class CityScreen {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.assets = [];
        this.players = {};
        this.myPlayer = null;
        this.keys = {};
        this.running = false;
        this.channel = null;
        this.playerSkinImg = null;
        this.playerX = 400;
        this.playerY = 400;
        this.playerDir = 'down';
        this.playerSpeed = 4;
        this.playerSize = 48;

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
        if (!game) return;

        document.getElementById('city-screen').classList.remove('hidden');
        window.cityModeActive = true;
        this.canvas = document.getElementById('city-canvas');
        this.ctx = this.canvas.getContext('2d');

        await this.loadPlayerSkin(game);
        await this.loadLayout();
        await this.registerPlayer();
        this.subscribeRealtime();

        this.resizeCanvas();
        this.running = true;

        requestAnimationFrame(() => {
            this.resizeCanvas();
            this.loop();
        });

        window._cityResizeHandler = () => this.resizeCanvas();
        window.addEventListener('resize', window._cityResizeHandler);
    }

    close() {
        this.running = false;
        window.cityModeActive = false;
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

    async loadPlayerSkin(game) {
        let url = null;
        try {
            const gender = game?.playerGender === 'female' ? 'feminino' : 'masculino';
            url = `assets/perso_${gender}.webp`;
            if (game?.currentCharacterId && window.db) {
                const { data, error } = await window.db.rpc('get_equipped_skin', {
                    p_character_id: game.currentCharacterId,
                    p_skin_type: 'player_skin'
                });
                if (!error && data && data.length > 0 && data[0].sprite_url) {
                    url = data[0].sprite_url;
                }
            }
        } catch (e) {
            console.warn('[City] Skin load error:', e);
            url = 'assets/perso_masculino.webp';
        }
        this.playerSkinImg = new Image();
        this.playerSkinImg.src = url;
        await new Promise(r => {
            this.playerSkinImg.onload = r;
            this.playerSkinImg.onerror = () => {
                console.warn('[City] Skin image failed, using fallback');
                this.playerSkinImg.src = 'assets/perso_masculino.webp';
                this.playerSkinImg.onload = r;
                this.playerSkinImg.onerror = r;
            };
        });
        console.log('[City] Player skin loaded:', url);
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
                img.onload = () => {};
                return {
                    ...a,
                    pos_x: a.pos_x ?? (a.grid_x * 64),
                    pos_y: a.pos_y ?? (a.grid_y * 64),
                    scale: a.scale ?? a.width ?? 1.0,
                    has_collision: a.has_collision || false,
                    collision_boxes: a.collision_boxes || [],
                    _img: img,
                    _mask: null
                };
            });
            console.log(`[City] Loaded ${this.assets.length} assets`);
            this.assets.forEach(a => {
                if (a.has_collision && a._img) {
                    const buildMask = () => { a._mask = this.createMask(a._img); };
                    a._img.onload = buildMask;
                    if (a._img.complete && a._img.naturalWidth) buildMask();
                }
            });
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
        const skinUrl = this.playerSkinImg?.src || '';

        this.myPlayer = {
            user_id: userId,
            character_name: charName,
            skin_url: skinUrl,
            pos_x: this.playerX,
            pos_y: this.playerY,
            direction: this.playerDir
        };

        try {
            await window.db.from('city_players').upsert({
                user_id: userId,
                character_name: charName,
                skin_url: skinUrl,
                pos_x: this.playerX,
                pos_y: this.playerY,
                direction: this.playerDir
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
                    this.players[p.user_id].pos_x = p.pos_x ?? p.grid_x * 64;
                    this.players[p.user_id].pos_y = p.pos_y ?? p.grid_y * 64;
                    this.players[p.user_id].direction = p.direction;
                }
            } else if (payload.eventType === 'DELETE') {
                delete this.players[payload.old?.user_id];
            }
        }).subscribe();
    }

    createMask(img) {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const cx = c.getContext('2d');
        cx.drawImage(img, 0, 0);
        const data = cx.getImageData(0, 0, c.width, c.height).data;
        const mask = new Uint8Array(c.width * c.height);
        for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3];
        return { mask, w: c.width, h: c.height };
    }

    checkCollision(nx, ny) {
        const ps = this.playerSize;
        const px = nx - ps / 2;
        const py = ny - ps / 2;
        for (const a of this.assets) {
            if (!a.has_collision) continue;
            const img = a._img;
            if (!img || !img.complete || !img.naturalWidth) continue;
            const sc = a.scale || 1;
            const aw = img.naturalWidth * sc;
            const ah = img.naturalHeight * sc;
            const boxes = a.collision_boxes;
            if (boxes && boxes.length > 0) {
                for (const b of boxes) {
                    const bx = a.pos_x + b.x * aw;
                    const by = a.pos_y + b.y * ah;
                    const bw = b.w * aw;
                    const bh = b.h * ah;
                    if (px < bx + bw && px + ps > bx && py < by + bh && py + ps > by) return true;
                }
            } else if (a._mask) {
                const m = a._mask;
                if (px + ps <= a.pos_x || px >= a.pos_x + aw) continue;
                if (py + ps <= a.pos_y || py >= a.pos_y + ah) continue;
                const step = Math.max(4, Math.floor(ps / 6));
                for (let sx = px + 2; sx < px + ps; sx += step) {
                    for (let sy = py + 2; sy < py + ps; sy += step) {
                        if (sx < a.pos_x || sx >= a.pos_x + aw || sy < a.pos_y || sy >= a.pos_y + ah) continue;
                        const ix = Math.floor((sx - a.pos_x) / sc);
                        const iy = Math.floor((sy - a.pos_y) / sc);
                        if (ix >= 0 && ix < m.w && iy >= 0 && iy < m.h && m.mask[iy * m.w + ix] > 128) return true;
                    }
                }
            } else {
                if (px < a.pos_x + aw && px + ps > a.pos_x && py < a.pos_y + ah && py + ps > a.pos_y) return true;
            }
        }
        return false;
    }

    handleInput() {
        let dx = 0, dy = 0;
        if (this.keys['ArrowUp'] || this.keys['w'] || this.keys['W']) { dy = -1; this.playerDir = 'up'; }
        else if (this.keys['ArrowDown'] || this.keys['s'] || this.keys['S']) { dy = 1; this.playerDir = 'down'; }
        else if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) { dx = -1; this.playerDir = 'left'; }
        else if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) { dx = 1; this.playerDir = 'right'; }

        if (dx || dy) {
            const len = Math.sqrt(dx * dx + dy * dy);
            const nx = this.playerX + (dx / len) * this.playerSpeed;
            const ny = this.playerY + (dy / len) * this.playerSpeed;
            if (!this.checkCollision(nx, ny)) {
                this.playerX = nx;
                this.playerY = ny;
            } else {
                // Tenta mover só no eixo X
                if (!this.checkCollision(nx, this.playerY)) {
                    this.playerX = nx;
                // Tenta mover só no eixo Y
                } else if (!this.checkCollision(this.playerX, ny)) {
                    this.playerY = ny;
                }
            }

            if (this.myPlayer) {
                this.myPlayer.pos_x = this.playerX;
                this.myPlayer.pos_y = this.playerY;
                this.myPlayer.direction = this.playerDir;
            }
        }
    }

    update() {
        this.handleInput();

        if (!this._lastSync) this._lastSync = 0;
        this._lastSync++;
        if (this._lastSync % 15 === 0) {
            this.syncPosition();
        }
    }

    async syncPosition() {
        if (!this.myPlayer) return;
        try {
            const user = window.db.auth?.getUser?.();
            const userId = user?.data?.user?.id;
            if (!userId) return;
            await window.db.from('city_players').upsert({
                user_id: userId,
                character_name: this.myPlayer.character_name,
                skin_url: this.myPlayer.skin_url,
                pos_x: this.playerX,
                pos_y: this.playerY,
                direction: this.playerDir
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
        const cw = this.canvas.width;
        const ch = this.canvas.height;
        if (cw === 0 || ch === 0) return;

        ctx.clearRect(0, 0, cw, ch);

        const camX = this.playerX - cw / 2;
        const camY = this.playerY - ch / 2;

        ctx.fillStyle = '#2d5a27';
        ctx.fillRect(0, 0, cw, ch);

        ctx.save();

        const gridSize = 64;
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        const gxStart = Math.floor(camX / gridSize) * gridSize;
        const gyStart = Math.floor(camY / gridSize) * gridSize;
        for (let gx = gxStart; gx < camX + cw + gridSize; gx += gridSize) {
            const sx = gx - camX;
            ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, ch); ctx.stroke();
        }
        for (let gy = gyStart; gy < camY + ch + gridSize; gy += gridSize) {
            const sy = gy - camY;
            ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(cw, sy); ctx.stroke();
        }

        const sorted = [...this.assets].sort((a, b) => (a.layer || 0) - (b.layer || 0) || (a.z_index || 0) - (b.z_index || 0));
        sorted.forEach(a => {
            const img = a._img;
            if (!img || !img.complete || !img.naturalWidth) return;

            const aw = img.naturalWidth * (a.scale || 1);
            const ah = img.naturalHeight * (a.scale || 1);
            const sx = a.pos_x - camX;
            const sy = a.pos_y - camY;

            if (sx + aw < -50 || sx > cw + 50 || sy + ah < -50 || sy > ch + 50) return;

            ctx.save();
            if (a.rotation) {
                ctx.translate(sx + aw / 2, sy + ah / 2);
                ctx.rotate((a.rotation || 0) * Math.PI / 180);
                ctx.drawImage(img, -aw / 2, -ah / 2, aw, ah);
            } else {
                ctx.drawImage(img, sx, sy, aw, ah);
            }
            ctx.restore();
        });

        const allPlayers = [];
        if (this.myPlayer) allPlayers.push({
            pos_x: this.playerX, pos_y: this.playerY, direction: this.playerDir,
            character_name: this.myPlayer.character_name,
            _skinImg: this.playerSkinImg, isMe: true
        });
        Object.values(this.players).forEach(p => {
            allPlayers.push({
                ...p,
                _skinImg: p._skinImg || null,
                isMe: false
            });
        });

        const count = allPlayers.length;
        const countEl = document.getElementById('city-player-count');
        if (countEl) countEl.textContent = `${count} jogador${count !== 1 ? 'es' : ''} online`;

        allPlayers.forEach(p => {
            const ps = this.playerSize;
            const sx = p.pos_x - camX - ps / 2;
            const sy = p.pos_y - camY - ps / 2;

            if (sx + ps < -50 || sx > cw + 50 || sy + ps < -50 || sy > ch + 50) return;

            const skinImg = p._skinImg;
            if (skinImg && skinImg.complete && skinImg.naturalWidth) {
                const imgW = skinImg.naturalWidth;
                const imgH = skinImg.naturalHeight;
                const isGrid = imgW > 100 && imgH > 100 && Math.abs(imgW - imgH) < 20;

                if (isGrid) {
                    const cols = 4, rows = 4;
                    const frameW = imgW / cols;
                    const frameH = imgH / rows;
                    const dirs = ['down', 'left', 'right', 'up'];
                    const row = dirs.indexOf(p.direction || 'down');
                    ctx.drawImage(skinImg,
                        0, row * frameH, frameW, frameH,
                        sx, sy, ps, ps
                    );
                } else {
                    ctx.drawImage(skinImg, sx, sy, ps, ps);
                }
            } else {
                ctx.fillStyle = p.isMe ? '#3498db' : '#e94560';
                ctx.fillRect(sx + 4, sy + 4, ps - 8, ps - 8);
            }

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur = 4;
            ctx.fillText(p.character_name || '?', p.pos_x - camX, sy - 8);
            ctx.shadowBlur = 0;
        });

        ctx.restore();

        const posEl = document.getElementById('city-pos');
        if (posEl) posEl.textContent = `X: ${Math.round(this.playerX)} Y: ${Math.round(this.playerY)}`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.cityScreen = new CityScreen();
});
