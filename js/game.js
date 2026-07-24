import { TYPE_COLORS, STARTER_IDS, TOTAL_POKEMON } from './data.js';
import { randomInt } from './utils.js';
import { createPokemon, createTeam, determineTurnOrder, executeTurn, getAIMove, getEffectivenessText, isTeamFainted, getFirstAlive } from './battle.js';
import {
    showScreen, preloadBattleSprites, updateBattleUI, showBattleMessage, showMoveSelection,
    drawBattleScene, initBattleUI, updateHpBar
} from './ui.js';

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

        await this.saveTeam();

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
            const spriteUrl = activePokemon.spriteUrls?.home || activePokemon.spriteUrls?.official || activePokemon.spriteUrls?.front;
            const img = spriteUrl ? PokeAPI.imageCache[spriteUrl] : null;

            if (img && img.complete && img.naturalWidth > 0) {
                const maxW = 200;
                const maxH = 200;
                const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
                const drawW = img.naturalWidth * scale;
                const drawH = img.naturalHeight * scale;

                this.ctx.shadowColor = TYPE_COLORS[activePokemon.type] || '#e94560';
                this.ctx.shadowBlur = 40;
                this.ctx.drawImage(img, w / 2 - drawW / 2, h / 2 - drawH / 2 - 30, drawW, drawH);
                this.ctx.shadowBlur = 0;
            } else {
                this.ctx.shadowColor = '#e94560';
                this.ctx.shadowBlur = 40;
                this.ctx.fillStyle = TYPE_COLORS[activePokemon.type] || '#e94560';
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
        const { pokemon, level } = await PokeAPI.getRandomPokemon(minLevel, maxLevel);

        const wildPokemon = await createPokemon(pokemon, level);
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
            () => this.onRun()
        );

        await showBattleMessage(`Um ${wildPokemon.name} selvagem apareceu!`);
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
            await showBattleMessage('Não conseguiu escapar!');
            await this.enemyTurn();
        }
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

            const result = executeTurn(attacker, defender, move);

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
            const result = executeTurn(enemyPokemon, playerPokemon, move);

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
