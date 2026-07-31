import { TYPE_COLORS, STARTER_IDS, TOTAL_POKEMON } from './data.js';
import { randomInt, loadTypeEffectiveness, calculateAllStats } from './utils.js';
import { createPokemon, createTeam, determineTurnOrder, executeTurn, getAIMove, getEffectivenessText, isTeamFainted, getFirstAlive, awardExp, expForLevel, learnLevelUpMoves, checkAbilityChange } from './battle.js';
import {
    showScreen, preloadBattleSprites, preloadBattleBgImage, updateBattleUI, showBattleMessage, showMoveSelection,
    drawBattleScene, initBattleUI, updateHpBar, showBagSelection, hideBattlePokemonSprites, stopBattleVideo, showMoveLearnPopup,
    detectBattleCircles, setBattlePositions, setBattleEffects, resetBattleFx, BATTLE_FX_LIST, getBattlePokemonSprites,
    removePlayerSprite, setPlayerSpriteRef, setSkipPlayerRender, setSkipEnemyRender
} from './ui.js';
import { Overworld2D } from './overworld.js';
import { MapEditor } from './map-editor.js';
import { RegionManager } from './region-manager.js';
import { MapZoneEditor } from './zone-editor.js';
import { Chat } from './chat.js';
import { BattleAnimations } from './battle-animations.js';

const SHINY_CHANCE = 128;

class PokeFuryGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 1280;
        this.canvas.height = 720;

        this.state = 'idle';
        this.playerName = 'Treinador';
        this.playerGender = 'male';
        this.currentCharacterId = null;
        this.playerTeam = [];
        this.enemyTeam = [];
        this.battleStartTime = null;
        this.starterDataCache = [];
        this.overworld2d = null;
        this._starting = false;
        this.chat = new Chat();
        this.trainerLevel = 1;
        this.trainerExp = 0;
        this.mochilaCategory = 'pocoes';

        this.regionManager = new RegionManager();
        this.battleAnimations = null;
        this.currentRegion = null;
        this.currentMap = null;
        this.currentRegionMaps = [];

        this.init();
    }

    async init() {
        await PokeAPI.init();
        await loadTypeEffectiveness();
        console.log('[PokeFury] Type effectiveness loaded from Supabase');
        await this.preloadStarters();
        this.render();

        this.setupEventListeners();

        // Auto-login: check for existing session + saved character
        if (window.GameData.userId && window.GameData.currentCharacterId) {
            try {
                const { data: { session } } = await window.db.auth.getSession();
                if (session && session.user) {
                    const { data: save } = await window.db.from('game_saves').select('*').eq('id', window.GameData.currentCharacterId).single();
                    if (save) {
                        console.log('[PokeFury] Auto-restoring session for:', save.player_name);
                        window.GameData.setUserId(session.user.id);

                        try {
                            const { data: profile } = await window.db.from('profiles').select('is_admin').eq('id', session.user.id).single();
                            window.isAdmin = !!(profile && profile.is_admin);
                        } catch (e) {
                            window.isAdmin = false;
                        }

                        document.getElementById('auth-screen').classList.add('hidden');
                        document.getElementById('character-screen').classList.add('hidden');
                        await this.loadCharacter(save);
                        return;
                    }
                }
            } catch (e) {
                console.log('[PokeFury] Auto-login failed:', e);
            }
        }
    }

    setupEventListeners() {
        document.querySelectorAll('.section-header[data-toggle]').forEach(header => {
            header.addEventListener('click', () => {
                header.classList.toggle('open');
                const items = header.nextElementSibling;
                if (items) items.classList.toggle('open');
            });
        });

        document.querySelectorAll('.nav-btn[data-screen]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (btn.dataset.screen === 'pokedex') this.openPokedex();
            });
        });

        const pcBtn = document.getElementById('btn-pc-pokemon');
        if (pcBtn) {
            pcBtn.addEventListener('click', () => this.openPC());
        }

        const mochilaBtn = document.getElementById('btn-mochila');
        if (mochilaBtn) {
            mochilaBtn.addEventListener('click', () => this.openMochila());
        }
        const mochilaClose = document.getElementById('mochila-close');
        if (mochilaClose) {
            mochilaClose.addEventListener('click', () => this.closeMochila());
        }
        const mochilaOverlay = document.getElementById('mochila-overlay');
        if (mochilaOverlay) {
            mochilaOverlay.addEventListener('click', (e) => {
                if (e.target === mochilaOverlay) this.closeMochila();
            });
        }
        document.querySelectorAll('.mochila-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.mochila-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.mochilaCategory = tab.dataset.category;
                this.renderMochila();
            });
        });
        const mochilaSearch = document.getElementById('mochila-search-input');
        if (mochilaSearch) {
            mochilaSearch.addEventListener('input', () => this.renderMochila());
        }

        const pcClose = document.getElementById('pc-close');
        if (pcClose) {
            pcClose.addEventListener('click', () => this.closePC());
        }
        const pcArrowLeft = document.getElementById('pc-arrow-left');
        if (pcArrowLeft) {
            pcArrowLeft.addEventListener('click', () => this.navigatePC(-1));
        }
        const pcArrowRight = document.getElementById('pc-arrow-right');
        if (pcArrowRight) {
            pcArrowRight.addEventListener('click', () => this.navigatePC(1));
        }

        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                localStorage.removeItem('pokefury_userId');
                localStorage.removeItem('pokefury_characterId');
                try {
                    await window.db.auth.signOut({ scope: 'global' });
                } catch (e) {
                    console.warn('[PokeFury] signOut error:', e);
                }
                // Force clear all supabase auth keys
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('sb-') || key.includes('supabase')) {
                        localStorage.removeItem(key);
                    }
                });
                window.GameData.userId = null;
                window.GameData.currentCharacterId = null;
                window.location.reload();
            });
        }

        const switchCharBtn = document.getElementById('btn-switch-character');
        if (switchCharBtn) {
            switchCharBtn.addEventListener('click', () => {
                this.switchCharacter();
            });
        }

    }

    async preloadStarters() {
        const starterPromises = STARTER_IDS.map(id => PokeAPI.ensurePokemon(id));
        this.starterDataCache = await Promise.all(starterPromises);
        await PokeAPI.preloadSprites(this.starterDataCache.map(s => s.spriteUrls.front || s.spriteUrls.home || s.spriteUrls.official));
    }

    async loadCharacter(save) {
        this.currentCharacterId = save.id;
        window.GameData.setCurrentCharacter(save.id);
        this.playerName = save.player_name || 'Treinador';
        this.playerGender = save.player_gender || 'male';
        this.avatarUrl = save.avatar_url || null;
        this.trainerLevel = save.trainer_level || 1;
        this.trainerExp = save.trainer_exp || 0;
        await this.startGame(save.starter_pokemon);
    }

    trainerExpForLevel(level) {
        if (level >= 91) return 100000;
        if (level >= 81) return 40000;
        if (level >= 71) return 25000;
        if (level >= 61) return 15000;
        if (level >= 51) return 10000;
        if (level >= 41) return 5000;
        if (level >= 31) return 2000;
        if (level >= 21) return 1000;
        if (level >= 11) return 400;
        if (level >= 7) return 200;
        if (level >= 4) return 100;
        if (level >= 2) return 50;
        return 50;
    }

    async awardTrainerExp(amount) {
        this.trainerExp += amount;
        let leveled = false;
        while (this.trainerLevel < 100 && this.trainerExp >= this.trainerExpForLevel(this.trainerLevel)) {
            this.trainerExp -= this.trainerExpForLevel(this.trainerLevel);
            this.trainerLevel++;
            leveled = true;
        }
        if (this.trainerLevel >= 100) {
            this.trainerLevel = 100;
            this.trainerExp = 0;
        }
        this.updateTrainerLevelUI();
        if (leveled) {
            this.saveTrainerLevel();
        } else {
            this.saveTrainerExp();
        }
    }

    updateTrainerLevelUI() {
        const el = document.getElementById('profile-level');
        if (el) el.textContent = `Nv. ${this.trainerLevel}`;
        const fill = document.getElementById('trainer-exp-fill');
        if (fill) {
            const needed = this.trainerExpForLevel(this.trainerLevel);
            const pct = this.trainerLevel >= 100 ? 100 : Math.min(100, (this.trainerExp / needed) * 100);
            fill.style.width = pct + '%';
        }
    }

    async saveTrainerLevel() {
        if (!this.currentCharacterId || !window.db) return;
        await window.db.from('game_saves')
            .update({ trainer_level: this.trainerLevel, trainer_exp: this.trainerExp })
            .eq('id', this.currentCharacterId);
    }

    async saveTrainerExp() {
        if (!this.currentCharacterId || !window.db) return;
        await window.db.from('game_saves')
            .update({ trainer_exp: this.trainerExp })
            .eq('id', this.currentCharacterId);
    }

    async startGame(starterSpecies) {
        if (this._starting) {
            console.log('[PokeFury] startGame already in progress, skipping');
            return;
        }
        this._starting = true;
        console.log('[PokeFury] startGame called with:', starterSpecies);

        try {
            const savedTeam = await window.GameData.getTeam();

            if (savedTeam.length > 0) {
                this.playerTeam = [];
                for (const row of savedTeam) {
                    const pokemonData = await PokeAPI.ensurePokemon(row.pokemon_id || row.species);
                    if (!pokemonData) continue;
                    const pokemon = await createPokemon(pokemonData, row.level, {
                        hp: row.iv_hp, attack: row.iv_attack, defense: row.iv_defense,
                        spAtk: row.iv_sp_atk, spDef: row.iv_sp_def, speed: row.iv_speed
                    }, {
                        hp: row.ev_hp, attack: row.ev_attack, defense: row.ev_defense,
                        spAtk: row.ev_sp_atk, spDef: row.ev_sp_def, speed: row.ev_speed
                    }, row.nature, row.is_shiny);
                    pokemon.currentHp = row.current_hp != null ? row.current_hp : pokemon.stats.hp;
                    pokemon.fainted = pokemon.currentHp <= 0;
                    pokemon.experience = row.experience || 0;
                    pokemon.happiness = row.happiness ?? 70;
                    pokemon.isMega = row.is_mega || false;
                    pokemon.heldItemId = row.held_item_id || null;
                    pokemon.statusEffect = row.status_effect || null;
                    if (row.moves && Array.isArray(row.moves) && row.moves.length > 0) {
                        const savedMoveIds = row.moves.map(m => Number(m.id)).filter(Boolean);
                        if (savedMoveIds.length > 0) {
                            const { data: moveDetails } = await window.db
                                .from('moves')
                                .select('id, name, type, category, power, accuracy, pp')
                                .in('id', savedMoveIds);
                            if (moveDetails && moveDetails.length > 0) {
                                const moveMap = {};
                                moveDetails.forEach(m => { moveMap[m.id] = m; });
                                const savedMoves = row.moves.map(sm => {
                                    const full = moveMap[Number(sm.id)];
                                    if (!full) return null;
                                    return {
                                        id: full.id, name: full.name, type: full.type,
                                        category: full.category || 'physical', power: full.power || 0,
                                        accuracy: full.accuracy || 100, pp: full.pp || 35,
                                        currentPp: sm.pp ?? full.pp ?? 35
                                    };
                                }).filter(Boolean);
                                for (const newMove of pokemon.moves) {
                                    if (!savedMoves.some(m => m.id === newMove.id)) {
                                        savedMoves.push(newMove);
                                    }
                                }
                                pokemon.moves = savedMoves.slice(0, 4);
                            }
                        }
                    }
                    this.playerTeam.push(pokemon);
                }
                console.log('[PokeFury] Team restored from DB:', this.playerTeam.map(p => p.name).join(', '));
            } else {
                const pokemonData = await PokeAPI.ensurePokemon(starterSpecies);
                console.log('[PokeFury] Starter Pokemon loaded:', pokemonData.name);
                this.playerTeam = [await createPokemon(pokemonData, 5)];
                console.log('[PokeFury] Team created');
            }

            this.updatePartyPanel();
        } catch (e) {
            console.error('[PokeFury] Error creating team:', e);
            return;
        }

        document.getElementById('character-screen').classList.add('hidden');
        document.getElementById('game-wrapper').classList.remove('hidden');

        if (!this.battleAnimations) {
            this.battleAnimations = new BattleAnimations(document.getElementById('game-wrapper'));
        }

        try {
            if (!this.overworld2d) {
                console.log('[PokeFury] Creating Overworld2D...');
                this.overworld2d = new Overworld2D(this);
            }
        } catch (e) {
            console.error('[PokeFury] Error creating Overworld2D:', e);
        }

        this.state = 'overworld';
        const profileNameEl = document.getElementById('profile-name');
        if (profileNameEl) profileNameEl.textContent = this.playerName;
        const profileAvatarEl = document.getElementById('profile-avatar');
        if (profileAvatarEl && this.avatarUrl) {
            profileAvatarEl.innerHTML = `<img src="${this.avatarUrl}" class="profile-avatar-img" alt="${this.playerName}">`;
        }
        this.updateTrainerLevelUI();

        if (window.GameData.userId && !this.chat._initialized) {
            this.chat.init(window.GameData.userId, this.playerName);
            this.chat._initialized = true;
        }

        try {
            if (this.overworld2d) this.overworld2d.show();
            await this.loadPlayerRegion();
        } catch (e) {
            console.error('[PokeFury] Error showing overworld:', e);
        }

        console.log('[PokeFury] Game started successfully!');

        const adminPanel = document.getElementById('admin-panel');
        if (adminPanel && window.isAdmin) {
            adminPanel.classList.remove('hidden');
            this.setupAdminButtons();
        }

        this._saveInBackground().catch(e =>
            console.error('[PokeFury] Background save error:', e)
        );
    }

    async loadPlayerRegion() {
        try {
            await this.regionManager.loadRegions();

            if (this.regionManager.regions.length === 0) {
                document.getElementById('location-name').textContent = 'Sem regioes - rode a SQL';
                return;
            }

            let progress = null;
            try {
                progress = await this.regionManager.getPlayerProgress(this.currentCharacterId);
            } catch (e) {
                console.warn('[PokeFury] player_progress table may not exist yet:', e.message);
            }

            if (!progress) {
                const firstRegion = this.regionManager.regions[0];
                const firstMaps = await this.regionManager.loadRegionMaps(firstRegion.id);
                if (firstMaps.length > 0) {
                    try {
                        const userId = window.GameData.userId || window.db.auth.getUser?.()?.data?.user?.id;
                        progress = await this.regionManager.initPlayerProgress(
                            this.currentCharacterId, firstRegion.id, firstMaps[0].id, userId
                        );
                    } catch (e) {
                        console.warn('[PokeFury] Could not save progress, using direct fallback:', e.message);
                        progress = {
                            current_region_id: firstRegion.id,
                            current_map_id: firstMaps[0].id
                        };
                    }
                }
            }

            if (progress) {
                this.currentRegion = this.regionManager.regions.find(r => r.id === progress.current_region_id);
                if (this.currentRegion) {
                    this.currentRegionMaps = await this.regionManager.loadRegionMaps(this.currentRegion.id);
                    this.currentMap = this.currentRegionMaps.find(m => m.id === progress.current_map_id);

                    if (this.currentMap && this.overworld2d) {
                        await this.overworld2d.setCurrentMap(this.currentMap);
                        document.getElementById('location-name').textContent = this.currentMap.name;
                        console.log(`[PokeFury] Loaded: ${this.currentRegion.name} > ${this.currentMap.name}`);
                    }
                }
            }
        } catch (e) {
            console.error('[PokeFury] Error loading region:', e);
            document.getElementById('location-name').textContent = 'Area Selvagem';
        }
    }

    async advanceToNextMap() {
        try {
            const result = await this.regionManager.advanceToNextMap(this.currentCharacterId);
            if (!result) return;

            if (result.type === 'end') {
                this.showTransitionBanner(result.message, 5000);
                return;
            }

            this.currentRegion = result.region;
            this.currentMap = result.map;
            this.currentRegionMaps = await this.regionManager.loadRegionMaps(this.currentRegion.id);

            if (this.overworld2d) {
                await this.overworld2d.setCurrentMap(this.currentMap);
            }

            document.getElementById('location-name').textContent = this.currentMap.name;

            if (result.type === 'next_region') {
                this.showTransitionBanner(`Nova Regiao: ${this.currentRegion.name}`);
            } else {
                this.showTransitionBanner(this.currentMap.name);
            }
        } catch (e) {
            console.error('[PokeFury] Error advancing map:', e);
        }
    }

    showTransitionBanner(text, duration = 3000) {
        const layer = document.getElementById('ui-layer');
        if (!layer) return;

        const existing = layer.querySelector('.transition-banner');
        if (existing) existing.remove();

        const banner = document.createElement('div');
        banner.className = 'transition-banner';
        banner.style.cssText = `
            position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
            background: rgba(0,0,0,0.80); color: #fff; padding: 8px 24px;
            border-radius: 8px; border: 1px solid rgba(233,69,96,0.5); z-index: 9999;
            font-size: 13px; font-weight: 700; text-align: center;
            pointer-events: none; white-space: nowrap;
        `;
        banner.textContent = text;
        layer.appendChild(banner);
        banner.style.opacity = '0';
        banner.style.transition = 'opacity 0.2s';
        requestAnimationFrame(() => { banner.style.opacity = '1'; });
        setTimeout(() => {
            banner.style.opacity = '0';
            setTimeout(() => banner.remove(), 200);
        }, duration);
    }

    async _saveInBackground() {
        try {
            const team = await window.GameData.getTeam();
            const isNew = team.length === 0;

            await this.saveTeam();

            if (isNew) {
                await Promise.all([
                    window.GameData.addItem(1, 5),
                    window.GameData.addItem(10, 10)
                ]);
                console.log('[PokeFury] Starter items given: 5x Potion, 10x Poke Ball');
            }
        } catch (e) {
            console.error('[PokeFury] Error saving team:', e);
        }
    }

    render() {
        if (this.state === 'battle') {
            this.renderBattle();
        }
    }

    renderBattle() {
        if (this.state !== 'battle') return;
        const clip = this.getBattleClipRect();
        if (clip) {
            this.ctx.clearRect(clip.x, clip.y, clip.w, clip.h);
        }
        const activePlayer = getFirstAlive(this.playerTeam) || this._lastBattlePlayer;
        const activeEnemy = getFirstAlive(this.enemyTeam) || this._lastBattleEnemy;
        if (activePlayer && activeEnemy) {
            this._lastBattlePlayer = activePlayer;
            this._lastBattleEnemy = activeEnemy;
            drawBattleScene(this.ctx, this.canvas, activePlayer, activeEnemy, this.currentBattleBg, this.getBattleClipRect());
        }
    }

    async startWildBattle(minLevel = 2, maxLevel = 8) {
        if (!this.playerTeam || this.playerTeam.length === 0 || this.playerTeam.every(p => p.fainted)) {
            console.warn('[PokeFury] No alive pokemon, skipping wild battle');
            hideBattlePokemonSprites();
            return;
        }
        this.isWildBattle = true;
        this._playerSpriteReady = false;

        this.currentBattleBg = this.getNormalizedBattleBg();
        if (this.currentBattleBg) {
            await preloadBattleBgImage(this.currentBattleBg);
            this.applyBattleNeonFromBg(this.currentBattleBg);
        }
        if (this.currentMap && this.currentMap.battle_player_x != null) {
            setBattlePositions({
                playerX: this.currentMap.battle_player_x,
                playerY: this.currentMap.battle_player_y,
                enemyX: this.currentMap.battle_enemy_x,
                enemyY: this.currentMap.battle_enemy_y
            });
            setBattleEffects(this.currentMap.battle_player_fx, this.currentMap.battle_enemy_fx);
        } else {
            setBattlePositions(null);
            setBattleEffects('none', 'none');
        }

        let pokemon = null;

        if (this.currentMap) {
            const encounters = await this.regionManager.loadMapEncounters(this.currentMap.id);
            if (encounters.length > 0) {
                // Rarity tier spawn rates (configurable)
                const TIER_RATES = { common: 58.998, uncommon: 25, rare: 12, legendary: 0.001, inicial: 0.001 };
                const tiers = ['common', 'uncommon', 'rare', 'legendary', 'inicial'];

                // Step 1: Pick rarity tier
                const tierTotal = tiers.reduce((sum, t) => sum + (TIER_RATES[t] || 0), 0);
                let tierRoll = Math.random() * tierTotal;
                let selectedTier = 'common';
                for (const t of tiers) {
                    tierRoll -= (TIER_RATES[t] || 0);
                    if (tierRoll <= 0) { selectedTier = t; break; }
                }

                // Step 2: Filter encounters by selected tier, fallback to all if tier empty
                let pool = encounters.filter(e => e.rarity === selectedTier);
                if (pool.length === 0) pool = encounters;

                // Step 3: Weighted random within the pool
                const totalWeight = pool.reduce((sum, e) => sum + e.weight, 0);
                let roll = Math.random() * totalWeight;
                for (const enc of pool) {
                    roll -= enc.weight;
                    if (roll <= 0) {
                        const highestLevel = this.playerTeam.reduce((max, p) => Math.max(max, p.level || 1), 1);
                        const maxWild = Math.min(highestLevel + 2, 100);
                        const minWild = Math.max(maxWild - 2, 1);
                        const level = minWild + Math.floor(Math.random() * (maxWild - minWild + 1));
                        const pokemonData = await PokeAPI.ensurePokemon(enc.pokemon_name);
                        const isShiny = Math.random() < (1 / SHINY_CHANCE);
                        pokemon = await createPokemon(pokemonData, level, null, null, null, isShiny);
                        break;
                    }
                }
            }
        }

        if (!pokemon) {
            const includeVariants = Math.random() < 0.15;
            const result = await PokeAPI.getRandomWildPokemon(minLevel, maxLevel, includeVariants);
            const isShiny = Math.random() < (1 / SHINY_CHANCE);
            pokemon = await createPokemon(result.pokemon, result.level, null, null, null, isShiny);
        }
        this.enemyTeam = [pokemon];

        const activePlayer = getFirstAlive(this.playerTeam);

        this.state = 'battle';
        this._lastBattlePlayer = activePlayer;
        this._lastBattleEnemy = pokemon;
        if (this.overworld2d) this.overworld2d.hide();
        this.battleStartTime = Date.now();
        showScreen('battle-screen');
        this.positionBattleScreen();

        updateBattleUI(this.playerTeam, this.enemyTeam);

        const clipRect = this.getBattleClipRect();
        const dw = clipRect ? clipRect.w : this.canvas.offsetWidth;
        const dh = clipRect ? clipRect.h : this.canvas.offsetHeight;
        const dx = clipRect ? clipRect.x : 0;
        const dy = clipRect ? clipRect.y : 0;
        let playerEndX, playerEndY;
        if (this.currentMap && this.currentMap.battle_player_x != null) {
            playerEndX = dx + this.currentMap.battle_player_x * dw;
            playerEndY = dy + this.currentMap.battle_player_y * dh;
        } else {
            playerEndX = dx + 0.25 * dw;
            playerEndY = dy + 0.75 * dh;
        }

        const mainArea = document.getElementById('main-area');
        const wrapper = document.getElementById('game-wrapper');
        if (mainArea && wrapper) {
            const mainRect = mainArea.getBoundingClientRect();
            const wrapRect = wrapper.getBoundingClientRect();
            playerEndX += mainRect.left - wrapRect.left;
            playerEndY += mainRect.top - wrapRect.top;
        }

        const isShinyPlayer = activePlayer.isShiny;
        const spriteUrls = activePlayer.spriteUrls || {};
        const shinyUrls = activePlayer.shinySpriteUrls || {};
        this._savedPlayerSpriteSrc = isShinyPlayer
            ? (shinyUrls.back || shinyUrls.front || spriteUrls.back || spriteUrls.front)
            : (spriteUrls.back || spriteUrls.front);

        setSkipPlayerRender(true);
        drawBattleScene(this.ctx, this.canvas, activePlayer, pokemon, this.currentBattleBg, clipRect);

        removePlayerSprite();
        hideBattlePokemonSprites();

        initBattleUI(
            () => this.onFight(),
            () => this.onBag(),
            () => this.onMega(),
            () => this.onRun()
        );

        const isShinyBattle = pokemon.isShiny;
        let introMsg = `Um ${pokemon.name} selvagem apareceu!`;
        if (isShinyBattle) introMsg = `Um ${pokemon.name} SHINY selvagem apareceu!`;
        if (pokemon.variant !== 'normal') introMsg = `Um ${pokemon.name} (${pokemon.variant}) selvagem apareceu!`;

        if (this.battleAnimations) {
            const sprites = getBattlePokemonSprites();
            await this.battleAnimations.playWildEntrance(sprites.enemy);
            await this.battleAnimations.playPlayerEntrance(playerEndX, playerEndY, this._savedPlayerSpriteSrc);
            if (this.battleAnimations._playerEntranceSprite) {
                setPlayerSpriteRef(this.battleAnimations._playerEntranceSprite);
            }
        }
        setSkipPlayerRender(false);
        this._playerSpriteReady = true;

        await showBattleMessage(introMsg, 2000);
    }

    async startBattleWithPokemon(pokemonName, level, spriteUrl) {
        hideBattlePokemonSprites();
        if (!this.playerTeam || this.playerTeam.length === 0 || this.playerTeam.every(p => p.fainted)) {
            console.warn('[PokeFury] No alive pokemon, skipping battle');
            return;
        }
        this.isWildBattle = true;
        this._playerSpriteReady = false;

        try {
            const pokemonData = await PokeAPI.ensurePokemon(pokemonName);
            const isShiny = Math.random() < (1 / SHINY_CHANCE);
            const pokemon = await createPokemon(pokemonData, level, null, null, null, isShiny);

            // Force sprite URL from map entity if provided
            if (spriteUrl && pokemon.spriteUrls) {
                pokemon.spriteUrls.front = spriteUrl;
            }

            this.enemyTeam = [pokemon];

            const activePlayer = getFirstAlive(this.playerTeam);

            this.currentBattleBg = this.getNormalizedBattleBg();
            if (this.currentBattleBg) {
                await preloadBattleBgImage(this.currentBattleBg);
                this.applyBattleNeonFromBg(this.currentBattleBg);
            }
            if (this.currentMap && this.currentMap.battle_player_x != null) {
                setBattlePositions({
                    playerX: this.currentMap.battle_player_x,
                    playerY: this.currentMap.battle_player_y,
                    enemyX: this.currentMap.battle_enemy_x,
                    enemyY: this.currentMap.battle_enemy_y
                });
                setBattleEffects(this.currentMap.battle_player_fx, this.currentMap.battle_enemy_fx);
            } else {
                setBattlePositions(null);
                setBattleEffects('none', 'none');
            }
            this.state = 'battle';
            this._lastBattlePlayer = activePlayer;
            this._lastBattleEnemy = pokemon;
            if (this.overworld2d) this.overworld2d.hide();
            this.battleStartTime = Date.now();
            showScreen('battle-screen');
            this.positionBattleScreen();
            updateBattleUI(this.playerTeam, this.enemyTeam);

            const clipRect2 = this.getBattleClipRect();
            const dw2 = clipRect2 ? clipRect2.w : this.canvas.offsetWidth;
            const dh2 = clipRect2 ? clipRect2.h : this.canvas.offsetHeight;
            const dx2 = clipRect2 ? clipRect2.x : 0;
            const dy2 = clipRect2 ? clipRect2.y : 0;
            let playerEndX, playerEndY;
            if (this.currentMap && this.currentMap.battle_player_x != null) {
                playerEndX = dx2 + this.currentMap.battle_player_x * dw2;
                playerEndY = dy2 + this.currentMap.battle_player_y * dh2;
            } else {
                playerEndX = dx2 + 0.25 * dw2;
                playerEndY = dy2 + 0.75 * dh2;
            }

            const mainArea2 = document.getElementById('main-area');
            const wrapper2 = document.getElementById('game-wrapper');
            if (mainArea2 && wrapper2) {
                const mainRect2 = mainArea2.getBoundingClientRect();
                const wrapRect2 = wrapper2.getBoundingClientRect();
                playerEndX += mainRect2.left - wrapRect2.left;
                playerEndY += mainRect2.top - wrapRect2.top;
            }

            const isShinyP2 = activePlayer.isShiny;
            const sUrls2 = activePlayer.spriteUrls || {};
            const shUrls2 = activePlayer.shinySpriteUrls || {};
            this._savedPlayerSpriteSrc = isShinyP2
                ? (shUrls2.back || shUrls2.front || sUrls2.back || sUrls2.front)
                : (sUrls2.back || sUrls2.front);

            setSkipPlayerRender(true);
            drawBattleScene(this.ctx, this.canvas, activePlayer, pokemon, this.currentBattleBg, clipRect2);

            removePlayerSprite();
            hideBattlePokemonSprites();

            initBattleUI(
                () => this.onFight(),
                () => this.onBag(),
                () => this.onMega(),
                () => this.onRun()
            );

            let introMsg = `Um ${pokemon.name} selvagem apareceu!`;
            if (isShiny) introMsg = `Um ${pokemon.name} SHINY selvagem apareceu!`;

            if (this.battleAnimations) {
                const sprites = getBattlePokemonSprites();
                await this.battleAnimations.playWildEntrance(sprites.enemy);
                await this.battleAnimations.playPlayerEntrance(playerEndX, playerEndY, this._savedPlayerSpriteSrc);
                if (this.battleAnimations._playerEntranceSprite) {
                    setPlayerSpriteRef(this.battleAnimations._playerEntranceSprite);
                }
            }
            setSkipPlayerRender(false);
            this._playerSpriteReady = true;

            await showBattleMessage(introMsg, 2000);
        } catch (e) {
            console.error('[PokeFury] Error starting battle:', e);
            hideBattlePokemonSprites();
            this.state = 'overworld';
            if (this.overworld2d) this.overworld2d.show();
            showScreen('hud');
        }
    }

    async onFight() {
        const playerPokemon = getFirstAlive(this.playerTeam);
        const enemyPokemon = getFirstAlive(this.enemyTeam);
        if (!playerPokemon || !enemyPokemon) return;

        showMoveSelection(playerPokemon.moves, async (move) => {
            try {
                await this.executeBattleTurn(playerPokemon, enemyPokemon, move);
            } catch (e) {
                console.error('[Battle] Turn error:', e);
                drawBattleScene(this.ctx, this.canvas, playerPokemon, enemyPokemon, this.currentBattleBg, this.getBattleClipRect());
                updateBattleUI(this.playerTeam, this.enemyTeam);
            }
        });
    }

    async onRun() {
        const playerPokemon = getFirstAlive(this.playerTeam);
        if (!playerPokemon) return;
        const escaped = Math.random() < 0.5;
        if (escaped) {
            await showBattleMessage('Você fugiu do combate com sucesso!');
            this.endBattle(null);
        } else {
            await showBattleMessage('Não foi possível fugir do combate!');
            await this.enemyTurn();
        }
    }

    async onBag() {
        const items = await window.GameData.getInventory();
        const usableItems = items.filter(inv => inv.items && inv.items.usable_in_battle && inv.items.category !== 'pokeball');

        if (usableItems.length === 0) {
            await showBattleMessage('Mochila vazia!');
            return;
        }

        showBagSelection(usableItems, async (item) => {
            await this.useItemInBattle(item);
        });
    }

    async useItemInBattle(item) {
        const playerPokemon = getFirstAlive(this.playerTeam);
        const enemyPokemon = getFirstAlive(this.enemyTeam);
        if (!playerPokemon || !enemyPokemon) return;
        const itemData = item.items;

        await window.GameData.removeItem(item.item_id, 1);

        if (itemData.subcategory === 'heal') {
            const heal = itemData.effect === 'heal_full' || itemData.effect === 'heal_full_status'
                ? playerPokemon.stats.hp
                : itemData.effect_value;
            playerPokemon.currentHp = Math.min(playerPokemon.stats.hp, playerPokemon.currentHp + heal);
            await showBattleMessage(`Usou ${itemData.name}! HP: ${playerPokemon.currentHp}/${playerPokemon.stats.hp}`);
            this.updatePartyPanel();
        } else if (itemData.category === 'pokeball') {
            const catchRate = this.calculateCatchRate(enemyPokemon, itemData);
            const caught = Math.random() < catchRate;
            if (caught) {
                await showBattleMessage(`Capturou ${enemyPokemon.name}!`);
                const added = await window.GameData.addPokemonToTeam(enemyPokemon);
                if (added === 'team') {
                    await showBattleMessage(`${enemyPokemon.name} foi adicionado a equipe!`);
                } else if (added === 'pc') {
                    await showBattleMessage(`Equipe cheia! ${enemyPokemon.name} foi enviado ao PC Pokemon.`);
                } else {
                    await showBattleMessage('Equipe cheia e PC lotado! Pokemon perdido.');
                }
                this.endBattle('win');
                return;
            } else {
                await showBattleMessage(`O Pokemon escapou da ${itemData.name}!`);
            }
        } else if (itemData.effect && itemData.effect.startsWith('cure_')) {
            await showBattleMessage(`${playerPokemon.name} foi curado de status!`);
        }

        drawBattleScene(this.ctx, this.canvas, playerPokemon, enemyPokemon, this.currentBattleBg, this.getBattleClipRect());
        updateBattleUI(this.playerTeam, this.enemyTeam);
        await this.enemyTurn();
    }

    calculateCatchRate(pokemon, pokeball) {
        if (pokeball.effect === 'catch_100x') return 1.0;

        const level = pokemon.level || 1;
        const levelFactor = Math.max(0.1, 1 - (level * 0.035));

        let baseRate = 0.25;
        if (pokeball.effect === 'catch_2x') baseRate = 0.50;
        else if (pokeball.effect === 'catch_1.5x') baseRate = 0.35;

        let rate = baseRate * levelFactor;

        if (pokemon.isShiny) rate *= 0.25;

        return Math.min(Math.max(rate, 0.02), 1.0);
    }

    async onMega() {
        const playerPokemon = getFirstAlive(this.playerTeam);
        if (!playerPokemon) return;
        if (playerPokemon.variant !== 'normal' || playerPokemon.isMega) {
            await showBattleMessage('Nao pode mega evoluir!');
            return;
        }

        if (playerPokemon.heldItemId) {
            const megaId = await PokeAPI.canMegaEvolve(playerPokemon, playerPokemon.heldItemId);
            if (megaId) {
                const megaData = await PokeAPI.ensurePokemon(megaId);
                const oldStats = { ...playerPokemon.stats };
                const megaPokemon = await createPokemon(megaData, playerPokemon.level, playerPokemon.ivs, playerPokemon.evs, playerPokemon.nature, playerPokemon.isShiny);
                megaPokemon.isMega = true;
                megaPokemon.heldItemId = playerPokemon.heldItemId;
                megaPokemon.currentHp = Math.min(megaPokemon.stats.hp, playerPokemon.currentHp + (megaPokemon.stats.hp - oldStats.hp));

                const idx = this.playerTeam.indexOf(playerPokemon);
                if (idx >= 0) this.playerTeam[idx] = megaPokemon;

                await preloadBattleSprites(megaPokemon, getFirstAlive(this.enemyTeam));
                drawBattleScene(this.ctx, this.canvas, megaPokemon, getFirstAlive(this.enemyTeam), this.currentBattleBg, this.getBattleClipRect());
                updateBattleUI(this.playerTeam, this.enemyTeam);
                this.updatePartyPanel();
                await showBattleMessage(`${playerPokemon.name} mega evoluiu para ${megaPokemon.name}!`);
                return;
            }
        }

        await showBattleMessage('Nao tem mega stone equipada!');
    }

    async executeBattleTurn(playerPokemon, enemyPokemon, playerMove) {
        if (!playerPokemon || !enemyPokemon) return;
        try {
        const order = determineTurnOrder(playerPokemon, enemyPokemon);

        for (const pokemon of order) {
            if (pokemon.fainted) continue;

            const isPlayer = pokemon === playerPokemon;
            const attacker = isPlayer ? playerPokemon : enemyPokemon;
            const defender = isPlayer ? enemyPokemon : playerPokemon;
            const move = isPlayer ? playerMove : getAIMove(attacker);

            if (!move) {
                await showBattleMessage(`${attacker.name} não tem PP!`);
                continue;
            }

            const result = await executeTurn(attacker, defender, move);

            attacker.moves.forEach(m => {
                if (String(m.id) === String(move.id)) m.currentPp = Math.max(0, (m.currentPp || 0) - 1);
            });

            if (result.missed) {
                await showBattleMessage(`${attacker.name} errou ${move.name}!`);
            } else if (result.statusMove) {
                await showBattleMessage(`${attacker.name} usou ${move.name}!`);
                for (const msg of (result.statusMessages || [])) {
                    await showBattleMessage(msg);
                }
            } else {
                await showBattleMessage(`${attacker.name} usou ${move.name}!`);

                const effText = getEffectivenessText(result.effectiveness);
                if (effText) await showBattleMessage(effText);

                if (result.critical) await showBattleMessage('Golpe crítico!');

                await showBattleMessage(updateHpBar(defender));
            }

            drawBattleScene(this.ctx, this.canvas, playerPokemon, enemyPokemon, this.currentBattleBg, this.getBattleClipRect());
            updateBattleUI(this.playerTeam, this.enemyTeam);
            this.updatePartyPanel();

            if (defender.fainted) {
                await showBattleMessage(`${defender.name} desmaiou!`);

                if (isTeamFainted(this.enemyTeam)) {
                    await showBattleMessage('Você venceu a batalha!');
                    if (this.isWildBattle && this.enemyTeam.length === 1) {
                        const captured = await this.showCapturePrompt();
                        this.endBattle('win');
                        return;
                    }
                    this.endBattle('win');
                    return;
                }
                if (isTeamFainted(this.playerTeam)) {
                    await showBattleMessage('Todos seus Pokémon desmaiaram...');
                    this.endBattle('lose');
                    return;
                }
            }
        }
        } catch (e) {
            console.error('[Battle] executeBattleTurn error:', e);
            drawBattleScene(this.ctx, this.canvas, playerPokemon, enemyPokemon, this.currentBattleBg, this.getBattleClipRect());
            updateBattleUI(this.playerTeam, this.enemyTeam);
        }
    }

    async enemyTurn() {
        const playerPokemon = getFirstAlive(this.playerTeam);
        const enemyPokemon = getFirstAlive(this.enemyTeam);
        if (!playerPokemon || !enemyPokemon) {
            if (isTeamFainted(this.playerTeam)) {
                await showBattleMessage('Todos seus Pokémon desmaiaram...');
                this.endBattle('lose');
            }
            return;
        }
        const move = getAIMove(enemyPokemon);

        if (move) {
            const result = await executeTurn(enemyPokemon, playerPokemon, move);

            enemyPokemon.moves.forEach(m => {
                if (String(m.id) === String(move.id)) m.currentPp = Math.max(0, (m.currentPp || 0) - 1);
            });

            if (result.statusMove) {
                await showBattleMessage(`${enemyPokemon.name} usou ${move.name}!`);
                for (const msg of (result.statusMessages || [])) {
                    await showBattleMessage(msg);
                }
            } else {
                await showBattleMessage(`${enemyPokemon.name} usou ${move.name}`);

                const effText = getEffectivenessText(result.effectiveness);
                if (effText) await showBattleMessage(effText);

                await showBattleMessage(updateHpBar(playerPokemon));
            }

            drawBattleScene(this.ctx, this.canvas, playerPokemon, enemyPokemon, this.currentBattleBg, this.getBattleClipRect());
            updateBattleUI(this.playerTeam, this.enemyTeam);
            this.updatePartyPanel();

            if (playerPokemon.fainted) {
                await showBattleMessage(`${playerPokemon.name} desmaiou!`);
                if (isTeamFainted(this.playerTeam)) {
                    await showBattleMessage('Todos seus Pokémon desmaiaram...');
                    this.endBattle('lose');
                }
            }
        }
    }

    showCapturePrompt() {
        return new Promise(async (resolve) => {
            const enemyPokemon = this.enemyTeam[0];
            if (!enemyPokemon) { resolve(false); return; }

            const inventory = await window.GameData.getInventory();
            const balls = inventory.filter(inv => inv.quantity > 0 && inv.items && inv.items.category === 'pokeball');

            if (balls.length === 0) {
                await showBattleMessage('Você não tem nenhuma Pokébola!');
                resolve(false);
                return;
            }

            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:1000;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.3s';

            const popup = document.createElement('div');
            popup.style.cssText = 'background:rgba(15,20,35,0.95);border:1px solid rgba(233,69,96,0.4);border-radius:16px;padding:24px 28px;max-width:360px;width:90%;text-align:center;backdrop-filter:blur(12px);box-shadow:0 0 30px rgba(233,69,96,0.2);';

            const spriteUrl = enemyPokemon.spriteUrls?.front || enemyPokemon.spriteUrl || '';
            popup.innerHTML = `
                <div style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">Pokémon derrotado!</div>
                <div style="display:flex;justify-content:center;margin:10px 0">
                    <img src="${spriteUrl}" style="width:80px;height:80px;image-rendering:pixelated;filter:drop-shadow(0 0 8px rgba(233,69,96,0.4))" onerror="this.style.display='none'">
                </div>
                <div style="font-size:16px;color:#fff;font-weight:700;margin-bottom:4px">${enemyPokemon.name}</div>
                <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:16px">Lv. ${enemyPokemon.level}</div>
                <div style="font-size:14px;color:rgba(255,255,255,0.8);margin-bottom:18px">Quer capturar este Pokémon?</div>
                <div style="display:flex;gap:10px;justify-content:center">
                    <button id="cap-yes" style="padding:10px 28px;border:none;border-radius:10px;background:linear-gradient(135deg,#e94560,#c23152);color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;transition:transform 0.15s">Sim</button>
                    <button id="cap-no" style="padding:10px 28px;border:1px solid rgba(255,255,255,0.2);border-radius:10px;background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.7);font-size:14px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif;transition:transform 0.15s">Não</button>
                </div>
            `;

            overlay.appendChild(popup);
            document.body.appendChild(overlay);

            popup.querySelectorAll('button').forEach(b => {
                b.onmouseenter = () => { b.style.transform = 'scale(1.05)'; };
                b.onmouseleave = () => { b.style.transform = 'scale(1)'; };
            });

            document.getElementById('cap-yes').onclick = () => {
                overlay.remove();
                this.showPokeballSelection().then(captured => resolve(captured));
            };
            document.getElementById('cap-no').onclick = () => {
                overlay.remove();
                resolve(false);
            };
        });
    }

    showPokeballSelection() {
        return new Promise(async (resolve) => {
            const enemyPokemon = this.enemyTeam[0];
            if (!enemyPokemon) { resolve(false); return; }

            const inventory = await window.GameData.getInventory();
            const balls = inventory.filter(inv => inv.items && inv.items.category === 'pokeball' && inv.quantity > 0);

            if (balls.length === 0) {
                await showBattleMessage('Você não tem nenhuma Pokébola!');
                resolve(false);
                return;
            }

            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:1000;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.3s';

            const popup = document.createElement('div');
            popup.style.cssText = 'background:rgba(15,20,35,0.95);border:1px solid rgba(233,69,96,0.4);border-radius:16px;padding:24px 28px;max-width:380px;width:90%;text-align:center;backdrop-filter:blur(12px);box-shadow:0 0 30px rgba(233,69,96,0.2);';

            let html = `<div style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:12px;text-transform:uppercase;letter-spacing:1px">Escolha uma Pokébola</div>`;
            html += `<div style="display:flex;flex-direction:column;gap:8px">`;

            for (const inv of balls) {
                const item = inv.items;
                const multiplier = item.effect_value || 1;
                const label = multiplier >= 100 ? '100%' : `x${multiplier}`;
                html += `
                    <button class="cap-ball-btn" data-ball-id="${item.id}" style="display:flex;align-items:center;gap:12px;padding:10px 14px;border:1px solid rgba(255,255,255,0.1);border-radius:10px;background:rgba(255,255,255,0.04);cursor:pointer;transition:all 0.15s;text-align:left">
                        <img src="${item.sprite_url || ''}" style="width:36px;height:36px" onerror="this.style.display='none'">
                        <div style="flex:1">
                            <div style="color:#fff;font-size:13px;font-weight:700">${item.name}</div>
                            <div style="color:rgba(255,255,255,0.4);font-size:11px">x${inv.quantity} • Chance: ${label}</div>
                        </div>
                    </button>
                `;
            }
            html += `</div>`;
            html += `<button id="cap-cancel" style="margin-top:12px;padding:8px 20px;border:1px solid rgba(255,255,255,0.15);border-radius:8px;background:transparent;color:rgba(255,255,255,0.5);font-size:12px;cursor:pointer;font-family:Inter,sans-serif">Cancelar</button>`;

            popup.innerHTML = html;
            overlay.appendChild(popup);
            document.body.appendChild(overlay);

            popup.querySelectorAll('.cap-ball-btn').forEach(btn => {
                btn.onmouseenter = () => { btn.style.borderColor = '#e94560'; btn.style.background = 'rgba(233,69,96,0.1)'; };
                btn.onmouseleave = () => { btn.style.borderColor = 'rgba(255,255,255,0.1)'; btn.style.background = 'rgba(255,255,255,0.04)'; };
                btn.onclick = async () => {
                    const ballId = parseInt(btn.dataset.ballId);
                    const ballItem = balls.find(b => b.items.id === ballId);
                    if (!ballItem) return;
                    overlay.remove();
                    const captured = await this.attemptCapture(ballItem);
                    resolve(captured);
                };
            });

            document.getElementById('cap-cancel').onclick = () => {
                overlay.remove();
                resolve(false);
            };
        });
    }

    async attemptCapture(ballInventory) {
        const itemData = ballInventory.items;
        const enemyPokemon = this.enemyTeam[0];
        if (!enemyPokemon) return false;

        await window.GameData.removeItem(ballInventory.item_id, 1);

        const catchRate = this.calculateCatchRate(enemyPokemon, itemData);
        const caught = Math.random() < catchRate;

        if (this.battleAnimations) {
            const sprites = getBattlePokemonSprites();
            const overlayRect = this.battleAnimations._getBoundingClientRect();

            const startX = overlayRect.width * 0.15;
            const startY = overlayRect.height * 0.65;

            let targetX = overlayRect.width * 0.5;
            let targetY = overlayRect.height * 0.35;
            if (sprites.enemy) {
                const eRect = sprites.enemy.getBoundingClientRect();
                targetX = eRect.left - overlayRect.left + eRect.width * 0.5;
                targetY = eRect.top - overlayRect.top + eRect.height * 0.5;
            }

            if (sprites.player) sprites.player.style.display = 'none';

            const ballSpriteUrl = itemData.sprite_url || '';
            this._captureInProgress = true;
            setSkipEnemyRender(true);
            const result = await this.battleAnimations.playCaptureThrow(ballSpriteUrl, startX, startY, targetX, targetY);

            if (caught) {
                await this.battleAnimations.playShake(result.ball, result.hitX, result.hitY, 3);
                await this.battleAnimations.playCaptureSuccess(result.ball, result.hitX, result.hitY, enemyPokemon.name);
            } else {
                await this.battleAnimations.playShake(result.ball, result.hitX, result.hitY, 1);
                await new Promise(r => setTimeout(r, 600));
                await this.battleAnimations.playCaptureFail(result.ball, result.hitX, result.hitY, targetX, targetY, sprites.enemy);
            }
            this._captureInProgress = false;
            setSkipEnemyRender(false);
        }

        if (caught) {
            await showBattleMessage(`Capturou ${enemyPokemon.name} com ${itemData.name}!`);
            const added = await window.GameData.addPokemonToTeam(enemyPokemon);
            if (added === 'team') {
                this.playerTeam.push(enemyPokemon);
                await showBattleMessage(`${enemyPokemon.name} foi adicionado à equipe!`);
            } else if (added === 'pc') {
                await showBattleMessage(`Equipe cheia! ${enemyPokemon.name} foi enviado ao PC.`);
            } else {
                await showBattleMessage('Equipe e PC lotados! Pokémon perdido.');
            }
            return true;
        } else {
            await showBattleMessage(`O Pokémon escapou da ${itemData.name}!`);
            return false;
        }
    }

    async endBattle(result) {
        if (this.state !== 'battle') return;

        if (result) {
            const duration = Math.floor((Date.now() - this.battleStartTime) / 1000);
            const enemy = this.enemyTeam[0];
            await window.GameData.recordBattle({
                opponentName: enemy.name,
                opponentTeam: [{ species: enemy.species, level: enemy.level }],
                result: result,
                xpGained: result === 'win' ? enemy.level * 10 : 0,
                duration: duration
            });
        }

        if (result === 'win' && this.playerTeam && this.enemyTeam.length > 0) {
            const enemyLevel = this.enemyTeam[0].level;
            const activePokemon = getFirstAlive(this.playerTeam);

            for (const p of this.playerTeam) {
                if (p.fainted) continue;
                const prevLevel = p.level;
                const levelMsgs = awardExp([p], enemyLevel, p === activePokemon ? p : null);
                for (const msg of levelMsgs) {
                    await showBattleMessage(msg);
                }
                if (p.level > prevLevel) {
                    const learnableMoves = await learnLevelUpMoves(p, prevLevel, p.level);
                    for (const newMove of learnableMoves) {
                        await showBattleMessage(`${p.name} quer aprender ${newMove.name}!`);
                        const result = await showMoveLearnPopup(p, newMove, p.moves);
                        if (result.teach) {
                            if (result.replaceIndex >= 0) {
                                const oldName = p.moves[result.replaceIndex].name;
                                p.moves[result.replaceIndex] = {
                                    ...newMove,
                                    id: newMove.id,
                                    currentPp: newMove.pp || 35
                                };
                                await showBattleMessage(`${p.name} esqueceu ${oldName} e aprendeu ${newMove.name}!`);
                            } else {
                                p.moves.push({
                                    ...newMove,
                                    id: newMove.id,
                                    currentPp: newMove.pp || 35
                                });
                                await showBattleMessage(`${p.name} aprendeu ${newMove.name}!`);
                            }
                        } else {
                            await showBattleMessage(`${p.name} não aprendeu ${newMove.name}.`);
                        }
                    }
                    const abilityName = await checkAbilityChange(p);
                    if (abilityName) {
                        await showBattleMessage(`${p.name} agora tem a habilidade ${abilityName}!`);
                    }
                }
            }
            await this.checkEvolutions();
            if (this.enemyTeam.length > 0) {
                await this.awardTrainerExp(1);
            }
        }

        if (result === 'lose' && this.playerTeam) {
            this.playerTeam.forEach(p => {
                if (p.fainted) {
                    p.currentHp = 0;
                }
            });
        }

        await this.saveTeam();

        this.state = 'overworld';
        this._lastBattlePlayer = null;
        this._lastBattleEnemy = null;
        showScreen('hud');
        hideBattlePokemonSprites();
        if (this.battleAnimations) this.battleAnimations.cleanupEntrance();
        stopBattleVideo();
        this.enemyTeam = [];
        this.updatePartyPanel();
        if (this.overworld2d) this.overworld2d.show();

        if (result === 'lose') {
            await this.teleportToPokemonCenter();
        } else {
            document.getElementById('location-name').textContent = 'Área Selvagem';
        }
    }

    async teleportToPokemonCenter() {
        if (!this.currentRegion) return;
        const maps = await this.regionManager.loadRegionMaps(this.currentRegion.id);
        const center = maps.find(m => m.name === 'Centro Pokemon');
        if (!center) {
            console.warn('[PokeFury] Centro Pokemon not found for region:', this.currentRegion.name);
            document.getElementById('location-name').textContent = 'Área Selvagem';
            return;
        }

        this.currentMap = center;
        this.regionManager.initPlayerProgress(this.currentCharacterId, this.currentRegion.id, center.id, this.userId);
        if (this.overworld2d) {
            this.overworld2d.setCurrentMap(center);
            this.overworld2d.show();
        }
        this.updatePartyPanel();
        document.getElementById('location-name').textContent = 'Centro Pokemon';
        this.showTransitionBanner('Você foi enviado ao Centro Pokemon...');
    }

    async checkEvolutions() {
        if (!this.playerTeam) return;

        for (const pokemon of this.playerTeam) {
            if (pokemon.fainted) continue;

            const { data: evolutions } = await window.db
                .from('pokemon_evolutions')
                .select('*')
                .eq('from_pokemon_id', pokemon.id);

            if (!evolutions || evolutions.length === 0) continue;

            for (const evo of evolutions) {
                let canEvolve = false;

                if (evo.evolution_method === 'level' && pokemon.level >= evo.min_level) {
                    canEvolve = true;
                }

                if (canEvolve) {
                    const newPokemonData = await PokeAPI.ensurePokemon(evo.to_pokemon_id);
                    if (!newPokemonData) continue;

                    const oldLevel = pokemon.level;
                    const oldExp = pokemon.experience || 0;
                    const oldMoves = pokemon.moves;
                    const oldIvs = pokemon.ivs;
                    const oldEvs = pokemon.evs;
                    const oldNature = pokemon.nature;
                    const oldShiny = pokemon.isShiny;

                    Object.assign(pokemon, await createPokemon(newPokemonData, oldLevel, oldIvs, oldEvs, oldNature, oldShiny));
                    pokemon.experience = oldExp;
                    pokemon.currentHp = pokemon.stats.hp;

                    await showBattleMessage(`${pokemon.name} evoluiu para ${newPokemonData.name}!`);
                    break;
                }
            }
        }
    }

    positionBattleScreen() {
        const battleEl = document.getElementById('battle-screen');
        if (battleEl && this.overworld2d) {
            battleEl.style.left = this.overworld2d.mapOffsetX + 'px';
            battleEl.style.top = this.overworld2d.mapOffsetY + 'px';
            battleEl.style.width = (this.overworld2d.worldCols * this.overworld2d.tileW) + 'px';
            battleEl.style.height = (this.overworld2d.worldRows * this.overworld2d.tileH) + 'px';
        }
    }

    getBattleClipRect() {
        if (!this.overworld2d) return null;
        return {
            x: this.overworld2d.mapOffsetX,
            y: this.overworld2d.mapOffsetY,
            w: this.overworld2d.worldCols * this.overworld2d.tileW,
            h: this.overworld2d.worldRows * this.overworld2d.tileH
        };
    }

    applyBattleNeonFromBg(bgUrl) {
        const battleEl = document.getElementById('battle-screen');
        if (!battleEl || !bgUrl) return;
        const isVideo = /\.(mp4|webm|ogg)$/i.test(bgUrl);
        if (isVideo) return;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const c = document.createElement('canvas');
            const sw = Math.min(img.naturalWidth, 200);
            const sh = Math.min(img.naturalHeight, 150);
            c.width = sw; c.height = sh;
            const cx = c.getContext('2d');
            cx.drawImage(img, 0, 0, sw, sh);
            const data = cx.getImageData(0, 0, sw, sh).data;
            let rSum = 0, gSum = 0, bSum = 0, count = 0;
            const samples = [
                [0, 0], [sw-1, 0], [0, sh-1], [sw-1, sh-1],
                [Math.floor(sw/2), 0], [0, Math.floor(sh/2)],
                [sw-1, Math.floor(sh/2)], [Math.floor(sw/2), sh-1]
            ];
            for (const [sx, sy] of samples) {
                const idx = (sy * sw + sx) * 4;
                const r = data[idx], g = data[idx+1], b = data[idx+2];
                const avg = (r + g + b) / 3;
                if (avg > 30 && avg < 240) {
                    rSum += r; gSum += g; bSum += b; count++;
                }
            }
            if (count === 0) return;
            const r = Math.round(rSum / count);
            const g = Math.round(gSum / count);
            const b = Math.round(bSum / count);
            const main = `rgb(${r},${g},${b})`;
            const dim = `rgba(${r},${g},${b},0.35)`;
            const bright = `rgb(${Math.min(255,r+60)},${Math.min(255,g+60)},${Math.min(255,b+60)})`;
            battleEl.style.setProperty('--battle-neon', main);
            battleEl.style.setProperty('--battle-neon-dim', dim);
            battleEl.style.setProperty('--battle-neon-bright', bright);
        };
        img.src = bgUrl;
    }

    getNormalizedBattleBg() {
        if (this.currentMap && this.currentMap.battle_bg_url) {
            console.log('[PokeFury] Battle BG URL:', this.currentMap.battle_bg_url);
            return this.currentMap.battle_bg_url;
        }
        console.log('[PokeFury] No battle BG configured for map:', this.currentMap?.name);
        return null;
    }

    async saveTeam() {
        await window.GameData.saveTeam(this.playerTeam);
    }

    updatePartyPanel() {
        const list = document.getElementById('party-list');
        if (!list) return;
        list.innerHTML = '';

        for (let i = 0; i < 6; i++) {
            const p = this.playerTeam[i];
            const slot = document.createElement('div');
            slot.style.cssText = 'display:flex;align-items:flex-start;gap:6px;padding:4px;margin-bottom:3px;border-radius:6px;background:rgba(255,255,255,0.05);transition:opacity 0.15s,transform 0.15s,background 0.15s;';
            if (p && p.fainted) slot.style.opacity = '0.45';

            if (p) {
                slot.draggable = true;
                slot.dataset.index = i;
                slot.style.cursor = 'grab';

                slot.ondragstart = (e) => {
                    e.dataTransfer.setData('text/plain', i);
                    e.dataTransfer.effectAllowed = 'move';
                    slot.style.opacity = '0.4';
                    slot.style.transform = 'scale(0.95)';
                };
                slot.ondragend = () => {
                    slot.style.opacity = p && p.fainted ? '0.45' : '1';
                    slot.style.transform = '';
                    list.querySelectorAll('[data-drop]').forEach(s => {
                        s.style.borderTop = '';
                        s.style.borderBottom = '';
                    });
                };
                slot.ondragover = (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    const rect = slot.getBoundingClientRect();
                    const mid = rect.top + rect.height / 2;
                    slot.style.borderTop = e.clientY < mid ? '2px solid #e94560' : '';
                    slot.style.borderBottom = e.clientY >= mid ? '2px solid #e94560' : '';
                };
                slot.ondragleave = () => {
                    slot.style.borderTop = '';
                    slot.style.borderBottom = '';
                };
                slot.ondrop = (e) => {
                    e.preventDefault();
                    slot.style.borderTop = '';
                    slot.style.borderBottom = '';
                    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                    const toIndex = i;
                    if (fromIndex === toIndex) return;
                    const rect = slot.getBoundingClientRect();
                    const mid = rect.top + rect.height / 2;
                    const insertBefore = e.clientY < mid;
                    const actualTo = insertBefore ? toIndex : toIndex;
                    this.reorderTeam(fromIndex, actualTo, insertBefore);
                };

                const spriteUrl = p.spriteUrls?.front || p.spriteUrls?.home || p.spriteUrls?.official || '';
                const hpPct = p.stats.hp > 0 ? (p.currentHp / p.stats.hp) * 100 : 0;
                const hpColor = hpPct <= 25 ? '#f44336' : hpPct <= 50 ? '#ff9800' : '#4caf50';
                const expNeeded = expForLevel(p.level + 1);
                const expPct = p.level >= 100 ? 100 : Math.max(0, Math.min(100, ((p.experience || 0) / expNeeded) * 100));

                slot.innerHTML = `
                    <div onclick="event.stopPropagation();window.pokefury.openPokemonInfo(${i})" style="position:relative;width:44px;height:44px;flex-shrink:0;border-radius:6px;overflow:hidden;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.15);cursor:pointer" title="Ver detalhes">
                        <img src="assets/pokeballsil.png" style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:22px;height:22px;opacity:0.3" alt="">
                        <img src="${spriteUrl}" style="position:absolute;top:2px;left:50%;transform:translateX(-50%);width:38px;height:38px;object-fit:contain" alt="${p.name}" onerror="this.style.display='none'">
                    </div>
                    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
                        <div style="font-family:Inter,sans-serif;font-size:11px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name} <span style="opacity:0.4">Lv${p.level}</span></div>
                        <div style="width:100%;height:8px;background:rgba(0,0,0,0.6);border-radius:4px;overflow:hidden"><div style="height:100%;border-radius:4px;width:${hpPct}%;background:${hpColor}"></div></div>
                        <div style="font-family:Inter,sans-serif;font-size:9px;color:rgba(255,255,255,0.7);line-height:1">HP ${p.currentHp}/${p.stats.hp}</div>
                        <div style="width:100%;height:8px;background:rgba(0,0,0,0.6);border-radius:4px;overflow:hidden"><div style="height:100%;border-radius:4px;width:${expPct}%;background:linear-gradient(90deg,#2196f3,#03a9f4)"></div></div>
                        <div style="font-family:Inter,sans-serif;font-size:9px;color:rgba(255,255,255,0.7);line-height:1">EXP ${p.level >= 100 ? 'MAX' : Math.floor(p.experience || 0) + '/' + expNeeded}</div>
                    </div>
                `;
            } else {
                slot.innerHTML = `
                    <div style="position:relative;width:44px;height:44px;flex-shrink:0;border-radius:6px;overflow:hidden;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.15)">
                        <img src="assets/pokeballsil.png" style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:22px;height:22px;opacity:0.3" alt="">
                    </div>
                    <div style="flex:1;min-width:0">
                        <div style="font-family:Inter,sans-serif;font-size:11px;font-weight:700;color:rgba(255,255,255,0.3)">Vazio</div>
                    </div>
                `;
            }

            list.appendChild(slot);
        }

        let healBtn = document.getElementById('heal-pokemon-btn');
        const isPokemonCenter = this.currentMap && this.currentMap.name === 'Centro Pokemon';
        if (isPokemonCenter) {
            if (!healBtn) {
                healBtn = document.createElement('button');
                healBtn.id = 'heal-pokemon-btn';
                healBtn.style.cssText = 'width:100%;margin-top:8px;padding:10px;background:linear-gradient(135deg,#e94560,#c23152);border:none;border-radius:8px;color:#fff;cursor:pointer;font-family:Inter,sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;transition:transform 0.15s,box-shadow 0.15s;box-shadow:0 2px 8px rgba(233,69,96,0.3)';
                healBtn.onmouseenter = () => { healBtn.style.transform = 'scale(1.03)'; healBtn.style.boxShadow = '0 4px 12px rgba(233,69,96,0.5)'; };
                healBtn.onmouseleave = () => { healBtn.style.transform = 'scale(1)'; healBtn.style.boxShadow = '0 2px 8px rgba(233,69,96,0.3)'; };
                healBtn.onclick = () => this.healAllPokemon();
                list.parentElement.appendChild(healBtn);
            }
            healBtn.textContent = this.playerTeam.every(p => !p.fainted && p.currentHp === p.stats.hp) ? 'Time Curado!' : 'Curar Pokemons';
            healBtn.disabled = this.playerTeam.every(p => !p.fainted && p.currentHp === p.stats.hp);
            healBtn.style.opacity = healBtn.disabled ? '0.5' : '1';
            healBtn.style.cursor = healBtn.disabled ? 'default' : 'pointer';
        } else if (healBtn) {
            healBtn.remove();
        }
    }

    async healAllPokemon() {
        if (!this.playerTeam) return;
        let healed = 0;
        for (const p of this.playerTeam) {
            const wasHurt = p.currentHp < p.stats.hp || p.fainted || p.statusEffect;
            if (wasHurt) {
                p.currentHp = p.stats.hp;
                p.fainted = false;
                p.statusEffect = null;
                p.moves.forEach(m => { m.currentPp = m.pp || 35; });
                healed++;
            }
        }
        if (healed > 0) {
            await this.saveTeam();
            this.updatePartyPanel();
            this.showTransitionBanner('Seus Pokemon foram curados!');
        }
    }

    reorderTeam(fromIndex, toIndex, insertBefore) {
        const pokemon = this.playerTeam[fromIndex];
        if (!pokemon) return;
        this.playerTeam.splice(fromIndex, 1);
        let newIndex = toIndex;
        if (fromIndex < toIndex) newIndex = insertBefore ? toIndex : toIndex;
        else newIndex = insertBefore ? toIndex : toIndex;
        if (fromIndex < toIndex) {
            newIndex = insertBefore ? toIndex - 1 : toIndex;
        } else {
            newIndex = insertBefore ? toIndex : toIndex + 1;
        }
        this.playerTeam.splice(newIndex, 0, pokemon);
        this.saveTeam();
        this.updatePartyPanel();
    }

    openPC() {
        this._pcBox = 1;
        this._pcOpen = true;
        document.getElementById('pc-overlay').classList.remove('hidden');
        if (this.overworld2d) this.overworld2d.hide();
        this.renderPCBox();
    }

    closePC() {
        this._pcOpen = false;
        document.getElementById('pc-overlay').classList.add('hidden');
        if (this.overworld2d) this.overworld2d.show();
    }

    async openMochila() {
        this.mochilaCategory = 'pocoes';
        document.querySelectorAll('.mochila-tab').forEach(t => t.classList.remove('active'));
        const defaultTab = document.querySelector('.mochila-tab[data-category="pocoes"]');
        if (defaultTab) defaultTab.classList.add('active');
        const searchInput = document.getElementById('mochila-search-input');
        if (searchInput) searchInput.value = '';
        document.getElementById('mochila-overlay').classList.remove('hidden');
        if (this.overworld2d) this.overworld2d.hide();
        await this.renderMochila();
    }

    closeMochila() {
        document.getElementById('mochila-overlay').classList.add('hidden');
        if (this.overworld2d) this.overworld2d.show();
    }

    async renderMochila() {
        const grid = document.getElementById('mochila-grid');
        const empty = document.getElementById('mochila-empty');
        const countEl = document.getElementById('mochila-count');
        if (!grid) return;

        const inventory = await window.GameData.getInventory();
        const search = (document.getElementById('mochila-search-input')?.value || '').toLowerCase().trim();

        const CATEGORY_MAP = {
            pocoes: ['medicine', 'battle_item'],
            pokebolas: ['pokeball'],
            itens: ['field', 'evolution_stone', 'held', 'mega_stone', 'held_item'],
            tm_hm: ['tm_hm']
        };

        const allowedCats = CATEGORY_MAP[this.mochilaCategory] || [];

        let filtered = inventory.filter(inv => {
            if (inv.quantity <= 0 || !inv.items) return false;
            const cat = inv.items.category || '';
            if (!allowedCats.includes(cat)) return false;
            if (search && !(inv.items.name || '').toLowerCase().includes(search)) return false;
            return true;
        });

        grid.innerHTML = '';
        if (filtered.length === 0) {
            grid.style.display = 'none';
            empty.style.display = 'block';
        } else {
            grid.style.display = 'grid';
            empty.style.display = 'none';
        }

        countEl.textContent = `${filtered.length} item${filtered.length !== 1 ? 's' : ''}`;

        let tooltipEl = null;

        for (const inv of filtered) {
            const item = inv.items;
            const slot = document.createElement('div');
            slot.className = 'mochila-slot';

            const spriteSrc = item.sprite_url || '';
            const img = document.createElement('img');
            img.src = spriteSrc;
            img.alt = item.name || '';
            img.onerror = function() { this.style.display = 'none'; };
            slot.appendChild(img);

            const nameEl = document.createElement('div');
            nameEl.className = 'slot-name';
            nameEl.textContent = item.name || `#${item.id}`;
            slot.appendChild(nameEl);

            if (inv.quantity > 1) {
                const qtyEl = document.createElement('div');
                qtyEl.className = 'slot-qty';
                qtyEl.textContent = `x${inv.quantity}`;
                slot.appendChild(qtyEl);
            }

            slot.addEventListener('mouseenter', (e) => {
                if (tooltipEl) tooltipEl.remove();
                tooltipEl = document.createElement('div');
                tooltipEl.className = 'mochila-tooltip';
                const catLabel = { medicine: 'Poção', pokeball: 'Pokébola', battle_item: 'Item de Batalha', field: 'Campo', evolution_stone: 'Pedra Evolutiva', held: 'Item Retido', mega_stone: 'Mega Pedra', tm_hm: 'TM/HM' };
                tooltipEl.innerHTML = `
                    <div class="tt-name">${item.name || `Item #${item.id}`}</div>
                    <div class="tt-cat">${catLabel[item.category] || item.category || 'Desconhecido'}</div>
                    <div class="tt-desc">${item.desc || item.description || ''}</div>
                    <div class="tt-qty">Quantidade: ${inv.quantity}</div>
                `;
                document.body.appendChild(tooltipEl);
                const rect = slot.getBoundingClientRect();
                let left = rect.right + 8;
                let top = rect.top;
                if (left + 220 > window.innerWidth) left = rect.left - 228;
                if (top + 140 > window.innerHeight) top = window.innerHeight - 148;
                tooltipEl.style.left = left + 'px';
                tooltipEl.style.top = top + 'px';
            });
            slot.addEventListener('mouseleave', () => {
                if (tooltipEl) { tooltipEl.remove(); tooltipEl = null; }
            });

            grid.appendChild(slot);
        }
    }

    navigatePC(dir) {
        this._pcBox = Math.max(1, Math.min(20, this._pcBox + dir));
        this.renderPCBox();
    }

    async renderPCBox() {
        const boxNum = this._pcBox;
        document.getElementById('pc-box-name').textContent = `Box ${boxNum}`;
        const slotsContainer = document.getElementById('pc-slots');
        slotsContainer.innerHTML = '';

        const boxPokemon = await window.GameData.getBoxPokemon(boxNum);
        const countEl = document.getElementById('pc-header').querySelector('div:last-child');
        if (countEl) countEl.textContent = `${boxPokemon.length}/30 Pokemon`;

        const boxMap = {};
        boxPokemon.forEach(p => { boxMap[p.slot_index] = p; });

        for (let i = 0; i < 30; i++) {
            const slot = document.createElement('div');
            slot.style.cssText = 'border-radius:3px;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background 0.15s,transform 0.15s;position:relative;min-height:0;overflow:hidden;';
            slot.dataset.slot = i;

            const p = boxMap[i];
            if (p) {
                const pokeData = await PokeAPI.ensurePokemon(p.pokemon_id || p.species);
                const spriteUrl = pokeData?.spriteUrls?.front || pokeData?.spriteUrls?.home || '';
                slot.innerHTML = `<img src="${spriteUrl}" style="width:80%;height:80%;object-fit:contain;" alt="${p.nickname || p.species}" onerror="this.style.display='none'">`;
                slot.title = `${p.nickname || p.species} Lv.${p.level}`;
                slot.style.borderColor = p.is_shiny ? '#ffd700' : 'rgba(255,255,255,0.2)';

                slot.onclick = () => this.withdrawFromPC(p);

                slot.ondragover = (e) => { e.preventDefault(); slot.style.background = 'rgba(233,69,96,0.3)'; };
                slot.ondragleave = () => { slot.style.background = 'rgba(0,0,0,0.4)'; };
                slot.ondrop = (e) => {
                    e.preventDefault();
                    slot.style.background = 'rgba(0,0,0,0.4)';
                    const partyIndex = parseInt(e.dataTransfer.getData('text/party-index'));
                    if (!isNaN(partyIndex)) {
                        this.storeToPC(partyIndex, boxNum, i);
                    }
                };
            } else {
                slot.innerHTML = '<div style="width:60%;height:60%;border:1px dashed rgba(255,255,255,0.15);border-radius:4px;"></div>';
                slot.ondragover = (e) => { e.preventDefault(); slot.style.background = 'rgba(76,175,80,0.2)'; };
                slot.ondragleave = () => { slot.style.background = 'rgba(0,0,0,0.4)'; };
                slot.ondrop = (e) => {
                    e.preventDefault();
                    slot.style.background = 'rgba(0,0,0,0.4)';
                    const partyIndex = parseInt(e.dataTransfer.getData('text/party-index'));
                    if (!isNaN(partyIndex)) {
                        this.storeToPC(partyIndex, boxNum, i);
                    }
                };
            }

            slot.onmouseenter = () => { slot.style.transform = 'scale(1.05)'; };
            slot.onmouseleave = () => { slot.style.transform = ''; };
            slotsContainer.appendChild(slot);
        }

        this.renderPCPartyBar();
    }

    async renderPCPartyBar() {
        const bar = document.getElementById('pc-party-bar');
        bar.innerHTML = '';
        for (let i = 0; i < 6; i++) {
            const p = this.playerTeam[i];
            if (!p) continue;
            const slot = document.createElement('div');
            slot.draggable = true;
            slot.dataset.partyIndex = i;
            slot.style.cssText = 'width:48px;height:48px;border-radius:6px;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;cursor:grab;transition:transform 0.15s,opacity 0.15s;position:relative;';
            if (p.fainted) slot.style.opacity = '0.4';

            const spriteUrl = p.spriteUrls?.front || p.spriteUrls?.home || p.spriteUrls?.official || '';
            slot.innerHTML = `<img src="${spriteUrl}" style="width:80%;height:80%;object-fit:contain;" alt="${p.name}" onerror="this.style.display='none'">`;
            slot.title = `${p.name} Lv.${p.level} - Arraste para a box`;

            slot.ondragstart = (e) => {
                e.dataTransfer.setData('text/party-index', i);
                e.dataTransfer.effectAllowed = 'move';
                slot.style.opacity = '0.4';
            };
            slot.ondragend = () => { slot.style.opacity = p.fainted ? '0.4' : '1'; };
            slot.onmouseenter = () => { slot.style.transform = 'scale(1.1)'; };
            slot.onmouseleave = () => { slot.style.transform = ''; };
            bar.appendChild(slot);
        }
    }

    async storeToPC(partyIndex, boxNumber, slotIndex) {
        const pokemon = this.playerTeam[partyIndex];
        if (!pokemon) return;
        const success = await window.GameData.storePokemon(pokemon, boxNumber, slotIndex);
        if (success) {
            this.playerTeam.splice(partyIndex, 1);
            await this.saveTeam();
            this.updatePartyPanel();
            this.renderPCBox();
        }
    }

    async withdrawFromPC(boxData) {
        if (this.playerTeam.length >= 6) {
            this.showTransitionBanner('Time cheio! Máximo 6 Pokemon.');
            return;
        }
        const pokemonData = await PokeAPI.ensurePokemon(boxData.pokemon_id || boxData.species);
        if (!pokemonData) return;
        const pokemon = await createPokemon(pokemonData, boxData.level, {
            hp: boxData.iv_hp, attack: boxData.iv_attack, defense: boxData.iv_defense,
            spAtk: boxData.iv_sp_atk, spDef: boxData.iv_sp_def, speed: boxData.iv_speed
        }, {
            hp: boxData.ev_hp, attack: boxData.ev_attack, defense: boxData.ev_defense,
            spAtk: boxData.ev_sp_atk, spDef: boxData.ev_sp_def, speed: boxData.ev_speed
        }, boxData.nature, boxData.is_shiny);

        pokemon.currentHp = boxData.current_hp;
        pokemon.fainted = pokemon.currentHp <= 0;
        pokemon.experience = boxData.experience;
        pokemon.statusEffect = boxData.status_effect || null;
        if (boxData.moves && Array.isArray(boxData.moves) && boxData.moves.length > 0) {
            const savedMoveIds = boxData.moves.map(m => Number(m.id)).filter(Boolean);
            if (savedMoveIds.length > 0) {
                const { data: moveDetails } = await window.db
                    .from('moves')
                    .select('id, name, type, category, power, accuracy, pp')
                    .in('id', savedMoveIds);
                if (moveDetails && moveDetails.length > 0) {
                    const moveMap = {};
                    moveDetails.forEach(m => { moveMap[m.id] = m; });
                    const savedMoves = boxData.moves.map(sm => {
                        const full = moveMap[Number(sm.id)];
                        if (!full) return null;
                        return {
                            id: full.id, name: full.name, type: full.type,
                            category: full.category || 'physical', power: full.power || 0,
                            accuracy: full.accuracy || 100, pp: full.pp || 35,
                            currentPp: sm.pp ?? full.pp ?? 35
                        };
                    }).filter(Boolean);
                    for (const newMove of pokemon.moves) {
                        if (!savedMoves.some(m => m.id === newMove.id)) {
                            savedMoves.push(newMove);
                        }
                    }
                    pokemon.moves = savedMoves.slice(0, 4);
                }
            }
        }

        await window.GameData.deleteBoxPokemon(boxData.id);
        this.playerTeam.push(pokemon);
        await this.saveTeam();
        this.updatePartyPanel();
        this.renderPCBox();
    }

    switchCharacter() {
        this.currentCharacterId = null;
        window.GameData.setCurrentCharacter(null);
        document.getElementById('game-wrapper').classList.add('hidden');
        document.getElementById('character-screen').classList.remove('hidden');
        if (this.overworld2d) this.overworld2d.hide();
        this.state = 'idle';
        loadCharacterScreen();
    }

    setupAdminButtons() {
        const regionsBtn = document.getElementById('admin-btn-regions');
        if (regionsBtn) {
            regionsBtn.onclick = () => this.openRegionManager();
        }

        const mapsBtn = document.getElementById('admin-btn-maps');
        if (mapsBtn) {
            mapsBtn.onclick = () => {
                const overlay = document.getElementById('map-editor-overlay');
                overlay.classList.remove('hidden');
                if (!this.mapEditor) {
                    this.mapEditor = new MapEditor();
                    this.setupMapEditorEvents();
                }
                this.mapEditor.resize(
                    overlay.querySelector('.editor-canvas-wrap').clientWidth,
                    overlay.querySelector('.editor-canvas-wrap').clientHeight
                );
                this.loadSavedMapsList();
            };
        }

        const donateBtn = document.getElementById('admin-btn-donate');
        if (donateBtn) {
            donateBtn.onclick = () => this.openDonateScreen();
        }
    }

    openDonateScreen() {
        const screen = document.getElementById('donate-screen');
        screen.classList.remove('hidden');

        document.getElementById('donate-close').onclick = () => screen.classList.add('hidden');

        this._donateSelectedChar = null;
        this._donateSelectedPokemon = null;
        this._donateSelectedPokemonData = null;
        document.getElementById('donate-search').value = '';
        document.getElementById('donate-char-info').classList.add('hidden');
        document.getElementById('donate-result').classList.add('hidden');

        this.setupDonateSearch();
        this.setupDonateItemSearch();
        this.setupDonatePokemonSearch();
        this.setupDonatePokemonForm();
    }

    setupDonateSearch() {
        const input = document.getElementById('donate-search');
        const results = document.getElementById('donate-search-results');
        let debounce = null;

        input.oninput = () => {
            clearTimeout(debounce);
            const q = input.value.trim();
            if (q.length < 2) { results.style.display = 'none'; return; }

            debounce = setTimeout(async () => {
                const { data } = await window.db.from('game_saves').select('id, player_name, starter_pokemon, user_id').ilike('player_name', `%${q}%`).limit(10);
                if (!data || data.length === 0) { results.style.display = 'none'; return; }

                results.innerHTML = '';
                results.style.display = 'block';
                for (const char of data) {
                    const div = document.createElement('div');
                    div.style.cssText = 'padding:8px 12px;cursor:pointer;color:#fff;font-size:13px;font-family:Inter,sans-serif;border-bottom:1px solid rgba(255,255,255,0.05)';
                    div.textContent = char.player_name;
                    div.onmouseenter = () => div.style.background = 'rgba(255,255,255,0.08)';
                    div.onmouseleave = () => div.style.background = 'transparent';
                    div.onclick = () => this.selectDonateChar(char);
                    results.appendChild(div);
                }
            }, 300);
        };

        input.onblur = () => setTimeout(() => results.style.display = 'none', 200);
    }

    async selectDonateChar(char) {
        this._donateSelectedChar = char;
        document.getElementById('donate-search').value = char.player_name;
        document.getElementById('donate-search-results').style.display = 'none';
        document.getElementById('donate-char-info').classList.remove('hidden');

        document.getElementById('donate-char-name').textContent = char.player_name;

        const { data: team } = await window.db.from('pokemon_team').select('*').eq('character_id', char.id).order('slot');
        const teamContainer = document.getElementById('donate-char-team');
        teamContainer.innerHTML = '';

        if (team && team.length > 0) {
            const maxLevel = Math.max(...team.map(t => t.level));
            document.getElementById('donate-char-level').textContent = `Nv. ${maxLevel} | ${team.length} pokemon`;

            for (const p of team) {
                const pokeData = await PokeAPI.ensurePokemon(p.pokemon_id || p.species);
                const spriteUrl = pokeData ? (pokeData.spriteUrls.front || pokeData.spriteUrls.home || '') : '';
                const hpPct = p.max_hp > 0 ? ((p.current_hp / p.max_hp) * 100) : 0;
                const expForNext = Math.floor(Math.pow(p.level + 1, 3) * 0.8);
                const expPct = p.level >= 100 ? 100 : Math.max(0, Math.min(100, ((p.experience || 0) / expForNext) * 100));

                const card = document.createElement('div');
                card.style.cssText = 'background:#0d1117;border-radius:8px;padding:8px;width:140px;border:1px solid rgba(255,255,255,0.08)';
                card.innerHTML = `
                    <div style="text-align:center;margin-bottom:4px"><img src="${spriteUrl}" style="width:48px;height:48px;image-rendering:pixelated" onerror="this.style.display='none'"></div>
                    <div style="color:#fff;font-size:11px;font-weight:600;text-align:center;font-family:Inter,sans-serif">${p.nickname || p.species} Lv${p.level}</div>
                    <div style="width:100%;height:5px;background:rgba(0,0,0,0.5);border-radius:3px;margin-top:4px;overflow:hidden"><div style="height:100%;width:${hpPct}%;background:${hpPct<=25?'#f44336':hpPct<=50?'#ff9800':'#4caf50'};border-radius:3px"></div></div>
                    <div style="color:rgba(255,255,255,0.4);font-size:8px;text-align:center;font-family:Inter,sans-serif">HP ${p.current_hp}/${p.max_hp}</div>
                    <div style="width:100%;height:4px;background:rgba(0,0,0,0.5);border-radius:2px;margin-top:2px;overflow:hidden"><div style="height:100%;width:${expPct}%;background:#2196f3;border-radius:2px"></div></div>
                    <div style="color:rgba(255,255,255,0.3);font-size:7px;text-align:center;font-family:Inter,sans-serif">EXP ${p.experience||0}/${expForNext}</div>
                `;
                teamContainer.appendChild(card);
            }
        } else {
            document.getElementById('donate-char-level').textContent = 'Sem pokemon';
        }
    }

    setupDonateItemSearch() {
        const input = document.getElementById('donate-item-name');
        const results = document.getElementById('donate-item-results');
        let debounce = null;

        input.oninput = () => {
            clearTimeout(debounce);
            const q = input.value.trim().toLowerCase();
            if (q.length < 1) { results.style.display = 'none'; return; }

            debounce = setTimeout(() => {
                const matches = ITEMS_DATA.filter(i => i.name.toLowerCase().includes(q)).slice(0, 10);
                if (matches.length === 0) { results.style.display = 'none'; return; }

                results.innerHTML = '';
                results.style.display = 'block';
                for (const item of matches) {
                    const div = document.createElement('div');
                    div.style.cssText = 'padding:6px 12px;cursor:pointer;color:#fff;font-size:12px;font-family:Inter,sans-serif;border-bottom:1px solid rgba(255,255,255,0.05)';
                    div.textContent = `${item.name} (ID: ${item.id})`;
                    div.onmouseenter = () => div.style.background = 'rgba(255,255,255,0.08)';
                    div.onmouseleave = () => div.style.background = 'transparent';
                    div.onclick = () => {
                        input.value = item.name;
                        input.dataset.itemId = item.id;
                        results.style.display = 'none';
                    };
                    results.appendChild(div);
                }
            }, 200);
        };

        input.onblur = () => setTimeout(() => results.style.display = 'none', 200);

        document.getElementById('donate-item-btn').onclick = async () => {
            if (!this._donateSelectedChar) return;
            const itemId = parseInt(input.dataset.itemId);
            const qty = parseInt(document.getElementById('donate-item-qty').value) || 1;
            if (!itemId) return;

            const { error } = await window.db.rpc('add_item', { p_item_id: itemId, p_qty: qty, p_character_id: this._donateSelectedChar.id, p_user_id: this._donateSelectedChar.user_id || this.userId });
            const result = document.getElementById('donate-result');
            result.classList.remove('hidden');
            if (error) {
                result.style.background = 'rgba(244,67,54,0.2)';
                result.style.color = '#f44336';
                result.textContent = `Erro: ${error.message}`;
            } else {
                result.style.background = 'rgba(76,175,80,0.2)';
                result.style.color = '#4caf50';
                result.textContent = `${qty}x ${input.value} doado para ${this._donateSelectedChar.player_name}!`;
                input.value = '';
                delete input.dataset.itemId;
            }
        };
    }

    setupDonatePokemonSearch() {
        const input = document.getElementById('donate-poke-name');
        const results = document.getElementById('donate-poke-results');
        const preview = document.getElementById('donate-poke-preview');
        let debounce = null;

        input.oninput = () => {
            clearTimeout(debounce);
            const q = input.value.trim().toLowerCase();
            if (q.length < 1) { results.style.display = 'none'; return; }

            debounce = setTimeout(async () => {
                const { data } = await window.db.from('pokemon').select('id, name').ilike('name', `%${q}%`).limit(10);
                if (!data || data.length === 0) { results.style.display = 'none'; return; }

                results.innerHTML = '';
                results.style.display = 'block';
                for (const poke of data) {
                    const div = document.createElement('div');
                    div.style.cssText = 'padding:6px 12px;cursor:pointer;color:#fff;font-size:12px;font-family:Inter,sans-serif;border-bottom:1px solid rgba(255,255,255,0.05)';
                    div.textContent = `${poke.name} (#${poke.id})`;
                    div.onmouseenter = () => div.style.background = 'rgba(255,255,255,0.08)';
                    div.onmouseleave = () => div.style.background = 'transparent';
                    div.onclick = async () => {
                        input.value = poke.name;
                        results.style.display = 'none';
                        this._donateSelectedPokemon = poke.id;

                        const pokemonData = await PokeAPI.ensurePokemon(poke.id);
                        this._donateSelectedPokemonData = pokemonData;

                        const spriteUrl = pokemonData?.spriteUrls?.front || pokemonData?.spriteUrls?.home || '';
                        preview.innerHTML = spriteUrl
                            ? `<img src="${spriteUrl}" style="width:72px;height:72px;image-rendering:pixelated" onerror="this.parentElement.innerHTML='Erro'">`
                            : '<span style="color:rgba(255,255,255,0.3)">Sem sprite</span>';

                        this.loadPokemonAbilities(pokemonData);
                        this.loadPokemonMoves(pokemonData);
                    };
                    results.appendChild(div);
                }
            }, 300);
        };

        input.onblur = () => setTimeout(() => results.style.display = 'none', 200);
    }

    async loadPokemonAbilities(pokemonData) {
        const select = document.getElementById('donate-poke-ability');
        select.innerHTML = '';

        if (!pokemonData?.id) {
            select.innerHTML = '<option value="">Selecione um pokemon</option>';
            return;
        }

        try {
            const { data, error } = await window.db
                .from('pokemon_abilities')
                .select('ability_id, is_hidden, slot, abilities(name)')
                .eq('pokemon_id', pokemonData.id)
                .order('slot');

            if (!error && data && data.length > 0) {
                for (const a of data) {
                    const opt = document.createElement('option');
                    opt.value = a.ability_id;
                    const hidden = a.is_hidden ? ' (Hidden)' : '';
                    opt.textContent = `${a.abilities?.name || `Ability ${a.ability_id}`}${hidden}`;
                    select.appendChild(opt);
                }
            } else {
                select.innerHTML = '<option value="">Sem habilidades no banco</option>';
            }
        } catch (e) {
            select.innerHTML = '<option value="">Erro ao carregar</option>';
        }
    }

    loadPokemonMoves(pokemonData) {
        const container = document.getElementById('donate-poke-moves');
        container.innerHTML = '';

        if (!pokemonData?.id) return;

        this._donateMoveOptions = [];
        this._donateSelectedMoves = [];

        this.addDonateMoveSlot();
    }

    async addDonateMoveSlot() {
        const container = document.getElementById('donate-poke-moves');
        if (container.children.length >= 4) return;

        const pokeId = this._donateSelectedPokemon;
        if (!pokeId) return;

        let moves = [];

        try {
            const { data, error } = await window.db
                .from('pokemon_moves_v2')
                .select('move_id, learn_method, level_learned')
                .eq('pokemon_id', pokeId)
                .order('level_learned');

            if (!error && data && data.length > 0) {
                const moveIds = [...new Set(data.map(r => r.move_id))];
                const { data: moveDetails } = await window.db
                    .from('moves')
                    .select('id, name, type, category, power')
                    .in('id', moveIds);
                const moveMap = {};
                if (moveDetails) moveDetails.forEach(m => { moveMap[m.id] = m; });

                moves = data.map(r => ({
                    id: r.move_id,
                    name: moveMap[r.move_id]?.name || `Move ${r.move_id}`,
                    type: moveMap[r.move_id]?.type || '?',
                    power: moveMap[r.move_id]?.power,
                    method: r.learn_method,
                    level: r.level_learned
                }));
            }
        } catch (e) {
            console.warn('[Donate] Error loading pokemon moves:', e);
        }

        if (moves.length === 0) {
            try {
                const { data } = await window.db.from('moves').select('id, name, type, category, power').limit(50);
                if (data) moves = data.map(m => ({ ...m, method: '?', level: 0 }));
            } catch (e) {}
        }

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;gap:6px;align-items:center';

        const select = document.createElement('select');
        select.style.cssText = 'flex:1;padding:6px 8px;background:#0d1117;border:1px solid rgba(255,255,255,0.12);border-radius:4px;color:#fff;font-size:12px;font-family:Inter,sans-serif;outline:none';

        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = 'Nenhum';
        select.appendChild(emptyOpt);

        for (const m of moves) {
            const opt = document.createElement('option');
            opt.value = m.id;
            const methodLabel = m.method === 'level-up' ? `Lv${m.level}` : m.method === 'machine' ? 'TM' : m.method === 'egg' ? 'Egg' : m.method === 'tutor' ? 'Tutor' : '';
            opt.textContent = `${m.name} (${m.type})${m.power ? ' ' + m.power + 'pw' : ''} [${methodLabel}]`;
            select.appendChild(opt);
        }

        const removeBtn = document.createElement('button');
        removeBtn.textContent = '✕';
        removeBtn.style.cssText = 'background:none;border:none;color:#f44336;font-size:14px;cursor:pointer;padding:4px';
        removeBtn.onclick = () => {
            wrapper.remove();
            this._donateSelectedMoves = this._donateSelectedMoves.filter(s => s !== select);
        };

        this._donateSelectedMoves.push(select);
        wrapper.appendChild(select);
        wrapper.appendChild(removeBtn);
        container.appendChild(wrapper);
    }

    setupDonatePokemonForm() {
        document.getElementById('donate-add-move').onclick = () => this.addDonateMoveSlot();

        document.getElementById('donate-poke-btn').onclick = async () => {
            if (!this._donateSelectedChar || !this._donateSelectedPokemon) return;

            const level = parseInt(document.getElementById('donate-poke-level').value) || 5;
            const ivs = {};
            document.querySelectorAll('.donate-iv').forEach(el => { ivs[el.dataset.stat] = parseInt(el.value) || 0; });
            const evs = {};
            document.querySelectorAll('.donate-ev').forEach(el => { evs[el.dataset.stat] = parseInt(el.value) || 0; });
            const nature = document.getElementById('donate-poke-nature').value;
            const abilityId = document.getElementById('donate-poke-ability').value;

            const moveIds = this._donateSelectedMoves.map(sel => parseInt(sel.value)).filter(Boolean);

            const pokemonData = await PokeAPI.ensurePokemon(this._donateSelectedPokemon);
            if (!pokemonData) return;

            const stats = calculateAllStats(pokemonData.baseStats, level, ivs, evs, nature);

            const { data: existingTeam } = await window.db.from('pokemon_team').select('slot').eq('character_id', this._donateSelectedChar.id).order('slot', { ascending: false }).limit(1);
            const teamCount = existingTeam && existingTeam.length > 0 ? existingTeam[0].slot : 0;
            const nextSlot = teamCount + 1;

            const insertData = {
                user_id: this._donateSelectedChar.user_id || this.userId,
                character_id: this._donateSelectedChar.id,
                species: pokemonData.species,
                nickname: pokemonData.name,
                level,
                current_hp: stats.hp,
                max_hp: stats.hp,
                experience: Math.floor(Math.pow(level, 3) * 0.8),
                moves: moveIds.map(id => ({ id: String(id), pp: 35 })),
                is_active: false,
                slot: nextSlot,
                pokemon_id: pokemonData.id,
                iv_hp: ivs.hp || 0, iv_attack: ivs.attack || 0, iv_defense: ivs.defense || 0,
                iv_sp_atk: ivs.spAtk || 0, iv_sp_def: ivs.spDef || 0, iv_speed: ivs.speed || 0,
                ev_hp: evs.hp || 0, ev_attack: evs.attack || 0, ev_defense: evs.defense || 0,
                ev_sp_atk: evs.spAtk || 0, ev_sp_def: evs.spDef || 0, ev_speed: evs.speed || 0,
                nature,
                happiness: 70,
                is_shiny: false,
                is_mega: false,
                held_item_id: null
            };

            let donateError;
            let donatedTo = 'equipe';
            if (teamCount >= 6) {
                const stored = await window.GameData.autoStoreRawPokemonToPC(insertData, this._donateSelectedChar.id);
                if (!stored) donateError = { message: 'PC lotado!' };
                donatedTo = 'PC Pokemon';
            } else {
                const { error } = await window.db.from('pokemon_team').insert(insertData);
                donateError = error;
            }

            const result = document.getElementById('donate-result');
            result.classList.remove('hidden');
            if (donateError) {
                result.style.background = 'rgba(244,67,54,0.2)';
                result.style.color = '#f44336';
                result.textContent = `Erro: ${donateError.message}`;
            } else {
                result.style.background = 'rgba(76,175,80,0.2)';
                result.style.color = '#4caf50';
                result.textContent = `${pokemonData.name} Lv${level} doado para ${this._donateSelectedChar.player_name} (${donatedTo})!`;
                this.selectDonateChar(this._donateSelectedChar);
            }
        };
    }

    async openPokedex() {
        const overlay = document.getElementById('pokedex-overlay');
        overlay.classList.remove('hidden');

        document.getElementById('pokedex-close').onclick = () => overlay.classList.add('hidden');

        this._pokedexLoaded = false;
        this._pokedexPokemon = [];
        this._pokedexSelected = null;
        const list = document.getElementById('pokedex-list');
        list.innerHTML = '<div style="padding:20px;color:rgba(255,255,255,0.4);text-align:center">Carregando Pokédex...</div>';

        try {
            const { data: baseData } = await window.db.from('pokemon').select('id, name, types, hp, attack, defense, sp_atk, sp_def, speed, sprite_official, sprite_home, variant, base_pokemon_id').lte('id', 1025).order('id').range(0, 9999);
            const { data: variantData } = await window.db.from('pokemon').select('id, name, types, hp, attack, defense, sp_atk, sp_def, speed, sprite_official, sprite_home, variant, base_pokemon_id').gt('id', 1025).order('id').range(0, 9999);
            const data = [...(baseData || []), ...(variantData || [])];
            console.log(`[Pokedex] Loaded ${data.length} pokemon (${baseData?.length || 0} base + ${variantData?.length || 0} variants)`);
            if (data.length > 0) {
                this._pokedexPokemon = data;
                this._pokedexFilter = 'all';
                this.renderPokedexTabs();
                this.renderPokedexList(this._pokedexPokemon);
            }
        } catch (e) {
            console.warn('[Pokedex] Error loading pokemon:', e);
            list.innerHTML = '<div style="padding:20px;color:#f44336;text-align:center">Erro ao carregar Pokédex</div>';
        }

        const searchInput = document.getElementById('pokedex-search');
        searchInput.value = '';
        searchInput.oninput = () => this.filterPokedex();

        window._pokedexDiag = async () => {
            const { data, error } = await window.db.from('pokemon').select('id, name, variant').order('id');
            if (error) { console.error('DIAG ERROR:', error); return; }
            const variants = (data || []).filter(p => p.variant && p.variant !== 'normal');
            console.log(`[DIAG] Total rows: ${data?.length}, Variants: ${variants.length}`);
            console.log('[DIAG] First 5 variants:', variants.slice(0, 5));
            const { data: v2 } = await window.db.from('pokemon').select('id, name, variant').eq('variant', 'mega').limit(5);
            console.log('[DIAG] Mega query result:', v2);
        };
        console.log('[Pokedex] Type _pokedexDiag() in console to run diagnostics');
    }

    renderPokedexTabs() {
        const tabs = document.getElementById('pokedex-tabs');
        tabs.innerHTML = `
            <button class="pokedex-tab active" data-filter="all">Todos</button>
            <button class="pokedex-tab" data-filter="normal">Normal</button>
            <button class="pokedex-tab" data-filter="mega">Mega</button>
            <button class="pokedex-tab" data-filter="gmax">G-Max</button>
            <button class="pokedex-tab" data-filter="alola">Alola</button>
            <button class="pokedex-tab" data-filter="galar">Galar</button>
            <button class="pokedex-tab" data-filter="hisui">Hisui</button>
            <button class="pokedex-tab" data-filter="paldea">Paldea</button>
            <button class="pokedex-tab" data-filter="form">Formas</button>
        `;
        tabs.querySelectorAll('.pokedex-tab').forEach(tab => {
            tab.onclick = () => {
                tabs.querySelectorAll('.pokedex-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this._pokedexFilter = tab.dataset.filter;
                this.filterPokedex();
            };
        });
    }

    filterPokedex() {
        const q = (document.getElementById('pokedex-search')?.value || '').toLowerCase().trim();
        let filtered = this._pokedexPokemon || [];
        console.log(`[Pokedex] Filter: ${this._pokedexFilter}, total: ${filtered.length}, variant matches: ${filtered.filter(p => p.variant === this._pokedexFilter).length}`);
        if (this._pokedexFilter && this._pokedexFilter !== 'all') {
            filtered = filtered.filter(p => p.variant === this._pokedexFilter);
        }
        if (q) {
            filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || String(p.id) === q);
        }
        this.renderPokedexList(filtered);
    }

    renderPokedexList(pokemonList) {
        const list = document.getElementById('pokedex-list');
        list.innerHTML = '';
        const variantColors = { mega: '#9c27b0', gmax: '#f44336', alola: '#2196f3', galar: '#ff9800', hisui: '#4caf50', paldea: '#00bcd4', form: '#e91e63' };
        const variantLabels = { mega: 'MEGA', gmax: 'G-MAX', alola: 'ALOLA', galar: 'GALAR', hisui: 'HISUI', paldea: 'PALDEA', form: 'FORMA' };
        pokemonList.forEach(p => {
            const item = document.createElement('div');
            item.className = 'pokedex-item' + (this._pokedexSelected === p.id ? ' active' : '');
            const num = String(p.id).padStart(3, '0');
            const sprite = `https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/home-front/${p.id}.png`;
            const badge = p.variant && p.variant !== 'normal' ? `<span style="font-size:8px;padding:1px 4px;border-radius:3px;background:${variantColors[p.variant] || '#666'};color:#fff;font-weight:700;margin-left:4px">${variantLabels[p.variant] || p.variant}</span>` : '';
            item.innerHTML = `
                <span class="pokedex-item-num">#${num}</span>
                <img class="pokedex-item-sprite" src="${sprite}" onerror="this.style.display='none'" loading="lazy">
                <span class="pokedex-item-name">${p.name}${badge}</span>
            `;
            item.onclick = () => this.selectPokedexPokemon(p.id);
            list.appendChild(item);
        });
    }

    async selectPokedexPokemon(pokemonId) {
        this._pokedexSelected = pokemonId;
        document.querySelectorAll('.pokedex-item').forEach(el => el.classList.remove('active'));

        const detail = document.getElementById('pokedex-detail');
        const pokemon = this._pokedexPokemon.find(p => p.id === pokemonId);
        if (!pokemon) return;

        const num = String(pokemon.id).padStart(3, '0');
        const spriteNormal = `https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/animated-front/${pokemon.id}.gif`;
        const spriteShiny = `https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/animated-front-shiny/${pokemon.id}.gif`;

        const typeColors = {
            normal: '#A8A878', fire: '#F08030', water: '#6890F0', electric: '#F8D030',
            grass: '#78C850', ice: '#98D8D8', fighting: '#C03028', poison: '#A040A0',
            ground: '#E0C068', flying: '#A890F0', psychic: '#F85888', bug: '#A8B820',
            rock: '#B8A038', ghost: '#705898', dragon: '#7038F8', dark: '#705848',
            steel: '#B8B8D0', fairy: '#EE99AC'
        };

        const rarityColors = {
            inicial: '#4caf50', common: '#9e9e9e', uncommon: '#2196f3',
            rare: '#ff9800', legendary: '#f44336'
        };

        let rarity = 'common';
        const bst = pokemon.hp + pokemon.attack + pokemon.defense + pokemon.sp_atk + pokemon.sp_def + pokemon.speed;
        const starters = [1,4,7,10,13,16,152,155,158,252,255,258,387,390,393,495,498,501,650,653,656,722,725,728,810,813,816,906,909,912];
        if (starters.includes(pokemon.id)) rarity = 'inicial';
        else if (bst >= 600) rarity = 'legendary';
        else if (bst >= 500) rarity = 'rare';
        else if (bst >= 400) rarity = 'uncommon';

        const typesHtml = (pokemon.types || []).map(t =>
            `<span class="pokedex-type-badge" style="background:${typeColors[t] || '#68a090'}">${t.toUpperCase()}</span>`
        ).join('');

        detail.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
                <span style="font-size:24px;font-weight:800;color:rgba(255,255,255,0.15)">#${num}</span>
                <span style="font-size:22px;font-weight:700">${pokemon.name}</span>
                <span class="pokedex-type-badge" style="background:${rarityColors[rarity]};margin-left:8px">${rarity.toUpperCase()}</span>
            </div>
            <div class="pokedex-detail-header">
                <div class="pokedex-sprites">
                    <div>
                        <div class="pokedex-sprite-box"><img src="${spriteNormal}" onerror="this.src='https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/home-front/${pokemon.id}.png'"></div>
                        <div class="pokedex-sprite-label">Normal</div>
                    </div>
                    <div>
                        <div class="pokedex-sprite-box" style="border-color:#ff9800"><img src="${spriteShiny}" onerror="this.src='https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/home-front-shiny/${pokemon.id}.png'"></div>
                        <div class="pokedex-sprite-label">Shiny</div>
                    </div>
                </div>
                <div style="flex:1">
                    <div class="pokedex-info-block">
                        <div class="pokedex-info-title">Tipos</div>
                        <div>${typesHtml || '<span style="color:rgba(255,255,255,0.3)">?</span>'}</div>
                    </div>
                </div>
            </div>
            <div id="pokedex-extra-info"><div style="color:rgba(255,255,255,0.3);padding:10px">Carregando detalhes...</div></div>
        `;

        this.loadPokedexExtraInfo(pokemon);
    }

    async loadPokedexExtraInfo(pokemon) {
        const container = document.getElementById('pokedex-extra-info');
        if (!container) return;

        let speciesData = null;
        let height = '?', weight = '?', genderRate = '?', baseHappiness = '?';

        const baseId = pokemon.base_id || pokemon.id;
        if (baseId <= 1025) {
            try {
                const resp = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${baseId}`);
                if (resp.ok) speciesData = await resp.json();
            } catch (e) {}

            if (speciesData) {
                baseHappiness = speciesData.base_happiness ?? '?';
                const gr = speciesData.gender_rate;
                if (gr === -1) genderRate = 'Sem gênero';
                else {
                    const female = (gr / 8) * 100;
                    const male = 100 - female;
                    genderRate = `♂ ${male}% / ♀ ${female}%`;
                }
            }

            try {
                const resp2 = await fetch(`https://pokeapi.co/api/v2/pokemon/${baseId}`);
                if (resp2.ok) {
                    const pData = await resp2.json();
                    height = `${(pData.height / 10).toFixed(1)} m`;
                    weight = `${(pData.weight / 10).toFixed(1)} kg`;
                }
            } catch (e) {}
        }

        let evolutionsHtml = '';
        try {
            const { data: evoCheck, error: evoErr } = await window.db.from('pokemon_evolutions').select('id').limit(1);
            if (!evoErr && evoCheck) {
                const chainIds = new Set();
                const chainOrder = [];

                function addChain(id) {
                    if (!chainIds.has(id)) { chainIds.add(id); chainOrder.push(id); }
                }

                let prevIds = [];
                let curId = pokemon.id;
                for (let i = 0; i < 10; i++) {
                    const { data: prev } = await window.db.from('pokemon_evolutions').select('from_pokemon_id').eq('to_pokemon_id', curId);
                    if (prev && prev.length > 0) {
                        curId = prev[0].from_pokemon_id;
                        prevIds.unshift(curId);
                    } else break;
                }
                chainOrder.length = 0;
                chainIds.clear();
                for (const id of prevIds) addChain(id);
                addChain(pokemon.id);

                curId = pokemon.id;
                for (let i = 0; i < 10; i++) {
                    const { data: next } = await window.db.from('pokemon_evolutions').select('to_pokemon_id, evolution_method, evolution_value, min_level, min_happiness').eq('from_pokemon_id', curId);
                    if (next && next.length > 0) {
                        const nextId = next[0].to_pokemon_id;
                        if (!chainIds.has(nextId)) {
                            addChain(nextId);
                            chainOrder.push(nextId);
                        }
                        curId = nextId;
                    } else break;
                }

                if (chainOrder.length > 1) {
                    const parts = [];
                    for (let i = 0; i < chainOrder.length; i++) {
                        if (i > 0) {
                            const { data: evoRow } = await window.db.from('pokemon_evolutions').select('evolution_method, evolution_value, min_level').eq('from_pokemon_id', chainOrder[i-1]).eq('to_pokemon_id', chainOrder[i]).maybeSingle();
                            let method = '';
                            if (evoRow) {
                                if (evoRow.evolution_method === 'level-up' || evoRow.evolution_method === 'level') method = `Nv.${evoRow.min_level || '?'}`;
                                else if (evoRow.evolution_method === 'use-item') { const it = await window.db.from('items').select('name').eq('id', parseInt(evoRow.evolution_value)).maybeSingle(); method = it?.data?.name || evoRow.evolution_value || '?'; }
                                else if (evoRow.evolution_method === 'happiness') method = 'Felicidade';
                                else if (evoRow.evolution_method === 'trade') method = 'Troca';
                                else method = evoRow.evolution_method || '?';
                            }
                            parts.push(`<span class="pokedex-evo-arrow">${method} →</span>`);
                        }
                        const pokeId = chainOrder[i];
                        const { data: poke } = await window.db.from('pokemon').select('id, name').eq('id', pokeId).single();
                        if (!poke) continue;
                        const sprite = `https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/home-front/${poke.id}.png`;
                        const isCurrent = poke.id === pokemon.id;
                        const style = isCurrent ? 'border:2px solid #4caf50;background:#1a3a1a' : 'background:#1c2333';
                        parts.push(`<div class="pokedex-evo-pokemon" style="${style}" onclick="window.pokefury.selectPokedexPokemon(${poke.id})">
                            <img src="${sprite}" onerror="this.style.display='none'">
                            <span>${poke.name}</span>
                        </div>`);
                    }
                    evolutionsHtml = `<div class="pokedex-info-block">
                        <div class="pokedex-info-title">Evoluções</div>
                        <div class="pokedex-evo-chain">${parts.join('')}</div>
                    </div>`;
                }
            }
        } catch (e) { console.warn('[Pokedex] Evolutions error:', e.message); }

        let locationsHtml = '';
        try {
            const { data: encounters } = await window.db
                .from('map_encounters')
                .select('pokemon_name, map_id, region_maps(name, region_id, regions(name))')
                .eq('pokemon_id', pokemon.id);
            if (encounters && encounters.length > 0) {
                const locMap = {};
                encounters.forEach(enc => {
                    const mapName = enc.region_maps?.name || 'Desconhecido';
                    const regionName = enc.region_maps?.regions?.name || 'Desconhecida';
                    const key = `${regionName} - ${mapName}`;
                    if (!locMap[key]) locMap[key] = regionName;
                });
                const locs = Object.keys(locMap).map(loc => `<span class="pokedex-location-tag">${loc}</span>`);
                locationsHtml = `<div class="pokedex-info-block">
                    <div class="pokedex-info-title">Localização Favorita</div>
                    <div>${locs.join('')}</div>
                </div>`;
            }
        } catch (e) {}

        let abilitiesHtml = '';
        try {
            const { data: abils } = await window.db
                .from('pokemon_abilities')
                .select('is_hidden, slot, abilities(name)')
                .eq('pokemon_id', pokemon.id)
                .order('slot');
            if (abils && abils.length > 0) {
                const tags = abils.map(a => {
                    const name = a.abilities?.name || '?';
                    const cls = a.is_hidden ? 'pokedex-ability-tag pokedex-ability-hidden' : 'pokedex-ability-tag';
                    const label = a.is_hidden ? `${name} (Oculta)` : name;
                    return `<span class="${cls}">${label}</span>`;
                });
                abilitiesHtml = `<div class="pokedex-info-block">
                    <div class="pokedex-info-title">Habilidades</div>
                    <div>${tags.join('')}</div>
                </div>`;
            }
        } catch (e) {}

        const statMax = 255;
        const statColors = { hp: '#4caf50', attack: '#f44336', defense: '#2196f3', spAtk: '#9c27b0', spDef: '#00bcd4', speed: '#ff9800' };
        const statsHtml = [
            { label: 'HP', val: pokemon.hp, key: 'hp' },
            { label: 'Ataque', val: pokemon.attack, key: 'attack' },
            { label: 'Defesa', val: pokemon.defense, key: 'defense' },
            { label: 'Sp.Atk', val: pokemon.sp_atk, key: 'spAtk' },
            { label: 'Sp.Def', val: pokemon.sp_def, key: 'spDef' },
            { label: 'Velocidade', val: pokemon.speed, key: 'speed' }
        ].map(s => `<div class="pokedex-info-row">
            <span class="pokedex-info-label">${s.label}</span>
            <span class="pokedex-info-value">${s.val}</span>
            <div class="pokedex-stat-bar-bg" style="width:100px"><div class="pokedex-stat-bar" style="width:${(s.val / statMax) * 100}%;background:${statColors[s.key]}"></div></div>
        </div>`).join('');

        container.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div>
                    <div class="pokedex-info-block">
                        <div class="pokedex-info-title">Dados Gerais</div>
                        <div class="pokedex-info-row"><span class="pokedex-info-label">Tamanho</span><span class="pokedex-info-value">${height}</span></div>
                        <div class="pokedex-info-row"><span class="pokedex-info-label">Peso</span><span class="pokedex-info-value">${weight}</span></div>
                        <div class="pokedex-info-row"><span class="pokedex-info-label">Gênero</span><span class="pokedex-info-value">${genderRate}</span></div>
                        <div class="pokedex-info-row"><span class="pokedex-info-label">Felicidade Base</span><span class="pokedex-info-value">${baseHappiness}</span></div>
                        <div class="pokedex-info-row"><span class="pokedex-info-label">BST</span><span class="pokedex-info-value">${pokemon.hp + pokemon.attack + pokemon.defense + pokemon.sp_atk + pokemon.sp_def + pokemon.speed}</span></div>
                    </div>
                    ${evolutionsHtml}
                </div>
                <div>
                    ${locationsHtml}
                    ${abilitiesHtml}
                    <div class="pokedex-info-block">
                        <div class="pokedex-info-title">Status Base</div>
                        ${statsHtml}
                    </div>
                </div>
            </div>
        `;
    }

    async openPokemonInfo(index) {
        const p = this.playerTeam[index];
        if (!p) return;

        const popup = document.getElementById('pokemon-info-popup');
        const content = document.getElementById('pokemon-info-content');
        popup.classList.remove('hidden');

        document.getElementById('pokemon-info-close').onclick = () => popup.classList.add('hidden');
        popup.onclick = (e) => { if (e.target === popup) popup.classList.add('hidden'); };

        const spriteUrl = p.spriteUrls?.front || p.spriteUrls?.home || p.spriteUrls?.official || '';
        const spriteAnimated = `https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/animated-front/${p.id}.gif`;

        const typeColors = {
            normal: '#A8A878', fire: '#F08030', water: '#6890F0', electric: '#F8D030',
            grass: '#78C850', ice: '#98D8D8', fighting: '#C03028', poison: '#A040A0',
            ground: '#E0C068', flying: '#A890F0', psychic: '#F85888', bug: '#A8B820',
            rock: '#B8A038', ghost: '#705898', dragon: '#7038F8', dark: '#705848',
            steel: '#B8B8D0', fairy: '#EE99AC'
        };

        const typesHtml = (p.types || []).map(t =>
            `<span style="display:inline-block;padding:2px 10px;border-radius:4px;font-size:11px;font-weight:600;color:#fff;background:${typeColors[t] || '#68a090'}">${t.toUpperCase()}</span>`
        ).join(' ');

        const natureNames = {
            hardy: 'Hardy', lonely: 'Lonely', brave: 'Brave', adamant: 'Adamant', naughty: 'Naughty',
            bold: 'Bold', relaxed: 'Relaxed', impish: 'Impish', lax: 'Lax', quiet: 'Quiet',
            modest: 'Modest', mild: 'Mild', rash: 'Rash', calm: 'Calm', gentle: 'Gentle',
            sassy: 'Sassy', careful: 'Careful', quirky: 'Quirky', serious: 'Serious', jolly: 'Jolly',
            naive: 'Naive', timid: 'Timid', hasty: 'Hasty', bold: 'Bold', impish: 'Impish'
        };

        content.innerHTML = `
            <div style="text-align:center;margin-bottom:12px">
                <img src="${spriteAnimated}" style="width:120px;height:120px;image-rendering:pixelated" onerror="this.src='${spriteUrl}';this.style.width='100px';this.style.height='100px'">
                <div style="margin-top:8px">${typesHtml}</div>
            </div>
            <div style="text-align:center;margin-bottom:12px">
                <div style="font-size:18px;font-weight:700;color:#fff">${p.name}</div>
                <div style="font-size:12px;color:rgba(255,255,255,0.4)">#${String(p.id).padStart(3, '0')}</div>
            </div>
            <div id="pokemon-info-extra"><div style="color:rgba(255,255,255,0.3);text-align:center;padding:10px">Carregando...</div></div>
        `;

        let height = '?', weight = '?', genderRate = '?';
        let abilityName = '?', abilityEffect = '';
        try {
            const resp = await fetch(`https://pokeapi.co/api/v2/pokemon/${p.id}`);
            if (resp.ok) {
                const pData = await resp.json();
                height = `${(pData.height / 10).toFixed(1)} m`;
                weight = `${(pData.weight / 10).toFixed(1)} kg`;
            }
        } catch (e) {}
        try {
            const resp = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${p.id}`);
            if (resp.ok) {
                const sData = await resp.json();
                const gr = sData.gender_rate;
                if (gr === -1) genderRate = 'Sem gênero';
                else { const f = (gr / 8) * 100; genderRate = `♂ ${100 - f}% / ♀ ${f}%`; }
            }
        } catch (e) {}
        try {
            const { data: abils } = await window.db
                .from('pokemon_abilities')
                .select('is_hidden, slot, abilities(name, effect, id)')
                .eq('pokemon_id', p.id)
                .order('slot');
            if (abils && abils.length > 0) {
                const normal = abils.find(a => !a.is_hidden);
                if (normal && normal.abilities) {
                    abilityName = normal.abilities.name || '?';
                    const abilityId = normal.abilities.id;
                    if (abilityId) {
                        try {
                            const resp = await fetch(`https://pokeapi.co/api/v2/ability/${abilityId}`);
                            if (resp.ok) {
                                const abData = await resp.json();
                                const ptEntry = (abData.flavor_text_entries || []).find(e => e.language?.name === 'pt');
                                const ptEffect = (abData.effect_entries || []).find(e => e.language?.name === 'pt');
                                abilityEffect = ptEntry?.flavor_text || ptEffect?.short_effect || ptEffect?.effect || normal.abilities.effect || '';
                                abilityEffect = abilityEffect.replace(/\n/g, ' ').replace(/\f/g, ' ');
                            }
                        } catch (e) {
                            abilityEffect = normal.abilities.effect || '';
                        }
                    }
                }
            }
        } catch (e) {}

        const ivTotal = (p.ivs?.hp || 0) + (p.ivs?.attack || 0) + (p.ivs?.defense || 0) + (p.ivs?.spAtk || 0) + (p.ivs?.spDef || 0) + (p.ivs?.speed || 0);
        const evTotal = (p.evs?.hp || 0) + (p.evs?.attack || 0) + (p.evs?.defense || 0) + (p.evs?.spAtk || 0) + (p.evs?.spDef || 0) + (p.evs?.speed || 0);

        const currentStats = p.baseStats ? calculateAllStats(p.baseStats, p.level, p.ivs || { hp:15,attack:15,defense:15,spAtk:15,spDef:15,speed:15 }, p.evs || { hp:0,attack:0,defense:0,spAtk:0,spDef:0,speed:0 }, p.nature || 'hardy') : null;

        const makeBar = (val, max, color) => `<div style="display:flex;align-items:center;gap:6px"><span style="min-width:24px;text-align:right;font-size:11px;color:#c9d1d9;font-weight:500">${val}</span><div style="flex:1;height:5px;background:#21262d;border-radius:3px;overflow:hidden"><div style="height:100%;width:${Math.min(100, (val / max) * 100)}%;background:${color};border-radius:3px"></div></div></div>`;

        const natureEffects = {
            hardy: null, lonely: { up: 'Ataque', down: 'Defesa' }, brave: { up: 'Ataque', down: 'Velocidade' },
            adamant: { up: 'Ataque', down: 'Sp.Atk' }, naughty: { up: 'Ataque', down: 'Sp.Def' },
            bold: { up: 'Defesa', down: 'Ataque' }, relaxed: { up: 'Defesa', down: 'Velocidade' },
            impish: { up: 'Defesa', down: 'Sp.Atk' }, lax: { up: 'Defesa', down: 'Sp.Def' },
            timid: { up: 'Velocidade', down: 'Ataque' }, hasty: { up: 'Velocidade', down: 'Defesa' },
            serious: null, jolly: { up: 'Velocidade', down: 'Sp.Atk' }, naive: { up: 'Velocidade', down: 'Sp.Def' },
            modest: { up: 'Sp.Atk', down: 'Ataque' }, mild: { up: 'Sp.Atk', down: 'Defesa' },
            quiet: { up: 'Sp.Atk', down: 'Velocidade' }, rash: { up: 'Sp.Atk', down: 'Sp.Def' },
            calm: { up: 'Sp.Def', down: 'Ataque' }, gentle: { up: 'Sp.Def', down: 'Defesa' },
            sassy: { up: 'Sp.Def', down: 'Velocidade' }, careful: { up: 'Sp.Def', down: 'Sp.Atk' },
            quirky: null
        };
        const nature = p.nature || 'hardy';
        const ne = natureEffects[nature];
        const natureText = ne ? `↑${ne.up} / ↓${ne.down}` : 'Sem efeito';

        const extra = document.getElementById('pokemon-info-extra');
        extra.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
                <div style="background:#0d1117;border-radius:6px;padding:8px;position:relative" id="nature-container">
                    <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;margin-bottom:4px">Natureza</div>
                    <div style="font-size:13px;color:#c9d1d9;font-weight:500;cursor:help" id="nature-name">${nature}</div>
                    <div id="nature-tooltip" style="display:none;position:absolute;left:0;right:0;bottom:100%;background:#1c2333;border:1px solid rgba(255,215,0,0.3);border-radius:6px;padding:8px;margin-bottom:6px;font-size:11px;color:rgba(255,255,255,0.7);line-height:1.4;z-index:10;box-shadow:0 4px 12px rgba(0,0,0,0.5)">${natureText}</div>
                </div>
                <div style="background:#0d1117;border-radius:6px;padding:8px">
                    <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;margin-bottom:4px">Gênero</div>
                    <div style="font-size:13px;color:#c9d1d9;font-weight:500">${genderRate}</div>
                </div>
                <div style="background:#0d1117;border-radius:6px;padding:8px">
                    <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;margin-bottom:4px">Tamanho</div>
                    <div style="font-size:13px;color:#c9d1d9;font-weight:500">${height}</div>
                </div>
                <div style="background:#0d1117;border-radius:6px;padding:8px">
                    <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;margin-bottom:4px">Peso</div>
                    <div style="font-size:13px;color:#c9d1d9;font-weight:500">${weight}</div>
                </div>
            </div>
            <div style="background:#0d1117;border-radius:6px;padding:8px;margin-bottom:12px;position:relative" id="ability-container">
                <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;margin-bottom:4px">Habilidade</div>
                <div style="font-size:13px;color:#ffd700;font-weight:600;cursor:help" id="ability-name">${abilityName}</div>
                <div id="ability-tooltip" style="display:none;position:absolute;left:0;right:0;bottom:100%;background:#1c2333;border:1px solid rgba(255,215,0,0.3);border-radius:6px;padding:8px;margin-bottom:6px;font-size:11px;color:rgba(255,255,255,0.7);line-height:1.4;z-index:10;box-shadow:0 4px 12px rgba(0,0,0,0.5)">${abilityEffect || 'Sem descrição disponível'}</div>
            </div>
            <div style="background:#0d1117;border-radius:6px;padding:8px;margin-bottom:12px">
                <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;margin-bottom:6px">Poder Total</div>
                <div style="font-size:20px;font-weight:700;color:#58a6ff">0</div>
            </div>
            ${currentStats ? `
            <div style="background:#0d1117;border-radius:6px;padding:8px;margin-bottom:8px">
                <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;margin-bottom:6px">Status Atuais (Nv.${p.level})</div>
                <div style="display:flex;flex-direction:column;gap:4px">
                    <div style="display:flex;align-items:center;gap:6px"><span style="min-width:44px;font-size:11px;color:rgba(255,255,255,0.5)">HP</span>${makeBar(currentStats.hp, 714, '#4caf50')}</div>
                    <div style="display:flex;align-items:center;gap:6px"><span style="min-width:44px;font-size:11px;color:rgba(255,255,255,0.5)">Ataque</span>${makeBar(currentStats.attack, 460, '#f44336')}</div>
                    <div style="display:flex;align-items:center;gap:6px"><span style="min-width:44px;font-size:11px;color:rgba(255,255,255,0.5)">Defesa</span>${makeBar(currentStats.defense, 460, '#2196f3')}</div>
                    <div style="display:flex;align-items:center;gap:6px"><span style="min-width:44px;font-size:11px;color:rgba(255,255,255,0.5)">Sp.Atk</span>${makeBar(currentStats.spAtk, 460, '#9c27b0')}</div>
                    <div style="display:flex;align-items:center;gap:6px"><span style="min-width:44px;font-size:11px;color:rgba(255,255,255,0.5)">Sp.Def</span>${makeBar(currentStats.spDef, 460, '#00bcd4')}</div>
                    <div style="display:flex;align-items:center;gap:6px"><span style="min-width:44px;font-size:11px;color:rgba(255,255,255,0.5)">Velocidade</span>${makeBar(currentStats.speed, 460, '#ff9800')}</div>
                </div>
            </div>
            ` : ''}
            <div style="background:#0d1117;border-radius:6px;padding:8px;margin-bottom:8px">
                <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;margin-bottom:6px">IVs (Total: ${ivTotal})</div>
                <div style="display:flex;flex-direction:column;gap:4px">
                    <div style="display:flex;align-items:center;gap:6px"><span style="min-width:44px;font-size:11px;color:rgba(255,255,255,0.5)">HP</span>${makeBar(p.ivs?.hp || 0, 31, '#4caf50')}</div>
                    <div style="display:flex;align-items:center;gap:6px"><span style="min-width:44px;font-size:11px;color:rgba(255,255,255,0.5)">Ataque</span>${makeBar(p.ivs?.attack || 0, 31, '#f44336')}</div>
                    <div style="display:flex;align-items:center;gap:6px"><span style="min-width:44px;font-size:11px;color:rgba(255,255,255,0.5)">Defesa</span>${makeBar(p.ivs?.defense || 0, 31, '#2196f3')}</div>
                    <div style="display:flex;align-items:center;gap:6px"><span style="min-width:44px;font-size:11px;color:rgba(255,255,255,0.5)">Sp.Atk</span>${makeBar(p.ivs?.spAtk || 0, 31, '#9c27b0')}</div>
                    <div style="display:flex;align-items:center;gap:6px"><span style="min-width:44px;font-size:11px;color:rgba(255,255,255,0.5)">Sp.Def</span>${makeBar(p.ivs?.spDef || 0, 31, '#00bcd4')}</div>
                    <div style="display:flex;align-items:center;gap:6px"><span style="min-width:44px;font-size:11px;color:rgba(255,255,255,0.5)">Velocidade</span>${makeBar(p.ivs?.speed || 0, 31, '#ff9800')}</div>
                </div>
            </div>
            <div style="background:#0d1117;border-radius:6px;padding:8px">
                <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;margin-bottom:6px">EVs (Total: ${evTotal})</div>
                <div style="display:flex;flex-direction:column;gap:4px">
                    <div style="display:flex;align-items:center;gap:6px"><span style="min-width:44px;font-size:11px;color:rgba(255,255,255,0.5)">HP</span>${makeBar(p.evs?.hp || 0, 252, '#4caf50')}</div>
                    <div style="display:flex;align-items:center;gap:6px"><span style="min-width:44px;font-size:11px;color:rgba(255,255,255,0.5)">Ataque</span>${makeBar(p.evs?.attack || 0, 252, '#f44336')}</div>
                    <div style="display:flex;align-items:center;gap:6px"><span style="min-width:44px;font-size:11px;color:rgba(255,255,255,0.5)">Defesa</span>${makeBar(p.evs?.defense || 0, 252, '#2196f3')}</div>
                    <div style="display:flex;align-items:center;gap:6px"><span style="min-width:44px;font-size:11px;color:rgba(255,255,255,0.5)">Sp.Atk</span>${makeBar(p.evs?.spAtk || 0, 252, '#9c27b0')}</div>
                    <div style="display:flex;align-items:center;gap:6px"><span style="min-width:44px;font-size:11px;color:rgba(255,255,255,0.5)">Sp.Def</span>${makeBar(p.evs?.spDef || 0, 252, '#00bcd4')}</div>
                    <div style="display:flex;align-items:center;gap:6px"><span style="min-width:44px;font-size:11px;color:rgba(255,255,255,0.5)">Velocidade</span>${makeBar(p.evs?.speed || 0, 252, '#ff9800')}</div>
                </div>
            </div>
        `;

        const abilityNameEl = document.getElementById('ability-name');
        const abilityTooltip = document.getElementById('ability-tooltip');
        if (abilityNameEl && abilityTooltip) {
            abilityNameEl.onmouseenter = () => { abilityTooltip.style.display = 'block'; };
            abilityNameEl.onmouseleave = () => { abilityTooltip.style.display = 'none'; };
        }
        const natureNameEl = document.getElementById('nature-name');
        const natureTooltip = document.getElementById('nature-tooltip');
        if (natureNameEl && natureTooltip) {
            natureNameEl.onmouseenter = () => { natureTooltip.style.display = 'block'; };
            natureNameEl.onmouseleave = () => { natureTooltip.style.display = 'none'; };
        }
    }

    async openRegionManager() {
        const overlay = document.getElementById('region-overlay');
        overlay.classList.remove('hidden');

        document.getElementById('region-btn-close').onclick = () => overlay.classList.add('hidden');

        await this.regionManager.loadRegions();
        this.renderRegionList();

        document.getElementById('region-btn-create').onclick = async () => {
            const name = prompt('Nome da nova regiao:');
            if (!name) return;
            await this.regionManager.createRegion(name);
            this.renderRegionList();
        };
    }

    renderRegionList() {
        const container = document.getElementById('region-list');
        container.innerHTML = '';

        this.regionManager.regions.forEach(region => {
            const item = document.createElement('div');
            item.className = 'region-item';
            item.innerHTML = `
                <button class="region-item-delete" title="Excluir">🗑️</button>
                <div class="region-item-name">${region.name}</div>
                <div class="region-item-meta">${region.description || 'Sem descricao'}</div>
            `;
            item.onclick = (e) => {
                if (e.target.closest('.region-item-delete')) return;
                container.querySelectorAll('.region-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                this.loadRegionDetail(region);
            };
            item.querySelector('.region-item-delete').onclick = async (e) => {
                e.stopPropagation();
                if (!confirm(`Excluir regiao "${region.name}"?`)) return;
                await this.regionManager.deleteRegion(region.id);
                this.renderRegionList();
                document.getElementById('region-detail').innerHTML = '<div class="region-empty"><p>Selecione uma regiao</p></div>';
            };
            container.appendChild(item);
        });
    }

    async loadRegionDetail(region) {
        const detail = document.getElementById('region-detail');
        const maps = await this.regionManager.loadRegionMaps(region.id);

        detail.innerHTML = `
            <div class="region-info">
                <h3>${region.name}</h3>
                <p>${region.description || 'Sem descricao'}</p>
                <div class="region-info-row">
                    <input type="text" id="region-name-input" value="${region.name}" placeholder="Nome">
                    <input type="text" id="region-desc-input" value="${region.description || ''}" placeholder="Descricao">
                    <button class="editor-action-btn primary" id="region-save-btn">Salvar</button>
                </div>
            </div>
            <div class="region-maps-header">
                <h4>Mapas (${maps.length})</h4>
                <button class="editor-action-btn primary" id="region-add-map-btn">+ Adicionar Mapa</button>
            </div>
            <div class="map-sequence" id="map-sequence"></div>
        `;

        document.getElementById('region-save-btn').onclick = async () => {
            const newName = document.getElementById('region-name-input').value;
            const newDesc = document.getElementById('region-desc-input').value;
            await this.regionManager.updateRegion(region.id, { name: newName, description: newDesc });
            this.renderRegionList();
        };

        document.getElementById('region-add-map-btn').onclick = () => {
            this.openMapPicker(region);
        };

        this.renderMapSequence(maps, region);
    }

    renderMapSequence(maps, region) {
        const container = document.getElementById('map-sequence');
        if (!container) return;
        container.innerHTML = '';

        if (maps.length === 0) {
            container.innerHTML = '<div style="color:rgba(255,255,255,0.3);font-size:12px;padding:16px;text-align:center">Nenhum mapa adicionado. Clique "+ Adicionar Mapa" para comecar.</div>';
            return;
        }

        maps.forEach((map, idx) => {
            if (idx > 0) {
                const arrow = document.createElement('div');
                arrow.className = 'map-arrow';
                arrow.textContent = '↓';
                container.appendChild(arrow);
            }

            const card = document.createElement('div');
            card.className = 'map-card';
            card.innerHTML = `
                <div class="map-card-number">${idx + 1}</div>
                <div class="map-card-preview">
                    <img src="${map.image_url}" alt="${map.name}" onerror="this.style.display='none'">
                </div>
                <div class="map-card-info">
                    <div class="map-card-name">${map.name}</div>
                    <div class="map-card-meta">Encontros: ${map.encounter_rate}% | Nivel: ${map.min_level}-${map.max_level}${map.is_gym ? ' | GYM' : ''}</div>
                </div>
                <div class="map-card-actions">
                    <button class.map-card-btn primary" data-action="encounters">Encontros</button>
                    <button class.map-card-btn" data-action="edit">Editar</button>
                    <button .map-card-btn" data-action="configure-bg" title="Configurar BG">🎨</button>
                    <button .map-card-btn danger" data-action="delete">Excluir</button>
                </div>
            `;

            card.querySelector('[data-action="encounters"]').onclick = () => this.openEncounterEditor(map);
            card.querySelector('[data-action="edit"]').onclick = () => this.openMapEditor(map, region);
            card.querySelector('[data-action="configure-bg"]').onclick = () => this.openBattleBackgroundPicker(map, region);
            card.querySelector('[data-action="delete"]').onclick = async () => {
                if (!confirm(`Excluir mapa "${map.name}"?`)) return;
                await this.regionManager.deleteMap(map.id);
                const updatedMaps = await this.regionManager.loadRegionMaps(region.id);
                this.renderMapSequence(updatedMaps, region);
            };

            container.appendChild(card);
        });
    }

    openMapPicker(region) {
        const modal = document.getElementById('map-picker-modal');
        const grid = document.getElementById('map-picker-grid');
        modal.classList.remove('hidden');

        document.getElementById('map-picker-close').onclick = () => modal.classList.add('hidden');
        document.querySelector('#map-picker-modal .modal-backdrop').onclick = () => modal.classList.add('hidden');

        const storageUrl = `${window.SUPABASE_URL}/storage/v1/object/public/sprites`;

        const folders = [
            { prefix: 'maps/routes', label: 'Routes' },
            { prefix: 'maps/towns', label: 'Towns' },
            { prefix: 'maps/dungeons', label: 'Dungeons' },
            { prefix: 'maps/interiors', label: 'Interiors' }
        ];

        grid.innerHTML = '<div style="color:rgba(255,255,255,0.3);font-size:12px;padding:8px">Carregando mapas...</div>';

        this.loadAllMapImages(folders, storageUrl, grid, region, modal);
    }

    async openBattleBackgroundPicker(map, region) {
        const modal = document.getElementById('map-picker-modal');
        const grid = document.getElementById('map-picker-grid');
        modal.classList.remove('hidden');

        document.getElementById('map-picker-close').onclick = () => modal.classList.add('hidden');
        document.querySelector('#map-picker-modal .modal-backdrop').onclick = () => modal.classList.add('hidden');

        const backgrounds = await this.regionManager.listBattleBackgrounds();
        
        grid.innerHTML = '';
        if (backgrounds.length === 0) {
            grid.innerHTML = '<div style="color:rgba(255,255,255,0.3);font-size:12px;padding:16px;grid-column:1/-1;text-align:center">Nenhum background de batalha encontrado. Faça upload para sprites/battle_backgrounds no Supabase Storage.</div>';
            return;
        }

        backgrounds.forEach(bg => {
            const item = document.createElement('div');
            item.className = 'map-picker-item';
            item.innerHTML = `
                <img src="${window.SUPABASE_URL}/storage/v1/object/public/sprites/battle_backgrounds/${bg.name}" alt="${bg.name}" loading="lazy">
                <div class="map-picker-item-name">${bg.name.replace(/\.(png|jpg|jpeg|gif)$/i, '').replace(/-/g, ' ')}</div>
            `;
            item.onclick = () => {
                const bgUrl = `${window.SUPABASE_URL}/storage/v1/object/public/sprites/battle_backgrounds/${bg.name}`;
                this.openBattlePositionEditor(map, region, bgUrl, bg.name);
            };
            grid.appendChild(item);
        });
    }

    openBattlePositionEditor(map, region, bgUrl, bgName) {
        const modal = document.getElementById('map-picker-modal');
        const grid = document.getElementById('map-picker-grid');

        const px = map.battle_player_x != null ? map.battle_player_x : 0.25;
        const py = map.battle_player_y != null ? map.battle_player_y : 0.75;
        const ex = map.battle_enemy_x != null ? map.battle_enemy_x : 0.72;
        const ey = map.battle_enemy_y != null ? map.battle_enemy_y : 0.4;
        const initPlayerFx = map.battle_player_fx || 'none';
        const initEnemyFx = map.battle_enemy_fx || 'none';

        grid.innerHTML = '';
        grid.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px;padding:12px;';

        const label = document.createElement('div');
        label.style.cssText = 'color:rgba(255,255,255,0.6);font-size:12px;text-align:center;';
        label.textContent = 'Arraste os pokemons para posição desejada e escolha o efeito nos pés';
        grid.appendChild(label);

        const preview = document.createElement('div');
        preview.style.cssText = 'position:relative;width:100%;max-width:700px;aspect-ratio:16/10;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.15);cursor:crosshair;';

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = bgUrl;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;pointer-events:none;display:block;';
        preview.appendChild(img);

        function createMarker(label, color, initX, initY) {
            const m = document.createElement('div');
            m.className = 'battle-pos-marker';
            m.style.cssText = `position:absolute;left:${initX*100}%;top:${initY*100}%;width:48px;height:48px;transform:translate(-50%,-80%);cursor:grab;z-index:2;`;
            m.innerHTML = `<div style="width:40px;height:40px;border-radius:50%;background:${color};border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 0 10px ${color}">${label === 'player' ? '🟢' : '🔴'}</div>
                <div style="text-align:center;font-size:9px;color:#fff;font-weight:700;text-shadow:0 0 4px #000;margin-top:-2px">${label === 'player' ? 'TREINADOR' : 'INIMIGO'}</div>`;
            return m;
        }

        const playerMarker = createMarker('player', 'rgba(34,150,34,0.8)', px, py);
        const enemyMarker = createMarker('enemy', 'rgba(200,34,34,0.8)', ex, ey);
        preview.appendChild(playerMarker);
        preview.appendChild(enemyMarker);

        function makeDraggable(marker, onUpdate) {
            let dragging = false;
            const onMove = (clientX, clientY) => {
                const rect = preview.getBoundingClientRect();
                const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
                marker.style.left = (x * 100) + '%';
                marker.style.top = (y * 100) + '%';
                onUpdate(x, y);
            };
            marker.addEventListener('mousedown', (e) => { e.preventDefault(); dragging = true; marker.style.cursor = 'grabbing'; });
            marker.addEventListener('touchstart', (e) => { dragging = true; }, { passive: true });
            window.addEventListener('mousemove', (e) => { if (dragging) onMove(e.clientX, e.clientY); });
            window.addEventListener('touchmove', (e) => { if (dragging) onMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
            window.addEventListener('mouseup', () => { dragging = false; marker.style.cursor = 'grab'; });
            window.addEventListener('touchend', () => { dragging = false; marker.style.cursor = 'grab'; });
        }

        let finalPx = px, finalPy = py, finalEx = ex, finalEy = ey;
        makeDraggable(playerMarker, (x, y) => { finalPx = x; finalPy = y; });
        makeDraggable(enemyMarker, (x, y) => { finalEx = x; finalEy = y; });

        grid.appendChild(preview);

        const fxSection = document.createElement('div');
        fxSection.style.cssText = 'width:100%;max-width:700px;display:flex;gap:16px;justify-content:center;flex-wrap:wrap;';

        function createFxSelector(title, initVal, onChange) {
            const col = document.createElement('div');
            col.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;min-width:120px;';
            const titleEl = document.createElement('div');
            titleEl.style.cssText = 'color:rgba(255,255,255,0.5);font-size:10px;font-weight:700;text-transform:uppercase;';
            titleEl.textContent = title;
            col.appendChild(titleEl);

            const row = document.createElement('div');
            row.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;justify-content:center;';
            let current = initVal;

            BATTLE_FX_LIST.forEach(fx => {
                const btn = document.createElement('button');
                btn.style.cssText = `width:36px;height:36px;border-radius:8px;border:2px solid ${fx.id === current ? '#e94560' : 'rgba(255,255,255,0.15)'};background:${fx.id === current ? 'rgba(233,69,96,0.3)' : 'rgba(0,0,0,0.4)'};cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;transition:all 0.15s;`;
                btn.textContent = fx.icon;
                btn.title = fx.name;
                btn.onmouseenter = () => { btn.style.transform = 'scale(1.1)'; };
                btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; };
                btn.onclick = () => {
                    current = fx.id;
                    row.querySelectorAll('button').forEach(b => {
                        b.style.borderColor = 'rgba(255,255,255,0.15)';
                        b.style.background = 'rgba(0,0,0,0.4)';
                    });
                    btn.style.borderColor = '#e94560';
                    btn.style.background = 'rgba(233,69,96,0.3)';
                    onChange(fx.id);
                };
                row.appendChild(btn);
            });
            col.appendChild(row);
            return { col, getCurrent: () => current };
        }

        let finalPlayerFx = initPlayerFx;
        let finalEnemyFx = initEnemyFx;
        const playerFxSel = createFxSelector('Efeito Treinador', initPlayerFx, (v) => { finalPlayerFx = v; });
        const enemyFxSel = createFxSelector('Efeito Inimigo', initEnemyFx, (v) => { finalEnemyFx = v; });
        fxSection.appendChild(playerFxSel.col);
        fxSection.appendChild(enemyFxSel.col);
        grid.appendChild(fxSection);

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:10px;margin-top:8px;';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Voltar';
        cancelBtn.className = 'action-btn small';
        cancelBtn.style.cssText = 'grid-column:auto;';
        cancelBtn.onclick = () => { this.openBattleBackgroundPicker(map, region); };

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Salvar BG + Posições';
        saveBtn.className = 'action-btn small';
        saveBtn.style.cssText = 'grid-column:auto;background:rgba(34,150,34,0.6);border:1px solid rgba(34,150,34,0.4);';
        saveBtn.onclick = async () => {
            try {
                await this.regionManager.updateMap(map.id, {
                    battle_bg_url: bgUrl,
                    battle_player_x: finalPx,
                    battle_player_y: finalPy,
                    battle_enemy_x: finalEx,
                    battle_enemy_y: finalEy,
                    battle_player_fx: finalPlayerFx,
                    battle_enemy_fx: finalEnemyFx
                });
                if (this.currentMap && this.currentMap.id === map.id) {
                    Object.assign(this.currentMap, {
                        battle_bg_url: bgUrl,
                        battle_player_x: finalPx,
                        battle_player_y: finalPy,
                        battle_enemy_x: finalEx,
                        battle_enemy_y: finalEy,
                        battle_player_fx: finalPlayerFx,
                        battle_enemy_fx: finalEnemyFx
                    });
                }
                modal.classList.add('hidden');
                grid.style.cssText = '';
                this.loadRegionDetail(region);
            } catch (e) {
                console.error('[BattlePos] Error saving:', e);
                alert('Erro ao salvar.');
            }
        };

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(saveBtn);
        grid.appendChild(btnRow);
    }

    async loadAllMapImages(folders, storageUrl, grid, region, modal) {
        grid.innerHTML = '';

        for (const folder of folders) {
            try {
                const { data, error } = await window.db.storage.from('sprites').list(folder.prefix);
                if (error || !data) continue;

                const images = data.filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f.name));
                if (images.length === 0) continue;

                const sectionHeader = document.createElement('div');
                sectionHeader.style.cssText = 'grid-column: 1/-1; color: rgba(255,255,255,0.5); font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 8px 4px 4px;';
                sectionHeader.textContent = folder.label;
                grid.appendChild(sectionHeader);

                images.forEach(file => {
                    const item = document.createElement('div');
                    item.className = 'map-picker-item';
                    item.innerHTML = `
                        <img src="${storageUrl}/${folder.prefix}/${file.name}" alt="${file.name}" loading="lazy">
                        <div class="map-picker-item-name">${file.name.replace(/\.(png|jpg|jpeg|gif)$/i, '').replace(/-/g, ' ')}</div>
                    `;
                    item.onclick = async () => {
                        const mapName = file.name.replace(/\.(png|jpg|jpeg|gif)$/i, '').replace(/-/g, ' ');
                        const imageUrl = `${storageUrl}/${folder.prefix}/${file.name}`;
                        await this.regionManager.addMapToRegion(region.id, mapName, imageUrl);
                        modal.classList.add('hidden');
                        this.loadRegionDetail(region);
                    };
                    grid.appendChild(item);
                });
            } catch (e) {
                console.warn(`[RegionManager] Error loading ${folder.prefix}:`, e);
            }
        }

        if (grid.children.length === 0) {
            grid.innerHTML = '<div style="color:rgba(255,255,255,0.3);font-size:12px;padding:16px;grid-column:1/-1;text-align:center">Nenhum mapa encontrado. Faca upload de imagens para sprites/maps/ no Supabase Storage.</div>';
        }
    }

    openMapEditor(map, region) {
        if (!this.zoneEditor) {
            this.zoneEditor = new MapZoneEditor();
            this.zoneEditor.init();
        }

        this.zoneEditor.onSave = async (collisionZones, spawnZones, playerSpawn) => {
            const update = { collision_zones: collisionZones, spawn_zones: spawnZones };
            if (playerSpawn) {
                update.player_spawn_x = playerSpawn.x;
                update.player_spawn_y = playerSpawn.y;
            } else {
                update.player_spawn_x = null;
                update.player_spawn_y = null;
            }
            await window.db.from('region_maps').update(update).eq('id', map.id);
            this.showTransitionBanner('Zonas salvas!');
            this.loadRegionDetail(region);
        };

        const imageLoader = (url) => {
            return new Promise(resolve => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => resolve(img);
                img.onerror = () => resolve(null);
                img.src = url;
            });
        };

        this.zoneEditor.open({
            name: map.name,
            image_url: map.image_url,
            gridW: this.overworld2d ? this.overworld2d.worldCols : 32,
            gridH: this.overworld2d ? this.overworld2d.worldRows : 24,
            collision_zones: map.collision_zones || [],
            spawn_zones: map.spawn_zones || [],
            player_spawn_x: map.player_spawn_x,
            player_spawn_y: map.player_spawn_y
        }, imageLoader);

        // Map image change button
        document.getElementById('zone-btn-change-image').onclick = () => {
            this.openMapImagePicker(map, region);
        };
    }

    async openMapImagePicker(map, region) {
        const modal = document.getElementById('map-image-modal');
        const grid = document.getElementById('map-image-grid');
        modal.classList.remove('hidden');

        document.getElementById('map-image-modal-close').onclick = () => modal.classList.add('hidden');

        grid.innerHTML = '<div style="color:rgba(255,255,255,0.3);grid-column:1/-1;text-align:center">Carregando imagens...</div>';

        const folders = ['routes', 'towns', 'dungeons', 'interiors'];
        const storageUrl = `${window.SUPABASE_URL}/storage/v1/object/public/sprites/maps`;
        let allImages = [];

        for (const folder of folders) {
            try {
                const { data } = await window.db.storage.from('sprites').list(`maps/${folder}`);
                if (data) {
                    data.filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f.name)).forEach(f => {
                        allImages.push({ name: f.name, folder, url: `${storageUrl}/${folder}/${f.name}` });
                    });
                }
            } catch (e) {
                console.warn(`[MapImagePicker] Could not list maps/${folder}:`, e);
            }
        }

        if (allImages.length === 0) {
            grid.innerHTML = '<div style="color:rgba(255,255,255,0.3);grid-column:1/-1;text-align:center">Nenhuma imagem encontrada. Faça upload para sprites/maps/</div>';
            return;
        }

        grid.innerHTML = '';
        for (const img of allImages) {
            const card = document.createElement('div');
            card.style.cssText = 'cursor:pointer;border-radius:8px;overflow:hidden;border:2px solid transparent;transition:border-color 0.2s';
            card.innerHTML = `
                <img src="${img.url}" style="width:100%;height:80px;object-fit:cover;display:block" loading="lazy" onerror="this.style.display='none'">
                <div style="padding:4px 8px;font-size:10px;color:rgba(255,255,255,0.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${img.folder}/${img.name}</div>
            `;
            card.onmouseenter = () => card.style.borderColor = '#e94560';
            card.onmouseleave = () => card.style.borderColor = 'transparent';
            card.onclick = async () => {
                await window.db.from('region_maps').update({ image_url: img.url }).eq('id', map.id);
                map.image_url = img.url;
                modal.classList.add('hidden');
                this.showTransitionBanner('Imagem do mapa atualizada!');
                this.loadRegionDetail(region);
            };
            grid.appendChild(card);
        }
    }

    async openEncounterEditor(map) {
        const modal = document.getElementById('encounter-modal');
        modal.classList.remove('hidden');

        document.getElementById('encounter-modal-close').onclick = () => modal.classList.add('hidden');
        document.querySelector('#encounter-modal .modal-backdrop').onclick = () => modal.classList.add('hidden');

        const encounters = await this.regionManager.loadMapEncounters(map.id);
        this.renderEncounterList(encounters, map);

        const nameInput = document.getElementById('encounter-pokemon-name');
        const previewEl = document.getElementById('encounter-preview');
        let previewData = null;

        nameInput.oninput = async () => {
            const name = nameInput.value.trim().toLowerCase();
            if (name.length < 2) {
                previewEl.innerHTML = 'Digite o nome para buscar...';
                previewData = null;
                return;
            }

            previewEl.innerHTML = 'Buscando...';
            try {
                const pokemonData = await PokeAPI.ensurePokemon(name);
                if (pokemonData) {
                    previewData = pokemonData;
                    const spriteUrl = PokeAPI.getBestSpriteUrl(pokemonData);
                    previewEl.innerHTML = `
                        <img src="${spriteUrl}" onerror="this.style.display='none'">
                        <div>
                            <div class="preview-name">${pokemonData.name || name}</div>
                            <div class="preview-id">#${pokemonData.id}</div>
                        </div>
                    `;
                } else {
                    previewEl.innerHTML = 'Pokemon nao encontrado';
                    previewData = null;
                }
            } catch (e) {
                previewEl.innerHTML = 'Pokemon nao encontrado no banco';
                previewData = null;
            }
        };

        document.getElementById('encounter-add-btn').onclick = async () => {
            const name = nameInput.value.trim();
            const weight = parseInt(document.getElementById('encounter-weight').value) || 50;

            if (!name) {
                alert('Digite o nome do Pokemon');
                return;
            }

            let pokemonId, spriteUrl;
            if (previewData) {
                pokemonId = previewData.id;
                spriteUrl = PokeAPI.getBestSpriteUrl(previewData);
            } else {
                const pokemonData = await PokeAPI.ensurePokemon(name);
                if (!pokemonData) {
                    alert('Pokemon nao encontrado: ' + name);
                    return;
                }
                pokemonId = pokemonData.id;
                spriteUrl = PokeAPI.getBestSpriteUrl(pokemonData);
                previewData = pokemonData;
            }

            await this.regionManager.addEncounter(map.id, previewData ? (previewData.name || name) : name, pokemonId, weight, spriteUrl);

            nameInput.value = '';
            document.getElementById('encounter-weight').value = '50';
            previewEl.innerHTML = '';
            previewData = null;

            const updated = await this.regionManager.loadMapEncounters(map.id);
            this.renderEncounterList(updated, map);
        };
    }

    renderEncounterList(encounters, map) {
        const container = document.getElementById('encounter-list');
        container.innerHTML = '';

        if (encounters.length === 0) {
            container.innerHTML = '<div style="color:rgba(255,255,255,0.3);font-size:12px;padding:8px">Nenhum encontro definido</div>';
            return;
        }

        encounters.forEach(enc => {
            const item = document.createElement('div');
            item.className = 'encounter-item';
            const rarityColors = { common: '#aaa', uncommon: '#3498db', rare: '#e94560', legendary: '#f39c12', inicial: '#2ecc71' };
            const rarityLabels = { common: 'Comum', uncommon: 'Incomum', rare: 'Raro', legendary: 'Lendario', inicial: 'Inicial' };
            const rarity = enc.rarity || 'common';
            const rarityColor = rarityColors[rarity] || '#aaa';
            const rarityLabel = rarityLabels[rarity] || rarity;
            item.innerHTML = `
                <img class="encounter-item-sprite" src="${enc.sprite_url}" alt="${enc.pokemon_name}" onerror="this.style.display='none'">
                <div class="encounter-item-info">
                    <div class="encounter-item-name">#${enc.pokemon_id} ${enc.pokemon_name}</div>
                    <div class="encounter-item-meta">
                        <span style="color:${rarityColor};font-weight:bold">${rarityLabel}</span> | Peso: ${enc.weight}
                    </div>
                </div>
                <button class="map-card-btn danger">Remover</button>
            `;
            item.querySelector('.danger').onclick = async () => {
                await this.regionManager.deleteEncounter(enc.id);
                const updated = await this.regionManager.loadMapEncounters(map.id);
                this.renderEncounterList(updated, map);
            };
            container.appendChild(item);
        });
    }

    setupMapEditorEvents() {
        const me = this.mapEditor;
        const overlay = document.getElementById('map-editor-overlay');

        document.getElementById('editor-btn-close').onclick = () => {
            overlay.classList.add('hidden');
        };

        document.getElementById('editor-btn-resize').onclick = () => {
            const w = parseInt(document.getElementById('editor-grid-w').value) || 40;
            const h = parseInt(document.getElementById('editor-grid-h').value) || 30;
            me.setGridSize(w, h);
        };

        document.getElementById('editor-btn-clear').onclick = () => {
            if (confirm('Tem certeza? Isso apagará todo o mapa.')) {
                me.clear();
            }
        };

        document.getElementById('editor-btn-save').onclick = () => this.saveMapToStorage();
        document.getElementById('editor-btn-load').onclick = () => this.loadSavedMapsList();
        document.getElementById('editor-btn-export').onclick = () => this.exportMapJSON();

        window.addEventListener('resize', () => {
            if (!overlay.classList.contains('hidden')) {
                const wrap = overlay.querySelector('.editor-canvas-wrap');
                me.resize(wrap.clientWidth, wrap.clientHeight);
            }
        });
    }

    async saveMapToStorage() {
        const me = this.mapEditor;
        const nameInput = document.getElementById('map-name-input');
        const name = (nameInput.value || '').trim();
        if (!name) {
            alert('Digite um nome para o mapa.');
            return;
        }

        const mapData = me.toJSON();
        const fileName = `maps/${name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}.json`;

        try {
            const blob = new Blob([mapData], { type: 'application/json' });
            const file = new File([blob], `${fileName}`, { type: 'application/json' });

            const { data, error } = await window.db.storage
                .from('sprites')
                .upload(fileName, file, { upsert: true });

            if (error) throw error;

            me.currentMapName = name;
            alert(`Mapa "${name}" salvo com sucesso!`);
            this.loadSavedMapsList();
        } catch (e) {
            console.error('[MapEditor] Save error:', e);
            alert('Erro ao salvar: ' + e.message);
        }
    }

    async loadSavedMapsList() {
        const container = document.getElementById('saved-maps-list');
        if (!container) return;
        container.innerHTML = '<div style="color:rgba(255,255,255,0.3);font-size:11px;padding:4px">Carregando...</div>';

        try {
            const { data, error } = await window.db.storage.from('sprites').list('maps');
            if (error) throw error;

            const jsonFiles = (data || []).filter(f => f.name.endsWith('.json'));

            container.innerHTML = '';
            if (jsonFiles.length === 0) {
                container.innerHTML = '<div style="color:rgba(255,255,255,0.3);font-size:11px;padding:4px">Nenhum mapa tile salvo</div>';
                return;
            }

            jsonFiles.forEach(file => {
                const item = document.createElement('div');
                item.className = 'saved-map-item';
                const displayName = file.name.replace('.json', '').replace(/-/g, ' ');
                item.innerHTML = `
                    <div>
                        <div class="saved-map-item-name">${displayName}</div>
                        <div class="saved-map-item-size">${new Date(file.created_at).toLocaleDateString('pt-BR')}</div>
                    </div>
                    <button class="saved-map-item-delete" title="Excluir">🗑️</button>
                `;

                item.querySelector('.saved-map-item-name').parentElement.onclick = () => this.loadMapFromStorage(file.name);
                item.querySelector('.saved-map-item-delete').onclick = (e) => {
                    e.stopPropagation();
                    this.deleteMapFromStorage(file.name);
                };

                container.appendChild(item);
            });
        } catch (e) {
            container.innerHTML = `<div style="color:#f44336;font-size:11px;padding:4px">Erro: ${e.message}</div>`;
        }
    }

    async loadMapFromStorage(fileName) {
        const me = this.mapEditor;
        try {
            const { data, error } = await window.db.storage.from('sprites').download(`maps/${fileName}`);
            if (error) throw error;

            const text = await data.text();
            const json = JSON.parse(text);
            me.fromJSON(json);

            const nameInput = document.getElementById('map-name-input');
            nameInput.value = fileName.replace('.json', '').replace(/-/g, ' ');

            document.getElementById('editor-grid-w').value = me.gridW;
            document.getElementById('editor-grid-h').value = me.gridH;

            alert(`Mapa "${fileName.replace('.json', '')}" carregado!`);
        } catch (e) {
            console.error('[MapEditor] Load error:', e);
            alert('Erro ao carregar: ' + e.message);
        }
    }

    async deleteMapFromStorage(fileName) {
        if (!confirm('Tem certeza que deseja excluir este mapa?')) return;
        try {
            const { error } = await window.db.storage.from('sprites').remove([`maps/${fileName}`]);
            if (error) throw error;
            this.loadSavedMapsList();
        } catch (e) {
            alert('Erro ao excluir: ' + e.message);
        }
    }

    exportMapJSON() {
        const me = this.mapEditor;
        const json = me.toJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${me.currentMapName || 'mapa'}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.pokefury = new PokeFuryGame();
});
