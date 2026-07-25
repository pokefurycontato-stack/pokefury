import { TYPE_COLORS, STARTER_IDS, TOTAL_POKEMON } from './data.js';
import { randomInt, loadTypeEffectiveness } from './utils.js';
import { createPokemon, createTeam, determineTurnOrder, executeTurn, getAIMove, getEffectivenessText, isTeamFainted, getFirstAlive } from './battle.js';
import {
    showScreen, preloadBattleSprites, updateBattleUI, showBattleMessage, showMoveSelection,
    drawBattleScene, initBattleUI, updateHpBar, showBagSelection
} from './ui.js';
import { Overworld2D } from './overworld.js';

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

        this.init();
    }

    async init() {
        await PokeAPI.init();
        await loadTypeEffectiveness();
        console.log('[PokeFury] Type effectiveness loaded from Supabase');
        await this.preloadStarters();
        this.render();

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

        const team = await window.GameData.getTeam();
        const isNew = team.length === 0;

        await this.saveTeam();

        if (isNew) {
            await window.GameData.addItem(1, 5);
            await window.GameData.addItem(10, 10);
            console.log('[PokeFury] Starter items given: 5x Potion, 10x Poke Ball');
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
        document.getElementById('location-name').textContent = 'Área Selvagem';

        try {
            if (this.overworld2d) this.overworld2d.show();
        } catch (e) {
            console.error('[PokeFury] Error showing overworld:', e);
        }

        console.log('[PokeFury] Game started successfully!');
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.state === 'battle') {
            this.renderBattle();
        }
    }

    renderBattle() {
        const activePlayer = getFirstAlive(this.playerTeam);
        const activeEnemy = getFirstAlive(this.enemyTeam);
        if (activePlayer && activeEnemy) {
            drawBattleScene(this.ctx, this.canvas, activePlayer, activeEnemy);
        }
    }

    async startWildBattle() {
        const minLevel = 2;
        const maxLevel = 8;
        const includeVariants = Math.random() < 0.15;
        const { pokemon, level } = await PokeAPI.getRandomWildPokemon(minLevel, maxLevel, includeVariants);

        const isShiny = Math.random() < (1 / SHINY_CHANCE);
        const wildPokemon = await createPokemon(pokemon, level, null, null, null, isShiny);
        this.enemyTeam = [wildPokemon];

        const activePlayer = getFirstAlive(this.playerTeam);
        await preloadBattleSprites(activePlayer, wildPokemon);

        this.state = 'battle';
        if (this.overworld2d) this.overworld2d.hide();
        this.battleStartTime = Date.now();
        showScreen('battle-screen');
        updateBattleUI(this.playerTeam, this.enemyTeam);

        drawBattleScene(this.ctx, this.canvas, activePlayer, wildPokemon);

        initBattleUI(
            () => this.onFight(),
            () => this.onBag(),
            () => this.onMega(),
            () => this.onRun()
        );

        let introMsg = `Um ${wildPokemon.name} selvagem apareceu!`;
        if (isShiny) introMsg = `Um ${wildPokemon.name} SHINY selvagem apareceu!`;
        if (wildPokemon.variant !== 'normal') introMsg = `Um ${wildPokemon.name} (${wildPokemon.variant}) selvagem apareceu!`;
        await showBattleMessage(introMsg);
    }

    async onFight() {
        const playerPokemon = getFirstAlive(this.playerTeam);
        const enemyPokemon = getFirstAlive(this.enemyTeam);

        showMoveSelection(playerPokemon.moves, async (move) => {
            await this.executeBattleTurn(playerPokemon, enemyPokemon, move);
        });
    }

    async onRun() {
        const escaped = Math.random() < 0.5;
        if (escaped) {
            await showBattleMessage('Escapou com sucesso!');
            this.endBattle(null);
        } else {
            await showBattleMessage('Nao conseguiu escapar!');
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

        drawBattleScene(this.ctx, this.canvas, playerPokemon, enemyPokemon);
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
                drawBattleScene(this.ctx, this.canvas, megaPokemon, getFirstAlive(this.enemyTeam));
                updateBattleUI(this.playerTeam, this.enemyTeam);
                await showBattleMessage(`${playerPokemon.name} mega evoluiu para ${megaPokemon.name}!`);
                return;
            }
        }

        await showBattleMessage('Nao tem mega stone equipada!');
    }

    async executeBattleTurn(playerPokemon, enemyPokemon, playerMove) {
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

            drawBattleScene(this.ctx, this.canvas, playerPokemon, enemyPokemon);
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
        const move = getAIMove(enemyPokemon);

        if (move) {
            const result = await executeTurn(enemyPokemon, playerPokemon, move);

            enemyPokemon.moves.forEach(m => {
                if (m.id === move.id) m.currentPp = Math.max(0, m.currentPp - 1);
            });

            await showBattleMessage(`${enemyPokemon.name} usou ${move.name}!`);

            const effText = getEffectivenessText(result.effectiveness);
            if (effText) await showBattleMessage(effText);

            await showBattleMessage(updateHpBar(playerPokemon));

            drawBattleScene(this.ctx, this.canvas, playerPokemon, enemyPokemon);
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

        this.saveTeam();

        this.state = 'overworld';
        showScreen('hud');
        document.getElementById('location-name').textContent = 'Área Selvagem';
        if (this.overworld2d) this.overworld2d.show();
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
}

window.addEventListener('DOMContentLoaded', () => {
    window.pokefury = new PokeFuryGame();
});
