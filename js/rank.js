/* =============================================================
   rank.js — Sistema de Rank (top 3)
   Poder total, IV, e Treinadores por nivel.
   Atualiza a cada 5 minutos.
   ============================================================= */

class RankSystem {
  constructor() {
    this.data = { power: [], iv: [], trainer: [] };
    this.lastUpdated = null;
    this._timer = null;
    this.listeners = [];
  }

  start() {
    this.refresh();
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => this.refresh(), 5 * 60 * 1000);
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  onChange(fn) {
    this.listeners.push(fn);
  }

  _emit() {
    this.listeners.forEach(fn => { try { fn(this.data); } catch (e) {} });
  }

  async refresh() {
    if (!window.db) return;
    try {
      const [power, iv, trainer] = await Promise.all([
        window.db.rpc('get_rank_power'),
        window.db.rpc('get_rank_iv'),
        window.db.rpc('get_rank_trainer')
      ]);

      this.data.power = (power.data && !power.error) ? (power.data || []) : [];
      this.data.iv = (iv.data && !iv.error) ? (iv.data || []) : [];
      this.data.trainer = (trainer.data && !trainer.error) ? (trainer.data || []) : [];
      this.lastUpdated = Date.now();
      this._emit();
    } catch (e) {
      console.warn('[Rank] refresh error:', e);
    }
  }

  getByType(type) {
    return this.data[type] || [];
  }
}

window.rankSystem = new RankSystem();
