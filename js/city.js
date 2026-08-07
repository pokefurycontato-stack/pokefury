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
        this.playerSpriteFrames = null;
        this.playerX = 400;
        this.playerY = 400;
        this.playerFromX = 400;
        this.playerFromY = 400;
        this.playerDir = 'down';
        this.playerMoving = false;
        this.moveProgress = 0;
        this.playerSpeed = 60;
        this.playerSize = 48;
        this.cameraX = 400;
        this.cameraY = 400;
        this.collisionZones = [];
        this.npcs = [];
        this.nearestNpc = null;
        this.npcDialogueOpen = false;
        this.battleZones = [];
        this.currentBattleZone = null;

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
        const teleportCloseBtn = document.getElementById('city-teleport-close');
        if (teleportCloseBtn) teleportCloseBtn.addEventListener('click', () => this.closeTeleportMenu());
        document.addEventListener('keydown', (e) => {
            if (!this.running) return;
            this.keys[e.key] = true;
            if (e.key === 'p' || e.key === 'P') {
                window._cityDebug = !window._cityDebug;
                console.log('[City] Debug:', window._cityDebug ? 'ON' : 'OFF');
            }
            if (e.key === 'e' || e.key === 'E') {
                if (this.npcDialogueOpen) return;
                if (this.nearestNpc) {
                    this.showNpcDialogue(this.nearestNpc);
                } else if (this.nearestTeleport) {
                    this.showTeleportMenu(this.nearestTeleport);
                }
            }
            if (e.key === 'Escape') {
                if (this.npcDialogueOpen) {
                    this.closeNpcDialogue();
                }
            }
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
        await this.loadCollisionZones();
        await this.loadTeleports();
        await this.loadNpcs();
        await this.loadBattleZones();
        await this.registerPlayer();
        this.cameraX = this.playerX;
        this.cameraY = this.playerY;
        await this.loadExistingPlayers();
        this.subscribeRealtime();

        this.resizeCanvas();
        this.running = true;

        requestAnimationFrame(() => {
            this.resizeCanvas();
            this.loop();
        });

        window._cityResizeHandler = () => this.resizeCanvas();
        window.addEventListener('resize', window._cityResizeHandler);

        window._cityBeforeUnload = () => this.unregisterPlayer();
        window.addEventListener('beforeunload', window._cityBeforeUnload);
    }

    close() {
        this.running = false;
        window.cityModeActive = false;
        document.getElementById('city-screen').classList.add('hidden');
        this.closeNpcDialogue();
        this.unregisterPlayer();
        this.players = {};
        if (this.channel) {
            this.channel.unsubscribe();
            this.channel = null;
        }
        if (window._cityResizeHandler) {
            window.removeEventListener('resize', window._cityResizeHandler);
        }
        if (window._cityBeforeUnload) {
            window.removeEventListener('beforeunload', window._cityBeforeUnload);
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
            url = 'assets/perso_masculino.webp';
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        await new Promise(r => {
            img.onload = r;
            img.onerror = () => {
                img.src = 'assets/perso_masculino.webp';
                img.onload = r;
                img.onerror = r;
            };
        });

        this.playerSkinImg = img;
        this.playerSpriteFrames = null;

        const isSquare = img.naturalWidth > 50 && Math.abs(img.naturalWidth - img.naturalHeight) < 20;
        if (isSquare) {
            this.playerSpriteFrames = { frameW: img.naturalWidth / 4, frameH: img.naturalHeight / 4 };
            this.playerSize = img.naturalWidth > 512 ? 64 : 48;
            console.log('[City] Sprite sheet ready, frames:', this.playerSpriteFrames);
        } else {
            this.playerSize = 48;
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
            const { data, error } = await window.db.from('city_layout').select('*').order('z_index').limit(5000);
            if (error) throw error;
            const parseNumber = (value, fallback = 0) => {
                const n = parseFloat(value);
                return Number.isFinite(n) ? n : fallback;
            };
            const resolveAssetUrl = (row) => {
                if (row.asset_url && typeof row.asset_url === 'string' && row.asset_url.trim().length > 0) {
                    return row.asset_url.trim();
                }
                if (row.asset_id && typeof row.asset_id === 'string') {
                    return `assets/assetmap/${row.asset_id.replace(/\.png$/i, '')}.png`;
                }
                return null;
            };
            this.assets = (data || []).map(a => {
                const assetUrl = resolveAssetUrl(a);
                if (!assetUrl) {
                    console.warn('[City] Skipping layout row with missing asset_url and asset_id fallback:', a);
                    return null;
                }
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.src = assetUrl;
                img.onload = () => this.render();
                img.onerror = () => console.warn('[City] Failed asset load:', assetUrl, 'row id:', a.id, 'asset_id:', a.asset_id);
                const posX = parseNumber(a.pos_x, parseNumber(a.grid_x, 0) * 64);
                const posY = parseNumber(a.pos_y, parseNumber(a.grid_y, 0) * 64);
                const scale = parseNumber(a.scale, parseNumber(a.width, 1.0));
                return {
                    ...a,
                    asset_url: assetUrl,
                    pos_x: posX,
                    pos_y: posY,
                    scale: scale,
                    has_collision: a.has_collision === true || String(a.has_collision) === 'true',
                    collision_boxes: Array.isArray(a.collision_boxes) ? a.collision_boxes : [],
                    layer: parseNumber(a.layer, 0),
                    rotation: parseNumber(a.rotation, 0),
                    z_index: parseNumber(a.z_index, 0),
                    _img: img,
                    _mask: null
                };
            }).filter(Boolean);
            console.log(`[City] Loaded ${this.assets.length} assets`);
            this.assets.forEach(a => {
                if (a.has_collision && a._img) {
                    const checkReady = () => { if (a._img.complete && a._img.naturalWidth) a._ready = true; };
                    a._img.onload = checkReady;
                    if (a._img.complete && a._img.naturalWidth) checkReady();
                }
            });
        } catch (e) {
            console.warn('[City] Layout load error:', e.message);
            this.assets = [];
        }
    }

    async registerPlayer() {
        const user = await window.db.auth?.getUser?.();
        const userId = user?.data?.user?.id;

        const game = window.pokefury;
        const charName = game?.playerName || 'Treinador';
        const skinUrl = this.playerSkinImg?.src || '';

        this.authUserId = userId || 'local';

        this.myPlayer = {
            user_id: this.authUserId,
            character_name: charName,
            skin_url: skinUrl,
            pos_x: this.playerX,
            pos_y: this.playerY,
            direction: this.playerDir
        };

        if (!userId) { console.warn('[City] No userId, local only'); return; }

        // Limpa entradas antigas deste usuario e registra当前位置
        try {
            await window.db.from('city_players').delete().eq('user_id', userId);
            await window.db.from('city_players').insert({
                user_id: userId,
                character_name: charName,
                skin_url: skinUrl,
                pos_x: this.playerX,
                pos_y: this.playerY,
                direction: this.playerDir
            });
        } catch (e) {
            console.warn('[City] Register error:', e);
        }
    }

    unregisterPlayer() {
        if (this.authUserId && this.authUserId !== 'local') {
            window.db.from('city_players').delete().eq('user_id', this.authUserId).then(() => {}).catch(() => {});
        }
    }

    async loadExistingPlayers() {
        try {
            const { data, error } = await window.db.from('city_players').select('*');
            if (error) throw error;
            (data || []).forEach(p => {
                if (p.user_id === this.authUserId) return;
                this.players[p.user_id] = { ...p, _skinImg: null };
                if (p.skin_url) {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.src = p.skin_url;
                    this.players[p.user_id]._skinImg = img;
                }
            });
            console.log(`[City] Loaded ${Object.keys(this.players).length} existing players`);
        } catch (e) {
            console.warn('[City] loadExistingPlayers error:', e.message);
        }
    }

    subscribeRealtime() {
        if (this.channel) this.channel.unsubscribe();
        this.channel = window.db.channel('city-players');
        this.channel.on('postgres_changes', { event: '*', schema: 'public', table: 'city_players' }, (payload) => {
            console.log('[City] Realtime event:', payload.eventType, payload.new?.user_id || payload.old?.user_id);
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                const p = payload.new;
                if (p.user_id === this.authUserId) return;
                if (!this.players[p.user_id]) {
                    this.players[p.user_id] = {
                        ...p, _skinImg: null,
                        fromX: p.pos_x, fromY: p.pos_y,
                        moveProgress: 1
                    };
                    if (p.skin_url) {
                        const img = new Image();
                        img.crossOrigin = 'anonymous';
                        img.src = p.skin_url;
                        this.players[p.user_id]._skinImg = img;
                    }
                } else {
                    const existing = this.players[p.user_id];
                    existing.fromX = existing.pos_x ?? existing.fromX;
                    existing.fromY = existing.pos_y ?? existing.fromY;
                    existing.pos_x = p.pos_x;
                    existing.pos_y = p.pos_y;
                    existing.direction = p.direction;
                    existing.moveProgress = 0;
                }
            } else if (payload.eventType === 'DELETE') {
                delete this.players[payload.old?.user_id];
            }
        }).subscribe((status) => {
            console.log('[City] Realtime status:', status);
        });
    }

    async loadCollisionZones() {
        try {
            const { data, error } = await window.db.from('city_collision_zones').select('*').limit(5000);
            if (error) throw error;
            this.collisionZones = (data || []).map(z => ({
                pos_x: z.pos_x, pos_y: z.pos_y, width: z.width, height: z.height
            }));
            console.log(`[City] Loaded ${this.collisionZones.length} collision zones`);
        } catch (e) {
            console.warn('[City] Collision zones load error:', e.message);
        this.collisionZones = [];
        this.teleports = [];
        this.nearestTeleport = null;
        }
    }

    async loadTeleports() {
        try {
            const { data, error } = await window.db.from('city_teleports').select('*').limit(5000);
            if (error) throw error;
            this.teleports = (data || []).map(t => ({
                id: t.id, name: t.name,
                sign_x: t.sign_x, sign_y: t.sign_y,
                sign_width: t.sign_width, sign_height: t.sign_height,
                dest_x: t.dest_x, dest_y: t.dest_y
            }));
            console.log(`[City] Loaded ${this.teleports.length} teleports`);
        } catch (e) {
            console.warn('[City] Teleports load error:', e.message);
            this.teleports = [];
        }
    }

    async loadNpcs() {
        try {
            const { data, error } = await window.db.from('city_npcs').select('*').limit(5000);
            if (error) throw error;
            this.npcs = (data || []).map(n => ({
                id: n.id, npc_type: n.npc_type, name: n.name,
                pos_x: n.pos_x, pos_y: n.pos_y,
                width: n.width, height: n.height,
                interaction_width: n.interaction_width, interaction_height: n.interaction_height,
                sprite_url: n.sprite_url
            }));
            console.log(`[City] Loaded ${this.npcs.length} NPCs`, this.npcs);
        } catch (e) {
            console.warn('[City] NPCs load error:', e.message);
            this.npcs = [];
        }
    }

    async loadBattleZones() {
        try {
            const { data, error } = await window.db.from('city_battle_zones').select('*').limit(5000);
            if (error) throw error;
            this.battleZones = (data || []).map(z => ({
                id: z.id, zone_name: z.zone_name,
                pos_x: z.pos_x, pos_y: z.pos_y,
                width: z.width, height: z.height
            }));
            console.log(`[City] Loaded ${this.battleZones.length} battle zones`);
        } catch (e) {
            console.warn('[City] Battle zones load error:', e.message);
            this.battleZones = [];
        }
    }

    showTeleportMenu(sign) {
        const popup = document.getElementById('city-teleport-popup');
        const title = document.getElementById('city-teleport-title');
        const list = document.getElementById('city-teleport-list');
        if (!popup || !title || !list) return;

        title.textContent = sign.name;
        list.innerHTML = '';

        const otherTeleports = this.teleports.filter(t => t.id !== sign.id);
        if (otherTeleports.length === 0) {
            list.innerHTML = '<div style="color:rgba(255,255,255,0.4);text-align:center;font-size:12px;">Nenhum destino disponível</div>';
        } else {
            otherTeleports.forEach(t => {
                const btn = document.createElement('button');
                btn.textContent = t.name;
                btn.style.cssText = 'padding:10px 16px;border:1px solid #30363d;border-radius:8px;background:rgba(139,92,246,0.15);color:#fff;font-size:13px;cursor:pointer;transition:all 0.2s;text-align:left;';
                btn.onmouseenter = () => { btn.style.background = 'rgba(139,92,246,0.35)'; btn.style.borderColor = '#8b5cf6'; };
                btn.onmouseleave = () => { btn.style.background = 'rgba(139,92,246,0.15)'; btn.style.borderColor = '#30363d'; };
                btn.onclick = () => {
                    this.teleportPlayer(t);
                    this.closeTeleportMenu();
                };
                list.appendChild(btn);
            });
        }

        popup.classList.remove('hidden');
    }

    closeTeleportMenu() {
        const popup = document.getElementById('city-teleport-popup');
        if (popup) popup.classList.add('hidden');
    }

    showNpcDialogue(npc) {
        if (npc.npc_type !== 'region_selector') return;
        const overlay = document.getElementById('city-npc-dialogue-overlay');
        const msg = document.getElementById('city-npc-dialogue-msg');
        const simBtn = document.getElementById('city-npc-dialogue-sim');
        const naoBtn = document.getElementById('city-npc-dialogue-nao');
        if (!overlay || !msg || !simBtn || !naoBtn) return;

        const charName = this.myPlayer?.character_name || 'Treinador';
        msg.textContent = `Olá ${charName}, que tal dar uma volta em meu avião e explorar novas regiões?`;

        this.npcDialogueOpen = true;

        simBtn.onclick = () => {
            console.log('[City] NPC Sim clicked');
            this.closeNpcDialogue();
            this.openCityWorldMap();
        };
        naoBtn.onclick = () => {
            console.log('[City] NPC Nao clicked');
            this.closeNpcDialogue();
        };

        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';
    }

    closeNpcDialogue() {
        const overlay = document.getElementById('city-npc-dialogue-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.style.display = 'none';
        }
        this.npcDialogueOpen = false;
    }

    openCityWorldMap() {
        console.log('[City] openCityWorldMap called');
        const overlay = document.getElementById('city-worldmap-overlay');
        const container = document.getElementById('city-worldmap-hotspots');
        const label = document.getElementById('city-worldmap-region-label');
        console.log('[City] overlay:', !!overlay, 'container:', !!container, 'label:', !!label);
        if (!overlay || !container || !label) return;

        const game = window.pokefury;
        const currentRegion = game?.currentRegion?.name || '';
        label.textContent = currentRegion ? `📍 Voce esta em: ${currentRegion}` : '';

        container.innerHTML = '';
        if (typeof WORLD_MAP_REGIONS !== 'undefined') {
            WORLD_MAP_REGIONS.forEach(r => {
                const spot = document.createElement('div');
                spot.className = 'worldmap-spot' + (r.name === currentRegion ? ' current' : '');
                spot.style.left = `calc(${r.cx * 100}% - 28px)`;
                spot.style.top = `calc(${r.cy * 100}% - 28px)`;
                const dot = document.createElement('div');
                dot.className = 'pokeball-dot';
                spot.appendChild(dot);
                spot.title = r.name;
                spot.addEventListener('click', () => this.cityTravelToRegion(r.name));
                container.appendChild(spot);
            });
        }

        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';

        document.getElementById('city-worldmap-close-btn').onclick = () => this.closeCityWorldMap();
        overlay.onclick = (e) => { if (e.target === overlay) this.closeCityWorldMap(); };
    }

    closeCityWorldMap() {
        const overlay = document.getElementById('city-worldmap-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.style.display = 'none';
        }
    }

    async cityTravelToRegion(regionName) {
        const game = window.pokefury;
        if (!game || !game.regionManager || !game.currentCharacterId) return;

        const region = game.regionManager.regions.find(
            r => r.name.toLowerCase() === regionName.toLowerCase()
        );
        if (!region) {
            alert(`Regiao "${regionName}" nao encontrada no banco de dados.`);
            return;
        }

        if (game.currentRegion && game.currentRegion.id === region.id) {
            this.closeCityWorldMap();
            return;
        }

        const maps = await game.regionManager.loadRegionMaps(region.id);
        if (!maps || maps.length === 0) {
            alert(`Regiao "${regionName}" nao possui mapas.`);
            return;
        }

        const firstMap = maps[0];
        const userId = window.GameData?.userId;

        await game.regionManager.initPlayerProgress(
            game.currentCharacterId, region.id, firstMap.id, userId
        );

        game.currentRegion = region;
        game.currentRegionMaps = maps;
        game.currentMap = firstMap;

        this.closeCityWorldMap();
        this.close();

        if (game.overworld2d) {
            await game.overworld2d.setCurrentMap(firstMap);
        }

        game.showTransitionBanner(`Viajando para ${regionName}...`);
    }

    teleportPlayer(dest) {
        this.playerX = dest.dest_x + 32;
        this.playerY = dest.dest_y + 32;
        this.playerFromX = this.playerX;
        this.playerFromY = this.playerY;
        this.cameraX = this.playerX;
        this.cameraY = this.playerY;
        this.syncPosition();
        console.log(`[City] Teleported to ${dest.name}`);
    }

    checkCollision(nx, ny) {
        const ps = 32;
        const px = nx - ps / 2;
        const py = ny - ps / 2;
        for (const z of this.collisionZones) {
            if (px < z.pos_x + z.width && px + ps > z.pos_x && py < z.pos_y + z.height && py + ps > z.pos_y) return true;
        }
        return false;
    }

    handleInput() {
        if (this.playerMoving) return;
        let dx = 0, dy = 0;
        if (this.keys['ArrowUp'] || this.keys['w'] || this.keys['W']) { dy = -1; this.playerDir = 'up'; }
        else if (this.keys['ArrowDown'] || this.keys['s'] || this.keys['S']) { dy = 1; this.playerDir = 'down'; }
        else if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) { dx = -1; this.playerDir = 'left'; }
        else if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) { dx = 1; this.playerDir = 'right'; }

        if (dx || dy) {
            const nx = this.playerX + dx * this.playerSpeed;
            const ny = this.playerY + dy * this.playerSpeed;
            if (!this.checkCollision(nx, ny)) {
                this.playerFromX = this.playerX;
                this.playerFromY = this.playerY;
                this.playerX = nx;
                this.playerY = ny;
                this.playerMoving = true;
                this.moveProgress = 0;
            } else if (!this.checkCollision(nx, this.playerY)) {
                this.playerFromX = this.playerX;
                this.playerFromY = this.playerY;
                this.playerX = nx;
                this.playerMoving = true;
                this.moveProgress = 0;
            } else if (!this.checkCollision(this.playerX, ny)) {
                this.playerFromX = this.playerX;
                this.playerFromY = this.playerY;
                this.playerY = ny;
                this.playerMoving = true;
                this.moveProgress = 0;
            }
        }
    }

    update() {
        if (this.playerMoving) {
            this.moveProgress += 0.04;
            if (this.moveProgress >= 1) {
                this.moveProgress = 1;
                this.playerMoving = false;
                if (this.myPlayer) {
                    this.myPlayer.pos_x = this.playerX;
                    this.myPlayer.pos_y = this.playerY;
                    this.myPlayer.direction = this.playerDir;
                }
            }
        }

        if (!this.playerMoving) this.handleInput();

        Object.values(this.players).forEach(p => {
            if (p.moveProgress < 1) {
                p.moveProgress += 0.08;
                if (p.moveProgress > 1) p.moveProgress = 1;
            }
        });

        const targetX = this.playerX;
        const targetY = this.playerY;
        this.cameraX += (targetX - this.cameraX) * 0.15;
        this.cameraY += (targetY - this.cameraY) * 0.15;

        this.nearestTeleport = null;
        for (const t of this.teleports) {
            const cx = t.sign_x + t.sign_width / 2;
            const cy = t.sign_y + t.sign_height / 2;
            const dist = Math.sqrt((this.playerX - cx) ** 2 + (this.playerY - cy) ** 2);
            if (dist < 80) {
                this.nearestTeleport = t;
                break;
            }
        }

        this.nearestNpc = null;
        for (const n of this.npcs) {
            if (n.npc_type !== 'region_selector') continue;
            const cx = n.pos_x + n.width / 2;
            const cy = n.pos_y + n.height / 2;
            const dist = Math.sqrt((this.playerX - cx) ** 2 + (this.playerY - cy) ** 2);
            if (dist < 100) {
                this.nearestNpc = n;
                break;
            }
        }

        const prevZone = this.currentBattleZone;
        this.currentBattleZone = null;
        for (const z of this.battleZones) {
            if (this.playerX >= z.pos_x && this.playerX <= z.pos_x + z.width &&
                this.playerY >= z.pos_y && this.playerY <= z.pos_y + z.height) {
                this.currentBattleZone = z;
                break;
            }
        }
        if (this.currentBattleZone && this.currentBattleZone !== prevZone) {
            console.log(`[City] Entered battle zone: ${this.currentBattleZone.zone_name}`);
        } else if (!this.currentBattleZone && prevZone) {
            console.log(`[City] Left battle zone: ${prevZone.zone_name}`);
        }

        if (!this._lastSync) this._lastSync = 0;
        this._lastSync++;
        if (this._lastSync % 15 === 0) {
            this.syncPosition();
        }
    }

    async syncPosition() {
        if (!this.myPlayer || this.authUserId === 'local') return;
        try {
            await window.db.from('city_players').update({
                pos_x: this.playerX,
                pos_y: this.playerY,
                direction: this.playerDir
            }).eq('user_id', this.authUserId);
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

        const camX = this.cameraX - cw / 2;
        const camY = this.cameraY - ch / 2;

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

        this.teleports.forEach(t => {
            const sx = t.sign_x - camX;
            const sy = t.sign_y - camY;
            if (sx + t.sign_width < -50 || sx > cw + 50 || sy + t.sign_height < -50 || sy > ch + 50) return;
            ctx.fillStyle = 'rgba(139, 92, 246, 0.35)';
            ctx.strokeStyle = '#8b5cf6';
            ctx.lineWidth = 2;
            ctx.fillRect(sx, sy, t.sign_width, t.sign_height);
            ctx.strokeRect(sx, sy, t.sign_width, t.sign_height);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(t.name, sx + t.sign_width / 2, sy - 6);
        });

        this.npcs.forEach(n => {
            const sx = n.pos_x - camX;
            const sy = n.pos_y - camY;
            if (sx + n.width < -50 || sx > cw + 50 || sy + n.height < -50 || sy > ch + 50) return;
        });

        if (window._cityDebug) {
            ctx.fillStyle = 'rgba(231, 76, 60, 0.25)';
            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 2;
            for (const z of this.collisionZones) {
                const sx = z.pos_x - camX;
                const sy = z.pos_y - camY;
                ctx.fillRect(sx, sy, z.width, z.height);
                ctx.strokeRect(sx, sy, z.width, z.height);
            }
            const ps = 32;
            const ppx = this.playerX - camX - ps / 2;
            const ppy = this.playerY - camY - ps / 2;
            ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            ctx.fillRect(ppx, ppy, ps, ps);
            ctx.strokeRect(ppx, ppy, ps, ps);
            ctx.fillStyle = '#00ff00';
            ctx.font = 'bold 10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${ps}x${ps}`, ppx + ps / 2, ppy - 6);
        }

        if (this.nearestTeleport) {
            const t = this.nearestTeleport;
            const sx = t.sign_x - camX + t.sign_width / 2;
            const sy = t.sign_y - camY - 20;
            ctx.fillStyle = 'rgba(139, 92, 246, 0.9)';
            ctx.beginPath();
            ctx.roundRect(sx - 50, sy - 14, 100, 22, 6);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Aperte E', sx, sy + 1);
        }

        if (this.nearestNpc && !this.npcDialogueOpen) {
            const n = this.nearestNpc;
            const sx = n.pos_x - camX + n.width / 2;
            const sy = n.pos_y - camY - 20;
            ctx.fillStyle = 'rgba(245, 158, 11, 0.9)';
            ctx.beginPath();
            ctx.roundRect(sx - 50, sy - 14, 100, 22, 6);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.font = 'bold 11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Aperte E', sx, sy + 1);
        }

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
                isMe: false,
                fromX: p.fromX ?? p.pos_x,
                fromY: p.fromY ?? p.pos_y,
                moveProgress: p.moveProgress ?? 1
            });
        });

        const count = allPlayers.length;
        const countEl = document.getElementById('city-player-count');
        if (countEl) countEl.textContent = `${count} jogador${count !== 1 ? 'es' : ''} online`;

        allPlayers.forEach(p => {
            const ps = this.playerSize;
            let drawX, drawY;
            const mp = p.isMe ? this.moveProgress : (p.moveProgress || 1);
            const fx = p.isMe ? this.playerFromX : (p.fromX ?? p.pos_x);
            const fy = p.isMe ? this.playerFromY : (p.fromY ?? p.pos_y);
            const tx = p.isMe ? this.playerX : p.pos_x;
            const ty = p.isMe ? this.playerY : p.pos_y;
            drawX = (fx + (tx - fx) * mp) - camX - ps / 2;
            drawY = (fy + (ty - fy) * mp) - camY - ps / 2;

            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.ellipse(drawX + ps / 2, drawY + ps - 2, ps / 3, 4, 0, 0, Math.PI * 2);
            ctx.fill();

            const skinImg = p._skinImg;
            if (skinImg && skinImg.complete && skinImg.naturalWidth) {
                const imgW = skinImg.naturalWidth;
                const imgH = skinImg.naturalHeight;
                const isGrid = imgW > 100 && imgH > 100 && Math.abs(imgW - imgH) < 20;
                if (isGrid) {
                    const frameW = imgW / 4;
                    const frameH = imgH / 4;
                    const dirs = ['down', 'left', 'right', 'up'];
                    const row = dirs.indexOf(p.direction || 'down');
                    const pmp = p.isMe ? this.moveProgress : (p.moveProgress || 1);
                    const walkIdx = Math.min(Math.floor(pmp * 4), 3);
                    ctx.drawImage(skinImg, walkIdx * frameW, row * frameH, frameW, frameH, drawX, drawY, ps, ps);
                } else {
                    ctx.drawImage(skinImg, drawX, drawY, ps, ps);
                }
            } else {
                ctx.fillStyle = p.isMe ? '#3498db' : '#e94560';
                ctx.fillRect(drawX + 4, drawY + 4, ps - 8, ps - 8);
            }

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur = 4;
            ctx.fillText(p.character_name || '?', drawX + ps / 2, drawY - 8);
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
