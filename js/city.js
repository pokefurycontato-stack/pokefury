// Tipos de grama alta (mesmo comportamento de ocultar o personagem/followers/selvagens)
const GRASS_ASSET_IDS = new Set([
    'grama', 'gramagelo', 'gramametal', 'gramapedra',
    'gramapraia', 'gramapsi', 'gramavoa', 'gramavulc'
]);

// Agua (praia/lagoa): oculta como a grama + efeito de boiar, bolhas contínuas e ondas
const WATER_ASSET_IDS = new Set([
    'praiacerto1'
]);

// Cores das bolhas de agua
const WATER_FX = {
    bubble: ['#eaf6ff', '#c9e8ff', '#ffffff', '#d8f0ff']
};

// Config das particulas ao andar sobre cada tipo de grama
const GRASS_FX = {
    grama:      { kind: 'blade', colors: ['#5cc048', '#6fd457', '#3f9c33'] },
    gramagelo:  { kind: 'ice',   colors: ['#d8f2ff', '#a8dcff', '#eaf9ff'] },
    gramametal: { kind: 'metal', colors: ['#aeb6c4', '#8b93a3', '#cdd4e0'] },
    gramapedra: { kind: 'smoke', colors: ['#8a6b45', '#6f5537', '#a5855f'] },
    gramapraia: { kind: 'sand',  colors: ['#ecd9a4', '#d8c187', '#f2e5bd'] },
    gramapsi:   { kind: 'smoke', colors: ['#5b2d8f', '#3f1d66', '#7a44b8'] },
    gramavoa:   { kind: 'smoke', colors: ['#4f86d8', '#3867b8', '#6ba1e8'] },
    gramavulc:  { kind: 'soot',  colors: ['#2b2b2b', '#1a1a1a', '#454545'] }
};

class CityScreen {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.cameraZoom = parseFloat(localStorage.getItem('pokefury_camera_zoom') || '1.5');
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
        this._grassParticles = [];
        this._waterParticles = [];
        this._animTime = 0;
        this.playerFromY = 400;
        this.playerDir = 'down';
        this.playerMoving = false;
        this.moveProgress = 1;
        this.playerSpeed = 60;
        this.playerSize = 48;
        this.followerBehind = 26;
        this.followerSideOffset = 40;
        // Offset para baixo (follower atras quando o jogador olha pra baixo): pequeno,
        // pra pokemon ficar tuckado nas costas, parcialmente coberto pelo treinador.
        this.followerDownOffset = 10;
        // Velocidade do follower em u/frame (dt=1 = 60fps). O jogador anda ~2.4u/frame,
        // entao 2.1 deixa o pokemon levemente mais lento: segue sempre, sem "borracha".
        this.followerSpeed = 2.1;
        this.followerCatchupSpeed = 3.4;
        this.grassForegroundOffset = 18;
        this.grassForegroundHalf = 40;
        this.grassForegroundPad = 8;
        this.grassWaveAmp = 8;
        // Agua: corte mais fundo que a grama (submerge) mas deixa o personagem mais visivel
        this.waterForegroundOffset = 20;
        this.waterForegroundHalf = 46;
        this.waterForegroundPad = 6;
        // Ondas de espuma que quebram nas entidades dentro d'agua
        this.waterWaveInterval = 1.6;
        this._waterWaves = [];
        this._waveTimer = 0;
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
        this._forcedWeather = null;
        this._forcedWeatherUntil = 0;
        this._forcedWeatherSub = null;
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

        // Pokemon seguindo o jogador
        this.pokemonFollowing = null;
        this.pokemonFollowSpriteUrl = null;
        this.pokemonFollowBackSpriteUrl = null;
        this.pokemonFollowStaticUrl = null;
        this.pokemonFollowEl = null;
        this.pokemonFollowShadowEl = null;
        this.pokemonFollowRenderX = this.playerX;
        this.pokemonFollowRenderY = this.playerY;
        this.pokemonFollowIdleTimer = 0;
        this.pokemonFollowIdleFlip = false;
        this._otherFollowerEls = {};

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
            <button data-action="group-invite" style="display:block;width:100%;padding:9px 14px;background:none;border:none;color:#fff;font-size:12px;font-weight:600;cursor:pointer;text-align:left;border-top:1px solid rgba(255,255,255,0.08);">Enviar convite de grupo</button>
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

        menu.querySelector('[data-action="group-invite"]').addEventListener('click', async () => {
            menu.remove();
            if (friendId && window.GroupSystem) {
                const result = await window.GroupSystem.sendInvite(friendId, name);
                if (result && result.error) {
                    window.pokefury?.showToast?.(result.error, 'error');
                } else if (result && result.ok) {
                    window.pokefury?.showToast?.('Convite de grupo enviado!', 'success');
                }
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
        this._ensureDepthCanvases();

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
            this._setupSettings();
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
        this._startSpriteReaper();
        this._setupCityChat();
        this._setupSettings();
        if (window.GroupSystem) window.GroupSystem.init();
        this.loadForcedWeather();
        // Pokemon seguindo o jogador na cidade
        this.updateCityFollower();
        // Pré-computa a cadeia de climas até o slot atual (evita travar o 1º frame)
        this.getWeather();
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
        if (!window.adminOverworldAccess) {
            // Jogadores (e admin fora do hub) permanecem na cidade (overworld so via admin.html)
            return;
        }
        this.running = false;
        window.cityModeActive = false;
        document.getElementById('city-screen').classList.add('hidden');
        document.getElementById('city-premium-modal')?.classList.add('hidden');
        this.hideBattleZoneUI();
        this.closeNpcDialogue();
        this.closeScanPopup();
        this.closeScanDetail();
        const scanBtn = document.getElementById('city-scan-btn');
        if (scanBtn) scanBtn.classList.add('hidden');
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
        this._stopSpriteReaper();
        this.players = {};
        if (this.pokemonFollowEl) { this.pokemonFollowEl.remove(); this.pokemonFollowEl = null; }
        if (this.pokemonFollowShadowEl) { this.pokemonFollowShadowEl.remove(); this.pokemonFollowShadowEl = null; }
        if (this.pokemonFollowGrassEl) { this.pokemonFollowGrassEl.remove(); this.pokemonFollowGrassEl = null; }
        for (const uid of Object.keys(this._otherFollowerEls || {})) this._removeOtherFollowerEls(uid);
        this._otherFollowerEls = {};
        this.pokemonFollowing = null;
        this.pokemonFollowSpriteUrl = null;
        this.pokemonFollowBackSpriteUrl = null;
        for (const p of (this.wildPokemon || [])) {
            if (p._el) { try { p._el.remove(); } catch (e) {} }
            if (p._grassEl) { try { p._grassEl.remove(); } catch (e) {} }
        }
        this.wildPokemon = [];
        if (this._nightOverlayEl) { this._nightOverlayEl.remove(); this._nightOverlayEl = null; }
        if (this._labelsOverlayEl) { this._labelsOverlayEl.remove(); this._labelsOverlayEl = null; }
        this._playerLabels = [];
        if (this._grassFxEl) { this._grassFxEl.remove(); this._grassFxEl = null; }
        this._grassParticles = [];
        if (this._waterFxEl) { this._waterFxEl.remove(); this._waterFxEl = null; }
        this._waterParticles = [];
        this._waterWaves = [];
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
        if (this._forcedWeatherSub) {
            try { this._forcedWeatherSub.unsubscribe(); } catch (e) {}
            this._forcedWeatherSub = null;
        }
        if (this._weatherAdminTimer) {
            clearInterval(this._weatherAdminTimer);
            this._weatherAdminTimer = null;
        }
        document.getElementById('city-weather-admin')?.remove();
        if (window._cityResizeHandler) {
            window.removeEventListener('resize', window._cityResizeHandler);
        }
        if (window._cityBeforeUnload) {
            window.removeEventListener('beforeunload', window._cityBeforeUnload);
        }
        const sfx = window.pokefury && window.pokefury.sfx;
        if (sfx) sfx.stopAll();
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
            // Backing store menor + CSS 100% = zoom (1.5x aproxima a camera).
            // Todos os overlays DOM usam canvas.width/scaleX derivados daqui, entao escalam junto.
            const z = this.cameraZoom || 1;
            this.canvas.width = Math.round(rect.width / z);
            this.canvas.height = Math.round(rect.height / z);
            if (this.depthCanvases) {
                for (const c of this.depthCanvases) {
                    c.width = this.canvas.width;
                    c.height = this.canvas.height;
                }
            }
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
            this._grassTiles = this.assets.filter(a => this._isGrassAsset(a));
            this._waterTiles = this.assets.filter(a => this._isWaterAsset(a));
            this._occluderTiles = [...(this._grassTiles || []), ...(this._waterTiles || [])];
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
        } else if (!inactive) {
            if (this._isVisible !== true) this._isVisible = true;
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
            const now = Date.now();
            (data || []).forEach(p => {
                if (p.user_id === this.authUserId) return;
                if (p.is_visible === false) return;
                if (!this.isCityPlayerActive(p, now)) return;
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

    isCityPlayerActive(p, now) {
        if (!p || p.is_visible === false) return false;
        const t = p.updated_at ? new Date(p.updated_at).getTime() : 0;
        if (!t) return true;
        return (now || Date.now()) - t < 10 * 60 * 1000;
    }

    _startSpriteReaper() {
        if (this._spriteReaperTimer) return;
        this._spriteReaperTimer = setInterval(() => {
            const now = Date.now();
            for (const key of Object.keys(this.players)) {
                const p = this.players[key];
                if (p.user_id === this.authUserId) continue;
                if (!this.isCityPlayerActive(p, now)) {
                    this._removeOtherFollowerEls(p.user_id);
                    delete this.players[key];
                }
            }
        }, 15000);
    }

    _stopSpriteReaper() {
        if (this._spriteReaperTimer) { clearInterval(this._spriteReaperTimer); this._spriteReaperTimer = null; }
    }

    subscribeRealtime() {
        if (this.channel) this.channel.unsubscribe();
        this.channel = window.db.channel('city-players');
        this.channel.on('postgres_changes', { event: '*', schema: 'public', table: 'city_players' }, (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                const p = payload.new;
                if (p.user_id === this.authUserId) return;
                if (p.is_visible === false) {
                    this._removeOtherFollowerEls(p.user_id);
                    delete this.players[p.user_id];
                    return;
                }
                if (!this.isCityPlayerActive(p)) {
                    this._removeOtherFollowerEls(p.user_id);
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
                    existing.follower_id = p.follower_id;
                    existing.follower_sprite_url = p.follower_sprite_url;
                    existing.follower_back_url = p.follower_back_url;
                    existing.follower_static_url = p.follower_static_url;
                    existing.follower_scale = p.follower_scale;
                    if (p.skin_url && p.skin_url !== existing.skin_url) {
                        existing.skin_url = p.skin_url;
                        const img = new Image();
                        img.crossOrigin = 'anonymous';
                        img.src = p.skin_url;
                        existing._skinImg = img;
                    }
                }
            } else if (payload.eventType === 'DELETE') {
                this._removeOtherFollowerEls(payload.old?.user_id);
                delete this.players[payload.old?.user_id];
            }
        }).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'city_forced_teleports' }, (payload) => {
            const t = payload.new;
            if (!t || t.user_id !== this.authUserId) return;
            this.playerX = t.pos_x;
            this.playerY = t.pos_y;
            this.playerFromX = t.pos_x;
            this.playerFromY = t.pos_y;
            this.cameraX = t.pos_x;
            this.cameraY = t.pos_y;
            this.syncPosition();
            if (window.pokefury?.showToast) window.pokefury.showToast('Um administrador te reposicionou para o spawn da cidade.', 'info');
            // Remove a notificação após aplicar
            window.db.from('city_forced_teleports').delete().eq('id', t.id).then(() => {}).catch(() => {});
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
            // Aviadora (region_selector) removida: regioes unificadas, sem viagem entre regioes
            this.npcs = (data || []).filter(n => n.npc_type !== 'region_selector').map(n => ({
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
            n.direction = 'down';
            n.walkFrame = 0;
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
            if (biome) {
                // Todas as regioes unificadas: todos os mapas com o nome do bioma
                const biomeMaps = await game.regionManager.loadMapsByBiome(biome);
                for (const m of (biomeMaps || [])) {
                    const list = await game.regionManager.loadMapEncounters(m.id);
                    encounters = encounters.concat(list || []);
                }
            }
            if ((!encounters || encounters.length === 0) && game.currentMap?.id) {
                encounters = await game.regionManager.loadMapEncounters(game.currentMap.id);
            }
        } catch (e) {
        }
        return encounters;
    }

    async filterSpawnEncounters(encounters, biome) {
        if (window.SpawnFilter) {
            try {
                return await window.SpawnFilter.filterEncounters(encounters, biome);
            } catch (e) {
            }
        }
        return encounters;
    }

    _setupSettings() {
        if (this._settingsBound) return;
        this._settingsBound = true;

        const btn = document.getElementById('city-settings-btn');
        const popup = document.getElementById('city-settings-popup');
        if (!btn || !popup) return;

        const showTab = (tab) => {
            const gp = document.getElementById('city-settings-gameplay');
            const g = document.getElementById('city-settings-graphics');
            const s = document.getElementById('city-settings-sound');
            if (gp) gp.classList.toggle('hidden', tab !== 'gameplay');
            if (g) g.classList.toggle('hidden', tab !== 'graphics');
            if (s) s.classList.toggle('hidden', tab !== 'sound');
            document.querySelectorAll('.city-settings-tab').forEach(t => {
                const active = t.dataset.tab === tab;
                t.style.background = active ? 'rgba(56,189,248,0.18)' : 'none';
                t.style.color = active ? '#7dd3fc' : 'rgba(255,255,255,0.6)';
            });
        };

        btn.addEventListener('click', () => {
            popup.classList.remove('hidden');
            this._syncSettingsForm();
        });

        const closeBtn = document.getElementById('city-settings-close');
        if (closeBtn) closeBtn.addEventListener('click', () => popup.classList.add('hidden'));

        popup.addEventListener('click', (e) => {
            if (e.target === popup) popup.classList.add('hidden');
        });

        document.querySelectorAll('.city-settings-tab').forEach(t => {
            t.addEventListener('click', () => showTab(t.dataset.tab));
        });

        const saveBtn = document.getElementById('city-settings-save');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const sel = document.querySelector('input[name="city-zoom"]:checked');
                if (sel) {
                    const v = parseFloat(sel.value);
                    if (Number.isFinite(v) && v > 0 && this.cameraZoom !== v) {
                        this.cameraZoom = v;
                        localStorage.setItem('pokefury_camera_zoom', String(v));
                        this.resizeCanvas();
                    }
                }
                const msg = document.getElementById('city-settings-save-msg');
                if (msg) {
                    msg.style.opacity = '1';
                    clearTimeout(this._saveMsgTimer);
                    this._saveMsgTimer = setTimeout(() => { msg.style.opacity = '0'; }, 1600);
                }
            });
        }

        const saveGameplayBtn = document.getElementById('city-settings-save-gameplay');
        if (saveGameplayBtn) {
            saveGameplayBtn.addEventListener('click', () => {
                const gSel = document.querySelector('input[name="city-auto-group"]:checked');
                const pSel = document.querySelector('input[name="city-auto-pvp"]:checked');
                localStorage.setItem('pokefury_auto_decline_group', gSel ? gSel.value : 'false');
                localStorage.setItem('pokefury_auto_decline_pvp', pSel ? pSel.value : 'false');
                const msg = document.getElementById('city-settings-save-msg-gameplay');
                if (msg) {
                    msg.style.opacity = '1';
                    clearTimeout(this._saveGpTimer);
                    this._saveGpTimer = setTimeout(() => { msg.style.opacity = '0'; }, 1600);
                }
            });
        }

        const musicSlider = document.getElementById('city-settings-music-volume');
        if (musicSlider) {
            musicSlider.addEventListener('input', () => {
                const v = parseInt(musicSlider.value, 10) / 100;
                const game = window.pokefury;
                if (game && game.music) game.music.setVolume(v);
            });
        }

        const sfxSlider = document.getElementById('city-settings-sfx-volume');
        if (sfxSlider) {
            sfxSlider.addEventListener('input', () => {
                const v = parseInt(sfxSlider.value, 10) / 100;
                const game = window.pokefury;
                if (game) {
                    game.sfxVolume = v;
                    if (game.sfx) game.sfx.setVolume(v);
                    else localStorage.setItem('pokefury_sfx_volume', String(v));
                }
            });
        }
    }

    _syncSettingsForm() {
        document.querySelectorAll('.city-zoom-opt').forEach(l => {
            const r = l.querySelector('input[name="city-zoom"]');
            if (!r) return;
            const on = Math.abs(parseFloat(r.value) - this.cameraZoom) < 0.01;
            r.checked = on;
            l.style.borderColor = on ? 'rgba(56,189,248,0.5)' : 'rgba(255,255,255,0.14)';
            l.style.background = on ? 'rgba(56,189,248,0.08)' : 'rgba(255,255,255,0.04)';
            const label = l.querySelector('span');
            if (label && on) label.style.color = '#7dd3fc';
        });
        document.querySelectorAll('.city-gameplay-opt').forEach(l => {
            const r = l.querySelector('input[type="radio"]');
            if (!r) return;
            const current = l.dataset.key === 'pvp'
                ? localStorage.getItem('pokefury_auto_decline_pvp')
                : localStorage.getItem('pokefury_auto_decline_group');
            const on = (current === 'true') === (r.value === 'true');
            r.checked = on;
            l.style.borderColor = on ? 'rgba(56,189,248,0.5)' : 'rgba(255,255,255,0.14)';
            l.style.background = on ? 'rgba(56,189,248,0.08)' : 'rgba(255,255,255,0.04)';
            const label = l.querySelector('span');
            if (label) label.style.color = on ? '#7dd3fc' : '#fff';
        });
        const game = window.pokefury;
        const ms = document.getElementById('city-settings-music-volume');
        if (ms && game && game.music) ms.value = Math.round(game.music.volume * 100);
        const ss = document.getElementById('city-settings-sfx-volume');
        if (ss) ss.value = Math.round(parseFloat(localStorage.getItem('pokefury_sfx_volume') || '0.8') * 100);
    }

    // ==================== SCANNER ====================
    updateScanButton() {
        const btn = document.getElementById('city-scan-btn');
        if (!btn) return;
        const inZone = !!this.currentSpawnZone;
        btn.classList.toggle('hidden', !inZone);
        if (this.currentSpawnZone && this.currentSpawnZone.biome) {
            btn.title = 'Scanner: ' + this.currentSpawnZone.biome;
        }
    }

    async openScanPopup() {
        const zone = this.currentSpawnZone;
        if (!zone || !zone.biome) return;
        const overlay = document.getElementById('city-scan-popup');
        if (!overlay) return;
        overlay.classList.remove('hidden');
        const titleEl = document.getElementById('city-scan-title');
        if (titleEl) titleEl.textContent = 'Scanner • ' + zone.biome;
        const content = document.getElementById('city-scan-content');
        if (content) content.innerHTML = '<div style="color:#888;text-align:center;padding:30px;">Carregando...</div>';

        let encounters = [];
        try {
            encounters = await this.filterSpawnEncounters(await this.resolveSpawnEncounters(zone.biome), zone.biome);
        } catch (e) {
            encounters = [];
        }

        const ids = [...new Set((encounters || []).map(e => e && e.pokemon_id).filter(Boolean))];
        let timeMap = {};
        if (ids.length) {
            try {
                const { data } = await window.db.from('pokemon_spawn_time').select('pokemon_id,time_of_day').in('pokemon_id', ids);
                for (const r of data || []) timeMap[String(r.pokemon_id)] = r.time_of_day;
            } catch (e) {}
        }

        const RARITY_ORDER = ['common', 'uncommon', 'rare', 'inicial', 'legendary'];
        const RARITY_LABELS = { common: 'Comuns', uncommon: 'Incomuns', rare: 'Raros', legendary: 'Lendários', inicial: 'Iniciais' };
        const RARITY_COLORS = { common: '#aaa', uncommon: '#3498db', rare: '#e94560', legendary: '#f39c12', inicial: '#2ecc71' };

        const groups = {};
        for (const e of encounters || []) {
            if (!e || e.pokemon_id == null) continue;
            const rar = e.rarity || 'common';
            const tod = timeMap[String(e.pokemon_id)] || 'all';
            if (!groups[rar]) groups[rar] = { all: [], day: [], night: [] };
            groups[rar][tod].push(e);
        }

        const rarKeys = Object.keys(groups).sort((a, b) => {
            const ia = RARITY_ORDER.indexOf(a);
            const ib = RARITY_ORDER.indexOf(b);
            if (ia === -1 && ib === -1) return a.localeCompare(b);
            if (ia === -1) return 1;
            if (ib === -1) return -1;
            return ia - ib;
        });

        let html = '';
        for (const rar of rarKeys) {
            const g = groups[rar];
            const label = RARITY_LABELS[rar] || rar;
            const color = RARITY_COLORS[rar] || '#aaa';
            html += '<div style="margin-bottom:18px;">';
            html += `<div style="color:${color};font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:6px;">${label} <span style="color:rgba(255,255,255,0.35);font-weight:600;font-size:11px;">(${g.all.length + g.day.length + g.night.length})</span></div>`;
            const subGroups = [
                { key: 'day', label: '☀️ Só de dia', list: g.day },
                { key: 'night', label: '🌙 Só de noite', list: g.night },
                { key: 'all', label: '🕐 Qualquer horário', list: g.all }
            ];
            for (const sg of subGroups) {
                if (!sg.list || sg.list.length === 0) continue;
                html += `<div style="font-size:11px;color:rgba(255,255,255,0.5);margin:6px 0 4px;">${sg.label}</div>`;
                html += this.renderScanGrid(sg.list);
            }
            html += '</div>';
        }
        if (!html) html = '<div style="color:#888;text-align:center;padding:30px;">Nenhum Pokémon encontrado nesta zona.</div>';

        content.innerHTML = html;
        content.querySelectorAll('.scan-pkm').forEach(el => {
            el.addEventListener('click', () => {
                const id = el.dataset.id;
                const name = el.dataset.name;
                this.openScanDetail(id, name);
            });
        });
    }

    renderScanGrid(list) {
        const seen = new Set();
        let html = '<div style="display:flex;flex-wrap:wrap;gap:10px;">';
        for (const e of list) {
            if (!e || e.pokemon_id == null) continue;
            if (seen.has(String(e.pokemon_id))) continue;
            seen.add(String(e.pokemon_id));
            const spriteUrl = window.PokeAPI ? window.PokeAPI.getAnimatedFrontUrl(e.pokemon_id) : (e.sprite_url || '');
            const staticUrl = (window.PokeAPI ? `${window.PokeAPI.supabaseStorageUrl}/home-front/${e.pokemon_id}.png` : (e.sprite_url || ''));
            html += `<div class="scan-pkm" data-id="${e.pokemon_id}" data-name="${encodeURIComponent(e.pokemon_name || '')}" style="cursor:pointer;text-align:center;width:74px;transition:transform 0.15s;" onmouseover="this.style.transform='scale(1.08)'" onmouseout="this.style.transform='scale(1)'">`;
            html += `<img src="${spriteUrl}" data-static="${staticUrl}" alt="${e.pokemon_name || ''}" loading="lazy" onerror="if(this.dataset.static && this.src !== this.dataset.static){this.src=this.dataset.static;}else{this.style.opacity=0.2;}" style="width:64px;height:64px;image-rendering:pixelated;background:rgba(255,255,255,0.04);border-radius:8px;border:1px solid rgba(255,255,255,0.08);padding:4px;">`;
            html += `<div style="color:#fff;font-size:10px;font-weight:600;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e.pokemon_name || ''}</div>`;
            html += '</div>';
        }
        html += '</div>';
        return html;
    }

    async openScanDetail(pokemonId, name) {
        const overlay = document.getElementById('city-scan-detail-popup');
        if (!overlay) return;
        overlay.classList.remove('hidden');
        const box = document.getElementById('city-scan-detail-box');
        if (box) box.innerHTML = '<div style="color:#888;text-align:center;padding:20px;">Carregando...</div>';

        let types = [];
        let sprite = window.PokeAPI ? window.PokeAPI.getAnimatedFrontUrl(pokemonId) : '';
        let staticUrl = window.PokeAPI ? `${window.PokeAPI.supabaseStorageUrl}/home-front/${pokemonId}.png` : '';
        try {
            const p = await window.PokeAPI.ensurePokemon(pokemonId);
            if (p) {
                types = p.types || [];
                sprite = window.PokeAPI.getAnimatedFrontUrl(p.id);
                staticUrl = p.sprite_official || p.sprite_home || `${window.PokeAPI.supabaseStorageUrl}/home-front/${p.id}.png`;
            }
        } catch (e) {}

        const typeHtml = types.map(t =>
            `<span class="type-badge type-${t}">${t}</span>`
        ).join(' ');

        if (box) box.innerHTML = `
            <img src="${sprite}" data-static="${staticUrl}" alt="${name}" onerror="if(this.dataset.static && this.src !== this.dataset.static){this.src=this.dataset.static;}else{this.style.opacity=0.2;}" style="width:110px;height:110px;image-rendering:pixelated;display:block;margin:0 auto 10px;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.5));">
            <div style="color:#fff;font-size:17px;font-weight:700;margin-bottom:10px;">${name}</div>
            <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;">${typeHtml || '<span style="color:#888;font-size:12px;">Sem tipo</span>'}</div>
        `;
    }

    closeScanPopup() {
        document.getElementById('city-scan-popup')?.classList.add('hidden');
    }

    closeScanDetail() {
        document.getElementById('city-scan-detail-popup')?.classList.add('hidden');
    }

    async spawnVisiblePokemon() {
        for (const p of (this.wildPokemon || [])) {
            if (p._el) { try { p._el.remove(); } catch (e) {} }
            if (p._grassEl) { try { p._grassEl.remove(); } catch (e) {} }
        }
        this.wildPokemon = [];
        if (!this.spawnPoints || this.spawnPoints.length === 0) return;

        const wrap = document.getElementById('city-canvas-wrap');
        if (!wrap) return;
        // Os selvagens vivem no MESMO wrap das faixas/followers, com z por banda
        // (3+2b). Ficam abaixo do topCtx, entao o dia/noite os escurece naturalmente
        // sem precisar de mascara.
        this.wildPokemonLayer = wrap;

        const game = window.pokefury;
        const charId = window.GameData?.currentCharacterId;

        for (const point of this.spawnPoints) {
            const biome = this.getSpawnZoneBiomeForPoint(point);
            if (!biome) continue;

            // Conta especies ja no mapa para nao repetir mais de 2 de cada
            const currentIds = this.wildPokemon.map(p => p.encounter?.pokemon_id).filter(Boolean);
            const placedCounts = {};
            for (const id of currentIds) placedCounts[String(id)] = (placedCounts[String(id)] || 0) + 1;

            let encounter;
            let isShiny = false;
            let serverSprite = null;
            if (charId) {
                // RPC com re-roll enquanto sortear especie que ja atingiu o limite (max 2 por especie)
                for (let attempt = 0; attempt < 3; attempt++) {
                    try {
                        const { data, error } = await window.db.rpc('roll_spawn_by_biome', {
                            p_character_id: charId,
                            p_biome: biome,
                            p_is_night: this.getDayNight().isNight
                        });
                        if (error || !data?.success) break;
                        if ((placedCounts[String(data.pokemon_id)] || 0) >= 2) continue;
                        encounter = {
                            pokemon_id: data.pokemon_id,
                            pokemon_name: data.pokemon_name,
                            sprite_url: data.sprite_url
                        };
                        isShiny = data.is_shiny || false;
                        serverSprite = data.sprite_url;
                        break;
                    } catch (e) { break; }
                }
            }

            if (!encounter) {
                const encounters = await this.filterSpawnEncounters(await this.resolveSpawnEncounters(biome), biome);
                if (!encounters || encounters.length === 0) continue;
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
            wrap.appendChild(el);
            const grassEl = document.createElement('canvas');
            grassEl.style.cssText = 'position:absolute;pointer-events:none;';
            wrap.appendChild(grassEl);
            this.wildPokemon.push({
                point,
                biome,
                encounter,
                spriteUrl,
                isShiny,
                _el: el,
                _grassEl: grassEl,
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
        let base = 52;
        if (enc.pokemon_id && window.PokeAPI && window.PokeAPI.pokemonCache) {
            const data = window.PokeAPI.pokemonCache[String(enc.pokemon_id)];
            if (data && data.height) base = 48 + Math.min(12, Math.round((data.height - 5) * 1.2));
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

        // Conta especies ja no mapa (ignorando p, que esta sendo substituido) para nao repetir mais de 2 de cada
        const currentIds = this.wildPokemon.filter(wp => wp !== p).map(wp => wp.encounter?.pokemon_id).filter(Boolean);
        const placedCounts = {};
        for (const id of currentIds) placedCounts[String(id)] = (placedCounts[String(id)] || 0) + 1;

        if (charId) {
            // RPC com re-roll enquanto sortear especie que ja atingiu o limite (max 2 por especie)
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    const { data, error } = await window.db.rpc('roll_spawn_by_biome', {
                        p_character_id: charId,
                        p_biome: biome,
                        p_is_night: this.getDayNight().isNight
                    });
                    if (error || !data?.success) break;
                    if ((placedCounts[String(data.pokemon_id)] || 0) >= 2) continue;
                    encounter = {
                        pokemon_id: data.pokemon_id,
                        pokemon_name: data.pokemon_name,
                        sprite_url: data.sprite_url
                    };
                    isShiny = data.is_shiny || false;
                    serverSprite = data.sprite_url;
                    break;
                } catch (e) { break; }
            }
        }

        if (!encounter) {
            let encounters = [];
            try {
                encounters = await this.filterSpawnEncounters(await this.resolveSpawnEncounters(biome), biome);
            } catch (e) {
            }
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
            if (p._grassEl) p._grassEl.style.display = 'none';
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
            // Banda pela profundidade real (pos_y = pes) e z 3+2b, como os followers.
            // O dia/noite e coberto pelo overlay acima de tudo (z 25), na mesma cor,
            // independente da banda -> nenhuma mascara.
            const band = this._bandForFollower(p.pos_y, this._depthSplits);
            const z = (3 + 2 * band) + '';
            el.style.zIndex = z;
            const sz = this.getWildPokemonSize(p);
            const natW = el.naturalWidth || 0;
            const natH = el.naturalHeight || 0;
            let aspect = 1;
            if (natW > 0 && natH > 0) aspect = Math.min(1.5, Math.max(0.6, natW / natH));
            const w = Math.max(1, Math.round(sz * aspect));
            const h = sz;
            const _wBob = this._waterBobAt(p.pos_x, p.pos_y);
            const sx = p.pos_x - camX;
            const sy = p.pos_y - camY + _wBob;
            if (sx + w < -50 || sx > this.canvas.width + 50 || sy + h < -50 || sy > this.canvas.height + 50) {
                el.style.display = 'none';
                if (p._grassEl) p._grassEl.style.display = 'none';
                continue;
            }
            el.style.display = 'block';
            el.style.left = (offsetX + (sx - w / 2) * scaleX) + 'px';
            el.style.top = (offsetY + (sy - h) * scaleY) + 'px';
            el.style.width = (w * scaleX) + 'px';
            el.style.height = (h * scaleY) + 'px';

            // Grama/agua na frente do pokemon selvagem (recorte alinhado da mesma textura)
            if (p._grassEl) {
                const _inW = this._inWaterAt(p.pos_x, p.pos_y);
                const _off0 = _inW ? this.waterForegroundOffset : this.grassForegroundOffset;
                const _half0 = _inW ? this.waterForegroundHalf : this.grassForegroundHalf;
                const _pad0 = _inW ? this.waterForegroundPad : this.grassForegroundPad;
                const fOff = Math.max(8, Math.round(_off0 * (sz / this.playerSize)));
                const fHalf = Math.max(16, Math.round(Math.max(sz, w) * 0.55));
                const fPad = Math.max(2, Math.round(_pad0 * (sz / this.playerSize)));
                this._drawGrassFrontOverlay(p._grassEl, this._occluderTiles || this._grassTiles || [], p.pos_x, p.pos_y + _wBob, fOff, fHalf, fPad, camX, camY, scaleX, scaleY, offsetX, offsetY, z);
            }
        }
    }

    async triggerCitySpawnBattle(zone) {
        if (!zone || !window.pokefury) return;
        const game = window.pokefury;
        if (game.state === 'battle' || game._battleStarting) return;
        if (this.spawnZoneCooldown > 0) return;

        let encounters = [];
        try {
            if (zone.biome) {
                // Todas as regioes unificadas: todos os mapas com o nome do bioma
                const biomeMaps = await game.regionManager.loadMapsByBiome(zone.biome);
                for (const m of (biomeMaps || [])) {
                    const list = await game.regionManager.loadMapEncounters(m.id);
                    encounters = encounters.concat(list || []);
                }
            }
            if ((!encounters || encounters.length === 0) && game.currentMap?.id) {
                encounters = await game.regionManager.loadMapEncounters(game.currentMap.id);
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

        encounters = await this.filterSpawnEncounters(encounters, zone.biome || (game.currentMap?.name || null));

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
            // Todas as especies ja atingiram o limite (2 de cada): o ponto fica vazio, sem repeticao
            if (filtered.length === 0) return null;
            // Se so sobraram raridades ultra-raras (lendario/inicial), a zona esta saturada:
            // NAO forca o spawn do lendario — ponto fica vazio para preservar o spawn rate absoluto
            const hasNormal = filtered.some(e => (TIER_WEIGHT[e.rarity] ?? 1) >= 1);
            if (!hasNormal) return null;
            pool = filtered;
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
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.beginPath();
                ctx.ellipse(sx + ps / 2, sy + ps - 2, ps / 3, 4, 0, 0, Math.PI * 2);
                ctx.fill();
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
        layer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden;z-index:60;';
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
            layer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden;z-index:40;';
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
        layer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden;z-index:51;';
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
                const isTrainer = sp.rank_type === 'trainer';
                el = document.createElement('div');
                el.style.cssText = 'position:absolute;display:flex;flex-direction:column;align-items:center;pointer-events:none;';
                const wrap = document.createElement('div');
                wrap.style.cssText = (isTrainer ? 'overflow:hidden;' : '') + 'position:relative;';
                const img = document.createElement('img');
                img.style.cssText = 'image-rendering:pixelated;display:block;position:relative;z-index:2;' + (isTrainer ? '' : 'filter:drop-shadow(0 7px 5px rgba(0,0,0,0.5));');
                wrap.appendChild(img);
                if (isTrainer) {
                    const shadowEl = document.createElement('div');
                    shadowEl.style.cssText = 'position:absolute;left:50%;bottom:1px;transform:translateX(-50%);width:58%;height:9px;border-radius:50%;background:rgba(0,0,0,0.38);filter:blur(1.5px);';
                    wrap.appendChild(shadowEl);
                }
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
            const adj = entry ? (window.getPokemonSpriteAdjust ? window.getPokemonSpriteAdjust(entry.pokemon_id) : null) : null;
            el._img.style.transform = adj ? `scale(${adj.scaleX}, ${adj.scaleY})` : '';

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
        if (window.GroupSystem && window.GroupSystem.inGroup) {
            try {
                await window.db.rpc('group_update_skin', {
                    p_character_id: window.GameData?.currentCharacterId,
                    p_skin_url: skinUrl
                });
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

        // Jogadores (e admin fora do hub) permanecem na cidade: re-spawn imediato dos pokemons da nova regiao
        if (!window.adminOverworldAccess) {
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
        this._snapFollowerBehind();
    }

    // Teleporta junto o pokemon que segue: coloca ele na posicao "atras do jogador"
    // no destino (mesma regra do _updateCityFollowerMove), sem ficar atravessando o mapa.
    _snapFollowerBehind() {
        if (!this.pokemonFollowing || !this.pokemonFollowEl) return;
        const feetY = this.playerY + this.playerSize / 2;
        let behindX = this.playerX;
        let behindY = feetY;
        if (this.playerDir === 'down') behindY = this.playerY - this.followerDownOffset;
        else if (this.playerDir === 'up') behindY = feetY + this.followerBehind;
        else if (this.playerDir === 'left') behindX = this.playerX + this.followerSideOffset;
        else if (this.playerDir === 'right') behindX = this.playerX - this.followerSideOffset;
        this.pokemonFollowRenderX = behindX;
        this.pokemonFollowRenderY = behindY;
        this.pokemonFollowIdleTimer = 0;
        this.pokemonFollowIdleFlip = false;
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

    _playerHitbox(nx, ny) {
        const ps = 14;
        const feetY = ny + this.playerSize / 2;
        return { px: nx - ps / 2, py: feetY - ps, ps };
    }

    checkCollision(nx, ny) {
        // Hitbox pequena NOS PES (antes 32x32 no centro): permite chegar mais perto de
        // objetos sem atravessar, pois so a regiao dos pes e bloqueada.
        const hb = this._playerHitbox(nx, ny);
        const px = hb.px, py = hb.py, ps = hb.ps;
        for (const z of this.collisionZones) {
            if (px < z.pos_x + z.width && px + ps > z.pos_x && py < z.pos_y + z.height && py + ps > z.pos_y) return true;
        }
        return false;
    }

    // Calcula a posicao maxima alcancavel de (playerX, playerY) na direcao (dx,dy) com
    // distancia `dist`, parando ENCOSTADA na primeira colisao do caminho (nunca atravessa).
    // Retorna {x,y} ou null se nao consegue mover (ja encostado na colisao).
    _collisionSlide(dx, dy, dist) {
        const hb = this._playerHitbox(this.playerX, this.playerY);
        const ps = hb.ps, half = ps / 2;
        const top = this.playerY + this.playerSize / 2 - ps;
        const feetY = top + ps;
        if (dx) {
            let limit = dx > 0 ? Infinity : -Infinity;
            for (const z of this.collisionZones) {
                if (!(top < z.pos_y + z.height && feetY > z.pos_y)) continue;   // sem overlap em Y
                if (dx > 0) {
                    if (this.playerX + half > z.pos_x) continue;                // zona ja esta atras
                    const t = z.pos_x - half;                                   // borda direita encosta na esquerda da zona
                    if (t < limit) limit = t;
                } else {
                    if (this.playerX - half < z.pos_x + z.width) continue;      // zona ja esta atras
                    const t = z.pos_x + z.width + half;                         // borda esquerda encosta na direita da zona
                    if (t > limit) limit = t;
                }
            }
            const tx = dx > 0 ? Math.min(this.playerX + dist, limit) : Math.max(this.playerX - dist, limit);
            if (tx === this.playerX) return null;
            return { x: tx, y: this.playerY };
        }
        let limit = dy > 0 ? Infinity : -Infinity;
        for (const z of this.collisionZones) {
            const px = this.playerX - half;
            if (!(px < z.pos_x + z.width && px + ps > z.pos_x)) continue;       // sem overlap em X
            if (dy > 0) {
                if (feetY > z.pos_y) continue;                                  // zona ja esta acima
                const t = z.pos_y - this.playerSize / 2;                        // base (pes) encosta no topo da zona
                if (t < limit) limit = t;
            } else {
                if (top < z.pos_y + z.height) continue;                         // zona ja esta abaixo
                const t = z.pos_y + z.height + ps - this.playerSize / 2;        // topo encosta na base da zona
                if (t > limit) limit = t;
            }
        }
        const ty = dy > 0 ? Math.min(this.playerY + dist, limit) : Math.max(this.playerY - dist, limit);
        if (ty === this.playerY) return null;
        return { x: this.playerX, y: ty };
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
            // Desliza ate ENCOSTAR na colisao mais proxima da direcao: a hitbox para
            // colada nela e nunca atravessa colisao no meio do caminho (sweep exato).
            const r = this._collisionSlide(dx, dy, this.playerSpeed);
            if (r) {
                this.playerFromX = this.playerX;
                this.playerFromY = this.playerY;
                this.playerX = r.x;
                this.playerY = r.y;
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

        const r = this._collisionSlide(dx, dy, this.playerSpeed);
        if (!r) return false;
        this.playerFromX = this.playerX;
        this.playerFromY = this.playerY;
        this.playerX = r.x;
        this.playerY = r.y;
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

        const targetX = this.playerFromX + (this.playerX - this.playerFromX) * this.moveProgress;
        const targetY = this.playerFromY + (this.playerY - this.playerFromY) * this.moveProgress;
        const cl = Math.min(1, 0.25 * this._dt);
        this.cameraX += (targetX - this.cameraX) * cl;
        this.cameraY += (targetY - this.cameraY) * cl;

        this._updateCityFollowerMove(this._dt);

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
        this.updateScanButton();
        if (this.currentSpawnZone && this.currentSpawnZone !== prevSpawn) {
        }

        if (!this._lastSync) this._lastSync = 0;
        this._lastSync++;

        this.updateWildPokemon(0.016 * this._dt);
        this.updateNpcPatrols(0.016 * this._dt);
        this.updateRaidInteraction();
        this.updateGymInteraction();

        this._updateSfx();
    }

    // Efeitos sonoros de ambiente: passos sincronizados com a caminhada,
    // noite e chuva. Volumes limitados (nao cobrem a musica).
    _updateSfx() {
        const sfx = window.pokefury && window.pokefury.sfx;
        if (!sfx) return;
        const moveHeld = !!(this.keys['ArrowUp'] || this.keys['w'] || this.keys['W'] ||
            this.keys['ArrowDown'] || this.keys['s'] || this.keys['S'] ||
            this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A'] ||
            this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']);
        const walking = moveHeld || this.playerMoving;
        sfx.setSteps(walking);
        sfx.setNight(this.getDayNight().isNight);
        sfx.setRain((this._weather || this.getWeather()) === 'rain');
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

    // ---------------- Pokemon seguindo (cidade) ----------------

    async loadCityFollower(pokemon) {
        if (!pokemon) return;
        this.pokemonFollowing = pokemon;

        const staticFront = pokemon.spriteUrls?.front || pokemon.spriteUrls?.home || pokemon.spriteUrls?.official;
        const animUrl = window.PokeAPI
            ? (pokemon.isShiny || pokemon.shiny
                ? window.PokeAPI.getAnimatedFrontShinyUrl(pokemon.id)
                : window.PokeAPI.getAnimatedFrontUrl(pokemon.id))
            : null;
        this.pokemonFollowStaticUrl = staticFront || null;
        this.pokemonFollowSpriteUrl = animUrl || staticFront;
        this.pokemonFollowBackSpriteUrl = pokemon.spriteUrls?.back || null;

        if (!this.pokemonFollowEl) {
            const wrap = this.canvas.parentElement;
            if (!wrap) return;
            this.pokemonFollowShadowEl = document.createElement('img');
            this.pokemonFollowShadowEl.style.cssText = 'position:absolute;pointer-events:none;z-index:2;filter:brightness(0) blur(3px) opacity(0.35);';
            wrap.appendChild(this.pokemonFollowShadowEl);

            this.pokemonFollowEl = document.createElement('img');
            this.pokemonFollowEl.style.cssText = 'position:absolute;pointer-events:none;z-index:3;';
            this.pokemonFollowEl.onerror = () => {
                const fb = this.pokemonFollowEl.dataset.fallback;
                if (fb && this.pokemonFollowEl.src !== fb) {
                    this.pokemonFollowEl.dataset.fallbackUsed = '1';
                    this.pokemonFollowEl.src = fb;
                } else {
                    this.pokemonFollowEl.style.display = 'none';
                }
            };
            wrap.appendChild(this.pokemonFollowEl);
        }
        this.pokemonFollowEl.dataset.fallback = this.pokemonFollowStaticUrl || '';
        delete this.pokemonFollowEl.dataset.fallbackUsed;
        this.pokemonFollowEl.src = this.pokemonFollowSpriteUrl;
        this.pokemonFollowShadowEl.src = this.pokemonFollowSpriteUrl;
        this.pokemonFollowEl.style.display = 'block';
        this.pokemonFollowShadowEl.style.display = 'block';

        this.pokemonFollowRenderX = this.playerX;
        this.pokemonFollowRenderY = this.playerY;

        this._syncFollowerToDb();
    }

    _cityFollowerScale(poke) {
        const raw = window.getPokemonScale ? window.getPokemonScale(poke) : 1;
        return Math.min(0.75, raw);
    }

    async _syncFollowerToDb() {
        if (!this.authUserId || this.authUserId === 'local') return;
        const poke = this.pokemonFollowing;
        const base = {
            follower_id: poke ? poke.id : null,
            follower_sprite_url: poke ? (this.pokemonFollowSpriteUrl || null) : null,
            follower_back_url: poke ? (this.pokemonFollowBackSpriteUrl || null) : null,
            follower_scale: poke ? this._cityFollowerScale(poke) : null
        };
        const withStatic = { ...base, follower_static_url: poke ? (this.pokemonFollowStaticUrl || null) : null };
        let res = null;
        try {
            res = await window.db.from('city_players').update(withStatic).eq('user_id', this.authUserId);
        } catch (e) {
            res = { error: e };
        }
        // Se a coluna follower_static_url ainda nao existir no banco, o UPDATE inteiro falha
        // (e o follower some p/ os outros). Nesse caso, tenta de novo sem essa coluna.
        if (res && res.error) {
            try {
                await window.db.from('city_players').update(base).eq('user_id', this.authUserId);
            } catch (e2) {}
        }
    }

    async updateCityFollower() {
        const game = window.pokefury;
        const follower = game?.playerTeam?.find(p => !p.fainted);
        if (follower && this.pokemonFollowing
            && follower.id === this.pokemonFollowing.id
            && (follower.shiny || follower.isShiny) === (this.pokemonFollowing.shiny || this.pokemonFollowing.isShiny)) {
            return;
        }
        this.pokemonFollowing = null;
        this.pokemonFollowSpriteUrl = null;
        this.pokemonFollowBackSpriteUrl = null;
        this.pokemonFollowStaticUrl = null;
        if (follower) {
            await this.loadCityFollower(follower);
        } else {
            if (this.pokemonFollowEl) this.pokemonFollowEl.style.display = 'none';
            if (this.pokemonFollowShadowEl) this.pokemonFollowShadowEl.style.display = 'none';
            this._syncFollowerToDb();
        }
    }

    _updateCityFollowerMove(dt) {
        if (!this.pokemonFollowing || !this.pokemonFollowEl) return;

        // Posição alvo: SEMPRE atrás do jogador (sentido contrário ao deslocamento).
        // Nos lados, os pés do follower alinham com a linha dos pés do jogador (nao o centro).
        const feetY = this.playerY + this.playerSize / 2;
        let behindX = this.playerX;
        let behindY = feetY;
        if (this.playerDir === 'down') behindY = this.playerY - this.followerDownOffset;
        else if (this.playerDir === 'up') behindY = feetY + this.followerBehind;
        else if (this.playerDir === 'left') behindX = this.playerX + this.followerSideOffset;
        else if (this.playerDir === 'right') behindX = this.playerX - this.followerSideOffset;

        // Movimento: perseguicao com velocidade CONSTANTE (nao lerp exponencial).
        // O pokemon segue o treinador sem disparar na frente nem fazer paradinha.
        const dx = behindX - this.pokemonFollowRenderX;
        const dy = behindY - this.pokemonFollowRenderY;
        const dist = Math.hypot(dx, dy);

        if (dist > 0.5) {
            // Se ficou muito longe (ex.: teleport ou pulou uma parede), acelera pra alcançar.
            const speed = dist > 150 ? this.followerCatchupSpeed : this.followerSpeed;
            const step = speed * dt;
            if (dist <= step) {
                this.pokemonFollowRenderX = behindX;
                this.pokemonFollowRenderY = behindY;
            } else {
                this.pokemonFollowRenderX += (dx / dist) * step;
                this.pokemonFollowRenderY += (dy / dist) * step;
            }
        }

        // Idle animation: so quando o pokemon chega de fato no ponto atras do jogador
        // (treinador parado E follower posicionado), nao quando o treinador apenas parou.
        const arrived = dist <= 0.5;
        if (arrived) {
            this.pokemonFollowIdleTimer++;
            if (this.pokemonFollowIdleTimer >= 180) {
                this.pokemonFollowIdleTimer = 0;
                this.pokemonFollowIdleFlip = !this.pokemonFollowIdleFlip;
            }
        } else {
            this.pokemonFollowIdleTimer = 0;
            this.pokemonFollowIdleFlip = false;
        }
    }

    drawCityFollower() {
        const game = window.pokefury;
        if (!this.pokemonFollowing || !this.pokemonFollowEl) return;
        if (game && (game.state === 'battle' || game._battleStarting)) {
            if (this.pokemonFollowEl.style.display !== 'none') {
                this.pokemonFollowEl.style.display = 'none';
                if (this.pokemonFollowShadowEl) this.pokemonFollowShadowEl.style.display = 'none';
                if (this.pokemonFollowGrassEl) this.pokemonFollowGrassEl.style.display = 'none';
            }
            return;
        }

        const wrap = this.canvas.parentElement;
        if (!wrap) return;

        const canvasRect = this.canvas.getBoundingClientRect();
        const wrapRect = wrap.getBoundingClientRect();
        if (canvasRect.width === 0) return;

        const scaleX = canvasRect.width / this.canvas.width;
        const scaleY = canvasRect.height / this.canvas.height;
        const offsetX = canvasRect.left - wrapRect.left;
        const offsetY = canvasRect.top - wrapRect.top;

        const camX = this.cameraX - this.canvas.width / 2;
        const camY = this.cameraY - this.canvas.height / 2;

        const fScale = this._cityFollowerScale(this.pokemonFollowing);
        const spriteSize = this.playerSize * fScale;

        const useBack = this.playerDir === 'up' && this.pokemonFollowBackSpriteUrl;
        const targetSrc = useBack ? this.pokemonFollowBackSpriteUrl : this.pokemonFollowSpriteUrl;
        if (!this.pokemonFollowEl.dataset.fallbackUsed && this.pokemonFollowEl.src !== targetSrc) {
            this.pokemonFollowEl.src = targetSrc;
            if (this.pokemonFollowShadowEl) this.pokemonFollowShadowEl.src = targetSrc;
        }

        const flipX = !useBack && this.playerDir === 'right';
        const idleFlip = !this.playerMoving && this.pokemonFollowIdleFlip;
        const finalFlip = idleFlip ? !flipX : flipX;
        // Sem deslocamento lateral: follower centrado nas costas do jogador
        const downOffsetX = 0;

        // Boiado na agua: balanco vertical suave (se nao estiver na agua, retorna 0)
        const _fBob = this._waterBobAt(this.pokemonFollowRenderX, this.pokemonFollowRenderY);
        const px = this.pokemonFollowRenderX - camX - spriteSize / 2;
        const py = this.pokemonFollowRenderY - camY - spriteSize + _fBob;

        const drawLeft = offsetX + px * scaleX + downOffsetX;
        const drawTop = offsetY + py * scaleY;

        this.pokemonFollowEl.style.display = 'block';
        this.pokemonFollowEl.style.left = drawLeft + 'px';
        this.pokemonFollowEl.style.top = drawTop + 'px';
        this.pokemonFollowEl.style.width = (spriteSize * scaleX) + 'px';
        this.pokemonFollowEl.style.height = (spriteSize * scaleY) + 'px';
        const followAdj = window.getPokemonSpriteAdjust ? window.getPokemonSpriteAdjust(this.pokemonFollowing?.id) : null;
        let followTransform = followAdj ? `scale(${followAdj.scaleX}, ${followAdj.scaleY})` : '';
        if (finalFlip) followTransform = (followTransform ? followTransform + ' ' : '') + 'scaleX(-1)';
        this.pokemonFollowEl.style.transform = followTransform || 'none';

        if (this.pokemonFollowShadowEl) {
            const shadowW = spriteSize * scaleX * 0.8;
            const shadowH = spriteSize * scaleY * 0.25;
            const shadowLeft = drawLeft + (spriteSize * scaleX - shadowW) / 2;
            const shadowTop = drawTop + spriteSize * scaleY - shadowH * 0.3;
            this.pokemonFollowShadowEl.style.display = 'block';
            this.pokemonFollowShadowEl.style.left = shadowLeft + 'px';
            this.pokemonFollowShadowEl.style.top = shadowTop + 'px';
            this.pokemonFollowShadowEl.style.width = shadowW + 'px';
            this.pokemonFollowShadowEl.style.height = shadowH + 'px';
            this.pokemonFollowShadowEl.style.transform = followTransform || 'none';
        }

        // Z-index entre as faixas de profundidade (cada follower vira um ponto de divisão)
        const f = this._bandForFollower(this.pokemonFollowRenderY, this._depthSplits);
        const z = (3 + 2 * f) + '';
        this.pokemonFollowEl.style.zIndex = z;
        if (this.pokemonFollowShadowEl) this.pokemonFollowShadowEl.style.zIndex = z;

        // Dia/noite: o overlay de noite vive em um canvas acima de tudo (z 25),
        // cobrindo TODAS as entidades DOM (followers e selvagens) com a mesma cor,
        // independente da posicao/profundidade -> nenhuma mascara aqui.
        this.pokemonFollowEl.style.filter = '';

        // Grama na frente do follower (recorte alinhado da mesma textura), acima do seu z
        if (!this.pokemonFollowGrassEl) {
            const wrap = this.canvas && this.canvas.parentElement;
            if (wrap) {
                const gc = document.createElement('canvas');
                gc.style.cssText = 'position:absolute;pointer-events:none;';
                wrap.appendChild(gc);
                this.pokemonFollowGrassEl = gc;
            }
        }
        if (this.pokemonFollowGrassEl) {
            // Na agua o corte e mais profundo (submerge ate a cintura)
            const _fInW = this._inWaterAt(this.pokemonFollowRenderX, this.pokemonFollowRenderY);
            const _fOff0 = _fInW ? this.waterForegroundOffset : this.grassForegroundOffset;
            const _fHalf0 = _fInW ? this.waterForegroundHalf : this.grassForegroundHalf;
            const _fPad0 = _fInW ? this.waterForegroundPad : this.grassForegroundPad;
            const fOff = Math.max(8, Math.round(_fOff0 * (spriteSize / this.playerSize)));
            const fHalf = Math.max(12, Math.round(_fHalf0 * (spriteSize / this.playerSize)));
            const fPad = Math.max(2, Math.round(_fPad0 * (spriteSize / this.playerSize)));
            // Centra o recorte na posicao VISUAL do sprite (follower sempre centralizado)
            const visualFeetX = this.pokemonFollowRenderX + downOffsetX / scaleX;
            this._drawGrassFrontOverlay(this.pokemonFollowGrassEl, this._occluderTiles || this._grassTiles || [], visualFeetX, this.pokemonFollowRenderY + _fBob, fOff, fHalf, fPad, camX, camY, scaleX, scaleY, offsetX, offsetY, z);
        }
    }

    _getOtherFollowerEls(userId) {
        if (!userId) return null;
        if (this._otherFollowerEls[userId]) return this._otherFollowerEls[userId];
        const wrap = this.canvas.parentElement;
        if (!wrap) return null;
        const shadowEl = document.createElement('img');
        shadowEl.style.cssText = 'position:absolute;pointer-events:none;z-index:2;filter:brightness(0) blur(3px) opacity(0.35);';
        wrap.appendChild(shadowEl);
        const el = document.createElement('img');
        el.style.cssText = 'position:absolute;pointer-events:none;z-index:3;';
        el.onerror = () => {
            const fb = el.dataset.fallback;
            if (fb && el.src !== fb) {
                el.dataset.fallbackUsed = '1';
                el.src = fb;
            } else {
                el.style.display = 'none';
            }
        };
        wrap.appendChild(el);
        const grassEl = document.createElement('canvas');
        grassEl.style.cssText = 'position:absolute;pointer-events:none;';
        wrap.appendChild(grassEl);
        const entry = { el, shadowEl, grassEl };
        this._otherFollowerEls[userId] = entry;
        return entry;
    }

    _removeOtherFollowerEls(userId) {
        const entry = this._otherFollowerEls && this._otherFollowerEls[userId];
        if (!entry) return;
        try { entry.el.remove(); } catch (e) {}
        try { entry.shadowEl.remove(); } catch (e) {}
        try { entry.grassEl && entry.grassEl.remove(); } catch (e) {}
        delete this._otherFollowerEls[userId];
    }

    drawOtherPlayerFollowerDom(p, drawX, drawY, ps, scaleX, scaleY, offsetX, offsetY, band) {
        if (!p || !p.follower_sprite_url) return;
        const entry = this._getOtherFollowerEls(p.user_id);
        if (!entry) return;
        const { el, shadowEl, grassEl } = entry;
        const z = (3 + 2 * (band || 0)) + '';
        el.style.zIndex = z;
        shadowEl.style.zIndex = z;

        const dir = p.direction || 'down';
        const useBack = dir === 'up' && p.follower_back_url;
        const src = useBack ? p.follower_back_url : p.follower_sprite_url;
        el.dataset.fallback = p.follower_static_url || '';
        if (!el.dataset.fallbackUsed && el.src !== src) {
            el.src = src;
            shadowEl.src = src;
        }

        const fScale = Math.min(0.75, Number(p.follower_scale) || 1);
        const size = ps * fScale;
        // Distancia fixa do CENTRO do jogador (nao encosta nem cobre o sprite)
        const OFF = 55;
        let offX = 0, offY = 0;
        if (dir === 'down') offY = -(this.followerBehind + ps / 2);
        else if (dir === 'up') offY = OFF - ps / 2;
        else if (dir === 'left') offX = OFF;
        else offX = -OFF;

        const cX = drawX + (ps - size) / 2 + offX;
        const cY = (drawY + ps) - size + offY;
        const left = offsetX + cX * scaleX;
        const top = offsetY + cY * scaleY;
        const w = size * scaleX;
        const h = size * scaleY;

        const adj = window.getPokemonSpriteAdjust ? window.getPokemonSpriteAdjust(p.follower_id) : null;
        let transform = adj ? `scale(${adj.scaleX}, ${adj.scaleY})` : '';
        if (dir === 'right') transform = (transform ? transform + ' ' : '') + 'scaleX(-1)';
        const tf = transform || 'none';

        // Dia/noite: overlay de noite em canvas acima de tudo (z 25) cobre todos os
        // followers com a mesma cor, independente de profundidade -> sem mascara aqui.
        el.style.filter = '';

        el.style.display = 'block';
        el.style.left = left + 'px';
        el.style.top = top + 'px';
        el.style.width = w + 'px';
        el.style.height = h + 'px';
        el.style.transform = tf;

        const shadowW = w * 0.8;
        const shadowH = h * 0.25;
        shadowEl.style.display = 'block';
        shadowEl.style.left = (left + (w - shadowW) / 2) + 'px';
        shadowEl.style.top = (top + h - shadowH * 0.3) + 'px';
        shadowEl.style.width = shadowW + 'px';
        shadowEl.style.height = shadowH + 'px';
        shadowEl.style.transform = tf;

        // Grama/agua na frente do follower (recorte alinhado da mesma textura), acima do seu z
        const camX = this.cameraX - this.canvas.width / 2;
        const camY = this.cameraY - this.canvas.height / 2;
        const fX = cX + size / 2 + camX;
        const fY = cY + size + camY;
        const _fInW = this._inWaterAt(fX, fY);
        const fOff = Math.max(8, Math.round((_fInW ? this.waterForegroundOffset : this.grassForegroundOffset) * (size / ps)));
        const fHalf = Math.max(12, Math.round((_fInW ? this.waterForegroundHalf : this.grassForegroundHalf) * (size / ps)));
        const fPad = Math.max(2, Math.round((_fInW ? this.waterForegroundPad : this.grassForegroundPad) * (size / ps)));
        this._drawGrassFrontOverlay(grassEl, this._occluderTiles || this._grassTiles || [], fX, fY, fOff, fHalf, fPad, camX, camY, scaleX, scaleY, offsetX, offsetY, z);
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
        this._snapFollowerBehind();
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
        this._snapFollowerBehind();
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
        this._snapFollowerBehind();
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
        this._snapFollowerBehind();
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
        // Clima forçado (painel admin) tem prioridade enquanto durar
        if (this._forcedWeather && this._forcedWeatherUntil > this.serverNow()) {
            return this._forcedWeather;
        }
        const SLOT = 15 * 60 * 1000;      // clima muda a cada 15 min
        const OFFSET = 7.5 * 60 * 1000;   // deslocado no meio entre dia e noite
        const slot = Math.floor((this.serverNow() + OFFSET) / SLOT);
        this._advanceWeatherChain(slot);
        return this._slotHistory[this._slotHistory.length - 1];
    }

    _pickWeatherForSlot(slot, banned) {
        // Todos com a mesma chance; ouro = peso 0.04 (efetivo ~5%, o mais raro)
        const goldW = 0.04;
        const base = (1 - goldW) / 7; // ~13.7% para cada um dos 7
        const weights = [
            { id: 'clear', w: base },
            { id: 'rain', w: base },
            { id: 'snow', w: base },
            { id: 'sandstorm', w: base },
            { id: 'psychic', w: base },
            { id: 'grassstorm', w: base },
            { id: 'wind', w: base },
            { id: 'gold', w: goldW }
        ];
        const bannedSet = new Set(banned || []);
        let candidate = 'gold';
        let attempts = 0;
        do {
            const h = Math.abs(Math.sin(slot * 127.1 + 311.7 + attempts * 91.7) * 43758.5453) % 1;
            let acc = 0;
            candidate = 'gold';
            for (const w of weights) {
                acc += w.w;
                if (h < acc) { candidate = w.id; break; }
            }
            attempts++;
        } while (bannedSet.has(candidate) && attempts < 64);
        // Fallback determinístico: se exaurir as tentativas, escolhe o primeiro não banido
        if (bannedSet.has(candidate)) {
            candidate = weights.find(w => !bannedSet.has(w.id)).id;
        }
        return candidate;
    }

    _advanceWeatherChain(slot) {
        if (this._chainSlot === undefined) {
            this._chainSlot = -1;
            this._slotHistory = [];
        }
        // Avança a cadeia do último slot computado até o slot atual.
        // Cada slot não pode repetir nenhum dos 2 anteriores (memória em _slotHistory).
        while (this._chainSlot < slot) {
            this._chainSlot++;
            const w = this._pickWeatherForSlot(this._chainSlot, this._slotHistory);
            this._slotHistory.push(w);
            if (this._slotHistory.length > 2) this._slotHistory.shift();
        }
    }

    weatherDurationMs() {
        const SLOT = 15 * 60 * 1000;
        const OFFSET = 7.5 * 60 * 1000;
        const now = this.serverNow();
        if (this._forcedWeather && this._forcedWeatherUntil > now) {
            return this._forcedWeatherUntil - now;
        }
        const nextSlot = (Math.floor((now + OFFSET) / SLOT) + 1) * SLOT - OFFSET;
        return nextSlot - now;
    }

    // ---------------- Clima forçado (admin) ----------------
    async loadForcedWeather() {
        try {
            const { data, error } = await window.db.from('forced_weather').select('*').limit(1);
            if (!error && data && data.length > 0) {
                const row = data[0];
                this._forcedWeather = row.weather;
                this._forcedWeatherUntil = new Date(row.ends_at).getTime();
            } else {
                this._forcedWeather = null;
                this._forcedWeatherUntil = 0;
            }
            this.subscribeForcedWeather();
        } catch (e) {
        }
    }

    subscribeForcedWeather() {
        if (this._forcedWeatherSub) return;
        this._forcedWeatherSub = window.db
            .channel('forced-weather-realtime')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'forced_weather'
            }, () => {
                this.loadForcedWeather();
            })
            .subscribe();
    }

    getWeatherMeta() {
        return [
            { id: 'clear', label: 'Tempo limpo', icon: '☀️' },
            { id: 'rain', label: 'Chuva', icon: '🌧️' },
            { id: 'snow', label: 'Neve', icon: '❄️' },
            { id: 'sandstorm', label: 'Tempestade de areia', icon: '🌪️' },
            { id: 'psychic', label: 'Fluxo psíquico', icon: '🔮' },
            { id: 'grassstorm', label: 'Tempestade de grama', icon: '🍃' },
            { id: 'wind', label: 'Ventos fortes', icon: '💨' },
            { id: 'gold', label: 'Partículas de ouro', icon: '✨' }
        ];
    }

    openWeatherAdminPanel() {
        if (!window.isAdmin) return;
        const existing = document.getElementById('city-weather-admin');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'city-weather-admin';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:10000;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;';

        const panel = document.createElement('div');
        panel.style.cssText = 'background:linear-gradient(135deg,#1a1a2e,#16213e);border:2px solid #38bdf8;border-radius:14px;padding:22px;min-width:340px;max-width:420px;box-shadow:0 10px 40px rgba(0,0,0,0.7);color:#fff;font-family:Inter,sans-serif;';
        panel.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
                <h3 style="margin:0;font-size:16px;">🌦️ Controle de Clima</h3>
                <button id="city-weather-admin-close" style="background:none;border:none;color:#aaa;font-size:20px;cursor:pointer;line-height:1;">✕</button>
            </div>
            <div id="city-weather-now" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:12px;margin-bottom:16px;display:flex;align-items:center;gap:10px;"></div>
            <div style="font-size:11px;color:rgba(255,255,255,0.6);margin-bottom:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Climas disponíveis</div>
            <div id="city-weather-list" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;max-height:280px;overflow-y:auto;"></div>
        `;
        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
        panel.querySelector('#city-weather-admin-close').addEventListener('click', () => overlay.remove());

        this.renderWeatherAdminNow(panel);
        this.renderWeatherAdminList(panel);

        this._weatherAdminTimer = setInterval(() => {
            const nowEl = document.getElementById('city-weather-now');
            if (!nowEl) {
                clearInterval(this._weatherAdminTimer);
                return;
            }
            this.renderWeatherAdminNow(panel);
        }, 1000);
    }

    renderWeatherAdminNow(panel) {
        const nowEl = document.getElementById('city-weather-now');
        if (!nowEl) return;
        const meta = this.getWeatherMeta().find(m => m.id === (this._weather || this.getWeather())) || { label: this._weather || 'clear', icon: '❓' };
        const ms = this.weatherDurationMs();
        const total = Math.max(0, ms);
        const s = Math.floor(total / 1000);
        const mm = String(Math.floor(s / 60)).padStart(2, '0');
        const ss = String(s % 60).padStart(2, '0');
        nowEl.innerHTML = `
            <div style="font-size:30px;">${meta.icon}</div>
            <div style="flex:1;">
                <div style="font-size:14px;font-weight:700;">${meta.label}</div>
                <div style="font-size:11px;color:rgba(255,255,255,0.55);">Tempo restante: <span style="color:#38bdf8;font-weight:700;">${mm}:${ss}</span></div>
            </div>
            ${this._forcedWeather && this._forcedWeatherUntil > this.serverNow() ? '<div style="font-size:10px;color:#fbbf24;font-weight:700;background:rgba(251,191,36,0.12);padding:4px 8px;border-radius:6px;">FORÇADO</div>' : ''}
        `;
    }

    renderWeatherAdminList(panel) {
        const listEl = document.getElementById('city-weather-list');
        if (!listEl) return;
        const current = this._weather || this.getWeather();
        listEl.innerHTML = '';
        this.getWeatherMeta().forEach(m => {
            const btn = document.createElement('button');
            const active = m.id === current;
            btn.style.cssText = 'padding:10px;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;font-family:Inter,sans-serif;color:#fff;background:' + (active ? 'linear-gradient(135deg,#38bdf8,#2563eb)' : 'rgba(255,255,255,0.08)') + ';border:1px solid ' + (active ? '#38bdf8' : 'rgba(255,255,255,0.1)') + ';';
            btn.textContent = m.icon + ' ' + m.label;
            btn.onclick = async () => {
                const res = await window.db.rpc('force_weather', { p_weather: m.id });
                if (res && (res.error || (res.data && res.data.error))) {
                    window.pokefury?.showToast?.(res.error?.message || res.data?.error || 'Erro ao forçar clima', 'error');
                    return;
                }
                window.pokefury?.showToast?.(`Clima forçado: ${m.label}!`, 'success');
                this._forcedWeather = m.id;
                this._forcedWeatherUntil = Date.now() + (15 * 60 * 1000);
                this._weather = null;
                this.weatherParticles = [];
                this.renderWeatherAdminNow(panel);
                this.renderWeatherAdminList(panel);
            };
            listEl.appendChild(btn);
        });
    }

    isPokemonTimeValid(pokemonId) {
        const isNight = this.getDayNight().isNight;
        if (isNight && DIURNAL_POKEMON_IDS.has(pokemonId)) return false;
        if (!isNight && NOCTURNAL_POKEMON_IDS.has(pokemonId)) return false;
        return true;
    }

    drawSpriteReflection(ctx, img, srcX, srcY, srcW, srcH, dx, dy, dw, dh) {
        if (this._weather !== 'rain') return;
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
        else if (weather === 'sandstorm') weatherIcon = '🌪️';
        else if (weather === 'psychic') weatherIcon = '🔮';
        else if (weather === 'grassstorm') weatherIcon = '🍃';
        else if (weather === 'wind') weatherIcon = '💨';
        else if (weather === 'gold') weatherIcon = '✨';
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
        if (weather === 'clear' || weather === 'psychic') { this.weatherParticles = []; return; }

        const CONFIGS = {
            rain: { target: 120, speed: 9, speedVar: 6, len: 15, lenVar: 15, size: 0, wind: -2.5, windVar: 1 },
            snow: { target: 70, speed: 1.2, speedVar: 2, len: 0, size: 2, sizeVar: 4 },
            sandstorm: { target: 180, speed: 5, speedVar: 4, len: 2, lenVar: 3, size: 1, sizeVar: 2, wind: 2, windVar: 1.5, drift: 2 },
            grassstorm: { target: 70, speed: 3, speedVar: 3, len: 0, size: 2, sizeVar: 3, wind: 1.5, windVar: 1.5, drift: 1 },
            wind: { target: 45, speed: 18, speedVar: 14, len: 40, lenVar: 40, size: 0, wind: 6, windVar: 3 },
            gold: { target: 70, speed: 2.5, speedVar: 2, len: 0, size: 1, sizeVar: 2, wind: 0, drift: 0 }
        };
        const cfg = CONFIGS[weather];
        if (!cfg) return;

        while (this.weatherParticles.length < cfg.target) {
            this.weatherParticles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                speed: cfg.speed + Math.random() * cfg.speedVar,
                len: cfg.len ? cfg.len + Math.random() * cfg.lenVar : 0,
                size: cfg.size ? cfg.size + Math.random() * cfg.sizeVar : 0,
                opacity: 0.2 + Math.random() * 0.4,
                wind: cfg.wind ? cfg.wind + Math.random() * (cfg.windVar || 1) : 0,
                drift: cfg.drift || 0,
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
            } else if (weather === 'wind') {
                p.x += p.speed * f;
                p.y += Math.sin(p.wobble) * 0.6 * f;
                p.wobble += p.wobbleSpeed * f;
                if (p.x > w + p.len) { p.x = -p.len; p.y = Math.random() * h; }
            } else if (weather === 'sandstorm') {
                p.wobble += p.wobbleSpeed * f;
                p.x += (p.wind + Math.sin(p.wobble) * p.drift) * f;
                p.y += p.speed * 0.6 * f;
                if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w; }
                if (p.x > w + 10) p.x = -10;
                if (p.x < -10) p.x = w + 10;
            } else if (weather === 'grassstorm') {
                p.wobble += p.wobbleSpeed * f;
                p.x += (p.wind + Math.sin(p.wobble) * p.drift) * f;
                p.y += p.speed * 0.5 * f;
                if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w; }
                if (p.x > w + 10) p.x = -10;
                if (p.x < -10) p.x = w + 10;
            } else if (weather === 'gold') {
                p.wobble += p.wobbleSpeed * f;
                p.x += Math.sin(p.wobble) * 0.5 * f;
                p.y += p.speed * f;
                if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w; }
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

    // ---- Y-Sorting do Layer 3 ----
    // depthY = ponto em que a entidade toca o chão (base), não o topo da imagem.

    // Adiciona grama/agua na frente de uma entidade cujos pes estao em (feetX, feetY).
    // Na agua o corte e mais profundo (submerge ate a cintura, parecendo boiando).
    _pushGrassFrontForFeet(feetX, feetY) {
        const _occl = this._occluderTiles || [];
        if (_occl.length === 0) return;
        const _inWater = this._inWaterAt(feetX, feetY);
        const _cutOff = _inWater ? this.waterForegroundOffset : this.grassForegroundOffset;
        const _cutHalf = _inWater ? this.waterForegroundHalf : this.grassForegroundHalf;
        const _cutPad = _inWater ? this.waterForegroundPad : this.grassForegroundPad;
        let _anyIn = false;
        for (const a of _occl) {
            const img = a._img;
            if (!img || !img.complete || !img.naturalWidth) continue;
            const aw = img.naturalWidth * (a.scale || 1);
            const ah = img.naturalHeight * (a.scale || 1);
            if (feetX >= a.pos_x && feetX <= a.pos_x + aw && feetY >= a.pos_y && feetY <= a.pos_y + ah) { _anyIn = true; break; }
        }
        if (!_anyIn) return;
        const _bx0 = feetX - _cutHalf;
        const _bx1 = feetX + _cutHalf;
        const _by1 = feetY + _cutPad;
        const _cutY = feetY - _cutOff;
        for (const a of _occl) {
            const img = a._img;
            if (!img || !img.complete || !img.naturalWidth) continue;
            const aw = img.naturalWidth * (a.scale || 1);
            const ah = img.naturalHeight * (a.scale || 1);
            const ox0 = Math.max(_bx0, a.pos_x), ox1 = Math.min(_bx1, a.pos_x + aw);
            const oy0 = Math.max(_cutY, a.pos_y), oy1 = Math.min(_by1, a.pos_y + ah);
            if (ox0 < ox1 && oy0 < oy1) {
                this._grassFronts.push({ a, ox0, ox1, oy0, oy1, depthY: feetY, z_index: (a.z_index || 0) + 1000000 });
            }
        }
    }

    getEntityDepthY(e) {
        const r = e.ref;
        if (e.kind === 'asset') {
            const img = r._img;
            if (!img || !img.complete || !img.naturalWidth) return Number.MIN_SAFE_INTEGER;
            const ah = img.naturalHeight * (r.scale || 1);
            return r.pos_y + ah;
        }
        if (e.kind === 'npc') {
            const ps = Math.round((r.width || 48) * 1.2);
            return r.pos_y + ps;
        }
        if (e.kind === 'grassFront') {
            return r.depthY;
        }
        if (e.kind === 'player') {
            const ps = this.playerSize;
            const mp = r.isMe ? this.moveProgress : (r.moveProgress ?? 1);
            const fy = r.isMe ? this.playerFromY : (r.fromY ?? r.pos_y);
            const ty = r.isMe ? this.playerY : r.pos_y;
            return (fy + (ty - fy) * mp) + ps / 2;
        }
        return 0;
    }

    drawAssetSprite(ctx, a, camX, camY, cw, ch) {
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
    }

    // ---- Grama alta (textura unica dividida em 2 passadas) ----
    // A grama e renderizada normalmente (Etapa 1) e a parte que fica NA FRENTE do
    // personagem (regiao da cintura para baixo, uma faixa estreita em volta do corpo)
    // e desenhada novamente por cima, com o MESMO recorte da mesma textura na mesma
    // posicao do mundo (perfeitamente alinhada). Nao ha clipping nem remocao de grama.
    // Configuraveis: grassForegroundOffset (altura do corte), grassForegroundHalf
    // (meia-largura da faixa), grassForegroundPad (sobra abaixo dos pes).

    _isGrassAsset(a) {
        if (!a) return false;
        if (a._isGrass !== undefined) return a._isGrass;
        const id = String(a.asset_id || '').replace(/\.png$/i, '');
        const url = a.asset_url || '';
        const name = (url.split('/').pop() || '').replace(/\.png$/i, '');
        const is = GRASS_ASSET_IDS.has(id) || GRASS_ASSET_IDS.has(name);
        a._isGrass = is;
        return is;
    }

    _grassTypeAt(x, y) {
        for (const a of this._grassTiles || []) {
            const img = a._img;
            if (!img || !img.complete || !img.naturalWidth) continue;
            const aw = img.naturalWidth * (a.scale || 1);
            const ah = img.naturalHeight * (a.scale || 1);
            if (x >= a.pos_x && x <= a.pos_x + aw && y >= a.pos_y && y <= a.pos_y + ah) {
                const id = String(a.asset_id || '').replace(/\.png$/i, '');
                if (GRASS_ASSET_IDS.has(id)) return id;
            }
        }
        return null;
    }

    _isWaterAsset(a) {
        if (!a) return false;
        if (a._isWater !== undefined) return a._isWater;
        const id = String(a.asset_id || '').replace(/\.png$/i, '');
        const url = a.asset_url || '';
        const name = (url.split('/').pop() || '').replace(/\.png$/i, '');
        const is = WATER_ASSET_IDS.has(id) || WATER_ASSET_IDS.has(name);
        a._isWater = is;
        return is;
    }

    // O ponto (x,y) esta dentro de um tile de agua?
    _inWaterAt(x, y) {
        if (!this._waterTiles || this._waterTiles.length === 0) return false;
        for (const a of this._waterTiles) {
            const img = a._img;
            if (!img || !img.complete || !img.naturalWidth) continue;
            const aw = img.naturalWidth * (a.scale || 1);
            const ah = img.naturalHeight * (a.scale || 1);
            if (x >= a.pos_x && x <= a.pos_x + aw && y >= a.pos_y && y <= a.pos_y + ah) return true;
        }
        return false;
    }

    // Boiado: pequeno balanco vertical suave (sine) quando a entidade esta na agua.
    // Fase depende do X do mundo para entidades nao balancarem sincronizadas.
    _waterBobAt(x, y) {
        if (!this._inWaterAt(x, y)) return 0;
        const t = this._animTime || 0;
        return Math.sin(t * 3.4 + x * 0.045) * 2.6;
    }

    // Topo ondulado da faixa frontal por coluna do MUNDO (estavel ao mover a camera e
    // continuo entre tiles). So desce (cobre menos) para nao precisar recortar acima.
    _grassWaveTop(x, baseY, maxY) {
        const amp = this.grassWaveAmp || 0;
        if (!amp) return baseY;
        const n = 0.5 + 0.5 * Math.sin(x * 0.13 + 4.7);
        const n2 = 0.5 + 0.5 * Math.sin(x * 0.041 + 1.3);
        const top = baseY + amp * (0.4 * n + 0.6 * n2);
        return Math.min(top, maxY - 0.5);
    }

    _drawGrassFront(ctx, gf, camX, camY) {
        const a = gf.a;
        const img = a._img;
        if (!img || !img.complete || !img.naturalWidth) return;
        const scale = a.scale || 1;
        const sx = (gf.ox0 - a.pos_x) / scale;
        const sy = (gf.oy0 - a.pos_y) / scale;
        const sw = (gf.ox1 - gf.ox0) / scale;
        const sh = (gf.oy1 - gf.oy0) / scale;
        if (sw <= 0.5 || sh <= 0.5) return;
        const dx = gf.ox0 - camX;
        const dy = gf.oy0 - camY;
        const dw = gf.ox1 - gf.ox0;
        const dh = gf.oy1 - gf.oy0;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(dx, this._grassWaveTop(gf.ox0, gf.oy0, gf.oy1) - camY);
        const step = 8;
        for (let x = gf.ox0 + step; x < gf.ox1; x += step) {
            ctx.lineTo(x - camX, this._grassWaveTop(x, gf.oy0, gf.oy1) - camY);
        }
        ctx.lineTo(dx + dw, this._grassWaveTop(gf.ox1, gf.oy0, gf.oy1) - camY);
        ctx.lineTo(dx + dw, dy + dh);
        ctx.lineTo(dx, dy + dh);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
        ctx.restore();
    }

    // Faixa de grama na frente para entidades DOM (followers animados e pokemons
    // selvagens): um <canvas> posicionado sobre a parte inferior da entidade com o
    // recorte alinhado da mesma textura. A entidade continua animando atras da grama.
    _drawGrassFrontOverlay(canvasEl, grassTiles, feetX, feetY, offset, halfW, pad, camX, camY, scaleX, scaleY, offsetX, offsetY, z) {
        if (!canvasEl || !grassTiles || grassTiles.length === 0) {
            if (canvasEl) canvasEl.style.display = 'none';
            return;
        }
        const waistY = feetY - offset;
        const bX0 = feetX - halfW;
        const bX1 = feetX + halfW;
        const bY1 = feetY + pad;
        const bandH = offset + pad;
        const minOverlap = Math.max(4, Math.round(bandH * 0.35));
        const minW = Math.max(6, Math.round(halfW * 0.4));
        let maxOverlap = 0;
        const crops = [];
        for (const a of grassTiles) {
            const img = a._img;
            if (!img || !img.complete || !img.naturalWidth) continue;
            const aw = img.naturalWidth * (a.scale || 1);
            const ah = img.naturalHeight * (a.scale || 1);
            const ox0 = Math.max(bX0, a.pos_x), ox1 = Math.min(bX1, a.pos_x + aw);
            const oy0 = Math.max(waistY, a.pos_y), oy1 = Math.min(bY1, a.pos_y + ah);
            if (ox0 < ox1 && oy0 < oy1) {
                crops.push({ a, ox0, ox1, oy0, oy1 });
                if (ox1 - ox0 >= minW && oy1 - oy0 > maxOverlap) maxOverlap = oy1 - oy0;
            }
        }
        if (crops.length === 0 || maxOverlap < minOverlap) {
            canvasEl.style.display = 'none';
            return;
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const c of crops) {
            if (c.ox0 < minX) minX = c.ox0;
            if (c.oy0 < minY) minY = c.oy0;
            if (c.ox1 > maxX) maxX = c.ox1;
            if (c.oy1 > maxY) maxY = c.oy1;
        }
        const w = maxX - minX, h = maxY - minY;
        if (w <= 0.5 || h <= 0.5) {
            canvasEl.style.display = 'none';
            return;
        }
        canvasEl.style.display = 'block';
        canvasEl.style.left = (offsetX + (minX - camX) * scaleX) + 'px';
        canvasEl.style.top = (offsetY + (minY - camY) * scaleY) + 'px';
        canvasEl.style.width = (w * scaleX) + 'px';
        canvasEl.style.height = (h * scaleY) + 'px';
        if (z) canvasEl.style.zIndex = z;
        const W = Math.max(1, Math.round(w * scaleX));
        const H = Math.max(1, Math.round(h * scaleY));
        if (canvasEl.width !== W) canvasEl.width = W;
        if (canvasEl.height !== H) canvasEl.height = H;
        const cctx = canvasEl.getContext('2d');
        cctx.clearRect(0, 0, W, H);
        for (const c of crops) {
            const img = c.a._img;
            if (!img) continue;
            const s = c.a.scale || 1;
            const sx = (c.ox0 - c.a.pos_x) / s;
            const sy = (c.oy0 - c.a.pos_y) / s;
            const sw = (c.ox1 - c.ox0) / s;
            const sh = (c.oy1 - c.oy0) / s;
            if (sw <= 0.5 || sh <= 0.5) continue;
            const px0 = (c.ox0 - minX) * scaleX;
            const py0 = (c.oy0 - minY) * scaleY;
            const pw = (c.ox1 - c.ox0) * scaleX;
            const ph = (c.oy1 - c.oy0) * scaleY;
            cctx.save();
            cctx.beginPath();
            cctx.moveTo(px0, (this._grassWaveTop(c.ox0, c.oy0, c.oy1) - minY) * scaleY);
            const step = 8;
            for (let x = c.ox0 + step; x < c.ox1; x += step) {
                cctx.lineTo((x - minX) * scaleX, (this._grassWaveTop(x, c.oy0, c.oy1) - minY) * scaleY);
            }
            cctx.lineTo(px0 + pw, (this._grassWaveTop(c.ox1, c.oy0, c.oy1) - minY) * scaleY);
            cctx.lineTo(px0 + pw, py0 + ph);
            cctx.lineTo(px0, py0 + ph);
            cctx.closePath();
            cctx.clip();
            cctx.drawImage(img, sx, sy, sw, sh, px0, py0, pw, ph);
            cctx.restore();
        }
    }

    // ---- Particulas ao andar na grama alta ----
    // Pequenos pedacos (grama/gelo/metal/areia) ou fumaca (pedra/psi/voador) ou fuligem
    // (vulcanico) que sobem do corpo do personagem/follower e somem. Simples e rapidas.

    _spawnGrassFx(wx, wy, typeId) {
        const cfg = GRASS_FX[typeId];
        if (!cfg) return;
        const n = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < n; i++) {
            this._grassParticles.push({
                x: wx + (Math.random() - 0.5) * 26,
                y: wy + (Math.random() - 0.5) * 20,
                vx: (Math.random() - 0.5) * 20,
                vy: -(16 + Math.random() * 28),
                life: 0,
                maxLife: 0.35 + Math.random() * 0.3,
                size: 2 + Math.random() * 3.5,
                kind: cfg.kind,
                color: cfg.colors[Math.floor(Math.random() * cfg.colors.length)],
                rot: Math.random() * Math.PI * 2,
                vr: (Math.random() - 0.5) * 8,
                drift: (Math.random() - 0.5) * 40
            });
        }
        if (this._grassParticles.length > 140) this._grassParticles.splice(0, this._grassParticles.length - 140);
    }

    _updateGrassFx() {
        let fxEl = this._grassFxEl;
        if (!fxEl && this.canvas && this.canvas.parentElement) {
            fxEl = document.createElement('canvas');
            fxEl.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:24;';
            this.canvas.parentElement.appendChild(fxEl);
            this._grassFxEl = fxEl;
        }
        if (!fxEl) return;
        const cw = this.canvas.width;
        const ch = this.canvas.height;
        if (fxEl.width !== cw) fxEl.width = cw;
        if (fxEl.height !== ch) fxEl.height = ch;
        const ctx = fxEl.getContext('2d');
        ctx.clearRect(0, 0, cw, ch);
        const camX = this.cameraX - cw / 2;
        const camY = this.cameraY - ch / 2;
        const dt = this._dt || 1;

        // Jogador (corpo do personagem)
        if (this.playerMoving) {
            const pfx = this.playerFromX + (this.playerX - this.playerFromX) * this.moveProgress;
            const pfy = (this.playerFromY + (this.playerY - this.playerFromY) * this.moveProgress) + this.playerSize / 2;
            const type = this._grassTypeAt(pfx, pfy);
            if (type) this._spawnGrassFx(pfx, pfy - this.playerSize * 0.55, type);
        }
        // Pokemon que segue (DOM acompanha o jogador)
        if (this.playerMoving && this.pokemonFollowing && this.pokemonFollowEl && this.pokemonFollowEl.style.display !== 'none') {
            const type = this._grassTypeAt(this.pokemonFollowRenderX, this.pokemonFollowRenderY);
            if (type) {
                const fScale = this._cityFollowerScale(this.pokemonFollowing);
                const spriteSize = this.playerSize * fScale;
                this._spawnGrassFx(this.pokemonFollowRenderX, this.pokemonFollowRenderY - spriteSize * 0.5, type);
            }
        }
        // Pronto para selvagens andando: basta chamar _spawnGrassFx(pos_x, pos_y - alt, tipo)

        const list = this._grassParticles;
        const k = dt / 60;
        for (let i = list.length - 1; i >= 0; i--) {
            const p = list[i];
            p.life += k;
            if (p.life >= p.maxLife) { list.splice(i, 1); continue; }
            const t = p.life / p.maxLife;
            p.x += p.vx * k;
            p.y += p.vy * k;
            p.vy += 30 * k;
            p.vx += p.drift * k * 0.2;
            p.rot += p.vr * k;
            p.size = Math.max(0.5, p.size - 2.5 * k);
            const sx = p.x - camX;
            const sy = p.y - camY;
            if (sx < -20 || sx > cw + 20 || sy < -20 || sy > ch + 20) { list.splice(i, 1); continue; }
            ctx.save();
            ctx.globalAlpha = (1 - t) * 0.9;
            ctx.fillStyle = p.color;
            ctx.translate(sx, sy);
            if (p.kind === 'smoke' || p.kind === 'soot') {
                ctx.beginPath();
                ctx.arc(0, 0, p.size * (1 + t * 1.7), 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.rotate(p.rot);
                ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
            }
            ctx.restore();
        }
    }

    // ---- Agua: bolhas contínuas (mesmo parado) + ondas de espuma que quebram ----
    // A agua oculta como a grama (front-cut) e as entidades boiam; aqui ficam as bolhas
    // subindo do corpo de quem esta dentro d'agua e ondas de espuma que cruzam a agua,
    // quebram nas entidades (foam burst + anel) e se dissolvem.

    _spawnWaterBubble(x, y) {
        const colors = WATER_FX.bubble;
        this._waterParticles.push({
            x: x + (Math.random() - 0.5) * 18,
            y: y + (Math.random() - 0.5) * 14,
            vx: (Math.random() - 0.5) * 6,
            vy: -(22 + Math.random() * 34),
            wobA: 5 + Math.random() * 7,
            wobF: 1.5 + Math.random() * 1.6,
            wobP: Math.random() * Math.PI * 2,
            life: 0,
            maxLife: 0.7 + Math.random() * 0.8,
            size: 1.5 + Math.random() * 3,
            color: colors[Math.floor(Math.random() * colors.length)]
        });
        if (this._waterParticles.length > 130) this._waterParticles.splice(0, this._waterParticles.length - 130);
    }

    // Onda de espuma que nasce na parte de baixo da agua e sobe (sentido unico),
// passando por cima da entidade alvo — quando cruza, quebra nela (foam burst).
    _spawnWaterWave(tx, ty) {
        const dist = 240 + Math.random() * 160;
        if (this._waterWaves.length < 10) {
            this._waterWaves.push({
                x: tx,
                y: ty + dist,
                nx: 0,
                ny: -1,
                len: 55 + Math.random() * 40,
                speed: 34 + Math.random() * 18,
                t: 0,
                life: 0,
                maxLife: 2.2 + Math.random() * 0.9,
                hit: new Set()
            });
        }
    }

    // Espuma que espirra quando a onda quebra na entidade (particulas + anel que expande)
    _spawnFoamBurst(x, y) {
        const n = 9 + Math.floor(Math.random() * 5);
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 18 + Math.random() * 44;
            this._waterParticles.push({
                kind: 'foam',
                x: x + (Math.random() - 0.5) * 8,
                y: y + (Math.random() - 0.5) * 6,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp - 20,
                life: 0,
                maxLife: 0.5 + Math.random() * 0.45,
                size: 2.5 + Math.random() * 4,
                color: '#eaf8ff'
            });
        }
        this._waterParticles.push({
            kind: 'ring', x, y, size: 5, maxSize: 30, life: 0, maxLife: 0.45
        });
        if (this._waterParticles.length > 240) this._waterParticles.splice(0, this._waterParticles.length - 240);
    }

    // Atualiza e desenha as ondas de espuma
    _updateWaterWaves(ctx, k, camX, camY) {
        const waves = this._waterWaves;
        for (let i = waves.length - 1; i >= 0; i--) {
            const w = waves[i];
            w.t += k;
            w.life += k;
            if (w.life >= w.maxLife) { waves.splice(i, 1); continue; }
            w.x += w.nx * w.speed * k;
            w.y += w.ny * w.speed * k;

            // Quebra nas entidades dentro d'agua que a linha de espuma cruzar
            const perpX = -w.ny, perpY = w.nx;
            const targets = this._waterWaveTargets();
            for (const e of targets) {
                if (w.hit.has(e.id)) continue;
                const rx = e.x - w.x, ry = e.y - w.y;
                const along = rx * perpX + ry * perpY;
                const across = rx * w.nx + ry * w.ny;
                let dist;
                if (Math.abs(along) <= w.len) dist = Math.abs(across);
                else {
                    const ex = Math.abs(along) - w.len;
                    dist = Math.sqrt(ex * ex + across * across);
                }
                if (dist < 22) {
                    w.hit.add(e.id);
                    this._spawnFoamBurst(e.x, e.y - 14);
                }
            }

            // Linha de espuma (blobs brancos ao longo da perpendicular, com ondulacao)
            const fade = 1 - (w.life / w.maxLife);
            for (let pass = 0; pass < 2; pass++) {
                const step = pass === 0 ? 5 : 14;
                const mult = pass === 0 ? 1 : 1.8;
                const alphaMul = pass === 0 ? 1 : 0.35;
                for (let i = -w.len; i <= w.len; i += step) {
                    const bx = w.x + perpX * i;
                    const by = w.y + perpY * i;
                    const wob = Math.sin(i * 0.1 + w.t * 3.2) * 6;
                    const fx = bx + w.nx * wob;
                    const fy = by + w.ny * wob;
                    if (!this._inWaterAt(fx, fy)) continue;
                    const sx = fx - camX, sy = fy - camY;
                    const edge = 1 - Math.min(1, Math.abs(i) / w.len);
                    const alpha = 0.42 * fade * alphaMul * (0.35 + edge * 0.65);
                    if (alpha <= 0.01) continue;
                    const r = (4 + Math.sin(i * 0.7 + w.t * 2.8) * 2) * mult * (1.6 - fade * 0.5);
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = '#eaf8ff';
                    ctx.beginPath();
                    ctx.arc(sx, sy, r, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.globalAlpha = 1;
        }
    }

    // Entidades atualmente dentro d'agua (alvos das ondas)
    _waterWaveTargets() {
        const out = [];
        const gmp = this.moveProgress || 0;
        const pfx = this.playerFromX + (this.playerX - this.playerFromX) * gmp;
        const pfy = (this.playerFromY + (this.playerY - this.playerFromY) * gmp) + this.playerSize / 2;
        if (this._inWaterAt(pfx, pfy)) out.push({ id: 'me', x: pfx, y: pfy });
        if (this.pokemonFollowing && this.pokemonFollowEl && this.pokemonFollowEl.style.display !== 'none') {
            if (this._inWaterAt(this.pokemonFollowRenderX, this.pokemonFollowRenderY)) {
                out.push({ id: 'fol', x: this.pokemonFollowRenderX, y: this.pokemonFollowRenderY });
            }
        }
        for (const p of (this.wildPokemon || [])) {
            if (!p.active || !p._el || p._el.style.display === 'none') continue;
            if (this._inWaterAt(p.pos_x, p.pos_y)) out.push({ id: 'w' + p.pos_x + '_' + p.pos_y, x: p.pos_x, y: p.pos_y });
        }
        return out;
    }

    _updateWaterFx() {
        const hasWater = (this._waterTiles || []).length > 0;
        if (!hasWater && this._waterParticles.length === 0) return;
        let fxEl = this._waterFxEl;
        if (!fxEl && this.canvas && this.canvas.parentElement) {
            fxEl = document.createElement('canvas');
            fxEl.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:24;';
            this.canvas.parentElement.appendChild(fxEl);
            this._waterFxEl = fxEl;
        }
        if (!fxEl) return;
        const cw = this.canvas.width;
        const ch = this.canvas.height;
        if (fxEl.width !== cw) fxEl.width = cw;
        if (fxEl.height !== ch) fxEl.height = ch;
        const ctx = fxEl.getContext('2d');
        ctx.clearRect(0, 0, cw, ch);
        const camX = this.cameraX - cw / 2;
        const camY = this.cameraY - ch / 2;
        const dt = this._dt || 1;
        const k = dt / 60;

        // Ondas de espuma: spawn periodico (mais frequente) mirando entidades dentro d'agua
        this._waveTimer = (this._waveTimer || 0) + k;
        if (this._waveTimer >= this.waterWaveInterval) {
            this._waveTimer = 0;
            const targets = this._waterWaveTargets();
            if (targets.length > 0) {
                const n = Math.min(2, targets.length);
                for (let i = 0; i < n; i++) {
                    const tgt = targets[Math.floor(Math.random() * targets.length)];
                    this._spawnWaterWave(tgt.x, tgt.y);
                }
                this._waveTimer = -(Math.random() * 0.5);
            }
        }
        this._updateWaterWaves(ctx, k, camX, camY);

        // Bolhas contínuas (mesmo parado) saindo de quem esta dentro d'agua
        const gmp = this.moveProgress || 0;
        const pfx = this.playerFromX + (this.playerX - this.playerFromX) * gmp;
        const pfy = (this.playerFromY + (this.playerY - this.playerFromY) * gmp) + this.playerSize / 2;
        if (this._inWaterAt(pfx, pfy) && Math.random() < k * 3.2) {
            this._spawnWaterBubble(pfx, pfy - this.playerSize * 0.5);
        }
        if (this.pokemonFollowing && this.pokemonFollowEl && this.pokemonFollowEl.style.display !== 'none') {
            if (this._inWaterAt(this.pokemonFollowRenderX, this.pokemonFollowRenderY) && Math.random() < k * 3.2) {
                const fScale = this._cityFollowerScale(this.pokemonFollowing);
                const spriteSize = this.playerSize * fScale;
                this._spawnWaterBubble(this.pokemonFollowRenderX, this.pokemonFollowRenderY - spriteSize * 0.5);
            }
        }
        for (const p of (this.wildPokemon || [])) {
            if (!p.active || !p._el || p._el.style.display === 'none') continue;
            if (this._inWaterAt(p.pos_x, p.pos_y) && Math.random() < k * 2.6) {
                const sz = this.getWildPokemonSize(p);
                this._spawnWaterBubble(p.pos_x, p.pos_y - sz * 0.5);
            }
        }

        const list = this._waterParticles;
        for (let i = list.length - 1; i >= 0; i--) {
            const p = list[i];
            p.life += k;
            if (p.life >= p.maxLife) { list.splice(i, 1); continue; }
            const t = p.life / p.maxLife;
            if (p.kind !== 'ring') {
                p.x += (p.vx || 0) * k + (p.wobA ? Math.sin(p.life * p.wobF + p.wobP) * p.wobA * k * 1.5 : 0);
                p.y += (p.vy || 0) * k;
                if (p.kind === 'foam') {
                    p.vy += 34 * k;
                    p.size *= (1 - 0.25 * k);
                } else {
                    p.vy -= 8 * k;
                }
            }
            const sx = p.x - camX;
            const sy = p.y - camY;
            if (sy < -30 || sx < -30 || sx > cw + 30 || sy > ch + 30) { list.splice(i, 1); continue; }
            if (p.kind === 'foam') {
                const alpha = Math.sin(Math.min(1, t * 1.2) * Math.PI) * 0.8;
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(sx, sy, Math.max(0.5, p.size * (1 - t * 0.35)), 0, Math.PI * 2);
                ctx.fill();
            } else if (p.kind === 'ring') {
                const s = p.size + (p.maxSize - p.size) * t;
                ctx.globalAlpha = (1 - t) * 0.5;
                ctx.strokeStyle = '#eaf8ff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(sx, sy, s, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                const size = p.size * (1 + t * 0.4);
                const alpha = Math.sin(Math.min(1, t * 1.4) * Math.PI) * 0.6;
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(sx, sy, size, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.85)';
                ctx.beginPath();
                ctx.arc(sx - size * 0.3, sy - size * 0.35, Math.max(0.5, size * 0.3), 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    drawNpcSprite(ctx, n, camX, camY, cw, ch, shadowOffX, shadowOffY) {
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
                this.drawSpriteReflection(ctx, img, offsetX + walkIdx * frameW, offsetY + dirIdx * frameH, frameW, frameH, sx, drawY, ps, ps);
            } else {
                ctx.drawImage(img, sx, sy, ps, ps);
                this.drawSpriteReflection(ctx, img, 0, 0, img.naturalWidth, img.naturalHeight, sx, sy, ps, ps);
            }
        } else {
            ctx.fillStyle = n.npc_type === 'professor' ? '#ffd54f' : (n.npc_type === 'narrator' ? '#f59e0b' : (n.npc_type === 'vendor' ? '#2f855a' : (n.npc_type === 'banker' ? '#8b5cf6' : '#ff8fab')));
            ctx.fillRect(sx + 4, sy + 4, ps - 8, ps - 8);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(n.name || (n.npc_type === 'professor' ? 'Carvalho' : (n.npc_type === 'narrator' ? 'Narrador' : (n.npc_type === 'vendor' ? 'Vendedor' : (n.npc_type === 'banker' ? 'Banqueira' : 'Joy')))), sx + ps / 2, sy - 6);
        }
    }

    // Desenha nome/titulo dos jogadores numa overlay propria (z 26) acima do overlay
    // de dia/noite (z 25): os sprites escurecem, mas nomes/titulos continuam legiveis.
    _drawPlayerLabels() {
        const labels = this._playerLabels;
        const cw = this.canvas.width;
        const ch = this.canvas.height;
        if (!labels || labels.length === 0) {
            if (this._labelsOverlayEl) {
                const c2 = this._labelsOverlayEl.getContext('2d');
                c2.clearRect(0, 0, this._labelsOverlayEl.width, this._labelsOverlayEl.height);
            }
            return;
        }
        let ovEl = this._labelsOverlayEl;
        if (!ovEl && this.canvas && this.canvas.parentElement) {
            ovEl = document.createElement('canvas');
            ovEl.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:26;';
            this.canvas.parentElement.appendChild(ovEl);
            this._labelsOverlayEl = ovEl;
        }
        if (!ovEl) return;
        if (ovEl.width !== cw) ovEl.width = cw;
        if (ovEl.height !== ch) ovEl.height = ch;
        const ctx = ovEl.getContext('2d');
        ctx.clearRect(0, 0, cw, ch);
        for (const l of labels) {
            ctx.fillStyle = l.group ? '#38bdf8' : '#fff';
            ctx.font = 'bold 11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur = 4;
            ctx.fillText(l.name, l.x, l.y);
            ctx.shadowBlur = 0;
            if (l.title && l.titleColor) {
                ctx.fillStyle = l.titleColor;
                ctx.font = 'bold 10px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.shadowColor = 'rgba(0,0,0,0.9)';
                ctx.shadowBlur = 3;
                ctx.fillText(l.title, l.x, l.y - 12);
                ctx.shadowBlur = 0;
            }
        }
    }

    drawPlayerSprite(ctx, p, camX, camY, shadowOffX, shadowOffY, fScaleX, fScaleY, fOffX, fOffY, band) {
        const ps = this.playerSize;
        let drawX, drawY;
        const mp = p.isMe ? this.moveProgress : (p.moveProgress ?? 1);
        const fx = p.isMe ? this.playerFromX : (p.fromX ?? p.pos_x);
        const fy = p.isMe ? this.playerFromY : (p.fromY ?? p.pos_y);
        const tx = p.isMe ? this.playerX : p.pos_x;
        const ty = p.isMe ? this.playerY : p.pos_y;
        const _ix = fx + (tx - fx) * mp;
        const _iy = fy + (ty - fy) * mp;
        // Boiado na agua (pelo X/Y interpolado + pés); 0 fora da agua
        const _bob = this._waterBobAt(_ix, _iy + ps / 2);
        drawX = _ix - camX - ps / 2;
        drawY = _iy - camY - ps / 2 + _bob;

        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(drawX + ps / 2 + shadowOffX, drawY + ps - 2 + shadowOffY, ps / 3, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pokemon seguindo dos OUTROS jogadores (DOM sobre o canvas p/ animar o GIF)
        if (!p.isMe) {
            if (p.follower_sprite_url) {
                // Banda do follower pela SUA profundidade real (offset de direção)
                const fdir = p.direction || 'down';
                let foffY = 0;
                if (fdir === 'down') foffY = -(this.followerBehind + ps / 2);
                else if (fdir === 'up') foffY = 55 - ps / 2;
                const fDepth = drawY + camY + ps + foffY;
                const fband = this._bandForFollower(fDepth, this._depthSplits);
                this.drawOtherPlayerFollowerDom(p, drawX, drawY, ps, fScaleX, fScaleY, fOffX, fOffY, fband);
            } else {
                const _entry = this._otherFollowerEls && this._otherFollowerEls[p.user_id];
                if (_entry) { _entry.el.style.display = 'none'; _entry.shadowEl.style.display = 'none'; }
            }
        }

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
                // Dentro d'agua o personagem nao "caminha": trava no frame 0 da direcao atual
                const _inWater = this._inWaterAt(_ix, _iy + ps / 2);
                const walkIdx = (isMoving && !_inWater) ? Math.min(Math.floor(pmp * 4), 3) : 0;
                ctx.drawImage(skinImg, walkIdx * frameW, row * frameH, frameW, frameH, drawX, drawY, ps, ps);
                this.drawSpriteReflection(ctx, skinImg, walkIdx * frameW, row * frameH, frameW, frameH, drawX, drawY, ps, ps);
            } else {
                ctx.drawImage(skinImg, drawX, drawY, ps, ps);
                this.drawSpriteReflection(ctx, skinImg, 0, 0, skinImg.naturalWidth, skinImg.naturalHeight, drawX, drawY, ps, ps);
            }
        } else {
            ctx.fillStyle = p.isMe ? '#3498db' : '#e94560';
            ctx.fillRect(drawX + 4, drawY + 4, ps - 8, ps - 8);
        }

        // Nome/titulo nao sofrem o escurecimento do dia/noite: vao para uma overlay
        // propria (z 26, acima do overlay de noite z 25) desenhada no fim do render.
        const title = p.isMe ? (this.myEquippedTitle || null) : (p.equipped_title || null);
        let titleColor = null;
        if (title) {
            const titleId = p.isMe ? (this.myEquippedTitleId || null) : (p.equipped_title_id || null);
            const rarity = window.Titles ? window.Titles.getRarity(titleId) : 'common';
            if (rarity === 'mythic') {
                const hue = (Date.now() / 12) % 360;
                titleColor = `hsl(${hue}, 100%, 65%)`;
            } else {
                titleColor = (window.Titles && window.Titles.getRarityStyle(titleId)) ? window.Titles.getRarityStyle(titleId).color : '#fbbf24';
            }
        }
        (this._playerLabels = this._playerLabels || []).push({
            x: drawX + ps / 2,
            y: drawY - 8,
            name: p.character_name || '?',
            group: !!(window.GroupSystem && window.GroupSystem.isMember(p.character_id)),
            title,
            titleColor
        });
    }

    // ---- Faixas de profundidade ----
    // Cada pokémon que segue (DOM) vira um ponto de divisão: canvas da banda i tem
    // z = 2+2i, o follower da banda i fica em z = 3+2i (entre as faixas i e i+1).
    // Overlays DOM (teleport/wild/rank/raid) ficam em z >= 40.

    _ensureDepthCanvases() {
        if (this._depthCanvasesReady) return;
        const wrap = this.canvas && this.canvas.parentElement;
        if (!wrap) return;
        this._depthCanvasesReady = true;
        const count = 10;
        this.depthCanvases = [];
        this.depthCtxs = [];
        for (let i = 0; i < count; i++) {
            const c = document.createElement('canvas');
            c.className = 'city-depth-canvas';
            c.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';
            c.style.zIndex = (2 + 2 * i) + '';
            c.width = this.canvas.width || 1;
            c.height = this.canvas.height || 1;
            wrap.appendChild(c);
            this.depthCanvases.push(c);
            this.depthCtxs.push(c.getContext('2d'));
        }
    }

    _computeDepthSplits() {
        const splits = [];
        const ps = this.playerSize;
        if (this.pokemonFollowing && this.pokemonFollowEl && this.pokemonFollowEl.style.display !== 'none') {
            splits.push(this.pokemonFollowRenderY);
        }
        Object.values(this.players || {}).forEach(p => {
            if (!p.follower_sprite_url) return;
            const fromY = p.fromY ?? p.pos_y;
            const interpY = fromY + (p.pos_y - fromY) * (p.moveProgress ?? 1);
            // Profundidade real do follower (offset de direção), igual ao DOM
            const dir = p.direction || 'down';
            let offY = 0;
            if (dir === 'down') offY = -(this.followerBehind + ps / 2);
            else if (dir === 'up') offY = 55 - ps / 2;
            splits.push(interpY + ps / 2 + offY);
        });
        const uniq = [...new Set(splits)];
        uniq.sort((a, b) => a - b);
        return uniq;
    }

    _bandForDepth(depth, splits) {
        let b = 0;
        if (splits) for (const s of splits) if (s <= depth) b++;
        const max = this.depthCanvases ? this.depthCanvases.length - 1 : 0;
        return Math.min(b, max);
    }

    // Banda de um follower: ele fica na faixa ABAIXO do próprio split (não o conta).
    _bandForFollower(depth, splits) {
        let b = 0;
        if (splits) for (const s of splits) if (s < depth) b++;
        const max = this.depthCanvases ? this.depthCanvases.length - 1 : 0;
        return Math.min(b, max);
    }

    _clearDepthCanvases(bandCount, cw, ch) {
        if (!this.depthCanvases) return 0;
        const used = Math.max(1, Math.min(bandCount, this.depthCanvases.length));
        for (let i = 0; i < this.depthCanvases.length; i++) {
            const c = this.depthCanvases[i];
            if (i < used) {
                c.style.display = 'block';
                const dctx = this.depthCtxs[i];
                dctx.imageSmoothingEnabled = true;
                if ('imageSmoothingQuality' in dctx) dctx.imageSmoothingQuality = 'high';
                dctx.clearRect(0, 0, cw, ch);
            } else {
                c.style.display = 'none';
            }
        }
        return used;
    }

    render() {
        if (!this.ctx || !this.canvas) return;
        const ctx = this.ctx;
        const cw = this.canvas.width;
        const ch = this.canvas.height;
        if (cw === 0 || ch === 0) return;
        this._animTime = (this._animTime || 0) + (this._dt || 1) / 60;

        this._ensureDepthCanvases();

        const camX = this.cameraX - cw / 2;
        const camY = this.cameraY - ch / 2;

        const dn = this.getDayNight();
        const sunHeight = Math.max(0.15, Math.sin(dn.sunAngle));
        const shadowLen = (1 - sunHeight) * 16;
        const shadowOffX = -Math.cos(dn.sunAngle) * shadowLen;
        const shadowOffY = 2 + sunHeight * 3;

        // Faixas de profundidade: cada pokémon seguindo (DOM) vira um ponto de divisão.
        this._depthSplits = this._computeDepthSplits();
        const bandCount = this._clearDepthCanvases(this._depthSplits.length + 1, cw, ch);
        const bandCtx = (i) => (this.depthCtxs && this.depthCtxs[i]) ? this.depthCtxs[i] : ctx;
        const topCtx = bandCtx(bandCount - 1);

        // Grama alta/agua: posicao dos pes do personagem (interpolada) para o corte
        this._grassFronts = [];
        const _gmp = this.moveProgress || 0;
        const _grassPfx = this.playerFromX + (this.playerX - this.playerFromX) * _gmp;
        const _grassPfy = (this.playerFromY + (this.playerY - this.playerFromY) * _gmp) + this.playerSize / 2;
        this._pushGrassFrontForFeet(_grassPfx, _grassPfy);

        // ---- FUNDO: canvas base, abaixo de todas as faixas ----
        ctx.clearRect(0, 0, cw, ch);
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
            if ((a.layer || 0) === 3) return; // Layer 3 vai para o pool de profundidade (Y-Sorting)
            this.drawAssetSprite(ctx, a, camX, camY, cw, ch);
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

        ctx.restore();

        // ---- Y-Sorting do Layer 3 ----
        // Lista única de entidades renderizáveis do Layer 3 (assets + NPCs + jogadores),
        // ordenada por depthY (ponto de contato com o chão), do menor para o maior.
        const allPlayers = [];
        if (this.myPlayer) allPlayers.push({
            pos_x: this.playerX, pos_y: this.playerY, direction: this.playerDir,
            character_name: this.myPlayer.character_name,
            character_id: this.myPlayer.character_id,
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

        // Grama/agua na frente de OUTROS jogadores: eles tambem sao cobertos quando
        // andam na grama ou na agua (recorte alinhado, igual ao do jogador local).
        for (const p of allPlayers) {
            if (p.isMe) continue;
            const ps = this.playerSize;
            const mp = p.moveProgress ?? 1;
            const fx = p.fromX ?? p.pos_x;
            const fy = p.fromY ?? p.pos_y;
            const ix = fx + (p.pos_x - fx) * mp;
            const iy = (fy + (p.pos_y - fy) * mp) + ps / 2;
            this._pushGrassFrontForFeet(ix, iy);
        }

        const count = allPlayers.length;
        const countEl = document.getElementById('city-player-count');
        if (countEl) countEl.textContent = `${count} jogador${count !== 1 ? 'es' : ''} online`;

        // Escala/offset do canvas -> container DOM (para followers DOM dos outros jogadores)
        const _wrap = this.canvas.parentElement;
        const _canvasRect = this.canvas.getBoundingClientRect();
        const _wrapRect = _wrap ? _wrap.getBoundingClientRect() : null;
        const fScaleX = _canvasRect.width / this.canvas.width;
        const fScaleY = _canvasRect.height / this.canvas.height;
        const fOffX = _canvasRect.left - (_wrapRect ? _wrapRect.left : 0);
        const fOffY = _canvasRect.top - (_wrapRect ? _wrapRect.top : 0);

        const depthPool = [];
        this._playerLabels = [];
        this.assets.forEach(a => {
            if ((a.layer || 0) === 3) depthPool.push({ kind: 'asset', ref: a });
        });
        this.npcs.forEach(n => {
            if (n.npc_type !== 'nurse' && n.npc_type !== 'professor' && n.npc_type !== 'narrator' && n.npc_type !== 'vendor' && n.npc_type !== 'banker') return;
            depthPool.push({ kind: 'npc', ref: n });
        });
        allPlayers.forEach(p => depthPool.push({ kind: 'player', ref: p }));
        if (this._grassFronts && this._grassFronts.length > 0) {
            this._grassFronts.forEach(gf => depthPool.push({ kind: 'grassFront', ref: gf }));
        }
        depthPool.sort((x, y) => (this.getEntityDepthY(x) - this.getEntityDepthY(y)) || ((x.ref.z_index || 0) - (y.ref.z_index || 0)));

        // Cada entidade vai para a faixa certa (entre os pokémons que seguem).
        depthPool.forEach(e => {
            const band = this._bandForDepth(this.getEntityDepthY(e), this._depthSplits);
            const dctx = bandCtx(band);
            if (e.kind === 'asset') {
                this.drawAssetSprite(dctx, e.ref, camX, camY, cw, ch);
            } else if (e.kind === 'npc') {
                this.drawNpcSprite(dctx, e.ref, camX, camY, cw, ch, shadowOffX, shadowOffY);
            } else if (e.kind === 'grassFront') {
                this._drawGrassFront(dctx, e.ref, camX, camY);
            } else {
                this.drawPlayerSprite(dctx, e.ref, camX, camY, shadowOffX, shadowOffY, fScaleX, fScaleY, fOffX, fOffY, band);
            }
        });

        // ---- OVERLAYS: faixa do topo (acima do pool e do fundo, abaixo dos followers) ----
        topCtx.save();

        if (window._cityDebug) {
            topCtx.fillStyle = 'rgba(231, 76, 60, 0.25)';
            topCtx.strokeStyle = '#e74c3c';
            topCtx.lineWidth = 2;
            for (const z of this.collisionZones) {
                const sx = z.pos_x - camX;
                const sy = z.pos_y - camY;
                topCtx.fillRect(sx, sy, z.width, z.height);
                topCtx.strokeRect(sx, sy, z.width, z.height);
            }
            const hb = this._playerHitbox(this.playerX, this.playerY);
            const ppx = hb.px - camX;
            const ppy = hb.py - camY;
            topCtx.fillStyle = 'rgba(0, 255, 0, 0.2)';
            topCtx.strokeStyle = '#00ff00';
            topCtx.lineWidth = 2;
            topCtx.fillRect(ppx, ppy, hb.ps, hb.ps);
            topCtx.strokeRect(ppx, ppy, hb.ps, hb.ps);
            topCtx.fillStyle = '#00ff00';
            topCtx.font = 'bold 10px Inter, sans-serif';
            topCtx.textAlign = 'center';
            topCtx.fillText(`${hb.ps}x${hb.ps}`, ppx + hb.ps / 2, ppy - 6);
        }

        if (this.nearestTeleport) {
            const t = this.nearestTeleport;
            const sx = t.sign_x - camX + t.sign_width / 2;
            const sy = t.sign_y - camY - 20;
            topCtx.fillStyle = 'rgba(139, 92, 246, 0.9)';
            topCtx.beginPath();
            topCtx.roundRect(sx - 50, sy - 14, 100, 22, 6);
            topCtx.fill();
            topCtx.fillStyle = '#fff';
            topCtx.font = 'bold 11px Inter, sans-serif';
            topCtx.textAlign = 'center';
            topCtx.fillText('Aperte E', sx, sy + 1);
        }

        if (this.nearestNpc && !this.npcDialogueOpen) {
            const n = this.nearestNpc;
            const sx = n.pos_x - camX + n.width / 2;
            const sy = n.pos_y - camY - 20;
            const label = (n.npc_type === 'nurse' || n.npc_type === 'narrator' || n.npc_type === 'vendor' || n.npc_type === 'pc' || n.npc_type === 'banker') ? 'Aperte E para interagir' : 'Aperte E';
            const boxW = (n.npc_type === 'nurse' || n.npc_type === 'narrator' || n.npc_type === 'vendor' || n.npc_type === 'pc' || n.npc_type === 'banker') ? 170 : 100;
            topCtx.fillStyle = 'rgba(245, 158, 11, 0.9)';
            topCtx.beginPath();
            topCtx.roundRect(sx - boxW / 2, sy - 14, boxW, 22, 6);
            topCtx.fill();
            topCtx.fillStyle = '#000';
            topCtx.font = 'bold 11px Inter, sans-serif';
            topCtx.textAlign = 'center';
            topCtx.fillText(label, sx, sy + 1);
        }

        if (this.nearRaidPortal && this.raidPortal) {
            const p = this.raidPortal;
            const sx = p.pos_x - camX + (p.width || 64) / 2;
            const sy = p.pos_y - camY - 24;
            topCtx.fillStyle = 'rgba(123, 47, 247, 0.9)';
            topCtx.beginPath();
            topCtx.roundRect(sx - 70, sy - 14, 140, 22, 6);
            topCtx.fill();
            topCtx.fillStyle = '#fff';
            topCtx.font = 'bold 11px Inter, sans-serif';
            topCtx.textAlign = 'center';
            topCtx.fillText('Pressione E para entrar na raid', sx, sy + 1);
        }

        if (this.nearGymNpc && this.gymNpc) {
            const sx = this.gymNpc.pos_x - camX;
            const sy = this.gymNpc.pos_y - camY - 50;
            topCtx.fillStyle = 'rgba(233, 69, 96, 0.9)';
            topCtx.beginPath();
            topCtx.roundRect(sx - 70, sy - 14, 140, 22, 6);
            topCtx.fill();
            topCtx.fillStyle = '#fff';
            topCtx.font = 'bold 11px Inter, sans-serif';
            topCtx.textAlign = 'center';
            topCtx.fillText('Pressione E para interagir', sx, sy + 1);
        }

        if (this.nearRaidExit && this.raidExit) {
            const e = this.raidExit;
            const sx = e.pos_x - camX;
            const sy = e.pos_y - camY - 24;
            topCtx.fillStyle = 'rgba(34, 197, 94, 0.9)';
            topCtx.beginPath();
            topCtx.roundRect(sx - 60, sy - 14, 120, 22, 6);
            topCtx.fill();
            topCtx.fillStyle = '#fff';
            topCtx.font = 'bold 11px Inter, sans-serif';
            topCtx.textAlign = 'center';
            topCtx.fillText('Pressione E para sair', sx, sy + 1);
        }

        if (this.inActiveGymZone) {
            const cx = this.canvas.width / 2;
            const cy = this.canvas.height - 80;
            topCtx.fillStyle = 'rgba(233, 69, 96, 0.9)';
            topCtx.beginPath();
            topCtx.roundRect(cx - 130, cy - 16, 260, 30, 8);
            topCtx.fill();
            topCtx.fillStyle = '#fff';
            topCtx.font = 'bold 14px Inter, sans-serif';
            topCtx.textAlign = 'center';
            topCtx.fillText('APERTE E PARA DESAFIAR O LÍDER', cx, cy + 5);
        }

        topCtx.restore();

        // Pokemon seguindo o jogador (desenhado sobre o canvas)
        this.drawCityFollower();

        // Particulas de grama ao andar (jogador + pokemon que segue)
        this._updateGrassFx();
        this._updateWaterFx();

        // Day/night overlay (ACIMA de todas as entidades DOM, mesma cor, sem mascara):
        // canvas transparente z 25, abaixo dos layers de raid/teleport (z 40+).
        let ovEl = this._nightOverlayEl;
        if (!ovEl && this.canvas && this.canvas.parentElement) {
            ovEl = document.createElement('canvas');
            ovEl.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:25;';
            this.canvas.parentElement.appendChild(ovEl);
            this._nightOverlayEl = ovEl;
        }
        if (ovEl) {
            if (ovEl.width !== cw) ovEl.width = cw;
            if (ovEl.height !== ch) ovEl.height = ch;
            const ovCtx = ovEl.getContext('2d');
            ovCtx.clearRect(0, 0, cw, ch);
            if (dn.darkness > 0.01) {
                ovCtx.save();
                ovCtx.globalAlpha = dn.darkness;
                ovCtx.fillStyle = `rgb(${dn.tint.r},${dn.tint.g},${dn.tint.b})`;
                ovCtx.fillRect(0, 0, cw, ch);
                ovCtx.restore();
            }
            // Psychic weather: leve tom roxo sobre a tela (dia ou noite)
            if ((this._weather || this.getWeather()) === 'psychic') {
                ovCtx.save();
                ovCtx.globalAlpha = 0.3;
                ovCtx.fillStyle = 'rgb(139, 92, 246)';
                ovCtx.fillRect(0, 0, cw, ch);
                ovCtx.restore();
            }
            // Night lights (lamps glow as it gets dark)
            if (dn.darkness > 0.15 && this.lights.length > 0) {
                const intensity = Math.min(1, (dn.darkness - 0.15) / 0.5);
                ovCtx.save();
                ovCtx.globalCompositeOperation = 'screen';
                for (const l of this.lights) {
                    const sx = l.pos_x - camX;
                    const sy = l.pos_y - camY;
                    if (sx < -300 || sx > cw + 300 || sy < -300 || sy > ch + 300) continue;
                    const radius = (l.radius || 120);
                    const grad = ovCtx.createRadialGradient(sx, sy, 0, sx, sy, radius);
                    grad.addColorStop(0, `rgba(255,220,150,${0.5 * intensity})`);
                    grad.addColorStop(0.3, `rgba(255,200,120,${0.28 * intensity})`);
                    grad.addColorStop(1, 'rgba(255,180,80,0)');
                    ovCtx.fillStyle = grad;
                    ovCtx.beginPath();
                    ovCtx.arc(sx, sy, radius, 0, Math.PI * 2);
                    ovCtx.fill();
                }
                ovCtx.restore();
            }
            // Weather particles
            const weather = this._weather || 'clear';
            if (weather !== 'clear' && weather !== 'psychic') {
                ovCtx.save();
                for (const p of this.weatherParticles) {
                    if (weather === 'rain') {
                        ovCtx.beginPath();
                        ovCtx.moveTo(p.x, p.y);
                        ovCtx.lineTo(p.x + p.wind * 0.5, p.y + p.len);
                        ovCtx.strokeStyle = `rgba(120,180,255,${p.opacity})`;
                        ovCtx.lineWidth = 1.2;
                        ovCtx.stroke();
                    } else if (weather === 'wind') {
                        ovCtx.beginPath();
                        ovCtx.moveTo(p.x, p.y);
                        ovCtx.lineTo(p.x - p.len, p.y + Math.sin(p.wobble) * 2);
                        ovCtx.strokeStyle = `rgba(255,255,255,${p.opacity * 0.55})`;
                        ovCtx.lineWidth = 1.6;
                        ovCtx.stroke();
                    } else if (weather === 'sandstorm') {
                        ovCtx.fillStyle = `rgba(222, 179, 106, ${p.opacity * 0.85})`;
                        ovCtx.beginPath();
                        ovCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                        ovCtx.fill();
                    } else if (weather === 'grassstorm') {
                        ovCtx.fillStyle = `rgba(130, 190, 90, ${p.opacity * 0.85})`;
                        ovCtx.beginPath();
                        ovCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                        ovCtx.fill();
                    } else if (weather === 'gold') {
                        ovCtx.fillStyle = `rgba(255, 214, 90, ${p.opacity})`;
                        ovCtx.fillRect(p.x, p.y, p.size + 1, p.size + 1);
                    } else {
                        ovCtx.beginPath();
                        ovCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                        ovCtx.fillStyle = `rgba(220,235,255,${p.opacity})`;
                        ovCtx.fill();
                    }
                }
                ovCtx.restore();
            }
        }

        // Nome/titulo dos jogadores acima do overlay de dia/noite (nao escurecem)
        this._drawPlayerLabels();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.cityScreen = new CityScreen();
});

// Preferências de Gameplay (auto recusa de convites). Default: recusas desligadas.
window.CitySettings = {
    getAutoDeclineGroup: () => localStorage.getItem('pokefury_auto_decline_group') === 'true',
    getAutoDeclinePvp: () => localStorage.getItem('pokefury_auto_decline_pvp') === 'true'
};

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
