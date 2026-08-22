const FARM_COLORS = [
    { id: 'vermelha', label: 'Vermelha', level: 1, growMins: 5, xp: 5 },
    { id: 'branca', label: 'Branca', level: 1, growMins: 3, xp: 3 },
    { id: 'verde', label: 'Verde', level: 1, growMins: 5, xp: 5 },
    { id: 'azul', label: 'Azul', level: 2, growMins: 10, xp: 8 },
    { id: 'preta', label: 'Preta', level: 2, growMins: 10, xp: 8 },
    { id: 'marrom', label: 'Marrom', level: 3, growMins: 10, xp: 8 },
    { id: 'rosa', label: 'Rosa', level: 3, growMins: 10, xp: 8 },
    { id: 'laranja', label: 'Laranja', level: 4, growMins: 10, xp: 8 },
    { id: 'roxa', label: 'Roxa', level: 4, growMins: 10, xp: 8 },
    { id: 'ciano', label: 'Ciano', level: 5, growMins: 10, xp: 8 },
    { id: 'cinza', label: 'Cinza', level: 5, growMins: 10, xp: 8 },
    { id: 'amarela', label: 'Amarela', level: 6, growMins: 10, xp: 12 }
];

const FARM_LEVEL_XP = [0, 50, 150, 350, 700, 1200];

const FARM_TIER_HARVESTS = [0, 30, 100];

const FARM_TIER_AMOUNTS = [1, 5, 10];

const FARM_COLOR_CSS = {
    vermelha: '#e53935', branca: '#e0e0e0', verde: '#43a047',
    azul: '#1e88e5', preta: '#333333', marrom: '#8d6e63',
    rosa: '#ec407a', laranja: '#fb8c00', roxa: '#8e24aa',
    ciano: '#00bcd4', cinza: '#90a4ae', amarela: '#fdd835'
};

class FarmManager {
    constructor(game) {
        this.game = game;
        this.farmData = null;
        this.plots = [];
        this.tiers = [];
        this.inventory = [];
        this._intervalId = null;
        this._nearPlotIdx = -1;
        this._farmMode = false;
    }

    async init() {
        try {
            const { data, error } = await window.db.rpc('init_farm');
            if (error) console.warn('[Farm] init error:', error);
        } catch (e) {
            console.warn('[Farm] init failed:', e);
        }
    }

    async loadFarmData() {
        try {
            const { data, error } = await window.db.rpc('get_farm_data');
            if (error) throw error;
            if (data) {
                this.farmData = data.farm || null;
                this.plots = data.plots || [];
                this.tiers = data.tiers || [];
                this.inventory = data.inventory || [];
            }
        } catch (e) {
            console.warn('[Farm] loadFarmData error:', e);
        }
    }

    getLevel() {
        return this.farmData?.level || 1;
    }

    getXP() {
        return this.farmData?.xp || 0;
    }

    getNextLevelXP() {
        const lvl = this.getLevel();
        if (lvl >= 6) return Infinity;
        return FARM_LEVEL_XP[lvl] || 999999;
    }

    getTierForColor(color) {
        const t = this.tiers.find(t => t.color === color);
        return t ? t.tier : 1;
    }

    getHarvestCountForColor(color) {
        const t = this.tiers.find(t => t.color === color);
        return t ? t.harvest_count : 0;
    }

    isColorUnlocked(color) {
        const cfg = FARM_COLORS.find(c => c.id === color);
        return cfg ? this.getLevel() >= cfg.level : false;
    }

    getPlotStatus(plotIndex) {
        const p = this.plots.find(p => p.plot_index === plotIndex);
        if (!p) return { status: 'empty', color: '' };
        if (p.status === 'ready') return { status: 'ready', color: p.color, readyAt: p.ready_at };
        if (p.status === 'growing') {
            const readyAt = new Date(p.ready_at).getTime();
            const now = Date.now();
            if (now >= readyAt) return { status: 'ready', color: p.color, readyAt: p.ready_at };
            return { status: 'growing', color: p.color, readyAt: p.ready_at, remainingMs: readyAt - now };
        }
        return { status: 'empty', color: '' };
    }

    getPlotColorName(plotIndex) {
        const p = this.plots.find(p => p.plot_index === plotIndex);
        return p ? p.color : '';
    }

    async plantBerry(plotIndex, color) {
        try {
            const { data, error } = await window.db.rpc('plant_berry', {
                p_plot_index: plotIndex,
                p_color: color
            });
            if (error) throw error;
            if (data?.error) return { error: data.error };
            await this.loadFarmData();
            return { ok: true, readyAt: data.ready_at };
        } catch (e) {
            console.warn('[Farm] plantBerry error:', e);
            return { error: e.message || 'Plant failed' };
        }
    }

    async harvestBerry(plotIndex) {
        try {
            const { data, error } = await window.db.rpc('harvest_berry', {
                p_plot_index: plotIndex
            });
            if (error) throw error;
            if (data?.error) return { error: data.error };
            await this.loadFarmData();
            return data;
        } catch (e) {
            console.warn('[Farm] harvestBerry error:', e);
            return { error: e.message || 'Harvest failed' };
        }
    }

    getInventory() {
        return this.inventory || [];
    }

    getInventoryForColor(color) {
        const inv = this.inventory.find(i => i.color === color);
        return inv ? inv.quantity : 0;
    }

    startTimer(callback) {
        this.stopTimer();
        this._intervalId = setInterval(() => {
            if (callback) callback();
        }, 1000);
    }

    stopTimer() {
        if (this._intervalId) {
            clearInterval(this._intervalId);
            this._intervalId = null;
        }
    }

    getPlotSpriteUrl(plotIndex) {
        const ps = this.getPlotStatus(plotIndex);
        const baseUrl = 'assets/fazenda/';
        if (ps.status === 'empty') return baseUrl + 'sembarry.png';
        if (ps.status === 'growing') return baseUrl + 'folhassembarry.png';
        if (ps.status === 'ready') return baseUrl + 'barry' + ps.color + '.png';
        return baseUrl + 'sembarry.png';
    }

    getBerryIconUrl(color) {
        return 'assets/fazenda/icobarry' + color + '.png';
    }

    getBerrySpriteUrl(color) {
        return 'assets/fazenda/barry' + color + '.png';
    }

    getPreviewSpriteUrl(plotIndex, color) {
        if (color) return 'assets/fazenda/barry' + color + '.png';
        return 'assets/fazenda/sembarry.png';
    }
}

export { FARM_COLORS, FARM_LEVEL_XP, FARM_TIER_HARVESTS, FARM_TIER_AMOUNTS, FARM_COLOR_CSS, FarmManager };

if (typeof window !== 'undefined') {
    window.FARM_COLORS = FARM_COLORS;
    window.FARM_COLOR_CSS = FARM_COLOR_CSS;
    window.FARM_LEVEL_XP = FARM_LEVEL_XP;
}
