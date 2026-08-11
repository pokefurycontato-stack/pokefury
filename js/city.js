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
        this._loadedSpawn = false;
        this.playerFromX = 400;
        this.playerFromY = 400;
        this.playerDir = 'down';
        this.playerMoving = false;
        this.moveProgress = 1;
        this.playerSpeed = 60;
        this.playerSize = 48;
        this.cameraX = 400;
        this.cameraY = 400;
        this.collisionZones = [];
        this.teleports = [];
        this.nearestTeleport = null;
        this.npcs = [];
        this.nearestNpc = null;
        this.npcDialogueOpen = false;
        this.battleZones = [];
        this.currentBattleZone = null;
        this.spawnZones = [];
        this.currentSpawnZone = null;
        this.spawnZoneCooldown = 0;
        this.spawnPoints = [];
        this.wildPokemon = [];
        this.wildPokemonCooldown = 0;

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
            const tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            const cityGame = window.pokefury;
            if (cityGame && cityGame._pcOpen) {
                if (e.key === 'Escape') cityGame.closePC();
                return; // bloqueia input/movimento enquanto o PC está aberto
            }
            this.keys[e.key] = true;
            if (e.key === 'p' || e.key === 'P') {
                window._cityDebug = !window._cityDebug;
            }
            if (e.key === 'e' || e.key === 'E') {
                if (this.npcDialogueOpen) return;
                if (this.nearestNpc) {
                    this.handleNpcInteraction(this.nearestNpc);
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
            const tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            this.keys[e.key] = false;
        });
    }

    async open() {
        const game = window.pokefury;
        if (!game) return;
        if (this.running) return; // ja está aberta — evita re-spawn e loop duplicado

        document.getElementById('city-screen').classList.remove('hidden');
        window.cityModeActive = true;
        this.canvas = this.canvas || document.getElementById('city-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = true;
        if ('imageSmoothingQuality' in this.ctx) this.ctx.imageSmoothingQuality = 'high';

        // Cache para jogadores (nao-admin): reabre a cidade sem recarregar tudo.
        // Admin sempre recarrega (para ver alteracoes no city builder).
        if (!window.isAdmin && this._loaded) {
            const LS = window.LoadingScreen;
            if (LS) LS.show();
            await this.spawnVisiblePokemon();
            if (LS) LS.setProgress(40);
            await this.loadPlayerSpawn();
            await this.registerPlayer();
            this.cameraX = this.playerX;
            this.cameraY = this.playerY;
            await this.loadExistingPlayers();
            if (LS) LS.setProgress(80);
            this.subscribeRealtime();
            this._setupCityChat();
            this.resizeCanvas();
            this.running = true;
            requestAnimationFrame(() => { this.resizeCanvas(); this.loop(); });
            window._cityResizeHandler = () => this.resizeCanvas();
            window.addEventListener('resize', window._cityResizeHandler);
            window._cityBeforeUnload = () => this.unregisterPlayer();
            window.addEventListener('beforeunload', window._cityBeforeUnload);
            if (window.LoadingScreen) { window.LoadingScreen.setProgress(100); setTimeout(() => window.LoadingScreen.hide(), 250); }
            return;
        }

        // Carga inicial (e todas as aberturas para admin): loads independentes em paralelo
        const LS = window.LoadingScreen;
        if (LS) LS.show();

        try {
            const stages = [
                () => this.loadPlayerSkin(game),
                () => this.loadLayout(),
                () => this.loadCollisionZones(),
                () => this.loadTeleports(),
                () => this.loadNpcs(),
                () => this.loadBattleZones(),
                () => this.loadSpawnZones()
            ];
            const start = LS ? LS.getProgress() : 0;
            const span = Math.max(55 - start, 5);
            const step = span / stages.length;
            let done = 0;
            await Promise.all(stages.map(async (fn) => {
                try { await fn(); }
                finally { done++; if (LS) LS.setProgress(Math.min(60, Math.round(start + step * done))); }
            }));
            if (LS) LS.setProgress(60);
            await this.loadSpawnPoints(); // depende de spawnZones
            if (LS) LS.setProgress(72);
            await this.loadPlayerSpawn();
            await this.registerPlayer();
            if (LS) LS.setProgress(80);
            await this.loadExistingPlayers();
            if (LS) LS.setProgress(88);
        } catch (e) {
            console.error('[City] open load error:', e);
        }

        if (!window.isAdmin) this._loaded = true;

        this.subscribeRealtime();
        this._setupCityChat();
        if (LS) LS.setProgress(94);

        this.resizeCanvas();
        this.running = true;

        requestAnimationFrame(() => {
            this.resizeCanvas();
            this.loop();
        });
        if (LS) { LS.setProgress(100); setTimeout(() => LS.hide(), 350); }

        window._cityResizeHandler = () => this.resizeCanvas();
        window.addEventListener('resize', window._cityResizeHandler);

        window._cityBeforeUnload = () => this.unregisterPlayer();
        window.addEventListener('beforeunload', window._cityBeforeUnload);
    }

    _setupCityChat() {
        if (this._chat) return;
        const game = window.pokefury;
        if (!game || !window.Chat) return;
        const wrap = document.getElementById('city-chat-wrap');
        if (!wrap) return;
        const chatRef = game.chat;
        const userId = (chatRef && chatRef.userId) || window.GameData?.userId;
        const playerName = (chatRef && chatRef.playerName) || 'Treinador';
        if (!userId) return;
        try {
            this._chat = new window.Chat({ prefix: 'city-', container: wrap });
            this._chat.init(userId, playerName);
        } catch (e) {
        }
    }

    close() {
        if (!window.isAdmin) {
            // Jogadores nao-admin permanecem na cidade (overworld exclusivo para admin)
            return;
        }
        this.running = false;
        window.cityModeActive = false;
        document.getElementById('city-screen').classList.add('hidden');
        document.getElementById('city-premium-modal')?.classList.add('hidden');
        this.hideBattleZoneUI();
        this.closeNpcDialogue();
        const pcOverlay = document.getElementById('pc-overlay');
        if (pcOverlay) {
            if (pcOverlay.dataset.pcOrigParentId !== undefined) {
                const host = document.getElementById(pcOverlay.dataset.pcOrigParentId) || document.body;
                host.appendChild(pcOverlay);
                delete pcOverlay.dataset.pcOrigParentId;
            }
            if (pcOverlay.dataset.pcOrigZ !== undefined) {
                pcOverlay.style.zIndex = pcOverlay.dataset.pcOrigZ;
                delete pcOverlay.dataset.pcOrigZ;
            }
        }
        this.unregisterPlayer();
        this.players = {};
        if (this.wildPokemonLayer) {
            this.wildPokemonLayer.remove();
            this.wildPokemonLayer = null;
        }
        this.wildPokemon = [];
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

    openPremiumModal() {
        const game = window.pokefury;
        if (game && game.currentCharacterId && window.premiumStore) {
            window.premiumStore.setCurrentChar(game.currentCharacterId);
        }
        document.getElementById('city-premium-modal')?.classList.remove('hidden');
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
            const { data, error } = await window.db.from('city_layout').select('*').order('z_index');
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
                    return null;
                }
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.src = assetUrl;
                img.onload = () => this.render();
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
            this.assets.forEach(a => {
                if (a.has_collision && a._img) {
                    const checkReady = () => { if (a._img.complete && a._img.naturalWidth) a._ready = true; };
                    a._img.onload = checkReady;
                    if (a._img.complete && a._img.naturalWidth) checkReady();
                }
            });
        } catch (e) {
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

        if (!userId) { return; }

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
        } catch (e) {
        }
    }

    subscribeRealtime() {
        if (this.channel) this.channel.unsubscribe();
        this.channel = window.db.channel('city-players');
        this.channel.on('postgres_changes', { event: '*', schema: 'public', table: 'city_players' }, (payload) => {
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
        });
    }

    async loadCollisionZones() {
        try {
            const { data, error } = await window.db.from('city_collision_zones').select('*').limit(5000);
            if (error) throw error;
            this.collisionZones = (data || []).map(z => ({
                pos_x: z.pos_x, pos_y: z.pos_y, width: z.width, height: z.height
            }));
        } catch (e) {
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
                id: t.id, name: t.name, tag: t.tag || null,
                sign_x: t.sign_x, sign_y: t.sign_y,
                sign_width: t.sign_width, sign_height: t.sign_height,
                dest_x: t.dest_x, dest_y: t.dest_y
            }));
        } catch (e) {
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
            for (const n of this.npcs) {
                if (n.npc_type === 'nurse' || n.npc_type === 'professor' || n.npc_type === 'narrator' || n.npc_type === 'vendor' || n.npc_type === 'banker') {
                    n.originX = n.pos_x;
                    n.originY = n.pos_y;
                    n.direction = 'down';
                    n.walkFrame = 0;
                    n.patrolState = 'idle';
                    n._targetX = n.pos_x;
                    n._targetY = n.pos_y;
                    n._idleT = 1 + Math.random() * 2;
                    n._walkAnimT = 0;
                    let defaultSprite = 'assets/ferramentas/infermeirajoy.png';
                    if (n.npc_type === 'professor') defaultSprite = 'assets/ferramentas/professorcarvalho.png';
                    else if (n.npc_type === 'narrator') defaultSprite = 'assets/ferramentas/narradorpokemon.png';
                    else if (n.npc_type === 'banker') defaultSprite = 'assets/ferramentas/banqueira.png';
                    else if (n.npc_type === 'vendor') defaultSprite = 'assets/ferramentas/vendedor.png';
                    n._img = await this.loadNurseSprite(n.sprite_url || defaultSprite);
                }
            }
        } catch (e) {
            this.npcs = [];
        }
    }

    loadNurseSprite(url) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = url;
        });
    }

    updateNpcPatrols(dt) {
        for (const n of this.npcs) {
            if (n.npc_type !== 'nurse' && n.npc_type !== 'professor' && n.npc_type !== 'narrator' && n.npc_type !== 'vendor' && n.npc_type !== 'banker') continue;
            const step = 32;            // 1 tile = 1 passo
            const maxOffset = 2 * step; // até 2 passos para cada lado
            if (n.patrolState === 'idle') {
                n._idleT = (n._idleT || 0) - dt;
                n.direction = 'down';
                n.walkFrame = 0;
                if (n._idleT <= 0 && Math.random() < 0.04) {
                    const ox = Math.round((Math.random() * 2 - 1) * maxOffset);
                    const oy = Math.round((Math.random() * 2 - 1) * maxOffset);
                    n._targetX = n.originX + ox;
                    n._targetY = n.originY + oy;
                    n.patrolState = 'walk';
                }
            } else if (n.patrolState === 'walk') {
                this._walkNurseToward(n, n._targetX, n._targetY, 20 * dt, 'return');
            } else if (n.patrolState === 'return') {
                this._walkNurseToward(n, n.originX, n.originY, 24 * dt, 'idle');
            }
        }
    }

    _walkNurseToward(n, tx, ty, speed, nextState) {
        const dx = tx - n.pos_x;
        const dy = ty - n.pos_y;
        const dist = Math.hypot(dx, dy);
        if (dist > 1) {
            n.pos_x += (dx / dist) * Math.min(speed, dist);
            n.pos_y += (dy / dist) * Math.min(speed, dist);
            n.direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
            n._walkAnimT = (n._walkAnimT || 0) + 1;
            n.walkFrame = Math.floor((n._walkAnimT || 0) * 0.25) % 4;
        } else {
            if (nextState === 'idle') {
                n.pos_x = n.originX;
                n.pos_y = n.originY;
                n.direction = 'down';
                n.walkFrame = 0;
                n._idleT = 1 + Math.random() * 2;
            } else {
                n.pos_x = tx;
                n.pos_y = ty;
            }
            n.patrolState = nextState;
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
        } catch (e) {
            this.battleZones = [];
        }
    }

    async loadSpawnZones() {
        try {
            const { data, error } = await window.db.from('city_spawn_zones').select('*').limit(5000);
            if (error) throw error;
            this.spawnZones = (data || []).map(z => ({
                id: z.id,
                pos_x: z.pos_x, pos_y: z.pos_y,
                width: z.width, height: z.height,
                biome: z.biome || null
            }));
        } catch (e) {
            this.spawnZones = [];
        }
    }

    async loadSpawnPoints() {
        try {
            const { data, error } = await window.db.from('city_spawn_points').select('*').limit(5000);
            if (error) throw error;
            this.spawnPoints = (data || []).map(p => ({
                id: p.id,
                pos_x: p.pos_x, pos_y: p.pos_y
            }));
        } catch (e) {
            this.spawnPoints = [];
        }
        await this.spawnVisiblePokemon();
    }

    getSpawnZoneBiomeForPoint(point) {
        for (const z of this.spawnZones) {
            if (point.pos_x >= z.pos_x && point.pos_x <= z.pos_x + z.width &&
                point.pos_y >= z.pos_y && point.pos_y <= z.pos_y + z.height) {
                return z.biome || null;
            }
        }
        return null;
    }

    async resolveSpawnEncounters(biome) {
        const game = window.pokefury;
        if (!game || !game.regionManager) return [];
        let encounters = [];
        try {
            let mapId = null;
            if (biome) {
                const region = game.currentRegion;
                if (region) {
                    const maps = await game.regionManager.loadRegionMaps(region.id);
                    const biomeMap = (maps || []).find(m =>
                        String(m.name || '').trim().toLowerCase() === String(biome).trim().toLowerCase()
                    );
                    if (biomeMap) mapId = biomeMap.id;
                }
            }
            if (!mapId) mapId = game.currentMap?.id;
            if (mapId) encounters = await game.regionManager.loadMapEncounters(mapId);
        } catch (e) {
        }
        return encounters;
    }

    async spawnVisiblePokemon() {
        if (this.wildPokemonLayer) this.wildPokemonLayer.remove();
        this.wildPokemonLayer = null;
        this.wildPokemon = [];
        if (!this.spawnPoints || this.spawnPoints.length === 0) return;

        const wrap = document.getElementById('city-canvas-wrap');
        if (!wrap) return;
        const layer = document.createElement('div');
        layer.id = 'city-wild-pokemon-layer';
        layer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden;z-index:5;';
        wrap.appendChild(layer);
        this.wildPokemonLayer = layer;

        const game = window.pokefury;
        const charId = window.GameData?.currentCharacterId;

        for (const point of this.spawnPoints) {
            const biome = this.getSpawnZoneBiomeForPoint(point);
            if (!biome) continue;

            let encounter;
            let isShiny = false;
            let serverSprite = null;
            if (charId) {
                try {
                    const { data, error } = await window.db.rpc('roll_spawn_by_biome', {
                        p_character_id: charId,
                        p_biome: biome
                    });
                    if (!error && data?.success) {
                        encounter = {
                            pokemon_id: data.pokemon_id,
                            pokemon_name: data.pokemon_name,
                            sprite_url: data.sprite_url
                        };
                        isShiny = data.is_shiny || false;
                        serverSprite = data.sprite_url;
                    }
                } catch (e) {}
            }

            if (!encounter) {
                const encounters = await this.resolveSpawnEncounters(biome);
                if (!encounters || encounters.length === 0) continue;
                const currentIds = this.wildPokemon.map(p => p.encounter?.pokemon_id).filter(Boolean);
                encounter = this.chooseWeightedEncounter(encounters, currentIds);
                if (!encounter) continue;
                isShiny = (typeof getShinyChance === 'function') ? (Math.random() < (1 / getShinyChance())) : false;
            }

            const spriteUrl = serverSprite || ((window.PokeAPI && encounter.pokemon_id)
                ? (isShiny
                    ? `${window.PokeAPI.supabaseStorageUrl}/animated-front-shiny/${encounter.pokemon_id}.gif`
                    : window.PokeAPI.getAnimatedFrontUrl(encounter.pokemon_id))
                : (encounter.sprite_url || null));
            const el = document.createElement('img');
            el.style.cssText = 'position:absolute;pointer-events:none;image-rendering:pixelated;display:none;';
            if (spriteUrl) el.src = spriteUrl;
            layer.appendChild(el);
            this.wildPokemon.push({
                point,
                biome,
                encounter,
                spriteUrl,
                isShiny,
                _el: el,
                pos_x: point.pos_x,
                pos_y: point.pos_y,
                baseX: point.pos_x,
                baseY: point.pos_y,
                active: true,
                respawnTimer: 0
            });
        }
    }

    getWildPokemonSize(p) {
        const enc = p.encounter;
        let base = 64;
        if (enc.pokemon_id && window.PokeAPI && window.PokeAPI.pokemonCache) {
            const data = window.PokeAPI.pokemonCache[String(enc.pokemon_id)];
            if (data && data.height) base = 64 + Math.min(56, Math.round((data.height - 5) * 3));
        }
        return base;
    }

    async updateWildPokemon(dt) {
        if (this.wildPokemonCooldown > 0) this.wildPokemonCooldown -= dt;
        for (const p of this.wildPokemon) {
            if (!p.active) {
                if (p.respawnTimer > 0) {
                    p.respawnTimer -= dt;
                    if (p.respawnTimer <= 0) {
                        await this.reshuffleWildPokemon(p);
                    }
                }
                continue;
            }
            if (this.wildPokemonCooldown <= 0) {
                const pd = Math.hypot(this.playerX - p.pos_x, this.playerY - p.pos_y);
                if (pd < 38) {
                    this.wildPokemonCooldown = 1;
                    this.triggerVisiblePokemonBattle(p);
                }
            }
        }
    }

    async reshuffleWildPokemon(p) {
        const biome = p.biome || this.getSpawnZoneBiomeForPoint(p.point);
        const charId = window.GameData?.currentCharacterId;
        let encounter = null;
        let isShiny = false;
        let serverSprite = null;

        if (charId) {
            try {
                const { data, error } = await window.db.rpc('roll_spawn_by_biome', {
                    p_character_id: charId,
                    p_biome: biome
                });
                if (!error && data?.success) {
                    encounter = {
                        pokemon_id: data.pokemon_id,
                        pokemon_name: data.pokemon_name,
                        sprite_url: data.sprite_url
                    };
                    isShiny = data.is_shiny || false;
                    serverSprite = data.sprite_url;
                }
            } catch (e) {}
        }

        if (!encounter) {
            let encounters = [];
            try {
                encounters = await this.resolveSpawnEncounters(biome);
            } catch (e) {
            }
            const currentIds = this.wildPokemon.map(wp => wp.encounter?.pokemon_id).filter(Boolean);
            encounter = this.chooseWeightedEncounter(encounters, currentIds);
        }
        if (encounter) {
            p.encounter = encounter;
            if (!isShiny) {
                isShiny = (typeof getShinyChance === 'function') ? (Math.random() < (1 / getShinyChance())) : false;
            }
            const spriteUrl = serverSprite || ((window.PokeAPI && encounter.pokemon_id)
                ? (isShiny
                    ? `${window.PokeAPI.supabaseStorageUrl}/animated-front-shiny/${encounter.pokemon_id}.gif`
                    : window.PokeAPI.getAnimatedFrontUrl(encounter.pokemon_id))
                : (encounter.sprite_url || null));
            p.isShiny = isShiny;
            p.spriteUrl = spriteUrl;
            if (p._el && spriteUrl) p._el.src = spriteUrl;
        }
        p.active = true;
        if (p._el) p._el.style.display = 'block';
    }

    showBattleZoneUI() {
        const ui = document.getElementById('city-battle-ui');
        if (!ui) return;
        ui.classList.remove('hidden');
        const game = window.pokefury;
        if (game && game.updatePartyPanel) {
            game.updatePartyPanel(document.getElementById('city-party-list'));
        }
        const afk = game && game.afkManager;
        const startBtn = document.getElementById('city-afk-start-btn');
        const stopBtn = document.getElementById('city-afk-stop-btn');
        const statusEl = document.getElementById('city-afk-status');
        if (afk && startBtn && stopBtn && statusEl) {
            const running = !!afk.running;
            startBtn.style.display = running ? 'none' : 'block';
            stopBtn.style.display = running ? 'block' : 'none';
            stopBtn.classList.toggle('hidden', !running);
            statusEl.textContent = running ? 'Executando...' : 'Parado';
            statusEl.style.color = running ? '#4ecdc4' : 'rgba(255,255,255,0.4)';
        }
    }

    hideBattleZoneUI() {
        const ui = document.getElementById('city-battle-ui');
        if (ui) ui.classList.add('hidden');
    }

    async triggerVisiblePokemonBattle(p) {
        if (!p || !p.encounter) return;
        const game = window.pokefury;
        if (!game || game.state === 'battle' || game._battleStarting) return;
        const encounter = p.encounter;
        const pokemonId = encounter.pokemon_id || encounter.pokemon_name;
        const spriteUrl = p.spriteUrl || (window.PokeAPI ? window.PokeAPI.getAnimatedFrontUrl(encounter.pokemon_id) : null) || null;
        const level = this.getCityBattleLevel(encounter);
        game._cityBattle = true;
        game._currentBiome = p.biome || null;
        if (game.afkManager && game.afkManager._recordCityFight) {
            game.afkManager._recordCityFight(p.pos_x, p.pos_y);
        }
        await game.startBattleWithPokemon(pokemonId, level, spriteUrl, !!p.isShiny);
        if (game.state === 'battle') {
            p.active = false;
            p.respawnTimer = 20;
            if (p._el) p._el.style.display = 'none';
        }
    }

    renderWildPokemon() {
        const layer = this.wildPokemonLayer;
        if (!layer) return;
        const canvasRect = this.canvas.getBoundingClientRect();
        const wrapRect = layer.getBoundingClientRect();
        const scaleX = canvasRect.width / this.canvas.width;
        const scaleY = canvasRect.height / this.canvas.height;
        const offsetX = canvasRect.left - wrapRect.left;
        const offsetY = canvasRect.top - wrapRect.top;
        const camX = this.cameraX - this.canvas.width / 2;
        const camY = this.cameraY - this.canvas.height / 2;

        for (const p of this.wildPokemon) {
            if (!p.active) continue;
            const el = p._el;
            if (!el) continue;
            const sz = this.getWildPokemonSize(p);
            const sx = p.pos_x - camX;
            const sy = p.pos_y - camY;
            if (sx + sz < -50 || sx > this.canvas.width + 50 || sy + sz < -50 || sy > this.canvas.height + 50) {
                el.style.display = 'none';
                continue;
            }
            el.style.display = 'block';
            el.style.left = (offsetX + (sx - sz / 2) * scaleX) + 'px';
            el.style.top = (offsetY + (sy - sz) * scaleY) + 'px';
            el.style.width = (sz * scaleX) + 'px';
            el.style.height = (sz * scaleY) + 'px';
        }
    }

    async triggerCitySpawnBattle(zone) {
        if (!zone || !window.pokefury) return;
        const game = window.pokefury;
        if (game.state === 'battle' || game._battleStarting) return;
        if (this.spawnZoneCooldown > 0) return;

        let encounters = [];
        try {
            let mapId = null;
            if (zone.biome) {
                // Resolve o mapa do bioma na regiao atual do treinador
                const region = game.currentRegion;
                if (region && game.regionManager) {
                    const maps = await game.regionManager.loadRegionMaps(region.id);
                    const biomeMap = (maps || []).find(m =>
                        String(m.name || '').trim().toLowerCase() === String(zone.biome).trim().toLowerCase()
                    );
                    if (biomeMap) {
                        mapId = biomeMap.id;
                    } else {
                    }
                }
            }
            if (!mapId) {
                mapId = game.currentMap?.id;
            }
            if (mapId && game.regionManager) {
                encounters = await game.regionManager.loadMapEncounters(mapId);
            }
        } catch (e) {
        }

        if (!encounters || encounters.length === 0) {
            encounters = [
                { pokemon_name: 'Rattata', pokemon_id: 19, weight: 100, sprite_url: null, rarity: 'common' },
                { pokemon_name: 'Pidgey', pokemon_id: 16, weight: 80, sprite_url: null, rarity: 'common' },
                { pokemon_name: 'Zubat', pokemon_id: 41, weight: 60, sprite_url: null, rarity: 'common' }
            ];
        }

        const encounter = this.chooseWeightedEncounter(encounters);
        if (!encounter) return;

        const pokemonId = encounter.pokemon_id || encounter.pokemon_name;
        const isShiny = (typeof getShinyChance === 'function') ? (Math.random() < (1 / getShinyChance())) : false;
        const spriteUrl = (window.PokeAPI && encounter.pokemon_id)
            ? (isShiny
                ? `${window.PokeAPI.supabaseStorageUrl}/animated-front-shiny/${encounter.pokemon_id}.gif`
                : window.PokeAPI.getAnimatedFrontUrl(encounter.pokemon_id))
            : (encounter.sprite_url || null);
        const level = this.getCityBattleLevel(encounter);

        game._cityBattle = true;
        game._currentBiome = zone.biome || null;
        await game.startBattleWithPokemon(pokemonId, level, spriteUrl, isShiny);
        this.spawnZoneCooldown = 240;
    }

    chooseWeightedEncounter(encounters, currentPokemonIds) {
        if (!Array.isArray(encounters) || encounters.length === 0) return null;
        const TIER_WEIGHT = { common: 1, uncommon: 1, rare: 1, legendary: 0.00001, inicial: 0.00001 };
        let pool = encounters.filter(e => e && (e.weight == null || e.weight >= 0));
        if (pool.length === 0) return null;

        if (currentPokemonIds && currentPokemonIds.length > 0) {
            const counts = {};
            for (const id of currentPokemonIds) {
                counts[id] = (counts[id] || 0) + 1;
            }
            const filtered = pool.filter(e => (counts[e.pokemon_id] || 0) < 2);
            if (filtered.length > 0) pool = filtered;
        }

        const getWeight = (e) => {
            const base = Number.isFinite(e.weight) ? e.weight : 50;
            return base * (TIER_WEIGHT[e.rarity] ?? 1);
        };
        const total = pool.reduce((sum, e) => sum + getWeight(e), 0);
        let roll = Math.random() * total;
        for (const e of pool) {
            roll -= getWeight(e);
            if (roll <= 0) return e;
        }
        return pool[pool.length - 1];
    }

    getCityBattleLevel(encounter) {
        const game = window.pokefury;
        const highest = game?.playerTeam?.reduce((max, p) => Math.max(max, p?.level || 1), 1) || 1;
        const minLevel = Math.max(1, highest - 2);
        const maxLevel = Math.min(100, highest + 2);
        return Math.floor(minLevel + Math.random() * (maxLevel - minLevel + 1));
    }

    showTeleportMenu(sign) {
        const popup = document.getElementById('city-teleport-popup');
        const title = document.getElementById('city-teleport-title');
        const list = document.getElementById('city-teleport-list');
        if (!popup || !title || !list) return;

        title.textContent = sign.name;
        list.innerHTML = '';

        const isSafariSign = sign.tag === 'safari';
        const otherTeleports = this.teleports.filter(t => t.id !== sign.id && (isSafariSign || (!t.tag || t.tag !== 'safari')));
        if (otherTeleports.length === 0) {
            list.innerHTML = '<div style="color:rgba(255,255,255,0.4);text-align:center;font-size:12px;">Nenhum destino disponivel</div>';
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

    async loadPlayerSpawn() {
        try {
            const { data } = await window.db.from('city_player_spawn').select('pos_x, pos_y').limit(1).maybeSingle();
            if (data) {
                this.playerX = data.pos_x;
                this.playerY = data.pos_y;
                console.log('[City] Spawn loaded:', this.playerX, this.playerY);
            }
        } catch (e) { console.warn('[City] Spawn load failed:', e); }
    }

    showSafariTeleportMenu() {
        const popup = document.getElementById('city-teleport-popup');
        const title = document.getElementById('city-teleport-title');
        const list = document.getElementById('city-teleport-list');
        if (!popup || !title || !list) return;

        title.textContent = 'Gerente do Safari';
        list.innerHTML = '';

        const safariTeleports = this.teleports.filter(t => t.tag === 'safari');
        if (safariTeleports.length === 0) {
            list.innerHTML = '<div style="color:rgba(255,255,255,0.4);text-align:center;font-size:12px;">Nenhuma area de safari disponivel</div>';
        } else {
            safariTeleports.forEach(t => {
                const btn = document.createElement('button');
                btn.textContent = t.name;
                btn.style.cssText = 'padding:10px 16px;border:1px solid #30363d;border-radius:8px;background:rgba(34,197,94,0.15);color:#fff;font-size:13px;cursor:pointer;transition:all 0.2s;text-align:left;';
                btn.onmouseenter = () => { btn.style.background = 'rgba(34,197,94,0.35)'; btn.style.borderColor = '#22c55e'; };
                btn.onmouseleave = () => { btn.style.background = 'rgba(34,197,94,0.15)'; btn.style.borderColor = '#30363d'; };
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
        const okBtn = document.getElementById('city-npc-dialogue-ok');
        const icon = document.getElementById('city-npc-dialogue-icon');
        if (!overlay || !msg || !simBtn || !naoBtn) return;

        if (icon) icon.textContent = '✈️';
        if (okBtn) { okBtn.style.display = 'none'; okBtn.onclick = null; }
        simBtn.style.display = '';
        naoBtn.style.display = '';

        const charName = this.myPlayer?.character_name || 'Treinador';
        msg.textContent = `Olá ${charName}, que tal dar uma volta em meu avião e explorar novas regiões?`;

        this.npcDialogueOpen = true;

        simBtn.onclick = () => {
            this.closeNpcDialogue();
            this.openCityWorldMap();
        };
        naoBtn.onclick = () => {
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

    interactWithNurse(npc) {
        const game = window.pokefury;
        if (!game || !game.playerTeam) return;
        const needsHeal = game.playerTeam.some(p => p.currentHp < p.stats.hp || p.fainted || p.statusEffect);
        const msg = needsHeal
            ? 'Pronto seu time agora esta curado, volte sempre que precisar.'
            : 'Seu time já está com a saúde perfeita, volte sempre que precisar.';
        if (needsHeal && game.healAllPokemon) {
            game.healAllPokemon();
        }
        this.showNurseDialogue(msg);
    }

    interactWithPc(npc) {
        const game = window.pokefury;
        if (!game || game._pcOpen) return;
        this.ensurePcOverlayAboveCity();
        game.openPC();
    }

    ensurePcOverlayAboveCity() {
        const overlay = document.getElementById('pc-overlay');
        if (!overlay) return;
        // O #game-wrapper tem position:fixed (cria um stacking context proprio), entao o
        // pc-overlay interno nunca conseguiria ficar acima da #city-screen (z-index 800).
        // Movemos o overlay para o <body> (irmao da city-screen) e subimos seu z-index.
        if (overlay.parentElement && overlay.parentElement !== document.body) {
            if (overlay.dataset.pcOrigParentId === undefined) {
                overlay.dataset.pcOrigParentId = overlay.parentElement.id || 'body';
                overlay.dataset.pcOrigZ = overlay.style.zIndex || '20';
            }
            document.body.appendChild(overlay);
        }
        overlay.style.zIndex = '850';
    }

    interactWithNarrator(npc) {
        const overlay = document.getElementById('city-npc-dialogue-overlay');
        const msg = document.getElementById('city-npc-dialogue-msg');
        const simBtn = document.getElementById('city-npc-dialogue-sim');
        const naoBtn = document.getElementById('city-npc-dialogue-nao');
        const okBtn = document.getElementById('city-npc-dialogue-ok');
        const icon = document.getElementById('city-npc-dialogue-icon');
        if (!overlay || !msg || !simBtn || !naoBtn) return;

        if (icon) icon.textContent = '🎙️';
        if (okBtn) { okBtn.style.display = 'none'; okBtn.onclick = null; }
        simBtn.style.display = '';
        naoBtn.style.display = '';

        const charName = this.myPlayer?.character_name || 'Treinador';
        msg.textContent = `Olá ${charName}\nVejo que quer novas emoções com combate em tempo real contra outros treinadores, está preparado para ir à arena?`;

        this.npcDialogueOpen = true;

        simBtn.onclick = () => {
            this.closeNpcDialogue();
            this.openArenaFromNarrator();
        };
        naoBtn.onclick = () => {
            this.closeNpcDialogue();
        };

        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';
    }

    async openArenaFromNarrator() {
        const game = window.pokefury;
        if (!game || !game.openArena) return;

        const cityEl = document.getElementById('city-screen');
        const wrapper = document.getElementById('game-wrapper');
        const leftSide = document.getElementById('sidebar');
        const rightSide = document.getElementById('right-sidebar');
        const partyPanel = document.getElementById('party-panel');

        // Guarda o estado original para restaurar depois
        const prevWrapperDisplay = wrapper ? wrapper.style.display : '';
        const prevLeftDisplay = leftSide ? leftSide.style.display : '';
        const prevRightDisplay = rightSide ? rightSide.style.display : '';
        const partyParent = partyPanel ? partyPanel.parentElement : null;
        const partyNextSib = partyPanel ? partyPanel.nextSibling : null;

        // Esconde cidade e o wrapper (overworld + menus lateral/superior) para não piscar nem poluir a tela
        if (cityEl) cityEl.classList.add('hidden');
        window.cityModeActive = false;
        this.running = false;
        if (wrapper) wrapper.style.display = 'none';

        await game.openArena();

        const arenaEl = document.getElementById('arena-overlay');
        let partyBox = null;
        let observer = null;
        let restored = false;

        const restore = () => {
            if (restored) return;
            restored = true;
            if (observer) observer.disconnect();
            // Devolve a caixa TIME para a sidebar direita
            if (partyPanel) {
                if (partyBox && partyBox.contains(partyPanel)) partyPanel.remove();
                if (partyParent && partyPanel.parentNode !== partyParent) {
                    if (partyNextSib && partyNextSib.parentNode === partyParent) {
                        partyParent.insertBefore(partyPanel, partyNextSib);
                    } else {
                        partyParent.appendChild(partyPanel);
                    }
                }
            }
            if (partyBox) partyBox.remove();
            document.getElementById('arena-overlay')?.remove();
            if (wrapper) wrapper.style.display = prevWrapperDisplay;
            if (leftSide) leftSide.style.display = prevLeftDisplay;
            if (rightSide) rightSide.style.display = prevRightDisplay;
            this.running = true;
            window.cityModeActive = true;
            if (cityEl) cityEl.classList.remove('hidden');
            this.loop();
        };

        if (!arenaEl) {
            // A arena não chegou a abrir (ex.: sistema PVP indisponível) — restaura a cidade
            restore();
            return;
        }

        // Tela cheia da Arena, cobrindo todo o viewport (esconde menus lateral e superior)
        arenaEl.style.position = 'fixed';
        arenaEl.style.inset = '0';
        arenaEl.style.zIndex = '9996';
        arenaEl.style.width = '100vw';
        arenaEl.style.height = '100vh';
        document.body.appendChild(arenaEl);

        // Adiciona a caixa TIME (time do treinador) na lateral direita da arena
        if (partyPanel) {
            partyBox = document.createElement('div');
            partyBox.id = 'narrator-party-box';
            partyBox.style.cssText = 'position:fixed;top:0;right:0;width:280px;height:100%;z-index:9997;background:#0f1520;border-left:1px solid rgba(255,255,255,0.08);padding:14px;overflow-y:auto;box-sizing:border-box;';
            partyPanel.remove();
            partyBox.appendChild(partyPanel);
            document.body.appendChild(partyBox);
            if (typeof game.updatePartyPanel === 'function') game.updatePartyPanel();
            // Reserva espaço para a caixa TIME na arena central
            arenaEl.style.paddingRight = '280px';
            arenaEl.style.boxSizing = 'border-box';
        }

        // Fecha ao clicar no ✕ da arena
        const closeBtn = document.getElementById('arena-close');
        if (closeBtn) closeBtn.addEventListener('click', restore);

        // Segurança extra: se a arena for removida por qualquer outro caminho (ex.: aceitar desafio), restaura tudo
        observer = new MutationObserver(() => {
            if (!document.getElementById('arena-overlay')) restore();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    interactWithBanker(npc) {
        const overlay = document.getElementById('city-npc-dialogue-overlay');
        const msg = document.getElementById('city-npc-dialogue-msg');
        const simBtn = document.getElementById('city-npc-dialogue-sim');
        const naoBtn = document.getElementById('city-npc-dialogue-nao');
        const okBtn = document.getElementById('city-npc-dialogue-ok');
        const icon = document.getElementById('city-npc-dialogue-icon');
        if (!overlay || !msg || !simBtn || !naoBtn) return;

        if (icon) icon.textContent = '\uD83C\uDFE6';
        if (okBtn) { okBtn.style.display = 'none'; okBtn.onclick = null; }
        simBtn.style.display = '';
        naoBtn.style.display = '';

        const playerName = window.pokefury?.playerName || 'Treinador';
        msg.textContent = `Ola ${playerName}! Aqui voce consegue comprar e vender seus Pokemons para outros treinadores. Gostaria de comprar ou vender algum Pokemon no momento?`;

        this.npcDialogueOpen = true;
        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';

        simBtn.onclick = () => {
            this.closeNpcDialogue();
            if (window.Auction) window.Auction.open();
        };
        naoBtn.onclick = () => this.closeNpcDialogue();
    }

    interactWithVendor(npc) {
        const overlay = document.getElementById('city-npc-dialogue-overlay');
        const msg = document.getElementById('city-npc-dialogue-msg');
        const simBtn = document.getElementById('city-npc-dialogue-sim');
        const naoBtn = document.getElementById('city-npc-dialogue-nao');
        const okBtn = document.getElementById('city-npc-dialogue-ok');
        const icon = document.getElementById('city-npc-dialogue-icon');
        if (!overlay || !msg || !simBtn || !naoBtn) return;

        if (icon) icon.textContent = '🛒';
        if (okBtn) { okBtn.style.display = 'none'; okBtn.onclick = null; }
        simBtn.style.display = '';
        naoBtn.style.display = '';

        const charName = this.myPlayer?.character_name || 'Treinador';
        msg.textContent = `Olá ${charName}\nSeja bem vindo ao PokéMart, temos várias ofertas disponíveis que tal dar uma olhada?`;

        this.npcDialogueOpen = true;

        simBtn.onclick = () => {
            this.closeNpcDialogue();
            this.openPokemartFromVendor();
        };
        naoBtn.onclick = () => {
            this.closeNpcDialogue();
        };

        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';
    }

    openPokemartFromVendor() {
        if (!window.openPokeMart) return;
        const cityEl = document.getElementById('city-screen');
        const wrapper = document.getElementById('game-wrapper');
        const overlay = document.getElementById('pokemart-overlay');

        const prevWrapperDisplay = wrapper ? wrapper.style.display : '';
        const prevOverlayParent = overlay ? overlay.parentElement : null;
        const prevOverlayNext = overlay ? overlay.nextSibling : null;

        let observer = null;
        let restored = false;

        const restore = () => {
            if (restored) return;
            restored = true;
            if (observer) observer.disconnect();
            if (overlay) {
                overlay.classList.add('hidden');
                overlay.style.position = '';
                overlay.style.inset = '';
                overlay.style.zIndex = '';
                overlay.style.width = '';
                overlay.style.height = '';
                if (prevOverlayParent && overlay.parentElement !== prevOverlayParent) {
                    if (prevOverlayNext && prevOverlayNext.parentNode === prevOverlayParent) {
                        prevOverlayParent.insertBefore(overlay, prevOverlayNext);
                    } else {
                        prevOverlayParent.appendChild(overlay);
                    }
                }
            }
            if (wrapper) wrapper.style.display = prevWrapperDisplay;
            this.running = true;
            window.cityModeActive = true;
            if (cityEl) cityEl.classList.remove('hidden');
            this.loop();
        };

        // Esconde cidade e o wrapper (overworld + menus) durante o PokéMart
        if (cityEl) cityEl.classList.add('hidden');
        window.cityModeActive = false;
        this.running = false;
        if (wrapper) wrapper.style.display = 'none';

        // Move o PokéMart para o body em tela cheia (cobre todo o viewport)
        if (overlay) {
            overlay.style.position = 'fixed';
            overlay.style.inset = '0';
            overlay.style.zIndex = '9996';
            overlay.style.width = '100vw';
            overlay.style.height = '100vh';
            document.body.appendChild(overlay);
        }

        window.openPokeMart();

        // Quando o PokéMart for fechado (adiciona 'hidden'), restaura a cidade
        if (overlay) {
            observer = new MutationObserver(() => {
                if (overlay.classList.contains('hidden')) restore();
            });
            observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });
        }
    }

// Encontra o nome da area (teleporte) que corresponde ao bioma da quest,
    // procurando um teleporte cujo destino cai numa spawn zone com esse bioma.
    getAreaNameForBiome(biome) {
        if (!biome) return biome;
        const zone = (this.spawnZones || []).find(z =>
            z && z.biome && String(z.biome).trim().toLowerCase() === String(biome).trim().toLowerCase()
        );
        if (!zone) return biome;
        const tele = (this.teleports || []).find(t =>
            t && t.dest_x !== undefined &&
            t.dest_x >= zone.pos_x && t.dest_x <= zone.pos_x + (zone.width || 0) &&
            t.dest_y >= zone.pos_y && t.dest_y <= zone.pos_y + (zone.height || 0)
        );
        return (tele && tele.name) ? tele.name : biome;
    }

    async interactWithProfessor(npc) {
        const nid = npc.id;
        if (!nid) return;
        if (!window.ProfessorQuests || !window.db) {
            alert('Professor Carvalho: O sistema de quests ainda não está disponível.');
            return;
        }
        const userId = window.GameData?.userId || window.db.auth?.user()?.data?.user?.id;
        const characterId = window.GameData?.currentCharacterId || window.pokefury?.currentCharacterId;
        if (!userId || !characterId) return;

        const { data: activeQuests } = await window.db.from('player_professor_quests')
            .select('*')
            .eq('user_id', userId)
            .eq('character_id', characterId)
            .eq('npc_id', nid)
            .eq('status', 'active')
            .limit(1);

        if (activeQuests && activeQuests.length > 0) {
            const aq = activeQuests[0];
            const questData = await window.ProfessorQuests.loadProfessorQuest(aq.quest_id);
            if (!questData) return;
            const targetCount = questData.target_count || 1;
            let objectiveText = questData.title;
            let targetNpcName = questData.target_npc_name;
            if (!targetNpcName && questData.target_npc_id) {
                const { data: npcRow } = await window.db.from('city_npcs')
                    .select('name').eq('id', questData.target_npc_id).maybeSingle();
                targetNpcName = npcRow?.name || 'NPC';
            }
            const targetArea = this.getAreaNameForBiome(questData.target_biome) || questData.target_biome || '?';
            if (questData.quest_type === 'talk_to_npc') {
                objectiveText = `Falar com ${targetNpcName || 'NPC'}`;
            } else if (questData.quest_type === 'battles_biome') {
                objectiveText = `Caçar ${targetCount} pokemon em ${targetArea}`;
            } else if (questData.quest_type === 'catch_pokemon') {
                objectiveText = `Capturar ${targetCount} ${questData.target_pokemon_name || 'pokemon'}`;
            } else if (questData.quest_type === 'catch_pokemon_biome') {
                objectiveText = `Capturar ${targetCount} ${questData.target_pokemon_name || 'pokemon'} em ${targetArea}`;
            } else if (questData.quest_type === 'battles_total') {
                objectiveText = `Batalhar ${targetCount} vezes`;
            } else if (questData.quest_type === 'pvp_casual') {
                objectiveText = `Ganhar ${targetCount} batalhas PvP`;
            }
            const msg = `${questData.description || ''}\n\nObjetivo: ${objectiveText} (${aq.progress || 0}/${targetCount})`;
            this.showNpcDialogueWithMessage(npc, msg);
            return;
        }

        const allQuests = await window.ProfessorQuests.loadProfessorQuests(nid);
        const { data: completedQuests } = await window.db.from('player_professor_quests')
            .select('quest_id')
            .eq('user_id', userId)
            .eq('character_id', characterId)
            .eq('npc_id', nid)
            .eq('status', 'completed');
        const completedIds = new Set((completedQuests || []).map(c => c.quest_id));

        const nextQuest = allQuests.find(q => q.is_active && !completedIds.has(q.id));
        if (!nextQuest) {
            this.showNpcDialogueWithMessage(npc, 'Parabéns! Você completou todas as minhas quests!');
            return;
        }

        this.showProfessorQuestOffer(npc, nextQuest);
    }

    showNpcDialogueWithMessage(npc, msg) {
        const overlay = document.getElementById('city-npc-dialogue-overlay');
        const msgEl = document.getElementById('city-npc-dialogue-msg');
        const simBtn = document.getElementById('city-npc-dialogue-sim');
        const naoBtn = document.getElementById('city-npc-dialogue-nao');
        const okBtn = document.getElementById('city-npc-dialogue-ok');
        const icon = document.getElementById('city-npc-dialogue-icon');
        if (!overlay || !msgEl || !okBtn) return;
        msgEl.textContent = msg;
        if (icon) icon.textContent = npc.npc_type === 'nurse' ? '💉' : '💬';
        if (simBtn) { simBtn.style.display = 'none'; simBtn.onclick = null; }
        if (naoBtn) { naoBtn.style.display = 'none'; naoBtn.onclick = null; }
        okBtn.style.display = '';
        okBtn.onclick = () => this.closeNpcDialogue();
        this.npcDialogueOpen = true;
        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';
    }

    async showProfessorQuestOffer(npc, quest) {
        const overlay = document.getElementById('city-npc-dialogue-overlay');
        const msgEl = document.getElementById('city-npc-dialogue-msg');
        const simBtn = document.getElementById('city-npc-dialogue-sim');
        const naoBtn = document.getElementById('city-npc-dialogue-nao');
        const okBtn = document.getElementById('city-npc-dialogue-ok');
        const icon = document.getElementById('city-npc-dialogue-icon');
        if (!overlay || !msgEl || !simBtn || !naoBtn) return;
        const charName = this.myPlayer?.character_name || 'Treinador';
        let desc = (quest.description || quest.title || '').replace(/#Jogador/g, charName);
        if (quest.quest_type === 'talk_to_npc' && quest.target_npc_id) {
            let npcName = quest.target_npc_name;
            if (!npcName) {
                const { data: npcRow } = await window.db.from('city_npcs')
                    .select('name').eq('id', quest.target_npc_id).maybeSingle();
                npcName = npcRow?.name || 'NPC';
            }
            desc += `\n\nObjetivo: Falar com ${npcName}`;
        }
        msgEl.textContent = desc;
        if (icon) icon.textContent = '💬';
        if (okBtn) { okBtn.style.display = 'none'; okBtn.onclick = null; }
        simBtn.style.display = '';
        simBtn.textContent = 'Aceitar';
        naoBtn.style.display = '';
        naoBtn.textContent = 'Recusar';
        this.npcDialogueOpen = true;
        simBtn.onclick = async () => {
            this.closeNpcDialogue();
            const userId = window.GameData?.userId || window.db.auth?.user()?.data?.user?.id;
            const characterId = window.GameData?.currentCharacterId || this.myPlayer?.id;
            if (!userId || !characterId) return;
            await window.db.from('player_professor_quests').insert({
                user_id: userId, character_id: characterId,
                npc_id: npc.id, quest_id: quest.id,
                status: 'active', progress: 0
            });
            if (window.pokefury?.showToast) window.pokefury.showToast('Quest aceita!', 'success');
        };
        naoBtn.onclick = () => this.closeNpcDialogue();
        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';
    }

    async handleNpcInteraction(npc) {
        if (npc.npc_type === 'professor') {
            return this.interactWithProfessor(npc);
        }
        if (npc.npc_type === 'nurse') {
            const questDialogue = await this.checkNpcQuestDialogue(npc);
            if (questDialogue) return this.showQuestDialogue(npc, questDialogue);
            return this.interactWithNurse(npc);
        }
        if (npc.npc_type === 'narrator') {
            return this.interactWithNarrator(npc);
        }
        if (npc.npc_type === 'vendor') {
            return this.interactWithVendor(npc);
        }
        if (npc.npc_type === 'banker') {
            return this.interactWithBanker(npc);
        }
        if (npc.npc_type === 'gerente_safari') {
            return this.showSafariTeleportMenu();
        }
        if (npc.npc_type === 'pc') {
            return this.interactWithPc(npc);
        }
        const questDialogue = await this.checkNpcQuestDialogue(npc);
        if (questDialogue) return this.showQuestDialogue(npc, questDialogue);
        this.showNpcDialogue(npc);
    }

    async checkNpcQuestDialogue(npc) {
        if (!window.db) return null;
        try {
            const charId = window.GameData?.currentCharacterId;
            const userId = window.GameData?.userId || this.myPlayer?.user_id;
            if (!charId || !userId) { console.error('[Quest] no charId/userId', { charId, userId }); return null; }
            const { data: activeQuests } = await window.db.from('player_professor_quests')
                .select('quest_id, progress, status')
                .eq('character_id', charId)
                .eq('user_id', userId)
                .eq('status', 'active');
            if (!activeQuests || activeQuests.length === 0) return null;
            for (const aq of activeQuests) {
                const { data: quest } = await window.db.from('city_professor_quests')
                    .select('*')
                    .eq('id', aq.quest_id)
                    .maybeSingle();
                if (!quest) continue;
                if (quest.quest_type === 'talk_to_npc' && quest.target_npc_id === npc.id && quest.dialogue_text) {
                    return { quest, playerProgress: aq };
                }
            }
        } catch (e) {
        }
        return null;
    }

    showQuestDialogue(npc, { quest, playerProgress }) {
        const overlay = document.getElementById('city-npc-dialogue-overlay');
        const msgEl = document.getElementById('city-npc-dialogue-msg');
        const simBtn = document.getElementById('city-npc-dialogue-sim');
        const naoBtn = document.getElementById('city-npc-dialogue-nao');
        const okBtn = document.getElementById('city-npc-dialogue-ok');
        const icon = document.getElementById('city-npc-dialogue-icon');
        if (!overlay || !msgEl || !okBtn) return;
        const charName = this.myPlayer?.character_name || 'Treinador';
        const dialogue = quest.dialogue_text.replace(/#Jogador/g, charName);
        msgEl.textContent = dialogue;
        if (icon) icon.textContent = npc.npc_type === 'nurse' ? '💉' : '💬';
        if (simBtn) { simBtn.style.display = 'none'; simBtn.onclick = null; }
        if (naoBtn) { naoBtn.style.display = 'none'; naoBtn.onclick = null; }
        okBtn.style.display = '';
        okBtn.onclick = async () => {
            this.closeNpcDialogue();
            if (playerProgress.status === 'active') {
                const newProgress = (playerProgress.progress || 0) + 1;
                const questData = await window.ProfessorQuests.loadProfessorQuest(quest.id);
                const targetCount = questData?.target_count || 1;
                if (newProgress >= targetCount) {
                    await window.db.from('player_professor_quests')
                        .update({ status: 'completed', progress: newProgress, updated_at: new Date().toISOString() })
                        .eq('quest_id', quest.id)
                        .eq('character_id', window.GameData?.currentCharacterId);
                    if (window.ProfessorQuests && typeof window.ProfessorQuests.grantQuestRewards === 'function') {
                        await window.ProfessorQuests.grantQuestRewards(quest.id, this.myPlayer);
                    }
                    if (window.pokefury?.showToast) window.pokefury.showToast('Quest completa!', 'success');
                } else {
                    await window.db.from('player_professor_quests')
                        .update({ progress: newProgress, updated_at: new Date().toISOString() })
                        .eq('quest_id', quest.id)
                        .eq('character_id', window.GameData?.currentCharacterId);
                }
            }
        };
        this.npcDialogueOpen = true;
        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';
    }

    showNurseDialogue(msg) {
        const overlay = document.getElementById('city-npc-dialogue-overlay');
        const msgEl = document.getElementById('city-npc-dialogue-msg');
        const simBtn = document.getElementById('city-npc-dialogue-sim');
        const naoBtn = document.getElementById('city-npc-dialogue-nao');
        const okBtn = document.getElementById('city-npc-dialogue-ok');
        const icon = document.getElementById('city-npc-dialogue-icon');
        if (!overlay || !msgEl || !okBtn) return;
        msgEl.textContent = msg || '';
        if (icon) icon.textContent = '💉';
        if (simBtn) { simBtn.style.display = 'none'; simBtn.onclick = null; }
        if (naoBtn) { naoBtn.style.display = 'none'; naoBtn.onclick = null; }
        okBtn.style.display = '';
        okBtn.onclick = () => this.closeNpcDialogue();
        this.npcDialogueOpen = true;
        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';
    }

    openCityWorldMap() {
        const overlay = document.getElementById('city-worldmap-overlay');
        const container = document.getElementById('city-worldmap-hotspots');
        const label = document.getElementById('city-worldmap-region-label');
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
    }

    teleportToCityPokemonCenter() {
        const t = this.teleports.find(tp => {
            const name = String(tp.name || '').toLowerCase();
            return name.includes('centro') || name.includes('pokemon center') || name.includes('pokémon center') || name.includes('pokecenter');
        });
        const game = window.pokefury;
        if (!t) {
            if (game && game.showTransitionBanner) game.showTransitionBanner('Você foi derrotado! Vá até a Enfermeira Joy para curar seu time.');
            return;
        }
        this.teleportPlayer(t);
        if (game && game.showTransitionBanner) game.showTransitionBanner('Você foi enviado ao Centro Pokemon...');
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

    findPath(startX, startY, endX, endY) {
        const STEP = this.playerSpeed;
        const maxSteps = 1500;
        const toKey = (x, y) => `${Math.round(x)},${Math.round(y)}`;

        if (Math.abs(startX - endX) < STEP && Math.abs(startY - endY) < STEP) return null;

        const queue = [{ x: startX, y: startY, path: [] }];
        const visited = new Set();
        visited.add(toKey(startX, startY));
        const dirs = [
            { dx: 0, dy: -STEP, dir: 'ArrowUp' },
            { dx: 0, dy: STEP, dir: 'ArrowDown' },
            { dx: -STEP, dy: 0, dir: 'ArrowLeft' },
            { dx: STEP, dy: 0, dir: 'ArrowRight' }
        ];
        let checked = 0;

        while (queue.length > 0 && checked < maxSteps) {
            const cur = queue.shift();
            checked++;
            for (const d of dirs) {
                const nx = cur.x + d.dx;
                const ny = cur.y + d.dy;
                const key = toKey(nx, ny);
                if (visited.has(key)) continue;
                if (this.checkCollision(nx, ny)) continue;
                const distToTarget = Math.hypot(nx - endX, ny - endY);
                if (distToTarget < STEP) return [...cur.path, d.dir];
                visited.add(key);
                queue.push({ x: nx, y: ny, path: [...cur.path, d.dir] });
            }
        }
        return null;
    }

    getNextDirectionToTarget(targetX, targetY) {
        const path = this.findPath(this.playerX, this.playerY, targetX, targetY);
        return path && path.length > 0 ? path[0] : null;
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
                this.syncPosition();
            } else if (!this.checkCollision(nx, this.playerY)) {
                this.playerFromX = this.playerX;
                this.playerFromY = this.playerY;
                this.playerX = nx;
                this.playerMoving = true;
                this.moveProgress = 0;
                this.syncPosition();
            } else if (!this.checkCollision(this.playerX, ny)) {
                this.playerFromX = this.playerX;
                this.playerFromY = this.playerY;
                this.playerY = ny;
                this.playerMoving = true;
                this.moveProgress = 0;
                this.syncPosition();
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
                this.syncPosition();
            }
        }

        if (!this.playerMoving) this.handleInput();

        Object.values(this.players).forEach(p => {
            if (p.moveProgress < 1) {
                p.moveProgress += 0.15;
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
            if (n.npc_type !== 'region_selector' && n.npc_type !== 'nurse' && n.npc_type !== 'professor'
                && n.npc_type !== 'narrator' && n.npc_type !== 'vendor' && n.npc_type !== 'pc'
                && n.npc_type !== 'banker' && n.npc_type !== 'gerente_safari') continue;
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
            this.showBattleZoneUI();
        } else if (!this.currentBattleZone && prevZone) {
            this.hideBattleZoneUI();
        }

        const prevSpawn = this.currentSpawnZone;
        this.currentSpawnZone = null;
        for (const z of this.spawnZones) {
            if (this.playerX >= z.pos_x && this.playerX <= z.pos_x + z.width &&
                this.playerY >= z.pos_y && this.playerY <= z.pos_y + z.height) {
                this.currentSpawnZone = z;
                break;
            }
        }
        if (this.currentSpawnZone && this.currentSpawnZone !== prevSpawn) {
        }

        if (!this._lastSync) this._lastSync = 0;
        this._lastSync++;

        this.updateWildPokemon(0.016);
        this.updateNpcPatrols(0.016);
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

        this.renderWildPokemon();

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

        if (this.spawnZones.length > 0) {
            this.spawnZones.forEach((z, i) => {
                const sx = z.pos_x - camX;
                const sy = z.pos_y - camY;
                if (sx + z.width < -50 || sx > cw + 50 || sy + z.height < -50 || sy > ch + 50) return;
                ctx.fillStyle = 'rgba(34, 197, 94, 0.12)';
                ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)';
                ctx.lineWidth = 2;
                ctx.fillRect(sx, sy, z.width, z.height);
                ctx.strokeRect(sx, sy, z.width, z.height);
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 10px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(z.biome ? z.biome : 'Spawn', sx + z.width / 2, sy - 6);
            });
        }

        this.npcs.forEach(n => {
            if (n.npc_type !== 'nurse' && n.npc_type !== 'professor' && n.npc_type !== 'narrator' && n.npc_type !== 'vendor' && n.npc_type !== 'banker') return;
            const sx = n.pos_x - camX;
            const sy = n.pos_y - camY;
            const ps = Math.round((n.width || 48) * 1.2);
            if (sx + (n.width || 64) < -50 || sx > cw + 50 || sy + (n.height || 64) < -50 || sy > ch + 50) return;

            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.ellipse(sx + ps / 2, sy + ps - 2, ps / 3, 4, 0, 0, Math.PI * 2);
            ctx.fill();

            const img = n._img;
            if (img && img.complete && img.naturalWidth) {
                const imgW = img.naturalWidth;
                const imgH = img.naturalHeight;
                const isGrid = imgW > 100 && imgH > 100 && Math.abs(imgW - imgH) < 20;
                if (isGrid) {
                    const cols = 4;
                    const rows = 4;
                    const frameW = Math.floor(imgW / cols);
                    const frameH = Math.floor(imgH / rows);
                    const offsetX = Math.floor((imgW - frameW * cols) / 2);
                    const offsetY = Math.floor((imgH - frameH * rows) / 2);
                    const dirs = ['down', 'left', 'right', 'up'];
                    const dirIdx = Math.max(0, dirs.indexOf(n.direction || 'down'));
                    const walkIdx = Math.min(3, n.walkFrame || 0);
                    let drawY = sy;
                    let clipBottom = 0;
                    if (n.npc_type === 'professor') {
                        if (dirIdx === 1) { drawY = sy + Math.round(ps * 0.12); clipBottom = Math.round(ps * 0.06); }
                        else if (dirIdx === 2) { drawY = sy + Math.round(ps * 0.16); clipBottom = Math.round(ps * 0.08); }
                        else if (dirIdx === 3) { drawY = sy + Math.round(ps * 0.15); }
                    }
                    if (clipBottom > 0) {
                        ctx.save();
                        ctx.beginPath();
                        ctx.rect(sx - 1, drawY - 1, ps + 2, ps + 1 - clipBottom);
                        ctx.clip();
                    }
                    ctx.drawImage(img, offsetX + walkIdx * frameW, offsetY + dirIdx * frameH, frameW, frameH, sx, drawY, ps, ps);
                    if (clipBottom > 0) ctx.restore();
                } else {
                    ctx.drawImage(img, sx, sy, ps, ps);
                }
            } else {
                ctx.fillStyle = n.npc_type === 'professor' ? '#ffd54f' : (n.npc_type === 'narrator' ? '#f59e0b' : (n.npc_type === 'vendor' ? '#2f855a' : (n.npc_type === 'banker' ? '#8b5cf6' : '#ff8fab')));
                ctx.fillRect(sx + 4, sy + 4, ps - 8, ps - 8);
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 11px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(n.name || (n.npc_type === 'professor' ? 'Carvalho' : (n.npc_type === 'narrator' ? 'Narrador' : (n.npc_type === 'vendor' ? 'Vendedor' : (n.npc_type === 'banker' ? 'Banqueira' : 'Joy')))), sx + ps / 2, sy - 6);
            }
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
            const label = (n.npc_type === 'nurse' || n.npc_type === 'narrator' || n.npc_type === 'vendor' || n.npc_type === 'pc' || n.npc_type === 'banker') ? 'Aperte E para interagir' : 'Aperte E';
            const boxW = (n.npc_type === 'nurse' || n.npc_type === 'narrator' || n.npc_type === 'vendor' || n.npc_type === 'pc' || n.npc_type === 'banker') ? 170 : 100;
            ctx.fillStyle = 'rgba(245, 158, 11, 0.9)';
            ctx.beginPath();
            ctx.roundRect(sx - boxW / 2, sy - 14, boxW, 22, 6);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.font = 'bold 11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(label, sx, sy + 1);
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
            const mp = p.isMe ? this.moveProgress : (p.moveProgress ?? 1);
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
                    const pmp = p.isMe ? this.moveProgress : (p.moveProgress ?? 1);
                    const dx = Math.abs((p.pos_x || 0) - (p.fromX || p.pos_x || 0));
                    const dy = Math.abs((p.pos_y || 0) - (p.fromY || p.pos_y || 0));
                    const isMoving = p.isMe ? (this.moveProgress < 1.0) : (pmp < 1.0 && (dx > 2 || dy > 2));
                    const walkIdx = isMoving ? Math.min(Math.floor(pmp * 4), 3) : 1;
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

window._cityOpenPremiumShop = function(shop) {
    document.getElementById('city-premium-modal')?.classList.add('hidden');
    const game = window.pokefury;
    if (game && game.currentCharacterId && window.premiumStore) {
        window.premiumStore.setCurrentChar(game.currentCharacterId);
    }
    if (shop === 'buy') {
        window.premiumStore?.openBuyDiamonds();
    } else if (shop === 'shop') {
        window.premiumStore?.openDiamondShop();
    } else if (shop === 'skin') {
        window.premiumStore?.openSkinShop();
    }
};
