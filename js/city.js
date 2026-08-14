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
        this.weatherParticles = [];
        this._weather = null;
        this.puddles = [];
        this.lights = [];
        this.battleZones = [];
        this.currentBattleZone = null;
        this.spawnZones = [];
        this.currentSpawnZone = null;
        this.spawnZoneCooldown = 0;
        this.spawnPoints = [];
        this.wildPokemon = [];
        this.wildPokemonCooldown = 0;

        this.raidPortal = null;
        this.raidSpawn = null;
        this.raidBoss = null;
        this.raidExit = null;
        this.raidZones = [];
        this.raidCooldownUntil = 0;
        this._raidPortalImg = null;
        this._raidExitImg = null;
        this._raidBossImg = null;
        this._raidRankEl = null;
        this._raidRankTimer = null;
        this._raidLayer = null;
        this._raidPortalEl = null;
        this._raidBossEl = null;
        this._raidExitEl = null;
        this._raidBossImgId = null;
        this._raidBossW = 220;
        this._raidBossH = 220;
        this._teleportPortalImg = null;
        this._teleportLayer = null;
        this._teleportEls = [];
        this.gymNpc = null;
        this.gymZones = {};
        this.gymTeleports = {};
        this.nearGymNpc = false;
        this.nearGymTeleportType = null;
        this._gymNpcImg = null;
        this.rankSpawns = [];
        this._rankLayer = null;
        this._rankEls = {};

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
                if (this.nearGymNpc) {
                    this.showGymNpcDialogue();
                } else if (this.inActiveGymZone) {
                    window.pokefury?.startGymLeaderBattleDirect();
                } else if (this.nearRaidPortal) {
                    this.teleportToRaidArena();
                } else if (this.nearRaidExit) {
                    this.teleportOutOfRaid();
                } else if (this.nearestNpc) {
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
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.running) {
                this.playerMoving = false;
                this.moveProgress = 1;
                this.keys = {};
                if (window.pokefury?.afkManager) {
                    window.pokefury.afkManager._cityPath = null;
                    window.pokefury.afkManager._cityTargetId = null;
                }
            }
        });

        const cityCanvas = document.getElementById('city-canvas');
        if (cityCanvas) {
            cityCanvas.addEventListener('click', (e) => this.handlePlayerClick(e));
        }
    }

    handlePlayerClick(e) {
        const canvas = this.canvas;
        if (!canvas || !this.running) return;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const cx = (e.clientX - rect.left) * (canvas.width / rect.width);
        const cy = (e.clientY - rect.top) * (canvas.height / rect.height);
        const camX = this.cameraX - canvas.width / 2;
        const camY = this.cameraY - canvas.height / 2;
        const ps = this.playerSize;

        let hit = null, hitSx = 0, hitSy = 0;
        for (const key of Object.keys(this.players)) {
            const p = this.players[key];
            if (!p || p.is_visible === false) continue;
            const sx = (p.pos_x ?? 0) - camX;
            const sy = (p.pos_y ?? 0) - camY;
            if (cx >= sx - ps / 2 && cx <= sx + ps / 2 && cy >= sy - ps / 2 && cy <= sy + ps / 2) {
                hit = p; hitSx = sx; hitSy = sy;
                break;
            }
        }
        if (!hit) { this.closePlayerContextMenu(); return; }
        this.showPlayerContextMenu(hit, hitSx, hitSy);
    }

    showPlayerContextMenu(player, sx, sy) {
        this.closePlayerContextMenu();
        const canvas = this.canvas;
        const rect = canvas.getBoundingClientRect();
        const scaleX = rect.width / canvas.width;
        const scaleY = rect.height / canvas.height;
        const menu = document.createElement('div');
        menu.className = 'player-context-menu';
        menu.style.cssText = 'position:fixed;z-index:10060;background:#1c2333;border:1px solid rgba(255,255,255,0.15);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.5);overflow:hidden;';
        const friendId = player.character_id;
        const name = player.character_name || 'Jogador';
        menu.innerHTML = `
            <button data-action="add-friend" style="display:block;width:100%;padding:9px 14px;background:none;border:none;color:#fff;font-size:12px;font-weight:600;cursor:pointer;text-align:left;">Adicionar Amigo</button>
            <button data-action="private-msg" style="display:block;width:100%;padding:9px 14px;background:none;border:none;color:#fff;font-size:12px;font-weight:600;cursor:pointer;text-align:left;border-top:1px solid rgba(255,255,255,0.08);">Enviar mensagem privada</button>
            <button data-action="pvp" style="display:block;width:100%;padding:9px 14px;background:none;border:none;color:#fff;font-size:12px;font-weight:600;cursor:pointer;text-align:left;border-top:1px solid rgba(255,255,255,0.08);">Enviar pedido de PVP</button>
        `;
        menu.style.left = (rect.left + sx * scaleX) + 'px';
        menu.style.top = (rect.top + (sy - this.playerSize) * scaleY - 6) + 'px';
        menu.style.transform = 'translateX(-50%)';
        document.body.appendChild(menu);

        menu.querySelector('[data-action="add-friend"]').addEventListener('click', async () => {
            menu.remove();
            if (friendId && window.pokefury?.friends) {
                await window.pokefury.friends.addFriend(friendId);
            }
        });

        menu.querySelector('[data-action="private-msg"]').addEventListener('click', () => {
            menu.remove();
            if (friendId) {
                window.openPrivateChatWith(friendId, name);
            }
        });

        menu.querySelector('[data-action="pvp"]').addEventListener('click', async () => {
            menu.remove();
            if (friendId && window.pokefury?.pvp) {
                const result = await window.pokefury.pvp.sendChallenge(friendId, name, 0, 0, 0);
                if (result.error) {
                    window.pokefury.showToast(result.error, 'error');
                } else {
                    window.pokefury.showToast(`Desafio enviado para ${name}!`, 'success');
                }
            }
        });

        const close = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', close); } };
        setTimeout(() => document.addEventListener('click', close), 0);
    }

    closePlayerContextMenu() {
        document.querySelectorAll('.player-context-menu').forEach(m => m.remove());
    }

    async open() {
        const game = window.pokefury;
        if (!game) return;
        if (this.running) return; // ja está aberta — evita re-spawn e loop duplicado

        if (window.rankSystem) window.rankSystem.start();

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
            await this.loadLights();
            await this.loadRaidLayout();
            await this.loadGymLayout();
            await this.syncServerTime();
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
            await this.loadLights();
            await this.loadRaidLayout();
            await this.loadGymLayout();
            await this.loadMyEquippedTitle();
            await this.syncRetroactiveTitles();
            await this.syncServerTime();
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
        if (this._raidLayer) {
            this._raidLayer.remove();
            this._raidLayer = null;
            this._raidPortalEl = null;
            this._raidBossEl = null;
            this._raidExitEl = null;
        }
        if (this._teleportLayer) {
            this._teleportLayer.remove();
            this._teleportLayer = null;
            this._teleportEls = [];
        }
        this.hideRaidRank();
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
            character_id: window.GameData?.currentCharacterId || null,
            character_name: charName,
            skin_url: skinUrl,
            pos_x: this.playerX,
            pos_y: this.playerY,
            direction: this.playerDir,
            equipped_title: this.myEquippedTitle || null,
            equipped_title_id: this.myEquippedTitleId || null
        };

        if (!userId) { return; }

        this._isVisible = true;
        this._lastActivityTime = Date.now();
        this.setupVisibilityWatchdog();

        // Limpa entradas antigas deste usuario e registra当前位置
        try {
            await window.db.from('city_players').delete().eq('user_id', userId);
            await window.db.from('city_players').insert({
                user_id: userId,
                character_id: window.GameData?.currentCharacterId || null,
                character_name: charName,
                skin_url: skinUrl,
                pos_x: this.playerX,
                pos_y: this.playerY,
                direction: this.playerDir,
                equipped_title: this.myEquippedTitle || null,
                equipped_title_id: this.myEquippedTitleId || null,
                is_visible: true
            });
        } catch (e) {
        }
    }

    setupVisibilityWatchdog() {
        if (this._visibilityBound) return;
        this._visibilityBound = true;
        const mark = () => {
            this._lastActivityTime = Date.now();
            if (this._isVisible === false) {
                this._isVisible = true;
                if (this.authUserId && this.authUserId !== 'local') {
                    window.db.from('city_players').update({ is_visible: true }).eq('user_id', this.authUserId).then(() => {}).catch(() => {});
                }
            }
        };
        ['click', 'keydown', 'pointerdown', 'touchstart', 'scroll', 'mousemove'].forEach(evt => {
            window.addEventListener(evt, mark, { passive: true });
        });
        this._visTimer = setInterval(() => this._syncVisibility(), 30000);
    }

    async _syncVisibility() {
        if (!this.authUserId || this.authUserId === 'local') return;
        const inactive = Date.now() - this._lastActivityTime > 5 * 60 * 1000;
        if (inactive && this._isVisible !== false) {
            this._isVisible = false;
            try { await window.db.from('city_players').update({ is_visible: false }).eq('user_id', this.authUserId); } catch (e) {}
        } else if (!inactive && this._isVisible !== true) {
            this._isVisible = true;
            try { await window.db.from('city_players').update({ is_visible: true }).eq('user_id', this.authUserId); } catch (e) {}
        }
    }

    unregisterPlayer() {
        if (this._visTimer) { clearInterval(this._visTimer); this._visTimer = null; }
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
                if (p.is_visible === false) return;
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
                if (p.is_visible === false) {
                    delete this.players[p.user_id];
                    return;
                }
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
                    existing.equipped_title = p.equipped_title;
                    existing.equipped_title_id = p.equipped_title_id;
                    if (p.skin_url && p.skin_url !== existing.skin_url) {
                        existing.skin_url = p.skin_url;
                        const img = new Image();
                        img.crossOrigin = 'anonymous';
                        img.src = p.skin_url;
                        existing._skinImg = img;
                    }
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
                if (n._idleT <= 0 && Math.random() < 0.04 * (this._dt || 1)) {
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
            n._walkAnimT = (n._walkAnimT || 0) + (this._dt || 1);
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
                        p_biome: biome,
                        p_is_night: this.getDayNight().isNight
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

    // Verificação de batalha para auto farm em segundo plano (sem rAF)
    checkNearbyBattleTrigger() {
        if (this.wildPokemonCooldown > 0) { this.wildPokemonCooldown -= 1; return null; }
        for (const p of this.wildPokemon) {
            if (!p.active) continue;
            const pd = Math.hypot(this.playerX - p.pos_x, this.playerY - p.pos_y);
            if (pd < 38) {
                this.wildPokemonCooldown = 1;
                return p;
            }
        }
        return null;
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
                    p_biome: biome,
                    p_is_night: this.getDayNight().isNight
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
        const charId = window.GameData?.currentCharacterId;
        if (charId) {
            try {
                const { data: save } = await window.db.from('game_saves').select('city_pos_x, city_pos_y').eq('id', charId).maybeSingle();
                if (save && save.city_pos_x != null && save.city_pos_y != null) {
                    this.playerX = save.city_pos_x;
                    this.playerY = save.city_pos_y;
                    return;
                }
            } catch (e) {}
        }
        try {
            const { data } = await window.db.from('city_player_spawn').select('pos_x, pos_y').limit(1).maybeSingle();
            if (data) {
                this.playerX = data.pos_x;
                this.playerY = data.pos_y;
                console.log('[City] Spawn loaded:', this.playerX, this.playerY);
            }
        } catch (e) { console.warn('[City] Spawn load failed:', e); }
    }

    async loadLights() {
        try {
            const { data } = await window.db.from('city_lights').select('*');
            if (data) this.lights = data;
        } catch (e) {}
    }

    async loadRaidLayout() {
        try {
            const { data: portal } = await window.db.from('city_raid_portal').select('*').limit(1).maybeSingle();
            this.raidPortal = portal || null;
        } catch (e) { this.raidPortal = null; }
        try {
            const { data: spawn } = await window.db.from('city_raid_spawn').select('*').limit(1).maybeSingle();
            this.raidSpawn = spawn || null;
        } catch (e) { this.raidSpawn = null; }
        try {
            const { data: boss } = await window.db.from('city_raid_boss').select('*').limit(1).maybeSingle();
            this.raidBoss = boss || null;
        } catch (e) { this.raidBoss = null; }
        try {
            const { data: exit } = await window.db.from('city_raid_exit').select('*').limit(1).maybeSingle();
            this.raidExit = exit || null;
        } catch (e) { this.raidExit = null; }
        try {
            const { data: zones } = await window.db.from('city_raid_zones').select('*');
            this.raidZones = zones || [];
        } catch (e) { this.raidZones = []; }
        this._ensureRaidImages();
    }

    _ensureRaidImages() {
        const game = window.pokefury;
        if (!game?.raidBoss) return;
        if (!this._raidPortalImg) {
            const img = new Image();
            img.src = game.raidBoss.portalSpriteUrl();
            this._raidPortalImg = img;
        }
        if (!this._raidExitImg) {
            const img = new Image();
            img.src = game.raidBoss.portalSpriteUrl();
            this._raidExitImg = img;
        }
    }

    async loadGymLayout() {
        try {
            const { data: gn } = await window.db.from('city_gym_npc').select('*').limit(1).maybeSingle();
            this.gymNpc = gn || null;
        } catch (e) { this.gymNpc = null; }
        try {
            const { data: gz } = await window.db.from('city_gym_zones').select('*');
            this.gymZones = {};
            (gz || []).forEach(z => { this.gymZones[z.gym_type] = { pos_x: z.pos_x, pos_y: z.pos_y, width: z.width, height: z.height }; });
        } catch (e) { this.gymZones = {}; }
        try {
            const { data: gt } = await window.db.from('city_gym_teleports').select('*');
            this.gymTeleports = {};
            (gt || []).forEach(t => { this.gymTeleports[t.gym_type] = { pos_x: t.pos_x, pos_y: t.pos_y }; });
        } catch (e) { this.gymTeleports = {}; }
        if (!this._gymNpcImg) {
            const img = new Image();
            img.src = 'assets/ferramentas/npcginasios.png';
            this._gymNpcImg = img;
        }
        try {
            const { data: rs } = await window.db.from('city_rank_spawns').select('*');
            this.rankSpawns = rs || [];
        } catch (e) { this.rankSpawns = []; }
    }

    getRaidBoss() {
        return window.pokefury?.raidBoss?.activeBoss || null;
    }

    isInRaidZone() {
        for (const z of this.raidZones) {
            if (this.playerX >= z.pos_x && this.playerX <= z.pos_x + z.width &&
                this.playerY >= z.pos_y && this.playerY <= z.pos_y + z.height) {
                return true;
            }
        }
        return false;
    }

    drawRaidElements(ctx, camX, camY, cw, ch) {
        const boss = this.getRaidBoss();
        this._updateRaidBossSize();

        if (boss && this.raidBoss) {
            const s = this.raidBoss;
            const bw = this._raidBossW;
            const bh = this._raidBossH;
            const bx = s.pos_x - camX - bw / 2;
            const by = s.pos_y - camY - bh / 2;
            if (bx + bw > -50 && bx < cw + 50 && by + bh > -50 && by < ch + 50) {
                ctx.textAlign = 'center';
                ctx.font = 'bold 16px Inter, sans-serif';
                ctx.strokeStyle = 'rgba(0,0,0,0.85)';
                ctx.lineWidth = 4;
                const label = `Boss ${boss.boss_name} (Nv.${boss.level})`;
                ctx.strokeText(label, s.pos_x - camX, by + bh + 22);
                ctx.fillStyle = '#fff';
                ctx.fillText(label, s.pos_x - camX, by + bh + 22);
            }
        }

        // Portal de saida SEMPRE ativo (para nao prender jogadores na arena)
        if (this.raidExit) {
            const e = this.raidExit;
            const ex = e.pos_x - camX;
            const ey = e.pos_y - camY;
            const es = 64 * 3;
            if (ex + es > -50 && ex < cw + 50 && ey + es > -50 && ey < ch + 50) {
                ctx.textAlign = 'center';
                ctx.font = 'bold 10px Inter, sans-serif';
                ctx.fillStyle = '#fff';
                ctx.fillText('Sair', ex + es / 2, ey - 4);
            }
        }

        this.renderRaidDom();
    }

    drawGymElements(ctx, camX, camY, cw, ch) {
        if (this.gymNpc) {
            const ps = 56;
            const sx = this.gymNpc.pos_x - camX - ps / 2;
            const sy = this.gymNpc.pos_y - camY - ps / 2;
            if (sx + ps > -50 && sx < cw + 50 && sy + ps > -50 && sy < ch + 50) {
                const img = this._gymNpcImg;
                if (img && img.complete && img.naturalWidth) {
                    const frameW = img.naturalWidth / 4;
                    const frameH = img.naturalHeight / 4;
                    ctx.drawImage(img, 0, 0, frameW, frameH, sx, sy, ps, ps);
                } else {
                    ctx.fillStyle = '#e94560';
                    ctx.fillRect(sx, sy, ps, ps);
                }
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 11px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Líderes de Ginásio', sx + ps / 2, sy - 6);
            }
        }
    }

    ensureRaidLayer() {
        if (this._raidLayer) return;
        const wrap = document.getElementById('city-canvas-wrap');
        if (!wrap) return;
        const layer = document.createElement('div');
        layer.id = 'city-raid-layer';
        layer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden;z-index:6;';
        wrap.appendChild(layer);
        this._raidLayer = layer;

        const game = window.pokefury;
        if (!game?.raidBoss) return;
        this._raidPortalEl = document.createElement('img');
        this._raidPortalEl.style.cssText = 'position:absolute;pointer-events:none;display:none;image-rendering:auto;';
        this._raidPortalEl.src = game.raidBoss.portalSpriteUrl();
        layer.appendChild(this._raidPortalEl);

        this._raidBossEl = document.createElement('img');
        this._raidBossEl.style.cssText = 'position:absolute;pointer-events:none;display:none;image-rendering:auto;';
        layer.appendChild(this._raidBossEl);

        this._raidExitEl = document.createElement('img');
        this._raidExitEl.style.cssText = 'position:absolute;pointer-events:none;display:none;image-rendering:auto;';
        this._raidExitEl.src = game.raidBoss.portalSpriteUrl();
        layer.appendChild(this._raidExitEl);
    }

    _updateRaidBossSize() {
        const el = this._raidBossEl;
        const nw = (el && el.naturalWidth) ? el.naturalWidth : 220;
        const nh = (el && el.naturalHeight) ? el.naturalHeight : 220;
        const maxDim = 350;
        if (nw >= nh) {
            this._raidBossW = maxDim;
            this._raidBossH = Math.round(maxDim * (nh / nw));
        } else {
            this._raidBossH = maxDim;
            this._raidBossW = Math.round(maxDim * (nw / nh));
        }
    }

    renderTeleportDom() {
        if (!this._teleportLayer) {
            const wrap = document.getElementById('city-canvas-wrap');
            if (!wrap) return;
            const layer = document.createElement('div');
            layer.id = 'city-teleport-layer';
            layer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden;z-index:4;';
            wrap.appendChild(layer);
            this._teleportLayer = layer;
        }
        const layer = this._teleportLayer;
        const canvas = this.canvas;
        const canvasRect = canvas.getBoundingClientRect();
        const wrapRect = layer.getBoundingClientRect();
        const scaleX = canvasRect.width / canvas.width;
        const scaleY = canvasRect.height / canvas.height;
        const offsetX = canvasRect.left - wrapRect.left;
        const offsetY = canvasRect.top - wrapRect.top;
        const camX = this.cameraX - canvas.width / 2;
        const camY = this.cameraY - canvas.height / 2;

        while (this._teleportEls.length < this.teleports.length) {
            const el = document.createElement('img');
            el.src = 'assets/ferramentas/portal2.gif';
            el.style.cssText = 'position:absolute;pointer-events:none;display:none;';
            layer.appendChild(el);
            this._teleportEls.push(el);
        }

        this.teleports.forEach((t, i) => {
            const el = this._teleportEls[i];
            if (!el) return;
            const sx = t.sign_x - camX;
            const sy = t.sign_y - camY;
            if (sx + t.sign_width < -50 || sx > canvas.width + 50 || sy + t.sign_height < -50 || sy > canvas.height + 50) {
                el.style.display = 'none';
                return;
            }
            el.style.display = 'block';
            el.style.left = (offsetX + sx * scaleX) + 'px';
            el.style.top = (offsetY + sy * scaleY) + 'px';
            el.style.width = (t.sign_width * scaleX) + 'px';
            el.style.height = (t.sign_height * scaleY) + 'px';
        });

        for (let i = this.teleports.length; i < this._teleportEls.length; i++) {
            this._teleportEls[i].style.display = 'none';
        }
    }

    renderRaidDom() {
        const boss = this.getRaidBoss();
        const hasExit = !!this.raidExit;
        if (!boss && !hasExit) {
            if (this._raidLayer) this._raidLayer.style.display = 'none';
            return;
        }
        this.ensureRaidLayer();
        if (!this._raidLayer) return;
        this._raidLayer.style.display = '';

        const canvas = this.canvas;
        const canvasRect = canvas.getBoundingClientRect();
        const wrapRect = this._raidLayer.getBoundingClientRect();
        const scaleX = canvasRect.width / canvas.width;
        const scaleY = canvasRect.height / canvas.height;
        const offsetX = canvasRect.left - wrapRect.left;
        const offsetY = canvasRect.top - wrapRect.top;
        const camX = this.cameraX - canvas.width / 2;
        const camY = this.cameraY - canvas.height / 2;

        if (boss && this.raidPortal && this._raidPortalEl) {
            const p = this.raidPortal;
            const sx = p.pos_x - camX;
            const sy = p.pos_y - camY;
            const w = (p.width || 64) * 3;
            const h = (p.height || 64) * 3;
            const el = this._raidPortalEl;
            el.style.display = 'block';
            el.style.left = (offsetX + sx * scaleX) + 'px';
            el.style.top = (offsetY + sy * scaleY) + 'px';
            el.style.width = (w * scaleX) + 'px';
            el.style.height = (h * scaleY) + 'px';
        } else if (this._raidPortalEl) {
            this._raidPortalEl.style.display = 'none';
        }

        if (boss && this.raidBoss && this._raidBossEl) {
            const b = this.raidBoss;
            const bw = this._raidBossW;
            const bh = this._raidBossH;
            const bx = b.pos_x - camX - bw / 2;
            const by = b.pos_y - camY - bh / 2;
            const el = this._raidBossEl;
            if (this._raidBossImgId !== boss.pokemon_id) {
                el.src = window.pokefury.raidBoss.bossSpriteUrl(boss.pokemon_id);
                this._raidBossImgId = boss.pokemon_id;
            }
            el.style.display = 'block';
            el.style.left = (offsetX + bx * scaleX) + 'px';
            el.style.top = (offsetY + by * scaleY) + 'px';
            el.style.width = (bw * scaleX) + 'px';
            el.style.height = (bh * scaleY) + 'px';
        } else if (this._raidBossEl) {
            this._raidBossEl.style.display = 'none';
        }

        if (this.raidExit && this._raidExitEl) {
            const e = this.raidExit;
            const sx = e.pos_x - camX;
            const sy = e.pos_y - camY;
            const es = 64 * 3;
            const el = this._raidExitEl;
            el.style.display = 'block';
            el.style.left = (offsetX + sx * scaleX) + 'px';
            el.style.top = (offsetY + sy * scaleY) + 'px';
            el.style.width = (es * scaleX) + 'px';
            el.style.height = (es * scaleY) + 'px';
        }
    }

    getRankSpriteUrl(entry, type) {
        if (type === 'trainer') {
            if (entry.sprite_url) return entry.sprite_url;
            const gender = entry.player_gender === 'female' ? 'feminino' : 'masculino';
            return `assets/perso_${gender}.webp`;
        }
        if (!window.PokeAPI || !entry.pokemon_id) return '';
        return entry.is_shiny
            ? window.PokeAPI.getAnimatedFrontShinyUrl(entry.pokemon_id)
            : window.PokeAPI.getAnimatedFrontUrl(entry.pokemon_id);
    }

    getRankFallbackUrl(entry) {
        if (!entry) return '';
        if (entry.is_shiny) {
            return entry.sprite_front_shiny || entry.sprite_home_shiny || entry.sprite_official_shiny ||
                   entry.sprite_front || entry.sprite_home || entry.sprite_official || '';
        }
        return entry.sprite_front || entry.sprite_home || entry.sprite_official || '';
    }

    ensureRankLayer() {
        if (this._rankLayer) return;
        const wrap = document.getElementById('city-canvas-wrap');
        if (!wrap) return;
        const layer = document.createElement('div');
        layer.id = 'city-rank-layer';
        layer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden;z-index:5;';
        wrap.appendChild(layer);
        this._rankLayer = layer;
    }

    renderRankDom() {
        if (!this.rankSpawns.length) {
            if (this._rankLayer) this._rankLayer.style.display = 'none';
            return;
        }
        this.ensureRankLayer();
        if (!this._rankLayer) return;
        this._rankLayer.style.display = '';

        const rs = window.rankSystem;
        const data = rs ? rs.data : { power: [], iv: [], trainer: [] };

        const canvas = this.canvas;
        const canvasRect = canvas.getBoundingClientRect();
        const wrapRect = this._rankLayer.getBoundingClientRect();
        const scaleX = canvasRect.width / canvas.width;
        const scaleY = canvasRect.height / canvas.height;
        const offsetX = canvasRect.left - wrapRect.left;
        const offsetY = canvasRect.top - wrapRect.top;
        const camX = this.cameraX - canvas.width / 2;
        const camY = this.cameraY - canvas.height / 2;

        const seen = {};
        this.rankSpawns.forEach(sp => {
            const key = `${sp.rank_type}-${sp.position}`;
            seen[key] = true;
            const list = data[sp.rank_type] || [];
            const entry = list[sp.position - 1];

            let el = this._rankEls[key];
            if (!el) {
                el = document.createElement('div');
                el.style.cssText = 'position:absolute;display:flex;flex-direction:column;align-items:center;pointer-events:none;';
                const wrap = document.createElement('div');
                wrap.style.cssText = 'overflow:hidden;';
                const img = document.createElement('img');
                img.style.cssText = 'image-rendering:pixelated;display:block;';
                wrap.appendChild(img);
                const line1 = document.createElement('div');
                line1.style.cssText = 'color:#fff;font:bold 11px Inter,sans-serif;text-shadow:0 1px 3px rgba(0,0,0,0.9);white-space:nowrap;';
                const line2 = document.createElement('div');
                line2.style.cssText = 'color:rgba(255,255,255,0.85);font:10px Inter,sans-serif;text-shadow:0 1px 3px rgba(0,0,0,0.9);white-space:nowrap;';
                el.appendChild(wrap);
                el.appendChild(line1);
                el.appendChild(line2);
                el._wrap = wrap;
                el._img = img;
                el._line1 = line1;
                el._line2 = line2;
                this._rankLayer.appendChild(el);
                this._rankEls[key] = el;
            }

            const sx = sp.pos_x - camX;
            const sy = sp.pos_y - camY;
            if (sx + 80 < -50 || sx > canvas.width + 50 || sy + 100 < -50 || sy > canvas.height + 50) {
                el.style.display = 'none';
                return;
            }
            el.style.display = 'flex';

            const size = sp.rank_type === 'trainer' ? 56 : 64;
            const wpx = size * scaleX;
            const hpx = size * scaleY;
            const src = entry ? this.getRankSpriteUrl(entry, sp.rank_type) : '';
            el._entry = entry;
            if (src && el._imgSrc !== src) {
                el._imgSrc = src;
                el._img.src = src;
                el._img.onerror = () => {
                    const fb = this.getRankFallbackUrl(el._entry);
                    if (fb && el._img.src !== fb) el._img.src = fb;
                };
            }
            el._wrap.style.width = wpx + 'px';
            el._wrap.style.height = hpx + 'px';
            if (sp.rank_type === 'trainer') {
                el._img.style.width = (wpx * 4) + 'px';
                el._img.style.height = (hpx * 4) + 'px';
                el._img.style.marginLeft = '0px';
                el._img.style.marginTop = '0px';
            } else {
                el._img.style.width = wpx + 'px';
                el._img.style.height = hpx + 'px';
            }

            if (sp.rank_type === 'trainer') {
                el._line1.textContent = entry ? entry.player_name : `${sp.position}º -`;
                el._line2.textContent = entry ? `Treinador Nv.${entry.trainer_level}` : '';
                el._line1.style.font = 'bold 11px Inter,sans-serif';
            } else {
                el._line1.textContent = entry ? `${entry.species} Nv.${entry.level}` : `${sp.position}º -`;
                el._line2.textContent = entry ? entry.player_name : '';
                el._line1.style.font = 'bold 9px Inter,sans-serif';
            }

            const left = offsetX + (sx - size / 2) * scaleX;
            const top = offsetY + (sy - size / 2) * scaleY;
            el.style.left = left + 'px';
            el.style.top = top + 'px';
            el.style.width = wpx + 'px';
        });

        Object.keys(this._rankEls).forEach(key => {
            if (!seen[key]) this._rankEls[key].style.display = 'none';
        });
    }


    async loadMyEquippedTitle() {
        const charId = window.GameData?.currentCharacterId;
        if (!charId) return;
        try {
            const { data } = await window.db.from('game_saves').select('equipped_title, equipped_title_name').eq('id', charId).maybeSingle();
            if (data) {
                this.myEquippedTitle = data.equipped_title_name || null;
                this.myEquippedTitleId = data.equipped_title || null;
            }
        } catch (e) {}
    }

    async updateEquippedTitle(titleId, titleName) {
        this.myEquippedTitleId = titleId || null;
        this.myEquippedTitle = titleName || null;
        if (this.myPlayer) {
            this.myPlayer.equipped_title = titleName || null;
            this.myPlayer.equipped_title_id = titleId || null;
        }
        if (this.authUserId && this.authUserId !== 'local') {
            try {
                await window.db.from('city_players').update({
                    equipped_title: titleName || null,
                    equipped_title_id: titleId || null
                }).eq('user_id', this.authUserId);
            } catch (e) {}
        }
    }

    async updateEquippedSkin(skinUrl) {
        if (!skinUrl) return;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = skinUrl;
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
        if (this.myPlayer) {
            this.myPlayer.skin_url = skinUrl;
        }
        if (this.authUserId && this.authUserId !== 'local') {
            try {
                await window.db.from('city_players').update({ skin_url: skinUrl }).eq('user_id', this.authUserId);
            } catch (e) {}
        }
        this.render();
    }

    async syncRetroactiveTitles() {
        const charId = window.GameData?.currentCharacterId;
        if (!charId) return;
        try {
            const { data } = await window.db.rpc('sync_titles_retroactive', { p_character_id: charId });
            if (data?.awarded && data.awarded.length > 0) {
                window.Titles?.queueAward(data.awarded);
            }
        } catch (e) {}
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

    showGymNpcDialogue() {
        const overlay = document.getElementById('city-npc-dialogue-overlay');
        const msg = document.getElementById('city-npc-dialogue-msg');
        const simBtn = document.getElementById('city-npc-dialogue-sim');
        const naoBtn = document.getElementById('city-npc-dialogue-nao');
        const okBtn = document.getElementById('city-npc-dialogue-ok');
        const icon = document.getElementById('city-npc-dialogue-icon');
        if (!overlay || !msg || !simBtn || !naoBtn) return;

        if (icon) icon.textContent = '🏟️';
        if (okBtn) { okBtn.style.display = 'none'; okBtn.onclick = null; }
        simBtn.style.display = '';
        naoBtn.style.display = '';

        const charName = this.myPlayer?.character_name || 'Treinador';
        msg.textContent = `Olá ${charName}, aqui você mostra seu verdadeiro valor como Treinador Pokémon. Apenas os mais valentes desafiam os melhores dos melhores. Você está preparado?`;

        this.npcDialogueOpen = true;

        simBtn.onclick = () => {
            this.closeNpcDialogue();
            window.pokefury?.openGymLeadersPopup();
        };
        naoBtn.onclick = () => {
            this.closeNpcDialogue();
        };

        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';
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
            window.Titles?.recordStat?.('nurse_heals', 1);
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

        // Jogadores nao-admin permanecem na cidade: re-spawn imediato dos pokemons da nova regiao
        if (!window.isAdmin) {
            try { await this.spawnVisiblePokemon(); } catch (e) {}
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

    // Movimento direto (usado pelo auto farm em segundo plano, sem rAF)
    movePlayerDirectly(dir) {
        let dx = 0, dy = 0;
        if (dir === 'ArrowUp') { dy = -1; this.playerDir = 'up'; }
        else if (dir === 'ArrowDown') { dy = 1; this.playerDir = 'down'; }
        else if (dir === 'ArrowLeft') { dx = -1; this.playerDir = 'left'; }
        else if (dir === 'ArrowRight') { dx = 1; this.playerDir = 'right'; }
        else return false;

        const nx = this.playerX + dx * this.playerSpeed;
        const ny = this.playerY + dy * this.playerSpeed;
        if (this.checkCollision(nx, ny)) return false;

        this.playerFromX = this.playerX;
        this.playerFromY = this.playerY;
        this.playerX = nx;
        this.playerY = ny;
        this.playerMoving = false;
        this.moveProgress = 1;
        if (this.myPlayer) {
            this.myPlayer.pos_x = this.playerX;
            this.myPlayer.pos_y = this.playerY;
            this.myPlayer.direction = this.playerDir;
        }
        this.syncPosition();
        return true;
    }

    update(dt) {
        this._dt = dt || 1;
        this._updateWeatherParticles(this._dt);
        this.updateWeatherHud();
        if (this.playerMoving) {
            this.moveProgress += 0.04 * this._dt;
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
                p.moveProgress += 0.15 * this._dt;
                if (p.moveProgress > 1) p.moveProgress = 1;
            }
        });

        const targetX = this.playerX;
        const targetY = this.playerY;
        const cl = Math.min(1, 0.15 * this._dt);
        this.cameraX += (targetX - this.cameraX) * cl;
        this.cameraY += (targetY - this.cameraY) * cl;

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

        this.updateWildPokemon(0.016 * this._dt);
        this.updateNpcPatrols(0.016 * this._dt);
        this.updateRaidInteraction();
        this.updateGymInteraction();
    }

    updateRaidInteraction() {
        const boss = this.getRaidBoss();
        this.nearRaidPortal = false;
        this.nearRaidExit = false;

        // Portal de saida SEMPRE ativo (para nao prender jogadores na arena)
        if (this.raidExit) {
            const e = this.raidExit;
            if (Math.hypot(this.playerX - e.pos_x, this.playerY - e.pos_y) < 60) {
                this.nearRaidExit = true;
            }
        }

        if (!boss) {
            this.hideRaidRank();
            return;
        }

        if (this.raidPortal) {
            const p = this.raidPortal;
            const cx = p.pos_x + (p.width || 64) / 2;
            const cy = p.pos_y + (p.height || 64) / 2;
            if (Math.hypot(this.playerX - cx, this.playerY - cy) < 80) {
                this.nearRaidPortal = true;
            }
        }

        if (this.raidBoss) {
            const b = this.raidBoss;
            if (Math.hypot(this.playerX - b.pos_x, this.playerY - b.pos_y) < 110 && boss.current_hp > 0) {
                if (Date.now() >= this.raidCooldownUntil && window.pokefury && window.pokefury.state !== 'battle') {
                    this.raidCooldownUntil = 0;
                    window.pokefury.startRaidBossBattle();
                }
            }
        }

        if (this.isInRaidZone()) {
            this.showRaidRank(boss);
        } else {
            this.hideRaidRank();
        }
    }

    updateGymInteraction() {
        this.nearGymNpc = false;
        this.inActiveGymZone = false;
        if (this.gymNpc) {
            const n = this.gymNpc;
            if (Math.hypot(this.playerX - n.pos_x, this.playerY - n.pos_y) < 70) {
                this.nearGymNpc = true;
            }
        }
        const game = window.pokefury;
        const leaderType = game?._currentGymLeader?.type || null;
        if (leaderType && this.gymZones[leaderType]) {
            const z = this.gymZones[leaderType];
            if (this.playerX >= z.pos_x && this.playerX <= z.pos_x + z.width && this.playerY >= z.pos_y && this.playerY <= z.pos_y + z.height) {
                this.inActiveGymZone = true;
            }
        }
    }

    teleportToGymType(gymType) {
        const tp = this.gymTeleports[gymType];
        if (!tp) return;
        this.playerX = tp.pos_x;
        this.playerY = tp.pos_y;
        this.playerFromX = this.playerX;
        this.playerFromY = this.playerY;
        this.cameraX = this.playerX;
        this.cameraY = this.playerY;
        this.syncPosition();
    }

    teleportToGymNpc() {
        if (!this.gymNpc) return;
        this.playerX = this.gymNpc.pos_x;
        this.playerY = this.gymNpc.pos_y + 70;
        this.playerFromX = this.playerX;
        this.playerFromY = this.playerY;
        this.cameraX = this.playerX;
        this.cameraY = this.playerY;
        this.syncPosition();
    }

    teleportToRaidArena() {
        if (!this.raidSpawn) return;
        this.playerX = this.raidSpawn.pos_x;
        this.playerY = this.raidSpawn.pos_y;
        this.playerFromX = this.playerX;
        this.playerFromY = this.playerY;
        this.cameraX = this.playerX;
        this.cameraY = this.playerY;
        this.syncPosition();
        this.raidCooldownUntil = Date.now() + 2000;
    }

    teleportOutOfRaid() {
        if (!this.raidPortal) return;
        this.playerX = this.raidPortal.pos_x + (this.raidPortal.width || 64) / 2;
        this.playerY = this.raidPortal.pos_y + (this.raidPortal.height || 64) + 60;
        this.playerFromX = this.playerX;
        this.playerFromY = this.playerY;
        this.cameraX = this.playerX;
        this.cameraY = this.playerY;
        this.syncPosition();
    }

    async showRaidRank(boss) {
        if (!boss) return;
        if (this._raidRankEl) {
            if (this._raidRankTimer) return;
            this._raidRankTimer = setInterval(() => this.renderRaidRank(), 3000);
            return;
        }
        const el = document.createElement('div');
        el.id = 'raid-rank-panel';
        el.style.cssText = 'position:fixed;top:90px;left:12px;z-index:900;background:rgba(10,10,20,0.92);border:1px solid rgba(233,69,96,0.4);border-radius:10px;padding:10px 12px;min-width:200px;max-height:60vh;overflow-y:auto;pointer-events:none;';
        this._raidRankEl = el;
        document.body.appendChild(el);
        await this.renderRaidRank();
        this._raidRankTimer = setInterval(() => this.renderRaidRank(), 3000);
    }

    async renderRaidRank() {
        if (!this._raidRankEl) return;
        const boss = this.getRaidBoss();
        if (!boss) { this.hideRaidRank(); return; }
        const ranking = await window.pokefury?.raidBoss?.getRanking(boss.id) || [];
        const hpPct = boss.max_hp > 0 ? Math.max(0, (boss.current_hp / boss.max_hp) * 100) : 0;
        let rows = ranking.map((r, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
            const me = r.character_id === window.GameData?.currentCharacterId;
            return `<div style="display:flex;gap:6px;padding:3px 0;font-size:11px;${me ? 'color:#e94560;font-weight:700;' : 'color:#fff;'}"><span style="min-width:20px;">${medal}</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${this.escapeHtml(r.character_name || '?')}</span><span>${Number(r.total_damage).toLocaleString()}</span></div>`;
        }).join('');
        if (!rows) rows = '<div style="color:rgba(255,255,255,0.4);font-size:11px;">Sem dano ainda</div>';
        this._raidRankEl.innerHTML = `
            <div style="color:#e94560;font-weight:800;font-size:12px;margin-bottom:6px;">RAID BOSS</div>
            <div style="color:#fff;font-size:11px;margin-bottom:4px;">${this.escapeHtml(boss.boss_name)}</div>
            <div style="height:8px;background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden;margin-bottom:6px;"><div style="height:100%;width:${hpPct}%;background:linear-gradient(90deg,#e94560,#ff6b6b);"></div></div>
            <div style="color:rgba(255,255,255,0.6);font-size:10px;margin-bottom:6px;">HP ${Number(boss.current_hp).toLocaleString()} / ${Number(boss.max_hp).toLocaleString()}</div>
            <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:6px;">${rows}</div>
        `;
    }

    hideRaidRank() {
        if (this._raidRankEl) { this._raidRankEl.remove(); this._raidRankEl = null; }
        if (this._raidRankTimer) { clearInterval(this._raidRankTimer); this._raidRankTimer = null; }
    }

    escapeHtml(s) {
        const d = document.createElement('div');
        d.textContent = s == null ? '' : String(s);
        return d.innerHTML;
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
        this._saveLastCityPos();
    }

    _saveLastCityPos() {
        const charId = window.GameData?.currentCharacterId;
        if (!charId || !window.db) return;
        const now = Date.now();
        if (this._lastCityPosSave && now - this._lastCityPosSave < 10000) return;
        this._lastCityPosSave = now;
        window.db.from('game_saves').update({
            city_pos_x: this.playerX,
            city_pos_y: this.playerY
        }).eq('id', charId).then(() => {}).catch(() => {});
    }

    serverNow() {
        return Date.now() + (this._serverTimeOffset || 0);
    }

    getWeather() {
        const SLOT = 15 * 60 * 1000;      // clima muda a cada 15 min
        const OFFSET = 7.5 * 60 * 1000;   // deslocado no meio entre dia e noite
        const slot = Math.floor((this.serverNow() + OFFSET) / SLOT);
        const h = Math.abs(Math.sin(slot * 127.1 + 311.7) * 43758.5453) % 1;
        if (h < 0.45) return 'clear';
        if (h < 0.78) return 'rain';
        return 'snow';
    }

    isPokemonTimeValid(pokemonId) {
        const isNight = this.getDayNight().isNight;
        if (isNight && DIURNAL_POKEMON_IDS.has(pokemonId)) return false;
        if (!isNight && NOCTURNAL_POKEMON_IDS.has(pokemonId)) return false;
        return true;
    }

    drawSpriteReflection(img, srcX, srcY, srcW, srcH, dx, dy, dw, dh) {
        if (this._weather !== 'rain') return;
        const ctx = this.ctx;
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.translate(dx + dw / 2, dy + dh);
        ctx.scale(1, -1);
        ctx.drawImage(img, srcX, srcY, srcW, srcH, -dw / 2, -dh, dw, dh * 0.55);
        ctx.restore();
    }

    _rayRectIntersect(px, py, dx, dy, rect) {
        let tmin = -Infinity, tmax = Infinity;
        if (Math.abs(dx) < 1e-9) {
            if (px < rect.pos_x || px > rect.pos_x + rect.width) return null;
        } else {
            let t1 = (rect.pos_x - px) / dx;
            let t2 = (rect.pos_x + rect.width - px) / dx;
            if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
            tmin = Math.max(tmin, t1);
            tmax = Math.min(tmax, t2);
        }
        if (Math.abs(dy) < 1e-9) {
            if (py < rect.pos_y || py > rect.pos_y + rect.height) return null;
        } else {
            let t1 = (rect.pos_y - py) / dy;
            let t2 = (rect.pos_y + rect.height - py) / dy;
            if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
            tmin = Math.max(tmin, t1);
            tmax = Math.min(tmax, t2);
        }
        if (tmax < tmin || tmax < 0) return null;
        return tmin >= 0 ? tmin : tmax;
    }

    renderLightWithShadows(ctx, wx, wy, radius, intensity, camX, camY) {
        const sx = wx - camX;
        const sy = wy - camY;
        if (sx < -radius - 200 || sx > ctx.canvas.width + radius + 200 || sy < -radius - 200 || sy > ctx.canvas.height + radius + 200) return;

        // Collect occluders near this light
        const occluders = [];
        for (const z of this.collisionZones) {
            const cx = z.pos_x + z.width / 2;
            const cy = z.pos_y + z.height / 2;
            const d = Math.hypot(cx - wx, cy - wy);
            if (d < radius + Math.max(z.width, z.height) * 1.5) {
                occluders.push(z);
            }
        }

        if (occluders.length === 0) {
            const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
            grad.addColorStop(0, `rgba(255,220,150,${0.5 * intensity})`);
            grad.addColorStop(0.3, `rgba(255,200,120,${0.28 * intensity})`);
            grad.addColorStop(1, 'rgba(255,180,80,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(sx, sy, radius, 0, Math.PI * 2);
            ctx.fill();
            return;
        }

        // Generate rays to each corner of each occluder (with epsilon offsets)
        const angles = [];
        for (const z of occluders) {
            const corners = [
                [z.pos_x, z.pos_y],
                [z.pos_x + z.width, z.pos_y],
                [z.pos_x + z.width, z.pos_y + z.height],
                [z.pos_x, z.pos_y + z.height]
            ];
            for (const [cx, cy] of corners) {
                const a = Math.atan2(cy - wy, cx - wx);
                angles.push(a - 0.0001, a, a + 0.0001);
            }
        }
        angles.sort((a, b) => a - b);

        // Build visibility polygon
        const pts = [];
        for (const a of angles) {
            const dx = Math.cos(a);
            const dy = Math.sin(a);
            let minT = radius;
            for (const z of occluders) {
                const t = this._rayRectIntersect(wx, wy, dx, dy, z);
                if (t != null && t < minT) minT = t;
            }
            pts.push({ x: wx + dx * minT - camX, y: wy + dy * minT - camY });
        }

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        for (const p of pts) ctx.lineTo(p.x, p.y);
        ctx.closePath();
        ctx.clip();

        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
        grad.addColorStop(0, `rgba(255,220,150,${0.5 * intensity})`);
        grad.addColorStop(0.3, `rgba(255,200,120,${0.28 * intensity})`);
        grad.addColorStop(1, 'rgba(255,180,80,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(sx - radius, sy - radius, radius * 2, radius * 2);
        ctx.restore();
    }

    updateWeatherHud() {
        const el = document.getElementById('city-weather-hud');
        if (!el) return;
        const dn = this.getDayNight();
        const weather = this._weather || 'clear';
        const dayPhase = dn.dayPhase;
        let timeIcon, timeLabel;
        if (dn.isNight) {
            timeIcon = '🌙'; timeLabel = 'Noite';
        } else if (dayPhase < 0.2) {
            timeIcon = '🌅'; timeLabel = 'Amanhecer';
        } else if (dayPhase < 0.8) {
            timeIcon = '☀️'; timeLabel = 'Dia';
        } else {
            timeIcon = '🌇'; timeLabel = 'Entardecer';
        }
        let weatherIcon = '';
        if (weather === 'rain') weatherIcon = '🌧️';
        else if (weather === 'snow') weatherIcon = '❄️';
        const key = timeIcon + '|' + timeLabel + '|' + weather + '|' + weatherIcon;
        if (this._hudKey === key) return;
        this._hudKey = key;
        el.innerHTML = `<span>${timeIcon}</span><span style="font-size:12px;">${timeLabel}</span>` + (weatherIcon ? `<span>${weatherIcon}</span>` : '');
    }

    _generatePuddles() {
        this.puddles = [];
        for (let i = 0; i < 50; i++) {
            const x = 200 + (Math.abs(Math.sin(i * 37.7)) * 4500);
            const y = 200 + (Math.abs(Math.cos(i * 53.3)) * 4500);
            this.puddles.push({
                x, y,
                rx: 20 + (Math.abs(Math.sin(i * 17)) * 30),
                ry: 8 + (Math.abs(Math.cos(i * 23)) * 8),
                opacity: 0.12 + (Math.abs(Math.sin(i * 29)) * 0.18)
            });
        }
    }

    _updateWeatherParticles(dt) {
        const f = dt || 1;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const weather = this.getWeather();
        if (weather !== this._weather) {
            this._weather = weather;
            this.weatherParticles = [];
            if (weather === 'rain') this._generatePuddles();
            else this.puddles = [];
        }
        if (weather === 'clear') { this.weatherParticles = []; return; }

        const target = weather === 'rain' ? 120 : 70;
        while (this.weatherParticles.length < target) {
            this.weatherParticles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                speed: weather === 'rain' ? (9 + Math.random() * 6) : (1.2 + Math.random() * 2),
                len: weather === 'rain' ? (15 + Math.random() * 15) : 0,
                size: weather === 'rain' ? 0 : (2 + Math.random() * 4),
                opacity: 0.2 + Math.random() * 0.4,
                wind: weather === 'rain' ? (-1.5 - Math.random() * 1) : 0,
                wobble: Math.random() * Math.PI * 2,
                wobbleSpeed: 0.02 + Math.random() * 0.03
            });
        }

        for (const p of this.weatherParticles) {
            if (weather === 'rain') {
                p.x += p.wind * f;
                p.y += p.speed * f;
                if (p.y > h) { p.y = -p.len; p.x = Math.random() * w; }
                if (p.x < -20) p.x = w + 10;
            } else {
                p.wobble += p.wobbleSpeed * f;
                p.x += Math.sin(p.wobble) * 0.8 * f;
                p.y += p.speed * f;
                if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w; }
            }
        }
    }

    async syncServerTime() {
        try {
            const { data, error } = await window.db.rpc('get_server_time');
            if (!error && data != null) {
                this._serverTimeOffset = data - Date.now();
            }
        } catch (e) {}
    }

    getDayNight() {
        const CYCLE = 30 * 60 * 1000;  // 30 min total (15 day + 15 night)
        const DAY = 15 * 60 * 1000;    // 15 min day
        const t = this.serverNow() % CYCLE;
        const isNight = t >= DAY;
        const dayPhase = t / DAY;                     // 0..1 dentro do dia
        const nightPhase = (t - DAY) / (CYCLE - DAY); // 0..1 dentro da noite

        // darkness: 0 = dia claro, 1 = noite total
        let darkness = 0;
        let tint = { r: 0, g: 0, b: 0 };
        if (!isNight) {
            // Amanhecer (0-20% do dia): laranja -> dia claro
            if (dayPhase < 0.2) {
                const p = dayPhase / 0.2;
                darkness = 0.25 * (1 - p);
                tint = { r: 255, g: 140, b: 60 }; // laranja amanhecer
            }
            // Entardecer (80-100% do dia): dia claro -> laranja
            else if (dayPhase > 0.8) {
                const p = (dayPhase - 0.8) / 0.2;
                darkness = 0.35 * p;
                tint = { r: 255, g: 90, b: 40 }; // laranja entardecer
            } else {
                darkness = 0;
                tint = { r: 0, g: 0, b: 0 };
            }
        } else {
            // Noite: escuro com tons de azul
            const p = nightPhase;
            // transição suave: início e fim da noite um pouco mais claros
            let nightDarkness = 0.72;
            if (p < 0.15) nightDarkness = 0.5 + (0.72 - 0.5) * (p / 0.15);
            else if (p > 0.85) nightDarkness = 0.72 - (0.72 - 0.45) * ((p - 0.85) / 0.15);
            darkness = nightDarkness;
            tint = { r: 20, g: 30, b: 80 }; // azul noite
        }

        // Ângulo do sol (para sombras): 0 = leste, PI/2 = sul (meio-dia), PI = oeste
        const sunAngle = isNight ? Math.PI : (Math.PI * dayPhase);

        return { isNight, darkness, tint, sunAngle, dayPhase, nightPhase };
    }

    loop(timestamp) {
        if (!this.running) return;
        const now = timestamp || performance.now();
        if (!this._lastFrameTime) this._lastFrameTime = now;
        let dt = (now - this._lastFrameTime) / (1000 / 60);
        this._lastFrameTime = now;
        if (!Number.isFinite(dt) || dt < 0) dt = 0;
        if (dt > 3) dt = 3;
        this.update(dt);
        this.render();
        requestAnimationFrame((ts) => this.loop(ts));
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

        const dn = this.getDayNight();
        const sunHeight = Math.max(0.15, Math.sin(dn.sunAngle));
        const shadowLen = (1 - sunHeight) * 16;
        const shadowOffX = -Math.cos(dn.sunAngle) * shadowLen;
        const shadowOffY = 2 + sunHeight * 3;

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

        // Puddles during rain
        if (this._weather === 'rain' && this.puddles.length > 0) {
            for (const pd of this.puddles) {
                const sx = pd.x - camX;
                const sy = pd.y - camY;
                if (sx < -80 || sx > cw + 80 || sy < -40 || sy > ch + 40) continue;
                ctx.save();
                ctx.globalAlpha = pd.opacity;
                ctx.fillStyle = '#8ec8e8';
                ctx.beginPath();
                ctx.ellipse(sx, sy, pd.rx, pd.ry, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = pd.opacity * 0.6;
                ctx.fillStyle = '#d0ecff';
                ctx.beginPath();
                ctx.ellipse(sx - pd.rx * 0.2, sy - pd.ry * 0.3, pd.rx * 0.5, pd.ry * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

        this.renderWildPokemon();

        this.teleports.forEach(t => {
            const sx = t.sign_x - camX;
            const sy = t.sign_y - camY;
            if (sx + t.sign_width < -50 || sx > cw + 50 || sy + t.sign_height < -50 || sy > ch + 50) return;
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(t.name, sx + t.sign_width / 2, sy - 6);
        });
        this.renderTeleportDom();

        this.drawRaidElements(ctx, camX, camY, cw, ch);
        this.drawGymElements(ctx, camX, camY, cw, ch);
        this.renderRankDom();

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
            ctx.ellipse(sx + ps / 2 + shadowOffX, sy + ps - 2 + shadowOffY, ps / 3, 4, 0, 0, Math.PI * 2);
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
                    this.drawSpriteReflection(img, offsetX + walkIdx * frameW, offsetY + dirIdx * frameH, frameW, frameH, sx, drawY, ps, ps);
                } else {
                    ctx.drawImage(img, sx, sy, ps, ps);
                    this.drawSpriteReflection(img, 0, 0, img.naturalWidth, img.naturalHeight, sx, sy, ps, ps);
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

        if (this.nearRaidPortal && this.raidPortal) {
            const p = this.raidPortal;
            const sx = p.pos_x - camX + (p.width || 64) / 2;
            const sy = p.pos_y - camY - 24;
            ctx.fillStyle = 'rgba(123, 47, 247, 0.9)';
            ctx.beginPath();
            ctx.roundRect(sx - 70, sy - 14, 140, 22, 6);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Pressione E para entrar na raid', sx, sy + 1);
        }

        if (this.nearGymNpc && this.gymNpc) {
            const sx = this.gymNpc.pos_x - camX;
            const sy = this.gymNpc.pos_y - camY - 50;
            ctx.fillStyle = 'rgba(233, 69, 96, 0.9)';
            ctx.beginPath();
            ctx.roundRect(sx - 70, sy - 14, 140, 22, 6);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Pressione E para interagir', sx, sy + 1);
        }

        if (this.nearRaidExit && this.raidExit) {
            const e = this.raidExit;
            const sx = e.pos_x - camX;
            const sy = e.pos_y - camY - 24;
            ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
            ctx.beginPath();
            ctx.roundRect(sx - 60, sy - 14, 120, 22, 6);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Pressione E para sair', sx, sy + 1);
        }

        if (this.inActiveGymZone) {
            const cx = this.canvas.width / 2;
            const cy = this.canvas.height - 80;
            ctx.fillStyle = 'rgba(233, 69, 96, 0.9)';
            ctx.beginPath();
            ctx.roundRect(cx - 130, cy - 16, 260, 30, 8);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('APERTE E PARA DESAFIAR O LÍDER', cx, cy + 5);
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
            ctx.ellipse(drawX + ps / 2 + shadowOffX, drawY + ps - 2 + shadowOffY, ps / 3, 4, 0, 0, Math.PI * 2);
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
                    const walkIdx = isMoving ? Math.min(Math.floor(pmp * 4), 3) : 0;
                    ctx.drawImage(skinImg, walkIdx * frameW, row * frameH, frameW, frameH, drawX, drawY, ps, ps);
                    this.drawSpriteReflection(skinImg, walkIdx * frameW, row * frameH, frameW, frameH, drawX, drawY, ps, ps);
                } else {
                    ctx.drawImage(skinImg, drawX, drawY, ps, ps);
                    this.drawSpriteReflection(skinImg, 0, 0, skinImg.naturalWidth, skinImg.naturalHeight, drawX, drawY, ps, ps);
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

            const title = p.isMe ? (this.myEquippedTitle || null) : (p.equipped_title || null);
            if (title) {
                const titleId = p.isMe ? (this.myEquippedTitleId || null) : (p.equipped_title_id || null);
                const rarity = window.Titles ? window.Titles.getRarity(titleId) : 'common';
                let color;
                if (rarity === 'mythic') {
                    const hue = (Date.now() / 12) % 360;
                    color = `hsl(${hue}, 100%, 65%)`;
                } else {
                    color = (window.Titles && window.Titles.getRarityStyle(titleId)) ? window.Titles.getRarityStyle(titleId).color : '#fbbf24';
                }
                ctx.fillStyle = color;
                ctx.font = 'bold 10px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.shadowColor = 'rgba(0,0,0,0.9)';
                ctx.shadowBlur = 3;
                ctx.fillText(title, drawX + ps / 2, drawY - 20);
                ctx.shadowBlur = 0;
            }
        });

        ctx.restore();

        // Day/night overlay
        if (dn.darkness > 0.01) {
            ctx.save();
            ctx.globalAlpha = dn.darkness;
            ctx.fillStyle = `rgb(${dn.tint.r},${dn.tint.g},${dn.tint.b})`;
            ctx.fillRect(0, 0, cw, ch);
            ctx.restore();
        }

        // Night lights (lamps glow as it gets dark)
        if (dn.darkness > 0.15 && this.lights.length > 0) {
            const intensity = Math.min(1, (dn.darkness - 0.15) / 0.5);
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            for (const l of this.lights) {
                const sx = l.pos_x - camX;
                const sy = l.pos_y - camY;
                if (sx < -300 || sx > cw + 300 || sy < -300 || sy > ch + 300) continue;
                const radius = (l.radius || 120);
                const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
                grad.addColorStop(0, `rgba(255,220,150,${0.5 * intensity})`);
                grad.addColorStop(0.3, `rgba(255,200,120,${0.28 * intensity})`);
                grad.addColorStop(1, 'rgba(255,180,80,0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(sx, sy, radius, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        // Weather particles
        const weather = this._weather || 'clear';
        if (weather !== 'clear') {
            ctx.save();
            for (const p of this.weatherParticles) {
                if (weather === 'rain') {
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p.x + p.wind * 0.5, p.y + p.len);
                    ctx.strokeStyle = `rgba(120,180,255,${p.opacity})`;
                    ctx.lineWidth = 1.2;
                    ctx.stroke();
                } else {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(220,235,255,${p.opacity})`;
                    ctx.fill();
                }
            }
            ctx.restore();
        }

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
