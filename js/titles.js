// ============================================================
// TITLE SYSTEM - popups, equipar, exibir
// ============================================================

(function () {
  if (window.Titles) return;

  const Titles = {
    _queue: [],
    _showing: false,

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
        this._processQueue();
      };
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
              : list.map(t => `
                <div style="display:flex;align-items:center;gap:10px;background:#161b22;border:1px solid ${t.id === equippedId ? '#fbbf24' : '#30363d'};border-radius:8px;padding:10px 12px;margin-bottom:6px;">
                  <span style="font-size:20px;">🏅</span>
                  <div style="flex:1;min-width:0;">
                    <div style="color:#fff;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(t.name)}</div>
                    ${t.id === equippedId ? '<div style="color:#fbbf24;font-size:10px;">Equipado</div>' : ''}
                  </div>
                  ${t.id === equippedId
                    ? '<button style="padding:6px 12px;border-radius:6px;border:none;background:#30363d;color:#999;font-size:11px;cursor:default;">EQUIPADO</button>'
                    : `<button onclick="window.Titles.equipTitle('${t.id}')" style="padding:6px 14px;border-radius:6px;border:none;background:#fbbf24;color:#000;font-size:11px;font-weight:700;cursor:pointer;">EQUIPAR TÍTULO</button>`}
                </div>`).join('')}
          </div>
        </div>`;
      document.body.appendChild(overlay);
    },

    async equipTitle(titleId) {
      const charId = window.GameData?.currentCharacterId;
      if (!charId) return;
      const { data, error } = await window.db.rpc('equip_title', { p_character_id: charId, p_title_id: titleId });
      if (error || data?.error) { alert('Erro ao equipar título'); return; }
      document.getElementById('titles-overlay')?.remove();
      this.openTitlesPopup();
    }
  };

  window.Titles = Titles;
})();
