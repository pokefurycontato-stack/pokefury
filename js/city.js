class CityScreen {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.assets = [];
        this.players = {};
        this.myPlayer = null;
        this.camera = { x: 0, y: 0 };
        this.keys = {};
        this.moveSpeed = 2;
        this.tileSize = 64;
        this.running = false;
        this.channel = null;

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
        document.getElementById('city-screen').classList.remove('hidden');
        this.canvas = document.getElementById('city-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        this.running = true;
        await this.loadLayout();
        await this.registerPlayer();
        this.subscribeRealtime();
        this.loop();
    }

    close() {
        this.running = false;
        document.getElementById('city-screen').classList.add('hidden');
        this.unregisterPlayer();
        if (this.channel) {
            this.channel.unsubscribe();
            this.channel = null;
        }
    }

    resizeCanvas() {
        const wrap = document.getElementById('city-canvas-wrap');
        if (!wrap || !this.canvas) return;
        this.canvas.width = wrap.clientWidth;
        this.canvas.height = wrap.clientHeight;
    }

    async loadLayout() {
        try {
            const { data } = await window.db.from('city_layout').select('*').order('z_index');
            this.assets = (data || []).map(a => {
                const img = new Image();
                img.src = a.asset_url;
                return { ...a, _img: img };
            });
        } catch (e) {
            console.warn('[City] No layout found:', e.message);
            this.assets = [];
        }
    }

    async registerPlayer() {
        const user = window.db.auth?.getUser?.();
        const userId = user?.data?.user?.id;
        if (!userId) return;

        const charName = this.game?.currentCharacterName || 'Treinador';
        const overworld = this.game?.overworld2d;
        const skinUrl = overworld?.playerSprites?.down?.src || overworld?.playerSpriteFrames?.down?.[0]?.src || '';

        this.myPlayer = {
            user_id: userId,
            character_name: charName,
            skin_url: skinUrl,
            grid_x: 10,
            grid_y: 10,
            direction: 'down',
            _skinImg: null
        };

        if (skinUrl) {
            const img = new Image();
            img.src = skinUrl;
            this.myPlayer._skinImg = img;
        }

        try {
            await window.db.from('city_players').upsert({
                user_id: userId,
                character_name: charName,
                skin_url: skinUrl,
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
            window.db.from('city_players').delete().eq('user_id', userId);
        }
    }

    subscribeRealtime() {
        if (this.channel) this.channel.unsubscribe();
        this.channel = window.db.channel('city-players');
        this.channel.on('postgres_changes', { event: '*', schema: 'public', table: 'city_players' }, (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                const p = payload.new;
                if (p.user_id === this.myPlayer?.user_id) {
                    this.myPlayer.grid_x = p.grid_x;
                    this.myPlayer.grid_y = p.grid_y;
                    this.myPlayer.direction = p.direction;
                } else {
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
                }
            } else if (payload.eventType === 'DELETE') {
                delete this.players[payload.old.user_id];
            }
        }).subscribe();
    }

    async updateMyPosition() {
        if (!this.myPlayer) return;
        let moved = false;
        if (this.keys['ArrowUp'] || this.keys['w'] || this.keys['W']) { this.myPlayer.grid_y -= this.moveSpeed; this.myPlayer.direction = 'up'; moved = true; }
        if (this.keys['ArrowDown'] || this.keys['s'] || this.keys['S']) { this.myPlayer.grid_y += this.moveSpeed; this.myPlayer.direction = 'down'; moved = true; }
        if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) { this.myPlayer.grid_x -= this.moveSpeed; this.myPlayer.direction = 'left'; moved = true; }
        if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) { this.myPlayer.grid_x += this.moveSpeed; this.myPlayer.direction = 'right'; moved = true; }

        this.myPlayer.grid_x = Math.max(0, Math.min(this.myPlayer.grid_x, 50));
        this.myPlayer.grid_y = Math.max(0, Math.min(this.myPlayer.grid_y, 50));

        if (moved) {
            document.getElementById('city-pos').textContent = `X: ${Math.round(this.myPlayer.grid_x)} Y: ${Math.round(this.myPlayer.grid_y)}`;
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
    }

    loop() {
        if (!this.running) return;
        this.updateMyPosition();
        this.render();
        requestAnimationFrame(() => this.loop());
    }

    render() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        ctx.clearRect(0, 0, w, h);

        const ts = this.tileSize;
        const camX = this.myPlayer ? this.myPlayer.grid_x * ts - w / 2 : 0;
        const camY = this.myPlayer ? this.myPlayer.grid_y * ts - h / 2 : 0;

        ctx.fillStyle = '#2d5a27';
        ctx.fillRect(0, 0, w, h);

        for (let gx = 0; gx < 50; gx++) {
            for (let gy = 0; gy < 50; gy++) {
                const sx = gx * ts - camX;
                const sy = gy * ts - camY;
                if (sx + ts < 0 || sx > w || sy + ts < 0 || sy > h) continue;
                ctx.strokeStyle = 'rgba(255,255,255,0.05)';
                ctx.strokeRect(sx, sy, ts, ts);
            }
        }

        this.assets.forEach(a => {
            const ax = a.grid_x * ts - camX;
            const ay = a.grid_y * ts - camY;
            if (ax + a.width * ts < 0 || ax > w || ay + a.height * ts < 0 || ay > h) return;
            if (a._img && a._img.complete) {
                ctx.save();
                ctx.translate(ax + (a.width * ts) / 2, ay + (a.height * ts) / 2);
                ctx.rotate((a.rotation || 0) * Math.PI / 180);
                ctx.drawImage(a._img, -(a.width * ts) / 2, -(a.height * ts) / 2, a.width * ts, a.height * ts);
                ctx.restore();
            }
        });

        const allPlayers = [];
        if (this.myPlayer) allPlayers.push(this.myPlayer);
        Object.values(this.players).forEach(p => allPlayers.push(p));

        document.getElementById('city-player-count').textContent = `${allPlayers.length} jogador${allPlayers.length !== 1 ? 'es' : ''} online`;

        allPlayers.forEach(p => {
            const px = p.grid_x * ts - camX;
            const py = p.grid_y * ts - camY;

            if (p._skinImg && p._skinImg.complete && p._skinImg.naturalWidth) {
                const frameW = p._skinImg.naturalWidth / 4;
                const frameH = p._skinImg.naturalHeight / 4;
                const dirs = ['down', 'left', 'right', 'up'];
                const dirIdx = dirs.indexOf(p.direction || 'down');
                ctx.drawImage(p._skinImg,
                    0, dirIdx * frameH, frameW, frameH,
                    px + 2, py + 2, ts - 4, ts - 4
                );
            } else {
                ctx.fillStyle = p.user_id === this.myPlayer?.user_id ? '#3498db' : '#e94560';
                ctx.fillRect(px + 4, py + 4, ts - 8, ts - 8);
            }

            ctx.fillStyle = '#fff';
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 3;
            ctx.fillText(p.character_name || '?', px + ts / 2, py - 4);
            ctx.shadowBlur = 0;
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.cityScreen = new CityScreen();
});
