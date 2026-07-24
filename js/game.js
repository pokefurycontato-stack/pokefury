import { TYPE_COLORS, STARTER_IDS, TOTAL_POKEMON } from './data.js';
import { randomInt, loadTypeEffectiveness } from './utils.js';
import { createPokemon, createTeam, determineTurnOrder, executeTurn, getAIMove, getEffectivenessText, isTeamFainted, getFirstAlive } from './battle.js';
import {
    showScreen, preloadBattleSprites, updateBattleUI, showBattleMessage, showMoveSelection,
    drawBattleScene, initBattleUI, updateHpBar, showBagSelection
} from './ui.js';

const SHINY_CHANCE = 128;

class PokeFuryGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 960;
        this.canvas.height = 640;

        this.state = 'idle';
        this.playerName = 'Treinador';
        this.playerTeam = [];
        this.enemyTeam = [];
        this.battleStartTime = null;
        this.starterDataCache = [];

        this.init();
    }

    async init() {
        await PokeAPI.init();
        await loadTypeEffectiveness();
        console.log('[PokeFury] Type effectiveness loaded from Supabase');
        await this.preloadStarters();
        this.render();

        document.getElementById('btn-start-adventure').addEventListener('click', () => {
            this.onCharacterCreate();
        });

        document.getElementById('btn-new-character').addEventListener('click', () => {
            this.showCharCreate();
        });

        document.getElementById('btn-logout-char').addEventListener('click', async () => {
            await window.db.auth.signOut();
            location.reload();
        });

        setTimeout(() => {
            this.showCharScreen();
        }, 600);
    }

    async preloadStarters() {
        const starterPromises = STARTER_IDS.map(id => PokeAPI.ensurePokemon(id));
        this.starterDataCache = await Promise.all(starterPromises);
        await PokeAPI.preloadSprites(this.starterDataCache.map(s => s.spriteUrls.home || s.spriteUrls.official));
    }

    showCharScreen() {
        document.getElementById('character-screen').classList.remove('hidden');
        this.showCharSelect();
    }

    async showCharSelect() {
        document.getElementById('char-create').classList.add('hidden');
        document.getElementById('char-select').classList.remove('hidden');

        const list = document.getElementById('char-list');
        list.innerHTML = '';

        const { data } = await window.db.auth.getUser();
        if (!data || !data.user) return;

        const { data: saves } = await window.db
            .from('game_saves')
            .select('*')
            .eq('user_id', data.user.id);

        if (!saves || saves.length === 0) {
            this.showCharCreate();
            return;
        }

        for (const save of saves) {
            const card = document.createElement('div');
            card.className = 'char-card';

            let spriteHtml = '';
            if (save.starter_pokemon) {
                try {
                    const pokeData = await PokeAPI.ensurePokemon(save.starter_pokemon);
                    const spriteUrl = pokeData.spriteUrls?.home || pokeData.spriteUrls?.official || pokeData.spriteUrls?.front;
                    await PokeAPI.preloadSprite(spriteUrl);
                    const img = PokeAPI.imageCache[spriteUrl];
                    if (img && img.complete) {
                        spriteHtml = `<img src="${spriteUrl}" class="char-card-sprite" alt="${pokeData.name}">`;
                    }
                } catch (e) {
                    spriteHtml = '<div class="char-card-sprite-placeholder">?</div>';
                }
            }

            const types = save.starter_pokemon ? await this.getStarterTypes(save.starter_pokemon) : [];
            const typeBadges = types.map(t =>
                `<span class="type-badge type-${t}" style="background:${TYPE_COLORS[t] || '#686868'}">${t}</span>`
            ).join('');

            card.innerHTML = `
                ${spriteHtml}
                <div class="char-card-info">
                    <div class="char-card-name">${save.player_name || 'Treinador'}</div>
                    <div class="char-card-meta">${save.starter_pokemon ? 'Starter: ' + save.starter_pokemon : 'Sem starter'}</div>
                    <div class="char-card-types">${typeBadges}</div>
                </div>
            `;

            card.addEventListener('click', () => {
                this.loadCharacter(save);
            });

            list.appendChild(card);
        }
    }

    async getStarterTypes(species) {
        try {
            const data = await PokeAPI.ensurePokemon(species);
            return data.types;
        } catch (e) {
            return [];
        }
    }

    showCharCreate() {
        document.getElementById('char-select').classList.add('hidden');
        document.getElementById('char-create').classList.remove('hidden');

        const avatarGrid = document.getElementById('avatar-grid');
        avatarGrid.innerHTML = '';

        const starters = this.starterDataCache;
        const starterGrid = document.getElementById('starter-grid');
        starterGrid.innerHTML = '';

        starters.forEach((poke, i) => {
            const card = document.createElement('div');
            card.className = 'starter-card';
            card.dataset.species = poke.species;

            const spriteUrl = poke.spriteUrls?.home || poke.spriteUrls?.official || poke.spriteUrls?.front;
            const typeBadges = poke.types.map(t =>
                `<span class="type-badge type-${t}" style="background:${TYPE_COLORS[t] || '#686868'}">${t}</span>`
            ).join('');

            card.innerHTML = `
                <img src="${spriteUrl}" class="starter-sprite" alt="${poke.name}" crossorigin="anonymous">
                <div class="starter-name">${poke.name}</div>
                <div class="starter-types">${typeBadges}</div>
            `;

            card.addEventListener('click', () => {
                starterGrid.querySelectorAll('.starter-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
            });

            if (i === 0) card.classList.add('selected');
            starterGrid.appendChild(card);
        });
    }

    async onCharacterCreate() {
        const nameInput = document.getElementById('char-name');
        const name = nameInput.value.trim();

        if (!name || name.length < 2) {
            nameInput.style.borderColor = '#f44336';
            return;
        }

        const selectedCard = document.querySelector('#starter-grid .starter-card.selected');
        if (!selectedCard) return;

        const species = selectedCard.dataset.species;

        const { data } = await window.db.auth.getUser();
        if (!data || !data.user) return;

        const { error } = await window.db.from('game_saves').upsert({
            user_id: data.user.id,
            player_name: name,
            starter_pokemon: species
        }, { onConflict: 'user_id' });

        if (error) {
            console.error('[PokeFury] Erro ao salvar personagem:', error);
            return;
        }

        this.playerName = name;
        await this.startGame(species);
    }

    async loadCharacter(save) {
        this.playerName = save.player_name || 'Treinador';
        await this.startGame(save.starter_pokemon);
    }

    async startGame(starterSpecies) {
        const pokemonData = await PokeAPI.ensurePokemon(starterSpecies);
        this.playerTeam = [await createPokemon(pokemonData, 5)];

        const save = await window.GameData.getSave();
        const isNew = !save || !save.starter_pokemon || save.starter_pokemon !== starterSpecies;

        await this.saveTeam();

        if (isNew) {
            await window.GameData.addItem(1, 5);
            await window.GameData.addItem(10, 10);
            console.log('[PokeFury] Starter items given: 5x Potion, 10x Poké Ball');
        }

        document.getElementById('character-screen').classList.add('hidden');
        this.state = 'overworld';
        showScreen('hud');
        document.getElementById('player-name-hud').textContent = this.playerName;
        document.getElementById('location-name').textContent = 'Área Selvagem';
        this.render();
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.state === 'overworld') {
            this.renderOverworld();
        } else if (this.state === 'battle') {
            this.renderBattle();
        }
    }

    renderOverworld() {
        const w = this.canvas.width;
        const h = this.canvas.height;

        const grad = this.ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#1a1a2e');
        grad.addColorStop(1, '#16213e');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, w, h);

        this.ctx.fillStyle = '#e94560';
        this.ctx.globalAlpha = 0.04;
        for (let i = 0; i < 30; i++) {
            const x = (i * 37 + Date.now() / 80) % w;
            const y = h * 0.3 + Math.sin(i * 0.5) * h * 0.2;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 4 + (i % 3) * 2, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1;

        const activePokemon = getFirstAlive(this.playerTeam);
        if (activePokemon) {
            let spriteUrl = null;
            if (activePokemon.isShiny && activePokemon.shinySpriteUrls) {
                spriteUrl = activePokemon.shinySpriteUrls.home || activePokemon.shinySpriteUrls.official || activePokemon.shinySpriteUrls.front;
            }
            if (!spriteUrl) {
                spriteUrl = activePokemon.spriteUrls?.home || activePokemon.spriteUrls?.official || activePokemon.spriteUrls?.front;
            }
            const img = spriteUrl ? PokeAPI.imageCache[spriteUrl] : null;

            if (img && img.complete && img.naturalWidth > 0) {
                const maxW = 200;
                const maxH = 200;
                const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
                const drawW = img.naturalWidth * scale;
                const drawH = img.naturalHeight * scale;

                this.ctx.shadowColor = activePokemon.isShiny ? '#ffd700' : (TYPE_COLORS[activePokemon.type] || '#e94560');
                this.ctx.shadowBlur = 40;
                this.ctx.drawImage(img, w / 2 - drawW / 2, h / 2 - drawH / 2 - 30, drawW, drawH);
                this.ctx.shadowBlur = 0;
            } else {
                this.ctx.shadowColor = activePokemon.isShiny ? '#ffd700' : '#e94560';
                this.ctx.shadowBlur = 40;
                this.ctx.fillStyle = activePokemon.isShiny ? '#ffd700' : (TYPE_COLORS[activePokemon.type] || '#e94560');
                this.ctx.beginPath();
                this.ctx.arc(w / 2, h / 2 - 30, 12, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.shadowBlur = 0;
            }
        }

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.font = '500 14px Inter, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Clique para encontrar um Pokémon selvagem!', w / 2, h - 40);

        this.canvas.onclick = () => {
            this.canvas.onclick = null;
            this.startWildBattle();
        };
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
        this.render();
    }

    async saveTeam() {
        await window.GameData.saveTeam(this.playerTeam);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new PokeFuryGame();
});
