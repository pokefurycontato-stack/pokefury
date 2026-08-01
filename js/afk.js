import { getFirstAlive } from './battle.js';

export class AFKManager {
    constructor(game) {
        this.game = game;
        this.running = false;
        this.autoSearch = false;
        this.autoBattle = false;
        this.autoHeal = false;
        this.autoCapture = false;
        this.healThreshold = 40;
        this.captureRarities = {};
        this._walkPath = [];
        this._walkIndex = 0;
        this._walkDir = null;
        this._state = 'idle';
        this._loopTimer = null;
        this._battleResult = null;
    }

    start() {
        if (this.running) return;
        this.running = true;
        this._state = 'idle';
        this._loopTick();
    }

    stop() {
        this.running = false;
        this._state = 'idle';
        this._walkPath = [];
        if (this._loopTimer) { clearTimeout(this._loopTimer); this._loopTimer = null; }
    }

    async _loopTick() {
        if (!this.running) return;
        try {
            const game = this.game;
            if (game.state === 'battle' && this.autoBattle) {
                await this._handleBattle();
            } else if (game.state === 'overworld') {
                if (this.autoSearch) {
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

    // ============================================================
    // OVERWORLD: Walk to nearest Pokemon
    // ============================================================

    async _handleOverworld() {
        const ow = this.game.overworld2d;
        if (!ow || this.game.state !== 'overworld') return;
        if (ow.player.moving || ow.moveCooldown > 0) return;

        if (this._walkPath.length > 0 && this._walkIndex < this._walkPath.length) {
            const next = this._walkPath[this._walkIndex];
            const dx = next.x - ow.player.x;
            const dy = next.y - ow.player.y;
            if (dx === 0 && dy === 0) {
                this._walkIndex++;
                return;
            }
            let dir = null;
            if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 'right' : 'left';
            else dir = dy > 0 ? 'down' : 'up';
            const ndx = dir === 'right' ? 1 : dir === 'left' ? -1 : 0;
            const ndy = dir === 'down' ? 1 : dir === 'up' ? -1 : 0;
            ow.keys[dir === 'up' ? 'ArrowUp' : dir === 'down' ? 'ArrowDown' : dir === 'left' ? 'ArrowLeft' : 'ArrowRight'] = true;
            setTimeout(() => {
                ow.keys = {};
            }, 50);
            this._walkIndex++;
            return;
        }

        const target = this._findNearestPokemon(ow);
        if (!target) return;

        const path = this._findPath(ow, { x: ow.player.x, y: ow.player.y }, { x: target.x, y: target.y });
        if (path && path.length > 1) {
            this._walkPath = path.slice(1);
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
    // BATTLE: Smart AI
    // ============================================================

    async _handleBattle() {
        const game = this.game;
        if (game.state !== 'battle') return;
        if (!this.autoBattle) return;

        const playerPokemon = getFirstAlive(game.playerTeam);
        const enemyPokemon = getFirstAlive(game.enemyTeam);
        if (!playerPokemon || !enemyPokemon) return;

        const hpPct = (playerPokemon.currentHp / playerPokemon.stats.hp) * 100;

        if (this.autoHeal && hpPct <= this.healThreshold) {
            const healed = await this._tryHeal(playerPokemon);
            if (healed) return;
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
            const score = this._evaluateMove(attacker, defender, move);
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        if (!bestMove) {
            for (const move of attacker.moves) {
                if (move && move.currentPp > 0) { bestMove = move; break; }
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

    async _tryHeal(pokemon) {
        const hpPct = (pokemon.currentHp / pokemon.stats.hp) * 100;
        if (hpPct > this.healThreshold) return false;

        for (const move of (pokemon.moves || [])) {
            if (!move || move.currentPp <= 0) continue;
            const effect = this._getMoveEffectFast(move);
            if (effect && effect.effect === 'heal') {
                try {
                    const game = this.game;
                    const enemyPokemon = getFirstAlive(game.enemyTeam);
                    if (enemyPokemon) {
                        await game.executeBattleTurn(pokemon, enemyPokemon, move);
                        return true;
                    }
                } catch (e) { return false; }
            }
        }

        for (const move of (pokemon.moves || [])) {
            if (!move || move.currentPp <= 0) continue;
            const effect = this._getMoveEffectFast(move);
            if (effect && effect.effect === 'drain') {
                try {
                    const game = this.game;
                    const enemyPokemon = getFirstAlive(game.enemyTeam);
                    if (enemyPokemon) {
                        await game.executeBattleTurn(pokemon, enemyPokemon, move);
                        return true;
                    }
                } catch (e) { return false; }
            }
        }

        const healed = await this._usePotion(pokemon);
        return healed;
    }

    async _usePotion(pokemon) {
        try {
            const items = await window.GameData.getInventory();
            const healItems = items.filter(inv => inv.items &&
                inv.items.category === 'medicine' &&
                inv.items.subcategory === 'heal' &&
                inv.quantity > 0);
            if (healItems.length === 0) return false;
            healItems.sort((a, b) => (b.items.effect_value || 0) - (a.items.effect_value || 0));
            const hpDeficit = pokemon.stats.hp - pokemon.currentHp;
            for (const inv of healItems) {
                if (inv.items.effect_value >= hpDeficit * 0.5 || inv.items.effect === 'heal_full') {
                    const heal = inv.items.effect === 'heal_full' || inv.items.effect === 'heal_full_status'
                        ? pokemon.stats.hp
                        : Math.min(inv.items.effect_value, hpDeficit);
                    pokemon.currentHp = Math.min(pokemon.stats.hp, pokemon.currentHp + heal);
                    await window.GameData.addItem(inv.items.id, -1);
                    return true;
                }
            }
            if (healItems.length > 0) {
                const best = healItems[0];
                const heal = best.items.effect === 'heal_full' || best.items.effect === 'heal_full_status'
                    ? pokemon.stats.hp
                    : Math.min(best.items.effect_value, hpDeficit);
                pokemon.currentHp = Math.min(pokemon.stats.hp, pokemon.currentHp + heal);
                await window.GameData.addItem(best.items.id, -1);
                return true;
            }
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
        const rarity = enemyPokemon.rarity || 'common';
        if (!this.captureRarities[rarity]) return false;
        if (enemyPokemon.isAlpha || enemyPokemon.isRaidBoss) return false;

        const ballConfig = this.captureRarities[rarity];
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
