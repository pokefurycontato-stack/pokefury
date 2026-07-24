import { POKEMON_DATA, STARTER_OPTIONS } from './data.js';
import { randomInt } from './utils.js';
import { createPokemon, determineTurnOrder, executeTurn, getAIMove, getEffectivenessText, isTeamFainted, getFirstAlive } from './battle.js';
import {
    showScreen, updateBattleUI, showBattleMessage, showMoveSelection,
    drawBattleScene, initBattleUI, updateHpBar
} from './ui.js';

class PokeFuryGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 960;
        this.canvas.height = 640;

        this.state = 'title';
        this.playerName = 'Treinador';
        this.playerTeam = [];
        this.enemyTeam = [];
        this.battleStartTime = null;

        this.init();
    }

    async init() {
        document.getElementById('btn-new-game').addEventListener('click', () => {
            this.startNewGame();
        });

        const save = await window.GameData.getSave();
        if (save && save.starter_pokemon) {
            document.getElementById('btn-continue').disabled = false;
            document.getElementById('btn-continue').addEventListener('click', () => {
                this.loadGame();
            });
        }

        this.render();
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.state === 'title') {
            this.renderTitleScreen();
        } else if (this.state === 'starter-select') {
            this.renderStarterSelect();
        } else if (this.state === 'battle') {
            this.renderBattle();
        } else if (this.state === 'overworld') {
            this.renderOverworld();
        }
    }

    renderTitleScreen() {
        const w = this.canvas.width;
        const h = this.canvas.height;

        const grad = this.ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#1a1a2e');
        grad.addColorStop(0.5, '#16213e');
        grad.addColorStop(1, '#0f3460');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, w, h);

        this.ctx.fillStyle = '#e94560';
        this.ctx.globalAlpha = 0.06;
        for (let i = 0; i < 20; i++) {
            const x = (i * 50 + Date.now() / 50) % (w + 50) - 25;
            this.ctx.beginPath();
            this.ctx.arc(x, h / 2 + Math.sin(Date.now() / 1000 + i) * 100, 8, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1;
    }

    renderStarterSelect() {
        const w = this.canvas.width;
        const h = this.canvas.height;

        const grad = this.ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#1a1a2e');
        grad.addColorStop(1, '#16213e');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, w, h);

        this.ctx.fillStyle = '#fff';
        this.ctx.font = '600 18px Inter, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Escolha seu Pokémon inicial!', w / 2, 60);

        STARTER_OPTIONS.forEach((species, i) => {
            const data = POKEMON_DATA[species];
            const x = w * 0.2 + i * (w * 0.3);
            const y = h * 0.45;

            this.ctx.shadowColor = data.color;
            this.ctx.shadowBlur = 30;
            this.ctx.fillStyle = data.color;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 50, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;

            this.ctx.strokeStyle = 'rgba(233, 69, 96, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 58, 0, Math.PI * 2);
            this.ctx.stroke();

            this.ctx.fillStyle = '#fff';
            this.ctx.font = '600 12px Inter, sans-serif';
            this.ctx.fillText(data.name, x, y + 85);
            this.ctx.font = '400 10px Inter, sans-serif';
            this.ctx.fillStyle = 'rgba(255,255,255,0.5)';
            this.ctx.fillText(data.types.join(' / ').toUpperCase(), x, y + 105);
        });
    }

    renderBattle() {
        const activePlayer = getFirstAlive(this.playerTeam);
        const activeEnemy = getFirstAlive(this.enemyTeam);
        if (activePlayer && activeEnemy) {
            drawBattleScene(this.ctx, this.canvas, activePlayer, activeEnemy);
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

        this.ctx.shadowColor = '#e94560';
        this.ctx.shadowBlur = 40;
        this.ctx.fillStyle = '#e94560';
        this.ctx.beginPath();
        this.ctx.arc(w / 2, h / 2 - 30, 12, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.font = '500 14px Inter, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Clique para encontrar um Pokémon selvagem!', w / 2, h - 40);

        this.canvas.onclick = () => {
            this.canvas.onclick = null;
            this.startWildBattle();
        };
    }

    async startNewGame() {
        this.state = 'starter-select';
        this.render();
        await this.selectStarter();
    }

    async loadGame() {
        const team = await window.GameData.getTeam();
        if (team.length > 0) {
            this.playerTeam = team.map(t => {
                const pokemon = createPokemon(t.species, t.level);
                pokemon.currentHp = t.current_hp;
                if (t.moves && t.moves.length > 0) {
                    t.moves.forEach(savedMove => {
                        const move = pokemon.moves.find(m => m.id === savedMove.id);
                        if (move) move.currentPp = savedMove.pp;
                    });
                }
                if (pokemon.currentHp <= 0) pokemon.fainted = true;
                return pokemon;
            });
        } else {
            const save = await window.GameData.getSave();
            if (save && save.starter_pokemon) {
                this.playerTeam = [createPokemon(save.starter_pokemon, 5)];
            }
        }

        this.playerName = 'Treinador';
        const { data } = await window.db.auth.getUser();
        if (data && data.user && data.user.user_metadata && data.user.user_metadata.username) {
            this.playerName = data.user.user_metadata.username;
        }

        this.state = 'overworld';
        showScreen('hud');
        document.getElementById('player-name-hud').textContent = this.playerName;
        document.getElementById('location-name').textContent = 'Área Selvagem';
        this.render();
    }

    selectStarter() {
        return new Promise(resolve => {
            this.canvas.onclick = (e) => {
                const rect = this.canvas.getBoundingClientRect();
                const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
                const w = this.canvas.width;

                STARTER_OPTIONS.forEach((species, i) => {
                    const cx = w * 0.2 + i * (w * 0.3);
                    const cy = this.canvas.height * 0.45;
                    const dist = Math.sqrt((x - cx) ** 2 + (e.clientY - rect.top - cy) ** 2);

                    if (dist < 55) {
                        this.playerTeam = [createPokemon(species, 5)];
                        this.canvas.onclick = null;
                        resolve(species);
                        this.state = 'overworld';
                        showScreen('hud');
                        document.getElementById('location-name').textContent = 'Área Selvagem';
                        this.saveTeam();
                        this.render();
                    }
                });
            };
        });
    }

    async startWildBattle() {
        const wildSpecies = Object.keys(POKEMON_DATA)[randomInt(0, Object.keys(POKEMON_DATA).length - 1)];
        const wildLevel = randomInt(3, 7);
        this.enemyTeam = [createPokemon(wildSpecies, wildLevel)];

        this.state = 'battle';
        this.battleStartTime = Date.now();
        showScreen('battle-screen');
        updateBattleUI(this.playerTeam, this.enemyTeam);

        drawBattleScene(this.ctx, this.canvas, getFirstAlive(this.playerTeam), getFirstAlive(this.enemyTeam));

        initBattleUI(
            () => this.onFight(),
            () => this.onRun()
        );

        await showBattleMessage(`Um ${getFirstAlive(this.enemyTeam).name} selvagem apareceu!`);
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
        this.canvas.onclick = () => {
            this.canvas.onclick = null;
            this.startWildBattle();
        };
        this.render();
    }

    async saveTeam() {
        await window.GameData.saveTeam(this.playerTeam);
    }

    battleLoop() {}
}

window.addEventListener('DOMContentLoaded', () => {
    new PokeFuryGame();
});
