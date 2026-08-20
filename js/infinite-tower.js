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

    async beginRun() {
        await this.loadProgress();
        this.currentFloor = 1;
        this._towerActive = true;
        this.startCurrentFloor();
    }

    startCurrentFloor() {
        const game = this.game;
        if (!game || game.state === 'battle' || game._battleStarting || game._battleEnding) return;
        if (!this._towerActive) return;
        this.getFloorTeam(this.currentFloor).then((team) => {
            if (!team || team.length === 0) {
                this._towerActive = false;
                if (game.showToast) game.showToast('Rematada a Torre!', 'success');
                this.onTowerLeft(false);
                return;
            }
            if (game.startTowerBattle) game.startTowerBattle(this.currentFloor, team);
        });
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
        const game = this.game;
        if (game) {
            game._inTower = false;
            game._towerFloor = null;
            game._isTowerBattle = false;
        }
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