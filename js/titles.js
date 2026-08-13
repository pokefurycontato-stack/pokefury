// ============================================================
// TITLE SYSTEM - popups, equipar, exibir
// ============================================================

(function () {
  if (window.Titles) return;

  const Titles = {
    _queue: [],
    _showing: false,

    RARITY_MAP: {
      trainer_beginner: 'common',
      trainer_intermediate: 'uncommon',
      trainer_senior: 'rare',
      trainer_master: 'mythic',
      collector_beginner: 'common',
      collector_dedicated: 'uncommon',
      collector_expert: 'rare',
      collector_master: 'legendary',
      shiny_hunter: 'legendary',
      shiny_legend: 'mythic',
      adventure_begin: 'common',
      vip: 'mythic'
    },

    RARITY_STYLE: {
      common: { color: '#9ca3af', glow: 'none', label: 'Comum' },
      uncommon: { color: '#4ade80', glow: 'none', label: 'Incomum' },
      rare: { color: '#38bdf8', glow: '0 0 6px rgba(56,189,248,0.5)', label: 'Raro' },
      epic: { color: '#c084fc', glow: '0 0 8px rgba(192,132,252,0.6)', label: 'Épico' },
      legendary: { color: '#fbbf24', glow: '0 0 10px rgba(251,191,36,0.8)', label: 'Lendário' },
      mythic: { color: '#ff4d6d', glow: '0 0 14px rgba(255,77,109,0.9)', label: 'Mítico' }
    },

    getRarity(titleId) {
      if (this.RARITY_MAP[titleId]) return this.RARITY_MAP[titleId];
      if (titleId && titleId.startsWith('megamaster_')) return 'mythic';
      if (titleId && titleId.startsWith('gmaxmaster_')) return 'mythic';
      if (titleId && titleId.startsWith('master_')) return 'legendary';
      return 'common';
    },

    getRarityStyle(titleId) {
      return this.RARITY_STYLE[this.getRarity(titleId)] || this.RARITY_STYLE.common;
    },

    // Fila de títulos a exibir (aguarda sair de batalha)
    queueAward(titles) {
      if (!titles || titles.length === 0) return;
      for (const t of titles) this._queue.push(t);
      this._processQueue();
    },

    _processQueue() {
      if (this._showing) return;
      const game = window.pokefury;
      if (game && game.state === 'battle') {
        setTimeout(() => this._processQueue(), 1000);
        return;
      }
      const title = this._queue.shift();
      if (!title) return;
      this._showAwardPopup(title);
    },

    _showAwardPopup(title) {
      this._showing = true;
      const popup = document.createElement('div');
      popup.style.cssText = 'position:fixed;inset:0;z-index:999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
      popup.innerHTML = `
        <div style="background:linear-gradient(135deg,#1a2332,#0d1117);border:2px solid #fbbf24;border-radius:16px;padding:30px;text-align:center;max-width:420px;box-shadow:0 0 40px rgba(251,191,36,0.3);">
          <div style="font-size:36px;margin-bottom:10px;">🏅</div>
          <div style="color:rgba(255,255,255,0.7);font-size:13px;margin-bottom:6px;">Você adquiriu um novo título!</div>
          <div style="color:#fbbf24;font-size:24px;font-weight:800;margin:8px 0;">${escapeHtml(title.name)}</div>
          <button id="title-award-ok" style="margin-top:16px;padding:10px 28px;border-radius:10px;border:none;background:#fbbf24;color:#000;cursor:pointer;font-size:14px;font-weight:700;">OK</button>
        </div>`;
      document.body.appendChild(popup);
      popup.querySelector('#title-award-ok').onclick = () => {
        popup.remove();
        this._showing = false;
        this.refreshProfileTitles();
        this._processQueue();
      };
    },

    refreshProfileTitles() {
      const screen = document.getElementById('profile-screen');
      if (screen && !screen.classList.contains('hidden')) {
        window.profileScreen?.render?.();
      }
    },

    async openTitlesPopup() {
      const charId = window.GameData?.currentCharacterId;
      if (!charId) return;
      const { data: titles, error } = await window.db.rpc('get_earned_titles', { p_character_id: charId });
      if (error) { alert('Erro ao carregar títulos'); return; }
      const list = Array.isArray(titles) ? titles : [];

      const { data: save } = await window.db.from('game_saves').select('equipped_title').eq('id', charId).maybeSingle();
      const equippedId = save?.equipped_title || null;

      const overlay = document.createElement('div');
      overlay.id = 'titles-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:960;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
      overlay.innerHTML = `
        <div style="background:#0d1117;border:1px solid #30363d;border-radius:14px;width:95%;max-width:600px;max-height:85vh;display:flex;flex-direction:column;">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #30363d;">
            <div style="color:#fff;font-size:17px;font-weight:700;">Títulos Conquistados</div>
            <button onclick="document.getElementById('titles-overlay').remove()" style="background:none;border:none;color:#aaa;font-size:22px;cursor:pointer;">✕</button>
          </div>
          <div style="padding:14px;overflow-y:auto;flex:1;">
            ${list.length === 0
              ? '<div style="color:rgba(255,255,255,0.4);text-align:center;padding:40px;">Nenhum título conquistado ainda.</div>'
              : list.map(t => {
                  const style = window.Titles.getRarityStyle(t.id);
                  const isEquipped = t.id === equippedId;
                  const isMythic = style.color === '#ff4d6d';
                  return `
                <div style="display:flex;align-items:center;gap:10px;background:#161b22;border:1px solid ${isEquipped ? style.color : '#30363d'};border-radius:8px;padding:10px 12px;margin-bottom:6px;">
                  <span style="font-size:20px;">🏅</span>
                  <div style="flex:1;min-width:0;">
                    <div class="${isMythic ? 'title-rainbow' : ''}" style="color:${style.color};font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:${isMythic ? '' : style.glow};">${escapeHtml(t.name)}</div>
                    <div style="color:rgba(255,255,255,0.4);font-size:10px;">${style.label}${isEquipped ? ' · Equipado' : ''}</div>
                  </div>
                  ${isEquipped
                    ? '<button style="padding:6px 12px;border-radius:6px;border:none;background:#30363d;color:#999;font-size:11px;cursor:default;">EQUIPADO</button>'
                    : `<button onclick="window.Titles.equipTitle('${t.id}')" style="padding:6px 14px;border-radius:6px;border:none;background:${style.color};color:#000;font-size:11px;font-weight:700;cursor:pointer;">EQUIPAR TÍTULO</button>`}
                </div>`;}).join('')}
          </div>
        </div>`;
      document.body.appendChild(overlay);
    },

    // Últimos N títulos (para os slots do perfil)
    async loadLastTitles(count) {
      const charId = window.GameData?.currentCharacterId;
      if (!charId) return [];
      const { data } = await window.db.rpc('get_earned_titles', { p_character_id: charId });
      if (!Array.isArray(data)) return [];
      return data.slice(0, count);
    },

    async equipTitle(titleId) {
      const charId = window.GameData?.currentCharacterId;
      if (!charId) return;
      const { data, error } = await window.db.rpc('equip_title', { p_character_id: charId, p_title_id: titleId });
      if (error || data?.error) { alert('Erro ao equipar título'); return; }
      const titleName = data?.equipped || null;
      if (window.cityScreen && typeof window.cityScreen.updateEquippedTitle === 'function') {
        await window.cityScreen.updateEquippedTitle(titleId, titleName);
      }
      this.refreshProfileTitles();
      this.openTitlesPopup();
    }
  };

  window.Titles = Titles;
})();
