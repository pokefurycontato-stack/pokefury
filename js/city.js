class CityScreen {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.assets = [];
        this.players = {};
        this.myPlayer = null;
        this.keys = {};
        this.tileSize = 64;
        this.running = false;
        this.channel = null;
        this.playerSkinUrl = '';
        this.playerSkinImg = null;
        this.moveProgress = 0;
        this.moveFrom = { x: 10, y: 10 };
        this.moveTo = { x: 10, y: 10 };
        this.moving = false;
        this.direction = 'down';
        this.moveCooldown = 0;

        this.bindEvents();
    }

    bindEvents() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            if (btn.dataset.screen === 'city') {
                btn.addEventListener('click', () => this.open());
            }
        });

        const closeBtn = document.getElementById('city-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', () => this.close());

        document.addEventListener('keydown', (e) => {
            if (!this.running) return;
            this.keys[e.key] = true;
        });
        document.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });
    }

    async open() {
        const game = window.pokefury;
        if (!game) {
            console.error('[City] No game instance found');
            return;
        }

        document.getElementById('city-screen').classList.remove('hidden');
        this.canvas = document.getElementById('city-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.playerSkinUrl = await this.getPlayerSkinUrl(game);
        if (this.playerSkinUrl) {
            this.playerSkinImg = new Image();
            this.playerSkinImg.src = this.playerSkinUrl;
        }

        await this.loadLayout();
        await this.registerPlayer();

        this.resizeCanvas();
        this.running = true;
        this.loop();

        window._cityResizeHandler = () => this.resizeCanvas();
        window.addEventListener('resize', window._cityResizeHandler);
    }

    close() {
        this.running = false;
        document.getElementById('city-screen').classList.add('hidden');
        this.unregisterPlayer();
        if (this.channel) {
            this.channel.unsubscribe();
            this.channel = null;
        }
        if (window._cityResizeHandler) {
            window.removeEventListener('resize', window._cityResizeHandler);
        }
    }

    async getPlayerSkinUrl(game) {
        try {
            const gender = game.playerGender === 'female' ? 'feminino' : 'masculino';
            const defaultUrl = `assets/perso_${gender}.webp`;

            if (game.currentCharacterId && window.db) {
                const { data } = await window.db.rpc('get_equipped_skin', {
                    p_character_id: game.currentCharacterId,
                    p_skin_type: 'player_skin'
                });
                if (data && data.length > 0 && data[0].sprite_url) {
                    return data[0].sprite_url;
                }
            }
            return defaultUrl;
        } catch (e) {
            return `assets/perso_masculino.webp`;
        }
    }

    resizeCanvas() {
        const wrap = document.getElementById('city-canvas-wrap');
        if (!wrap || !this.canvas) return;
        const rect = wrap.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
        }
    }

    async loadLayout() {
        try {
            const { data, error } = await window.db.from('city_layout').select('*').order('z_index');
            if (error) throw error;
            this.assets = (data || []).map(a => {
                const img = new Image();
                img.src = a.asset_url;
                return { ...a, _img: img };
            });
            console.log(`[City] Loaded ${this.assets.length} assets`);
        } catch (e) {
            console.warn('[City] Layout load error:', e.message);
            this.assets = [];
        }
    }

    async registerPlayer() {
        const user = window.db.auth?.getUser?.();
        const userId = user?.data?.user?.id;
        if (!userId) return;

        const game = window.pokefury;
        const charName = game?.playerName || 'Treinador';

        this.myPlayer = {
            user_id: userId,
            character_name: charName,
            skin_url: this.playerSkinUrl,
            grid_x: 10,
            grid_y: 10,
            direction: 'down'
        };
        this.moveFrom = { x: 10, y: 10 };
        this.moveTo = { x: 10, y: 10 };

        try {
            await window.db.from('city_players').upsert({
                user_id: userId,
                character_name: charName,
                skin_url: this.playerSkinUrl,
                grid_x: 10,
                grid_y: 10,
                direction: 'down'
            }, { onConflict: 'user_id' });
        } catch (e) {
            console.warn('[City] Register error:', e);
        }
    }

    unregisterPlayer() {
        const user = window.db.auth?.getUser?.();
        const userId = user?.data?.user?.id;
        if (userId) {
            window.db.from('city_players').delete().eq('user_id', userId).catch(() => {});
        }
    }

    subscribeRealtime() {
        if (this.channel) this.channel.unsubscribe();
        this.channel = window.db.channel('city-players-' + Date.now());
        this.channel.on('postgres_changes', { event: '*', schema: 'public', table: 'city_players' }, (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                const p = payload.new;
                if (p.user_id === this.myPlayer?.user_id) return;
                if (!this.players[p.user_id]) {
                    this.players[p.user_id] = { ...p, _skinImg: null };
                    if (p.skin_url) {
                        const img = new Image();
                        img.src = p.skin_url;
                        this.players[p.user_id]._skinImg = img;
                    }
                } else {
                    this.players[p.user_id].grid_x = p.grid_x;
                    this.players[p.user_id].grid_y = p.grid_y;
                    this.players[p.user_id].direction = p.direction;
                }
            } else if (payload.eventType === 'DELETE') {
                delete this.players[payload.old?.user_id];
            }
        }).subscribe();
    }

    handleInput() {
        if (!this.myPlayer || this.moving || this.moveCooldown > 0) return;

        let dx = 0, dy = 0, dir = null;
        if (this.keys['ArrowUp'] || this.keys['w'] || this.keys['W']) { dy = -1; dir = 'up'; }
        else if (this.keys['ArrowDown'] || this.keys['s'] || this.keys['S']) { dy = 1; dir = 'down'; }
        else if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) { dx = -1; dir = 'left'; }
        else if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) { dx = 1; dir = 'right'; }

        if (dir) {
            this.direction = dir;
            this.myPlayer.direction = dir;
            const nx = this.myPlayer.grid_x + dx;
            const ny = this.myPlayer.grid_y + dy;
            if (nx < 0 || nx > 50 || ny < 0 || ny > 50) return;

            this.moveFrom = { x: this.myPlayer.grid_x, y: this.myPlayer.grid_y };
            this.moveTo = { x: nx, y: ny };
            this.moving = true;
            this.moveProgress = 0;
        }
    }

    update() {
        if (this.moving) {
            this.moveProgress += 0.14;
            if (this.moveProgress >= 1) {
                this.moveProgress = 1;
                this.myPlayer.grid_x = this.moveTo.x;
                this.myPlayer.grid_y = this.moveTo.y;
                this.moving = false;
                this.moveCooldown = 3;

                document.getElementById('city-pos').textContent = `X: ${Math.round(this.myPlayer.grid_x)} Y: ${Math.round(this.myPlayer.grid_y)}`;
                this.syncPosition();
            } else {
                this.myPlayer.grid_x = this.moveFrom.x + (this.moveTo.x - this.moveFrom.x) * this.moveProgress;
                this.myPlayer.grid_y = this.moveFrom.y + (this.moveTo.y - this.moveFrom.y) * this.moveProgress;
            }
        }

        if (this.moveCooldown > 0) this.moveCooldown--;
        this.handleInput();
    }

    async syncPosition() {
        if (!this.myPlayer) return;
        try {
            await window.db.from('city_players').upsert({
                user_id: this.myPlayer.user_id,
                character_name: this.myPlayer.character_name,
                skin_url: this.myPlayer.skin_url,
                grid_x: this.myPlayer.grid_x,
                grid_y: this.myPlayer.grid_y,
                direction: this.myPlayer.direction
            }, { onConflict: 'user_id' });
        } catch (e) {}
    }

    loop() {
        if (!this.running) return;
        this.update();
        this.render();
        requestAnimationFrame(() => this.loop());
    }

    render() {
        if (!this.ctx || !this.canvas) return;
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        if (w === 0 || h === 0) return;

        ctx.clearRect(0, 0, w, h);

        const ts = this.tileSize;
        const px = this.myPlayer ? this.myPlayer.grid_x : 10;
        const py = this.myPlayer ? this.myPlayer.grid_y : 10;
        const camX = px * ts - w / 2 + ts / 2;
        const camY = py * ts - h / 2 + ts / 2;

        ctx.fillStyle = '#2d5a27';
        ctx.fillRect(0, 0, w, h);

        const startGx = Math.max(0, Math.floor(camX / ts) - 1);
        const startGy = Math.max(0, Math.floor(camY / ts) - 1);
        const endGx = Math.min(50, Math.ceil((camX + w) / ts) + 1);
        const endGy = Math.min(50, Math.ceil((camY + h) / ts) + 1);

        for (let gx = startGx; gx <= endGx; gx++) {
            for (let gy = startGy; gy <= endGy; gy++) {
                const sx = gx * ts - camX;
                const sy = gy * ts - camY;
                ctx.strokeStyle = 'rgba(255,255,255,0.06)';
                ctx.strokeRect(sx, sy, ts, ts);
            }
        }

        this.assets.forEach(a => {
            const ax = a.grid_x * ts - camX;
            const ay = a.grid_y * ts - camY;
            const aw = (a.width || 1) * ts;
            const ah = (a.height || 1) * ts;
            if (ax + aw < 0 || ax > w || ay + ah < 0 || ay > h) return;
            if (a._img && a._img.complete && a._img.naturalWidth) {
                ctx.save();
                if (a.rotation) {
                    ctx.translate(ax + aw / 2, ay + ah / 2);
                    ctx.rotate((a.rotation || 0) * Math.PI / 180);
                    ctx.drawImage(a._img, -aw / 2, -ah / 2, aw, ah);
                } else {
                    ctx.drawImage(a._img, ax, ay, aw, ah);
                }
                ctx.restore();
            }
        });

        const allPlayers = [];
        if (this.myPlayer) allPlayers.push({ ...this.myPlayer, _skinImg: this.playerSkinImg, isMe: true });
        Object.values(this.players).forEach(p => allPlayers.push({ ...p, isMe: false }));

        document.getElementById('city-player-count').textContent = `${allPlayers.length} jogador${allPlayers.length !== 1 ? 'es' : ''} online`;

        allPlayers.forEach(p => {
            const ppx = p.grid_x * ts - camX;
            const ppy = p.grid_y * ts - camY;

            if (ppx + ts < -50 || ppx > w + 50 || ppy + ts < -50 || ppy > h + 50) return;

            if (p._skinImg && p._skinImg.complete && p._skinImg.naturalWidth) {
                const imgW = p._skinImg.naturalWidth;
                const imgH = p._skinImg.naturalHeight;
                const isGrid = Math.abs(imgW - imgH) < 10 && imgW > 100;
                if (isGrid) {
                    const frameW = imgW / 4;
                    const frameH = imgH / 4;
                    const dirs = ['down', 'left', 'right', 'up'];
                    const dirIdx = dirs.indexOf(p.direction || 'down');
                    ctx.drawImage(p._skinImg,
                        0, dirIdx * frameH, frameW, frameH,
                        ppx, ppy, ts, ts
                    );
                } else {
                    ctx.drawImage(p._skinImg, ppx, ppy, ts, ts);
                }
            } else {
                ctx.fillStyle = p.isMe ? '#3498db' : '#e94560';
                ctx.fillRect(ppx + 8, ppy + 8, ts - 16, ts - 16);
            }

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur = 4;
            ctx.fillText(p.character_name || '?', ppx + ts / 2, ppy - 6);
            ctx.shadowBlur = 0;
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.cityScreen = new CityScreen();
});
