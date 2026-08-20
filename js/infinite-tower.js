/* =============================================================
   infinite-tower.js — Mestre da Torre
   ============================================================= */

export class InfiniteTowerManager {
    constructor(game) {
        this.game = game;
        this.layout = { npc: null, entry: null, wild: null, rank: null };
        this.currentFloor = 1;
        this.bestFloor = 1;
        this.rank = [];
        this._towerActive = false;
        this.currentTeam = null;
        this._floorReady = false;
    }

    async loadLayout() {
        const tables = { npc: 'city_tower_npc', entry: 'city_tower_entry', wild: 'city_tower_wild', rank: 'city_tower_rank', exit: 'city_tower_exit' };
        const out = {};
        for (const key in tables) {
            try {
                const { data } = await window.db.from(tables[key]).select('*').limit(1).maybeSingle();
                out[key] = data || null;
            } catch (e) { out[key] = null; }
        }
        this.layout = out;
        return out;
    }

    async loadProgress() {
        const charId = window.GameData?.currentCharacterId;
        if (!charId) { this.currentFloor = 1; this.bestFloor = 1; return; }
        try {
            const { data } = await window.db.from('infinite_tower_progress')
                .select('floor, best_floor')
                .eq('character_id', charId)
                .limit(1);
            const row = (data && data[0]) || {};
            this.currentFloor = 1;
            this.bestFloor = Math.max(1, Number(row.best_floor) || 1);
        } catch (e) { this.currentFloor = 1; this.bestFloor = 1; }
    }

    async saveProgress(reachedFloor) {
        const charId = window.GameData?.currentCharacterId;
        const userId = window.GameData?.userId || null;
        if (!charId) return;
        if (reachedFloor) this.bestFloor = Math.max(this.bestFloor, reachedFloor);
        try {
            await window.db.rpc('set_tower_progress', {
                p_character_id: charId,
                p_user_id: userId,
                p_floor: reachedFloor || this.bestFloor
            });
        } catch (e) {}
    }

    getFloorTeam(floorNumber) {
        try {
            return window.db.rpc('get_tower_floor', { p_floor_number: Math.min(Math.max(1, Number(floorNumber) || 1), 1000) })
                .then(r => r.data || []);
        } catch (e) { return Promise.resolve([]); }
    }

    async beginRun(fromFloor = 1) {
        await this.loadProgress();
        this.currentFloor = Math.max(1, Number(fromFloor) || 1);
        this._towerActive = true;
        const team = this.game?.playerTeam;
        if (team) {
            for (const p of team) {
                if (p?.moves) p.moves.forEach(m => { if (m) m.currentPp = m.pp || 35; });
            }
        }
        this.startCurrentFloor();
    }

    async startCurrentFloor() {
        const game = this.game;
        if (!game || game.state === 'battle' || game._battleStarting || game._battleEnding) return;
        if (!this._towerActive) return;
        const team = await this.getFloorTeam(this.currentFloor);
        if (!team || team.length === 0) {
            this._towerActive = false;
            if (game.showToast) game.showToast('Rematada a Torre!', 'success');
            this.onTowerLeft(false);
            return;
        }
        this.currentTeam = team;
        this._floorReady = true;
        if (window.cityScreen?.showTowerWildPokemon) window.cityScreen.showTowerWildPokemon(this.currentFloor, team);
    }

    startFloorBattle() {
        if (!this._towerActive || !this._floorReady || !this.currentTeam) return;
        const game = this.game;
        if (game && (game.state === 'battle' || game._battleStarting || game._battleEnding)) return;
        const team = this.currentTeam;
        const floor = this.currentFloor;
        this._floorReady = false;
        this.currentTeam = null;
        if (game && game.startTowerBattle) game.startTowerBattle(floor, team);
    }

    onFloorCleared(clearedFloor) {
        this.saveProgress(clearedFloor);
        if (clearedFloor >= 1000) {
            if (this.game?.showToast) this.game.showToast('Venciches a Torre Infinita! 🏆', 'success');
            this.onTowerLeft(false);
            return;
        }
        setTimeout(() => {
            if (!this._towerActive) return;
            this.currentFloor += 1;
            this.startCurrentFloor();
        }, 400);
    }

    onTowerLeft() {
        this._towerActive = false;
        this.currentFloor = 1;
        this._floorReady = false;
        this.currentTeam = null;
        const game = this.game;
        if (game) {
            game._inTower = false;
            game._towerFloor = null;
            game._isTowerBattle = false;
        }
        if (window.cityScreen?.hideTowerWildPokemon) window.cityScreen.hideTowerWildPokemon();
        if (window.cityScreen?.teleportToTowerNpc) window.cityScreen.teleportToTowerNpc();
    }

    async fetchRank(limit = 5) {
        try {
            const { data } = await window.db.rpc('get_tower_rank', { p_limit: limit });
            this.rank = data || [];
            return this.rank;
        } catch (e) { return []; }
    }

    async getMyRank() {
        const charId = window.GameData?.currentCharacterId;
        if (!charId) return null;
        try {
            const { data } = await window.db.rpc('get_my_tower_progress', { p_character_id: charId });
            return (data && data[0]) || null;
        } catch (e) { return null; }
    }

    escapeHtml(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}