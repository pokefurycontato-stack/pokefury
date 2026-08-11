/* =============================================================
   profile-admin.js — Editor do layout do Perfil
   Abre a imagem perfil.png e permite posicionar (desenhar) onde
   cada elemento será exibido. Salva as posições em profile_layout.
   ============================================================= */

const PROFILE_ELEMENTS_META = [
  { key: 'sprite',      label: 'Foto do Sprite' },
  { key: 'name',        label: 'Nome' },
  { key: 'level',       label: 'Nivel' },
  { key: 'silver',      label: 'Prata' },
  { key: 'gold',        label: 'Ouro' },
  { key: 'diamond',     label: 'Diamante' },
  { key: 'badges',      label: 'Insignias' },
  { key: 'badgesPrev',  label: 'Insignias (regiao anterior)' },
  { key: 'badgesNext',  label: 'Insignias (proxima regiao)' },
  { key: 'title1',      label: 'Titulo 1' },
  { key: 'title2',      label: 'Titulo 2' },
  { key: 'title3',      label: 'Titulo 3' },
  { key: 'title4',      label: 'Titulo 4' },
  { key: 'title5',      label: 'Titulo 5' },
  { key: 'titlesMore',  label: 'Botao mais titulos (+)' },
  { key: 'benefits',    label: 'Beneficios' },
  { key: 'logout',      label: 'Sair da conta' },
  { key: 'switchChar',  label: 'Trocar de personagem' },
  { key: 'closeBtn',    label: 'Fechar perfil (X)' }
];

const PROFILE_DEFAULT_SIZE = {
  sprite:      { w: 120, h: 120 },
  name:        { w: 200, h: 32 },
  level:       { w: 120, h: 28 },
  silver:      { w: 160, h: 26 },
  gold:        { w: 160, h: 26 },
  diamond:     { w: 160, h: 26 },
  badges:      { w: 260, h: 120 },
  badgesPrev:  { w: 40, h: 40 },
  badgesNext:  { w: 40, h: 40 },
  title1:      { w: 200, h: 24 },
  title2:      { w: 200, h: 24 },
  title3:      { w: 200, h: 24 },
  title4:      { w: 200, h: 24 },
  title5:      { w: 200, h: 24 },
  titlesMore:  { w: 40, h: 40 },
  benefits:    { w: 220, h: 300 },
  logout:      { w: 160, h: 36 },
  switchChar:  { w: 160, h: 36 },
  closeBtn:    { w: 40, h: 40 }
};

class ProfileAdmin {
  constructor() {
    this.isOpen = false;
    this.config = null;
    this.bgNatural = { w: 1, h: 1 };
    this.tool = null;          // elemento a ser posicionado (chave)
    this.selected = null;      // chave selecionada
    this._drag = null;         // estado de arrasto
    this.elemMeta = {};
    PROFILE_ELEMENTS_META.forEach(m => { this.elemMeta[m.key] = m; });
    this.init();
  }

  init() {
    if (document.getElementById('profile-admin-screen')) return;
    const root = document.createElement('div');
    root.id = 'profile-admin-screen';
    root.classList.add('hidden');
    root.style.cssText = 'position:fixed;inset:0;z-index:960;background:#0a0e1a;display:flex;flex-direction:column;';

    root.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:linear-gradient(135deg,#38bdf8,#6366f1);border-bottom:1px solid #30363d;">
        <h2 style="margin:0;color:#fff;font-size:16px;">🖼️ Perfil - Posicionar Elementos</h2>
        <div style="display:flex;gap:8px;align-items:center;">
          <span style="color:rgba(255,255,255,0.8);font-size:11px;">Selecione um item e arraste no canvas para desenhar o tamanho. Arraste para mover. Alcinhas nos cantos para redimensionar. Del para remover.</span>
          <button id="pa-reset-btn" style="padding:6px 12px;border:none;border-radius:6px;background:rgba(255,255,255,0.15);color:#fff;font-size:12px;cursor:pointer;">↺ Reset</button>
          <button id="pa-save-btn" style="padding:6px 14px;border:none;border-radius:6px;background:#22c55e;color:#fff;font-size:12px;font-weight:700;cursor:pointer;">💾 Salvar</button>
          <button id="pa-close-btn" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;">✕</button>
        </div>
      </div>
      <div style="display:flex;flex:1;overflow:hidden;">
        <div id="pa-toolbar" style="width:210px;background:#161b22;border-right:1px solid #30363d;padding:10px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;"></div>
        <div id="pa-canvas-wrap" style="flex:1;position:relative;overflow:auto;background:#1a1a2e;display:flex;align-items:center;justify-content:center;padding:20px;">
          <div id="pa-stage" style="position:relative;">
            <img id="pa-bg" alt="Perfil" style="display:block;width:100%;height:auto;user-select:none;">
            <div id="pa-markers" style="position:absolute;inset:0;pointer-events:none;"></div>
          </div>
        </div>
        <div id="pa-props" style="width:220px;background:#161b22;border-left:1px solid #30363d;padding:12px;overflow-y:auto;">
          <div style="color:rgba(255,255,255,0.6);font-size:11px;font-weight:700;margin-bottom:8px;text-transform:uppercase;">Propriedades</div>
          <div id="pa-props-content" style="color:rgba(255,255,255,0.4);font-size:12px;">Selecione um elemento</div>
        </div>
      </div>`;
    document.body.appendChild(root);

    this.buildToolbar();
    this.bindEvents();
  }

  buildToolbar() {
    const tb = document.getElementById('pa-toolbar');
    tb.innerHTML = '';
    PROFILE_ELEMENTS_META.forEach(m => {
      const btn = document.createElement('button');
      btn.id = 'pa-tool-' + m.key;
      btn.textContent = m.label;
      btn.style.cssText = 'padding:8px;border:none;border-radius:6px;background:rgba(255,255,255,0.1);color:#fff;font-size:12px;cursor:pointer;text-align:left;transition:background 0.15s;';
      btn.addEventListener('click', () => this.pickTool(m.key));
      tb.appendChild(btn);
    });
  }
bindEvents() {
    document.getElementById('pa-close-btn').addEventListener('click', () => this.close());
    document.getElementById('pa-save-btn').addEventListener('click', () => this.save());
    document.getElementById('pa-reset-btn').addEventListener('click', () => this.resetToDefault());

    document.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.key === 'Escape') { this.close(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selected) {
        e.preventDefault();
        this.deleteSelected();
      }
    });

    const stage = document.getElementById('pa-stage');
    stage.addEventListener('mousedown', (e) => this.onStageMouseDown(e));
    window.addEventListener('mousemove', (e) => this.onStageMouseMove(e));
    window.addEventListener('mouseup', () => this.onStageMouseUp());
  }

  async open() {
    this.isOpen = true;
    document.getElementById('profile-admin-screen').classList.remove('hidden');
    await this.loadConfig();
    await this.loadImage();
    this.renderMarkers();
    this.renderProps();
  }

  close() {
    this.isOpen = false;
    this.tool = null;
    this.selected = null;
    document.getElementById('profile-admin-screen').classList.add('hidden');
  }

  async loadConfig() {
    let cfg = null;
    if (window.db) {
      try {
        const { data } = await window.db.from('profile_layout').select('config').eq('id', 1).maybeSingle();
        if (data && data.config && data.config.elements) cfg = data.config;
      } catch (e) { console.error('[ProfileAdmin] loadConfig:', e); }
    }
    this.config = cfg || { bg: 'assets/ferramentas/perfil.png', elements: {} };
    PROFILE_ELEMENTS_META.forEach(m => {
      if (!this.config.elements[m.key]) {
        const s = PROFILE_DEFAULT_SIZE[m.key] || { w: 100, h: 40 };
        this.config.elements[m.key] = { x: 20, y: 20, w: s.w, h: s.h };
      }
    });
  }

  async loadImage() {
    const bg = document.getElementById('pa-bg');
    bg.src = this.config.bg || 'assets/ferramentas/perfil.png';
    await new Promise((resolve) => {
      if (bg.complete && bg.naturalWidth) return resolve();
      bg.onload = resolve;
      bg.onerror = resolve;
    });
    this.bgNatural = { w: bg.naturalWidth || 1, h: bg.naturalHeight || 1 };
    const wrap = document.getElementById('pa-canvas-wrap');
    const maxW = (wrap.clientWidth || 800) - 40;
    const maxH = (wrap.clientHeight || 600) - 40;
    let w = this.bgNatural.w;
    let h = this.bgNatural.h;
    const scale = Math.min(1, maxW / w, maxH / h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
    const stage = document.getElementById('pa-stage');
    stage.style.width = w + 'px';
    stage.style.height = h + 'px';
  }

  toolBtn(key) { return document.getElementById('pa-tool-' + key); }

  pickTool(key) {
    this.tool = (this.tool === key) ? null : key;
    this.syncToolUI();
  }

  stageToImage(clientX, clientY) {
    const stage = document.getElementById('pa-stage');
    const rect = stage.getBoundingClientRect();
    const x = Math.round((clientX - rect.left) / rect.width * this.bgNatural.w);
    const y = Math.round((clientY - rect.top) / rect.height * this.bgNatural.h);
    return { x: Math.max(0, x), y: Math.max(0, y) };
  }

  onStageMouseDown(e) {
    if (e.target && e.target.classList && e.target.classList.contains('pa-marker')) {
      const key = e.target.dataset.key;
      const r = this.config.elements[key];
      if (!r) return;
      if (e.target.classList.contains('pa-resize')) {
        const p = this.stageToImage(e.clientX, e.clientY);
        this._resize = { key, startX: p.x, startY: p.y, origW: r.w, origH: r.h, handle: e.target.dataset.handle };
        this.selected = key;
        this.renderMarkers();
        this.renderProps();
        return;
      }
      this.selected = key;
      this.tool = null;
      this.syncToolUI();
      const p = this.stageToImage(e.clientX, e.clientY);
      this._drag = { key, dx: p.x - r.x, dy: p.y - r.y };
      this.renderMarkers();
      this.renderProps();
      return;
    }
    if (this.tool) {
      const p = this.stageToImage(e.clientX, e.clientY);
      this._drawing = { key: this.tool, startX: p.x, startY: p.y };
      this.selected = this.tool;
      this.syncToolUI();
    }
  }

  onStageMouseMove(e) {
    if (this._drawing) {
      const p = this.stageToImage(e.clientX, e.clientY);
      const d = this._drawing;
      const x = Math.min(d.startX, p.x);
      const y = Math.min(d.startY, p.y);
      const w = Math.abs(p.x - d.startX);
      const h = Math.abs(p.y - d.startY);
      this.config.elements[d.key] = { x, y, w, h };
      this.renderMarkers();
      this.renderProps();
      return;
    }
    if (this._resize) {
      const p = this.stageToImage(e.clientX, e.clientY);
      const rs = this._resize;
      const r = this.config.elements[rs.key];
      if (!r) return;
      const dx = p.x - rs.startX;
      const dy = p.y - rs.startY;
      if (rs.handle === 'se') { r.w = Math.max(10, rs.origW + dx); r.h = Math.max(10, rs.origH + dy); }
      else if (rs.handle === 'sw') { r.x = rs.origW > -dx ? rs.startX - rs.origW - dx + rs.origW : 10; r.w = Math.max(10, rs.origW + dx); r.h = Math.max(10, rs.origH + dy); }
      else if (rs.handle === 'ne') { r.w = Math.max(10, rs.origW + dx); r.y = rs.origH > -dy ? rs.startY - rs.origH - dy + rs.origH : 10; r.h = Math.max(10, rs.origH + dy); }
      else if (rs.handle === 'nw') { r.x = rs.origW > -dx ? rs.startX - rs.origW - dx + rs.origW : 10; r.w = Math.max(10, rs.origW + dx); r.y = rs.origH > -dy ? rs.startY - rs.origH - dy + rs.origH : 10; r.h = Math.max(10, rs.origH + dy); }
      this.renderMarkers();
      this.renderProps();
      return;
    }
    if (this._drag) {
      const key = this._drag.key;
      const r = this.config.elements[key];
      if (!r) return;
      const p = this.stageToImage(e.clientX, e.clientY);
      r.x = Math.max(0, p.x - this._drag.dx);
      r.y = Math.max(0, p.y - this._drag.dy);
      this.renderMarkers();
      if (this.selected === key) this.renderProps();
    }
  }

  onStageMouseUp() {
    if (this._drawing) {
      const d = this._drawing;
      const r = this.config.elements[d.key];
      if (r && r.w < 5 && r.h < 5) {
        delete this.config.elements[d.key];
        this.selected = null;
      } else {
        this.selected = d.key;
      }
      this._drawing = null;
      this.renderMarkers();
      this.renderProps();
    }
    this._drag = null;
    this._resize = null;
  }

  syncToolUI() {
    PROFILE_ELEMENTS_META.forEach(m => {
      const b = this.toolBtn(m.key);
      if (b) b.style.background = (m.key === this.tool) ? '#38bdf8' : 'rgba(255,255,255,0.1)';
    });
  }
renderMarkers() {
    const wrap = document.getElementById('pa-markers');
    wrap.innerHTML = '';
    const ele = this.config.elements;
    PROFILE_ELEMENTS_META.forEach(m => {
      const r = ele[m.key];
      if (!r || (!r.w && !r.h)) return;
      const sel = m.key === this.selected;
      const d = document.createElement('div');
      d.className = 'pa-marker';
      d.dataset.key = m.key;
      d.style.cssText = `position:absolute;left:${r.x / this.bgNatural.w * 100}%;top:${r.y / this.bgNatural.h * 100}%;width:${r.w / this.bgNatural.w * 100}%;height:${r.h / this.bgNatural.h * 100}%;box-sizing:border-box;border:2px dashed ${sel ? '#38bdf8' : 'rgba(56,189,248,0.55)'};background:${sel ? 'rgba(56,189,248,0.18)' : 'rgba(56,189,248,0.08)'};pointer-events:auto;cursor:move;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;text-align:center;overflow:hidden;`;
      d.textContent = m.label;
      d.addEventListener('mousedown', (e) => this.onStageMouseDown(e));
      if (sel) {
        const handles = [
          { pos: 'top:0;left:0;cursor:nw-resize;', handle: 'nw' },
          { pos: 'top:0;right:0;cursor:ne-resize;', handle: 'ne' },
          { pos: 'bottom:0;left:0;cursor:sw-resize;', handle: 'sw' },
          { pos: 'bottom:0;right:0;cursor:se-resize;', handle: 'se' }
        ];
        handles.forEach(h => {
          const hd = document.createElement('div');
          hd.className = 'pa-resize';
          hd.dataset.handle = h.handle;
          hd.style.cssText = `position:absolute;width:8px;height:8px;background:#38bdf8;border:1px solid #fff;pointer-events:auto;z-index:2;${h.pos}`;
          hd.addEventListener('mousedown', (e) => { e.stopPropagation(); this.onStageMouseDown(e); });
          d.appendChild(hd);
        });
      }
      wrap.appendChild(d);
    });
  }

  deleteSelected() {
    if (!this.selected) return;
    delete this.config.elements[this.selected];
    this.selected = null;
    this.renderMarkers();
    this.renderProps();
  }

  renderProps() {
    const el = document.getElementById('pa-props-content');
    if (!this.selected || !this.config.elements[this.selected]) { el.innerHTML = 'Selecione um elemento'; return; }
    const r = this.config.elements[this.selected];
    const meta = this.elemMeta[this.selected];
    el.innerHTML = `
      <div style="color:#38bdf8;font-weight:700;font-size:13px;margin-bottom:8px;">${meta.label}</div>
      <label style="color:rgba(255,255,255,0.5);font-size:11px;">X<input type="number" value="${r.x}" onchange="window.profileAdmin.updateElem('x', this.value)" style="width:100%;padding:6px;border-radius:6px;border:1px solid #30363d;background:#0d1117;color:#fff;font-size:12px;box-sizing:border-box;margin-top:2px;"></label>
      <div style="height:6px;"></div>
      <label style="color:rgba(255,255,255,0.5);font-size:11px;">Y<input type="number" value="${r.y}" onchange="window.profileAdmin.updateElem('y', this.value)" style="width:100%;padding:6px;border-radius:6px;border:1px solid #30363d;background:#0d1117;color:#fff;font-size:12px;box-sizing:border-box;margin-top:2px;"></label>
      <div style="height:6px;"></div>
      <label style="color:rgba(255,255,255,0.5);font-size:11px;">Largura<input type="number" value="${r.w}" onchange="window.profileAdmin.updateElem('w', this.value)" style="width:100%;padding:6px;border-radius:6px;border:1px solid #30363d;background:#0d1117;color:#fff;font-size:12px;box-sizing:border-box;margin-top:2px;"></label>
      <div style="height:6px;"></div>
      <label style="color:rgba(255,255,255,0.5);font-size:11px;">Altura<input type="number" value="${r.h}" onchange="window.profileAdmin.updateElem('h', this.value)" style="width:100%;padding:6px;border-radius:6px;border:1px solid #30363d;background:#0d1117;color:#fff;font-size:12px;box-sizing:border-box;margin-top:2px;"></label>
      <div style="height:10px;"></div>
      <button onclick="window.profileAdmin.deleteSelected()" style="width:100%;padding:8px;border:none;border-radius:6px;background:#e94560;color:#fff;font-size:12px;cursor:pointer;">Remover</button>
    `;
  }

  updateElem(field, value) {
    if (!this.selected || !this.config.elements[this.selected]) return;
    const num = parseInt(value, 10);
    this.config.elements[this.selected][field] = Number.isFinite(num) ? num : 0;
    this.renderMarkers();
    this.renderProps();
  }

  resetToDefault() {
    this.config.elements = {};
    PROFILE_ELEMENTS_META.forEach(m => {
      const s = PROFILE_DEFAULT_SIZE[m.key] || { w: 100, h: 40 };
      this.config.elements[m.key] = { x: 20, y: 20, w: s.w, h: s.h };
    });
    this.selected = null;
    this.renderMarkers();
    this.renderProps();
  }

  async save() {
    const btn = document.getElementById('pa-save-btn');
    btn.textContent = 'Salvando...';
    try {
      const payload = { bg: this.config.bg, elements: this.config.elements };
      const { error } = await window.db.from('profile_layout').upsert(
        { id: 1, config: payload, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      );
      if (error) throw error;
      btn.textContent = '✓ Salvo';
    } catch (e) {
      console.error('[ProfileAdmin] save error:', e);
      btn.textContent = 'Erro ao salvar';
    }
    setTimeout(() => { btn.textContent = '💾 Salvar'; }, 1500);
  }
}

window.profileAdmin = new ProfileAdmin();