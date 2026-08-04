import { getFirstAlive } from './battle.js';

export class AFKManager {
    constructor(game) {
        this.game = game;
        this.running = false;
        this.autoSearch = false;
        this.autoBattle = false;
        this.autoHeal = false;
        this.autoCapture = false;
        this.autoHealTeam = false;
        this.healThreshold = 40;
        this.healPotionId = null;
        this.captureRarities = {};
        this._walkPath = [];
        this._walkIndex = 0;
        this._state = 'idle';
        this._loopTimer = null;
        this._homeMap = null;
        this._homePlayerX = 0;
        this._homePlayerY = 0;
        this._visitingCenter = false;
        this._centerStep = 0;
        this._wasInBattle = false;
    }

    start() {
        if (this.running) return;
        this.running = true;
        this._state = 'idle';
        this._homeMap = this.game.currentMap;
        if (this.game.overworld2d) {
            this._homePlayerX = this.game.overworld2d.player.x;
            this._homePlayerY = this.game.overworld2d.player.y;
        }
        this._loopTick();
    }

    stop() {
        this.running = false;
        this._state = 'idle';
        this._walkPath = [];
        this._visitingCenter = false;
        this._centerStep = 0;
        if (this._loopTimer) { clearTimeout(this._loopTimer); this._loopTimer = null; }
    }

    async _loopTick() {
        if (!this.running) return;
        try {
            const game = this.game;
            if (game._battleEnding) {
                // Wait until rewards, persistence and battle cleanup finish.
            } else if (game.state === 'battle' && this.autoBattle) {
                await this._handleBattle();
                this._wasInBattle = true;
            } else if (game.state === 'overworld') {
                if (this._wasInBattle && this.autoHealTeam) {
                    this._wasInBattle = false;
                    await this._healTeamAfterBattle();
                }
                this._wasInBattle = false;
                if (this._visitingCenter) {
                    await this._handleCenterVisit();
                } else if (this.autoSearch) {
                    await this._handleOverworld();
                }
            }
        } catch (e) {
            console.error('[AFK] Tick error:', e);
        }
        if (this.running) {
            this._loopTimer = setTimeout(() => this._loopTick(), 200);
        }
    }

    _allMovesExhausted(pokemon) {
        if (!pokemon || !pokemon.moves) return false;
        return pokemon.moves.every(m => !m || m.currentPp <= 0);
    }

    async _healTeamAfterBattle() {
        const game = this.game;
        if (!game.playerTeam) return;
        const hasInjured = game.playerTeam.some(p => p.currentHp < p.stats.hp || p.fainted || p.statusEffect);
        if (!hasInjured) return;
        for (const p of game.playerTeam) {
            p.currentHp = p.stats.hp;
            p.fainted = false;
            p.statusEffect = null;
            if (p.moves) p.moves.forEach(m => { m.currentPp = m.pp || 35; });
        }
        await game.saveTeam();
        game.showTransitionBanner('Time curado automaticamente!');
    }

    // ============================================================
    // OVERWORLD: Walk to nearest Pokemon
    // ============================================================

    async _handleOverworld() {
        const ow = this.game.overworld2d;
        if (!ow || this.game.state !== 'overworld') return;
        if (ow.player.moving || ow.moveCooldown > 0) return;

        const playerPokemon = getFirstAlive(this.game.playerTeam);
        if (playerPokemon && this._allMovesExhausted(playerPokemon)) {
            await this._goToPokemonCenter();
            return;
        }

        if (this._walkPath.length > 0 && this._walkIndex < this._walkPath.length) {
            const next = this._walkPath[this._walkIndex];
            const dx = next.x - ow.player.x;
            const dy = next.y - ow.player.y;
            if (dx === 0 && dy === 0) {
                this._walkIndex++;
                return;
            }

            if (ow.isCollisionAt(next.x, next.y)) {
                this._walkPath = [];
                this._walkIndex = 0;
                return;
            }

            let dir = null;
            if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 'right' : 'left';
            else dir = dy > 0 ? 'down' : 'up';
            ow.keys[dir === 'up' ? 'ArrowUp' : dir === 'down' ? 'ArrowDown' : dir === 'left' ? 'ArrowLeft' : 'ArrowRight'] = true;
            setTimeout(() => { ow.keys = {}; }, 50);
            this._walkIndex++;
            return;
        }

        const target = this._findNearestPokemon(ow);
        if (!target) return;

        const path = this._findPath(ow, { x: ow.player.x, y: ow.player.y }, { x: target.x, y: target.y });
        if (path && path.length > 1) {
            this._walkPath = path.slice(1);
            this._walkIndex = 0;
        } else {
            this._walkPath = [];
            this._walkIndex = 0;
        }
    }

    _findNearestPokemon(ow) {
        let nearest = null;
        let minDist = Infinity;
        for (const p of ow.mapPokemonEntities) {
            if (!p.active) continue;
            const dist = Math.abs(p.x - ow.player.x) + Math.abs(p.y - ow.player.y);
            if (dist < minDist) {
                minDist = dist;
                nearest = p;
            }
        }
        return nearest;
    }

    _findPath(ow, start, end) {
        if (start.x === end.x && start.y === end.y) return [start];
        const cols = ow.worldCols || 32;
        const rows = ow.worldRows || 24;
        const key = (x, y) => `${x},${y}`;
        const open = [{ x: start.x, y: start.y, g: 0, f: 0, parent: null }];
        const closed = new Set();
        const heuristic = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
        open[0].f = heuristic(start, end);
        const maxIter = 3000;
        let iter = 0;
        while (open.length > 0 && iter < maxIter) {
            iter++;
            let bestIdx = 0;
            for (let i = 1; i < open.length; i++) {
                if (open[i].f < open[bestIdx].f) bestIdx = i;
            }
            const current = open.splice(bestIdx, 1)[0];
            if (current.x === end.x && current.y === end.y) {
                const path = [];
                let node = current;
                while (node) { path.unshift({ x: node.x, y: node.y }); node = node.parent; }
                return path;
            }
            closed.add(key(current.x, current.y));
            const neighbors = [
                { x: current.x + 1, y: current.y },
                { x: current.x - 1, y: current.y },
                { x: current.x, y: current.y + 1 },
                { x: current.x, y: current.y - 1 }
            ];
            for (const n of neighbors) {
                if (n.x < 0 || n.x >= cols || n.y < 0 || n.y >= rows) continue;
                if (closed.has(key(n.x, n.y))) continue;
                if (ow.isCollisionAt(n.x, n.y)) continue;
                const g = current.g + 1;
                const existing = open.find(o => o.x === n.x && o.y === n.y);
                if (existing) {
                    if (g < existing.g) {
                        existing.g = g;
                        existing.f = g + heuristic(n, end);
                        existing.parent = current;
                    }
                } else {
                    open.push({ x: n.x, y: n.y, g, f: g + heuristic(n, end), parent: current });
                }
            }
        }
        return null;
    }

    // ============================================================
    // POKEMON CENTER: Go heal when PP exhausted
    // ============================================================

    async _goToPokemonCenter() {
        this._visitingCenter = true;
        this._centerStep = 0;
        this._walkPath = [];
        console.log('[AFK] PP esgotados, indo ao Centro Pokemon...');
        await this.game.teleportToPokemonCenter();
    }

    async _handleCenterVisit() {
        const game = this.game;
        const ow = game.overworld2d;
        if (!ow || game.state !== 'overworld') return;

        if (this._centerStep === 0) {
            await game.healAllPokemon();
            console.log('[AFK] Time curado no Centro Pokemon');
            this._centerStep = 1;
            await game.teleportToMap(this._homeMap);
            if (ow.player) {
                ow.player.x = this._homePlayerX;
                ow.player.y = this._homePlayerY;
                ow.player.fromX = this._homePlayerX;
                ow.player.fromY = this._homePlayerY;
                ow.camera.x = ow.player.x * ow.tileW - ow.canvas.width / 2 + ow.tileW / 2;
                ow.camera.y = ow.player.y * ow.tileH - ow.canvas.height / 2 + ow.tileH / 2;
            }
            game.showTransitionBanner('Time curado! Voltando à área selvagem...');
            this._visitingCenter = false;
            this._centerStep = 0;
        }
    }

    // ============================================================
    // BATTLE: Smart AI
    // ============================================================

    async _handleBattle() {
        const game = this.game;
        if (game.state !== 'battle') return;
        if (!this.autoBattle) return;
        if (game._turnLocked) return;

        const playerPokemon = getFirstAlive(game.playerTeam);
        const enemyPokemon = getFirstAlive(game.enemyTeam);
        if (!playerPokemon || !enemyPokemon) return;

        if (playerPokemon.currentHp <= 0) return;

        const hpPct = (playerPokemon.currentHp / playerPokemon.stats.hp) * 100;

        if (this.autoHeal && hpPct <= this.healThreshold) {
            const healed = await this._tryHealSmart(playerPokemon);
            if (healed) return;
        }

        if (this._allMovesExhausted(playerPokemon)) {
            await game.executeBattleTurn(playerPokemon, enemyPokemon, {
                id: 'struggle', name: 'Struggle', type: 'normal', category: 'physical',
                power: 50, accuracy: 100, pp: 1, currentPp: 1
            });
            return;
        }

        const bestMove = this._chooseBestMove(playerPokemon, enemyPokemon);
        if (bestMove) {
            try {
                await game.executeBattleTurn(playerPokemon, enemyPokemon, bestMove);
            } catch (e) {
                console.error('[AFK] Battle turn error:', e);
            }
        }
    }

    _chooseBestMove(attacker, defender) {
        if (!attacker.moves || attacker.moves.length === 0) return null;
        let bestMove = null;
        let bestScore = -1;
        for (const move of attacker.moves) {
            if (!move || move.currentPp <= 0) continue;
            if (move.category === 'status') continue;
            if (!move.power || move.power <= 0) continue;
            const score = this._evaluateMove(attacker, defender, move);
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        if (!bestMove) {
            for (const move of attacker.moves) {
                if (move && move.currentPp > 0 && move.power > 0 && move.category !== 'status') {
                    bestMove = move;
                    break;
                }
            }
        }
        if (!bestMove) {
            for (const move of attacker.moves) {
                if (move && move.currentPp > 0 && move.power > 0) {
                    bestMove = move;
                    break;
                }
            }
        }
        return bestMove;
    }

    _evaluateMove(attacker, defender, move) {
        if (!move || !move.power) return 0;
        let score = move.power || 0;
        const attackerTypes = attacker.types || [];
        const defenderTypes = defender.types || [];
        const chart = this._typeChart;
        if (chart) {
            let eff = 1;
            for (const dt of defenderTypes) {
                const row = chart[move.type];
                if (row && row[dt]) eff *= row[dt];
            }
            score *= eff;
        }
        if (attackerTypes.includes(move.type)) score *= 1.5;
        if (move.category === 'physical') {
            score *= (attacker.stats.attack / Math.max(1, defender.stats.defense));
        } else if (move.category === 'special') {
            score *= (attacker.stats.spAtk / Math.max(1, defender.stats.spDef));
        }
        const hpPct = (attacker.currentHp / attacker.stats.hp) * 100;
        if (hpPct < 30) {
            const effect = this._getMoveEffectFast(move);
            if (effect && effect.effect === 'drain') score *= 1.8;
        }
        return score;
    }

    _getMoveEffectFast(move) {
        if (!move) return null;
        const name = (move.name || '').toLowerCase().trim();
        const DRAIN_MOVES = ['absorb', 'mega drain', 'giga drain', 'leech life', 'horn leech', 'drain punch', 'parasitic bite', 'bitter blade'];
        if (DRAIN_MOVES.includes(name)) return { effect: 'drain', drain: 0.5 };
        const RECOIL_MOVES = ['take down', 'double edge', 'brave bird', 'flare blitz', 'wild charge', 'head smash', 'steel wing'];
        if (RECOIL_MOVES.includes(name)) return { effect: 'recoil', recoil: 0.25 };
        const HEAL_MOVES = ['recover', 'softboiled', 'milk drink', 'roost', 'synthesis', 'moonlight', 'morning sun', 'slack off', 'wish', 'shore up'];
        if (HEAL_MOVES.includes(name)) return { effect: 'heal', healPercent: 0.5 };
        return null;
    }

    _calculateHealMoveAmount(pokemon, move, defender) {
        const effect = this._getMoveEffectFast(move);
        if (!effect) return 0;
        if (effect.effect === 'heal') {
            return Math.floor(pokemon.stats.hp * (effect.healPercent || 0.5));
        }
        if (effect.effect === 'drain') {
            const power = move.power || 40;
            let atk = pokemon.stats.spAtk || pokemon.stats.attack || 50;
            let def = 100;
            if (defender) {
                def = (move.category === 'physical' ? defender.stats.defense : defender.stats.spDef) || 100;
            }
            const estimatedDamage = Math.max(1, Math.floor((power * atk) / (def * 2)));
            const cappedDamage = Math.min(estimatedDamage, pokemon.stats.hp * 0.5);
            return Math.floor(cappedDamage * (effect.drain || 0.5));
        }
        return 0;
    }

    async _tryHealSmart(pokemon) {
        const hpPct = (pokemon.currentHp / pokemon.stats.hp) * 100;
        if (hpPct > this.healThreshold) return false;

        const hpDeficit = pokemon.stats.hp - pokemon.currentHp;
        const defender = getFirstAlive(this.game.enemyTeam);
        let bestHealMove = null;
        let bestMoveHeal = 0;

        for (const move of (pokemon.moves || [])) {
            if (!move || move.currentPp <= 0) continue;
            const effect = this._getMoveEffectFast(move);
            if (effect && (effect.effect === 'heal' || effect.effect === 'drain')) {
                const amount = this._calculateHealMoveAmount(pokemon, move, defender);
                if (amount > bestMoveHeal) {
                    bestMoveHeal = amount;
                    bestHealMove = move;
                }
            }
        }

        let potionHeal = 0;
        let potionItem = null;
        if (this.healPotionId) {
            try {
                const items = await window.GameData.getInventory();
                const potionInv = items.find(inv => inv.items && inv.items.id === this.healPotionId && inv.quantity > 0);
                if (potionInv) {
                    const eff = potionInv.items.effect;
                    if (eff === 'heal_full' || eff === 'heal_full_status') {
                        potionHeal = hpDeficit;
                    } else {
                        potionHeal = Math.min(potionInv.items.effect_value || 0, hpDeficit);
                    }
                    potionItem = potionInv;
                }
            } catch (e) { console.error('[AFK] Potion check error:', e); }
        }

        if (potionHeal > 0 && potionHeal >= bestMoveHeal) {
            return await this._useSpecificPotion(pokemon, potionItem, hpDeficit);
        }

        if (bestHealMove && bestMoveHeal > 0) {
            try {
                const enemyPokemon = getFirstAlive(this.game.enemyTeam);
                if (enemyPokemon) {
                    await this.game.executeBattleTurn(pokemon, enemyPokemon, bestHealMove);
                    return true;
                }
            } catch (e) { return false; }
        }

        if (potionHeal > 0) {
            return await this._useSpecificPotion(pokemon, potionItem, hpDeficit);
        }

        return false;
    }

    async _useSpecificPotion(pokemon, potionInv, hpDeficit) {
        if (!potionInv) return false;
        try {
            const item = potionInv.items;
            const heal = (item.effect === 'heal_full' || item.effect === 'heal_full_status')
                ? hpDeficit
                : Math.min(item.effect_value || 0, hpDeficit);
            pokemon.currentHp = Math.min(pokemon.stats.hp, pokemon.currentHp + heal);
            await window.GameData.addItem(item.id, -1);
            return true;
        } catch (e) {
            console.error('[AFK] Potion use error:', e);
        }
        return false;
    }

    // ============================================================
    // CAPTURE: Post-battle auto-capture
    // ============================================================

    async tryAutoCapture(enemyPokemon) {
        if (!this.autoCapture || !enemyPokemon) return false;
        if (enemyPokemon.isAlpha || enemyPokemon.isRaidBoss) return false;

        const isShiny = enemyPokemon.isShiny;
        const rarity = enemyPokemon.rarity || 'common';

        let ballConfig = null;

        // Shiny takes priority - use shiny ball config if enabled
        if (isShiny && this.captureRarities['shiny']) {
            ballConfig = this.captureRarities['shiny'];
        } else if (!isShiny && this.captureRarities[rarity]) {
            ballConfig = this.captureRarities[rarity];
        }

        if (!ballConfig) return false;

        const ballId = ballConfig.ballId;
        if (!ballId) return false;

        try {
            const items = await window.GameData.getInventory();
            const ballInv = items.find(inv => inv.items && inv.items.id === ballId && inv.quantity > 0);
            if (!ballInv) return false;

            const catchRate = this.game.calculateCatchRate(enemyPokemon, ballInv.items);
            const caught = Math.random() < catchRate;
            if (caught) {
                await window.GameData.addItem(ballId, -1);
                const added = await window.GameData.addPokemonToTeam(enemyPokemon);
                return true;
            } else {
                await window.GameData.addItem(ballId, -1);
                return false;
            }
        } catch (e) {
            console.error('[AFK] Capture error:', e);
        }
        return false;
    }

    async setTypeChart(chart) {
        this._typeChart = chart;
    }
}
