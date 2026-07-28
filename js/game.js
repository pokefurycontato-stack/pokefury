import { TYPE_COLORS, STARTER_IDS, TOTAL_POKEMON } from './data.js';
import { randomInt, loadTypeEffectiveness } from './utils.js';
import { createPokemon, createTeam, determineTurnOrder, executeTurn, getAIMove, getEffectivenessText, isTeamFainted, getFirstAlive } from './battle.js';
import {
    showScreen, preloadBattleSprites, preloadBattleBgImage, updateBattleUI, showBattleMessage, showMoveSelection,
    drawBattleScene, initBattleUI, updateHpBar, showBagSelection, hideBattlePokemonSprites
} from './ui.js';
import { Overworld2D } from './overworld.js';
import { MapEditor } from './map-editor.js';
import { RegionManager } from './region-manager.js';
import { MapZoneEditor } from './zone-editor.js';

const SHINY_CHANCE = 128;

class PokeFuryGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 960;
        this.canvas.height = 640;

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

        this.regionManager = new RegionManager();
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
            });
        });

        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                localStorage.removeItem('pokefury_userId');
                localStorage.removeItem('pokefury_characterId');
                await window.db.auth.signOut();
                location.reload();
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
        await this.startGame(save.starter_pokemon);
    }

    async startGame(starterSpecies) {
        if (this._starting) {
            console.log('[PokeFury] startGame already in progress, skipping');
            return;
        }
        this._starting = true;
        console.log('[PokeFury] startGame called with:', starterSpecies);

        try {
            const pokemonData = await PokeAPI.ensurePokemon(starterSpecies);
            console.log('[PokeFury] Starter Pokemon loaded:', pokemonData.name);
            this.playerTeam = [await createPokemon(pokemonData, 5)];
            console.log('[PokeFury] Team created');
        } catch (e) {
            console.error('[PokeFury] Error creating team:', e);
            return;
        }

        document.getElementById('character-screen').classList.add('hidden');
        document.getElementById('game-wrapper').classList.remove('hidden');

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
        const banner = document.createElement('div');
        banner.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.85); color: #fff; padding: 24px 48px;
            border-radius: 12px; border: 2px solid #e94560; z-index: 9999;
            font-size: 20px; font-weight: 700; text-align: center;
            pointer-events: none;
        `;
        banner.textContent = text;
        document.body.appendChild(banner);
        banner.style.opacity = '0';
        banner.style.transition = 'opacity 0.3s';
        requestAnimationFrame(() => { banner.style.opacity = '1'; });
        setTimeout(() => {
            banner.style.opacity = '0';
            setTimeout(() => banner.remove(), 300);
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
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.state === 'battle') {
            this.renderBattle();
        }
    }

    renderBattle() {
        if (this.state !== 'battle') return;
        const activePlayer = getFirstAlive(this.playerTeam);
        const activeEnemy = getFirstAlive(this.enemyTeam);
        if (activePlayer && activeEnemy) {
            drawBattleScene(this.ctx, this.canvas, activePlayer, activeEnemy, this.currentBattleBg);
        } else {
            hideBattlePokemonSprites();
        }
    }

    async startWildBattle(minLevel = 2, maxLevel = 8) {
        if (!this.playerTeam || this.playerTeam.length === 0 || this.playerTeam.every(p => p.fainted)) {
            console.warn('[PokeFury] No alive pokemon, skipping wild battle');
            hideBattlePokemonSprites();
            return;
        }

        this.currentBattleBg = this.getNormalizedBattleBg();
        if (this.currentBattleBg) {
            await preloadBattleBgImage(this.currentBattleBg);
        }

        let pokemon = null;

        if (this.currentMap) {
            const encounters = await this.regionManager.loadMapEncounters(this.currentMap.id);
            if (encounters.length > 0) {
                // Rarity tier spawn rates (configurable)
                const TIER_RATES = { common: 57, uncommon: 25, rare: 12, legendary: 3, inicial: 3 };
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
                        const encMin = enc.min_level || this.currentMap.min_level || minLevel;
                        const encMax = enc.max_level || this.currentMap.max_level || maxLevel;
                        const level = encMin + Math.floor(Math.random() * (encMax - encMin + 1));
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
        if (this.overworld2d) this.overworld2d.hide();
        this.battleStartTime = Date.now();
        showScreen('battle-screen');
        updateBattleUI(this.playerTeam, this.enemyTeam);

        drawBattleScene(this.ctx, this.canvas, activePlayer, pokemon, this.currentBattleBg);

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
        await showBattleMessage(introMsg);
    }

    async startBattleWithPokemon(pokemonName, level, spriteUrl) {
        hideBattlePokemonSprites();
        if (!this.playerTeam || this.playerTeam.length === 0 || this.playerTeam.every(p => p.fainted)) {
            console.warn('[PokeFury] No alive pokemon, skipping battle');
            return;
        }

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
            }
            this.state = 'battle';
            if (this.overworld2d) this.overworld2d.hide();
            this.battleStartTime = Date.now();
            showScreen('battle-screen');
            updateBattleUI(this.playerTeam, this.enemyTeam);

            drawBattleScene(this.ctx, this.canvas, activePlayer, pokemon, this.currentBattleBg);

            initBattleUI(
                () => this.onFight(),
                () => this.onBag(),
                () => this.onMega(),
                () => this.onRun()
            );

            let introMsg = `Um ${pokemon.name} selvagem apareceu!`;
            if (isShiny) introMsg = `Um ${pokemon.name} SHINY selvagem apareceu!`;
            await showBattleMessage(introMsg);
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
            await this.executeBattleTurn(playerPokemon, enemyPokemon, move);
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
        const usableItems = items.filter(inv => inv.items && inv.items.usable_in_battle);

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
        } else if (itemData.category === 'pokeball') {
            const catchRate = this.calculateCatchRate(enemyPokemon, itemData);
            const caught = Math.random() < catchRate;
            if (caught) {
                await showBattleMessage(`Capturou ${enemyPokemon.name}!`);
                const added = await window.GameData.addPokemonToTeam(enemyPokemon);
                if (added) {
                    await showBattleMessage(`${enemyPokemon.name} foi adicionado a equipe!`);
                } else {
                    await showBattleMessage('Equipe cheia! Pokemon perdido.');
                }
                this.endBattle('win');
                return;
            } else {
                await showBattleMessage(`O Pokemon escapou da ${itemData.name}!`);
            }
        } else if (itemData.effect && itemData.effect.startsWith('cure_')) {
            await showBattleMessage(`${playerPokemon.name} foi curado de status!`);
        }

        drawBattleScene(this.ctx, this.canvas, playerPokemon, enemyPokemon, this.currentBattleBg);
        updateBattleUI(this.playerTeam, this.enemyTeam);
        await this.enemyTurn();
    }

    calculateCatchRate(pokemon, pokeball) {
        const maxHp = pokemon.stats.hp;
        const currentHp = pokemon.currentHp;
        const hpFactor = (3 * maxHp - 2 * currentHp) / (3 * maxHp);
        let rate = hpFactor;

        if (pokeball.effect === 'catch_100x') rate = 1.0;
        else if (pokeball.effect === 'catch_2x') rate *= 2;
        else if (pokeball.effect === 'catch_1.5x') rate *= 1.5;
        else rate *= 1;

        if (pokemon.isShiny) rate *= 0.3;
        if (pokemon.level > 20) rate *= 0.8;

        return Math.min(rate, 1.0);
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
                drawBattleScene(this.ctx, this.canvas, megaPokemon, getFirstAlive(this.enemyTeam), this.currentBattleBg);
                updateBattleUI(this.playerTeam, this.enemyTeam);
                await showBattleMessage(`${playerPokemon.name} mega evoluiu para ${megaPokemon.name}!`);
                return;
            }
        }

        await showBattleMessage('Nao tem mega stone equipada!');
    }

    async executeBattleTurn(playerPokemon, enemyPokemon, playerMove) {
        if (!playerPokemon || !enemyPokemon) return;
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
                if (m.id === move.id) m.currentPp = Math.max(0, m.currentPp - 1);
            });

            if (result.missed) {
                await showBattleMessage(`${attacker.name} errou ${move.name}!`);
            } else {
                await showBattleMessage(`${attacker.name} usou ${move.name}!`);

                const effText = getEffectivenessText(result.effectiveness);
                if (effText) await showBattleMessage(effText);

                if (result.critical) await showBattleMessage('Golpe crítico!');

                await showBattleMessage(updateHpBar(defender));
            }

            drawBattleScene(this.ctx, this.canvas, playerPokemon, enemyPokemon, this.currentBattleBg);
            updateBattleUI(this.playerTeam, this.enemyTeam);

            if (defender.fainted) {
                await showBattleMessage(`${defender.name} desmaiou!`);

                if (isTeamFainted(this.enemyTeam)) {
                    await showBattleMessage('Você venceu a batalha!');
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
                if (m.id === move.id) m.currentPp = Math.max(0, m.currentPp - 1);
            });

            await showBattleMessage(`${enemyPokemon.name} usou ${move.name}`);

            const effText = getEffectivenessText(result.effectiveness);
            if (effText) await showBattleMessage(effText);

            await showBattleMessage(updateHpBar(playerPokemon));

            drawBattleScene(this.ctx, this.canvas, playerPokemon, enemyPokemon, this.currentBattleBg);
            updateBattleUI(this.playerTeam, this.enemyTeam);

            if (playerPokemon.fainted) {
                await showBattleMessage(`${playerPokemon.name} desmaiou!`);
                if (isTeamFainted(this.playerTeam)) {
                    await showBattleMessage('Todos seus Pokémon desmaiaram...');
                    this.endBattle('lose');
                }
            }
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

        if (result === 'lose' && this.playerTeam) {
            this.playerTeam.forEach(p => {
                if (p.fainted) {
                    p.fainted = false;
                    p.currentHp = Math.max(1, Math.floor(p.stats.hp * 0.5));
                }
            });
        }

        this.saveTeam();

        this.state = 'overworld';
        showScreen('hud');
        hideBattlePokemonSprites();
        this.enemyTeam = [];
        document.getElementById('location-name').textContent = 'Área Selvagem';
        if (this.overworld2d) this.overworld2d.show();
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
            item.onclick = async () => {
                const bgName = bg.name;
                const bgUrl = `${window.SUPABASE_URL}/storage/v1/object/public/sprites/battle_backgrounds/${bgName}`;
                try {
                    await this.regionManager.updateMap(map.id, { battle_bg_url: bgUrl });
                    if (this.currentMap && this.currentMap.id === map.id) {
                        this.currentMap.battle_bg_url = bgUrl;
                    }
                    modal.classList.add('hidden');
                    this.loadRegionDetail(region);
                } catch (e) {
                    console.error('[RegionManager] Error updating battle background:', e);
                    alert('Erro ao salvar o background.');
                }
            };
            grid.appendChild(item);
        });
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

        this.zoneEditor.onSave = async (collisionZones, spawnZones) => {
            await this.regionManager.saveMapZones(map.id, collisionZones, spawnZones);
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
            gridW: this.overworld2d ? this.overworld2d.worldCols : 40,
            gridH: this.overworld2d ? this.overworld2d.worldRows : 30,
            collision_zones: map.collision_zones || [],
            spawn_zones: map.spawn_zones || []
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
