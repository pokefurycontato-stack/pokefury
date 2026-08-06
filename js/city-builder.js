class CityBuilder {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.assets = [];
        this.selected = null;
        this.dragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.zoom = 1;
        this.availableAssets = [];
        this.nextId = 1;
        this.running = false;

        this.camX = 0;
        this.camY = 0;
        this.playerX = 400;
        this.playerY = 400;
        this.playerDir = 'down';
        this.playerSkinImg = null;
        this.playerKeys = {};
        this.playerSpeed = 4;
        this.playerSize = 48;
        this.previewMode = false;
        this.layers = [0];
        this.activeLayer = 0;

        this.bindEvents();
    }

    bindEvents() {
        const btn = document.getElementById('admin-btn-city-builder');
        if (btn) btn.addEventListener('click', () => this.open());
        const closeBtn = document.getElementById('cb-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', () => this.close());
        const saveBtn = document.getElementById('cb-save-btn');
        if (saveBtn) saveBtn.addEventListener('click', () => this.save());
        const previewBtn = document.getElementById('cb-preview-btn');
        if (previewBtn) previewBtn.addEventListener('click', () => this.togglePreview());
        const addLayerBtn = document.getElementById('cb-add-layer-btn');
        if (addLayerBtn) addLayerBtn.addEventListener('click', () => this.addLayer());

        document.addEventListener('keydown', (e) => {
            if (!this.running) return;
            const gameKeys = ['w','W','a','A','s','S','d','D','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
            if (gameKeys.includes(e.key)) e.preventDefault();
            this.playerKeys[e.key] = true;
            if ((e.key === 'Delete' || e.key === 'Backspace') && this.selected) {
                e.preventDefault();
                this.assets = this.assets.filter(a => a._id !== this.selected._id);
                this.selected = null;
                this.updateProps();
                this.render();
            }
            if ((e.key === 'r' || e.key === 'R') && this.selected) {
                this.selected.rotation = ((this.selected.rotation || 0) + 90) % 360;
                this.updateProps();
                this.render();
            }
        });
        document.addEventListener('keyup', (e) => {
            this.playerKeys[e.key] = false;
        });
    }

    async open() {
        const game = window.pokefury;
        document.getElementById('city-builder-screen').classList.remove('hidden');
        window.cityModeActive = true;
        this.canvas = document.getElementById('cb-canvas');
        this.ctx = this.canvas.getContext('2d');

        await this.loadPlayerSkin(game);
        await this.loadAssets();
        await this.loadSavedLayout();
        this.renderLayerTabs();

        this.resizeCanvas();
        this.running = true;
        this.loop();

        window._cbResizeHandler = () => this.resizeCanvas();
        window.addEventListener('resize', window._cbResizeHandler);
    }

    close() {
        this.running = false;
        this.previewMode = false;
        window.cityModeActive = false;
        document.getElementById('city-builder-screen').classList.add('hidden');
        if (window._cbResizeHandler) {
            window.removeEventListener('resize', window._cbResizeHandler);
        }
    }

    togglePreview() {
        this.previewMode = !this.previewMode;
        const btn = document.getElementById('cb-preview-btn');
        const sidebar = document.getElementById('cb-assets-panel');
        const props = document.getElementById('cb-props-panel');
        const layersBar = document.getElementById('cb-layers-bar');

        if (this.previewMode) {
            btn.style.background = '#f59e0b';
            btn.style.color = '#000';
            sidebar.style.display = 'none';
            props.style.display = 'none';
            if (layersBar) layersBar.style.display = 'none';
            this.resizeCanvas();
            this.selected = null;
        } else {
            btn.style.background = 'rgba(255,255,255,0.15)';
            btn.style.color = '#fff';
            sidebar.style.display = '';
            props.style.display = '';
            if (layersBar) layersBar.style.display = '';
            this.resizeCanvas();
        }
        this.updateProps();
    }

    renderLayerTabs() {
        const container = document.getElementById('cb-layer-tabs');
        if (!container) return;
        container.innerHTML = this.layers.map(l =>
            `<button data-layer="${l}" style="padding:4px 12px;border:none;border-radius:4px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;${l === this.activeLayer ? 'background:#f59e0b;color:#000;' : 'background:#30363d;color:#c9d1d9;'}">Layer ${l}${l === 0 ? ' (solo)' : ''}</button>`
        ).join('');
        container.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => this.selectLayer(parseInt(btn.dataset.layer)));
        });
    }

    addLayer() {
        const next = this.layers.length > 0 ? Math.max(...this.layers) + 1 : 0;
        this.layers.push(next);
        this.activeLayer = next;
        this.renderLayerTabs();
    }

    selectLayer(id) {
        this.activeLayer = id;
        this.selected = null;
        this.renderLayerTabs();
        this.updateProps();
    }

    async loadPlayerSkin(game) {
        let url = null;
        try {
            const gender = game?.playerGender === 'female' ? 'feminino' : 'masculino';
            url = `assets/perso_${gender}.webp`;
            if (game?.currentCharacterId && window.db) {
                const { data } = await window.db.rpc('get_equipped_skin', {
                    p_character_id: game.currentCharacterId,
                    p_skin_type: 'player_skin'
                });
                if (data && data.length > 0 && data[0].sprite_url) url = data[0].sprite_url;
            }
        } catch (e) {
            url = 'assets/perso_masculino.webp';
        }
        this.playerSkinImg = new Image();
        this.playerSkinImg.src = url;
        await new Promise(r => { this.playerSkinImg.onload = r; this.playerSkinImg.onerror = r; });
    }

    resizeCanvas() {
        const wrap = document.getElementById('cb-canvas-wrap');
        if (!wrap || !this.canvas) return;
        const rect = wrap.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
        }
    }

    async loadAssets() {
        const files = [
            'textgrama.png', 'pedraterreno.png', 'pedraretang.png', 'pedrapeq.png',
            'lago3.png', 'lago2.png', 'lago1.png', 'grama.png',
            'escada.png', 'barro.png', 'barranco.png', 'arvore.png'
        ];
        this.availableAssets = files.map(f => ({
            id: f.replace('.png', ''),
            name: f.replace('.png', ''),
            url: `assets/assetmap/${f}`
        }));
        this.renderAssetList();
    }

    renderAssetList() {
        const list = document.getElementById('cb-assets-list');
        list.innerHTML = this.availableAssets.map(a =>
            `<div class="cb-asset-item" data-id="${a.id}" style="display:flex;align-items:center;gap:8px;padding:6px;cursor:grab;border-radius:6px;border:1px solid #30363d;margin-bottom:4px;transition:border-color 0.2s;">
                <img src="${a.url}" style="width:40px;height:40px;object-fit:contain;border-radius:4px;background:#0d1117;" onerror="this.style.display='none'">
                <span style="color:#c9d1d9;font-size:11px;">${a.name}</span>
            </div>`
        ).join('');

        list.querySelectorAll('.cb-asset-item').forEach(el => {
            el.addEventListener('dblclick', (e) => {
                e.preventDefault();
                this.addAssetAt(el.dataset.id, this.playerX, this.playerY + 60);
            });
            el.addEventListener('mousedown', (e) => {
                if (e.detail >= 2) return;
                this.startDragNew(e, el.dataset.id);
            });
        });
    }

    addAssetAt(assetId, worldX, worldY) {
        const asset = this.availableAssets.find(a => a.id === assetId);
        if (!asset) return;
        const img = new Image();
        img.src = asset.url;
        const item = {
            _id: this.nextId++,
            asset_id: asset.id,
            asset_url: asset.url,
            pos_x: worldX,
            pos_y: worldY,
            scale: 1.0,
            rotation: 0,
            z_index: this.assets.length,
            layer: this.activeLayer,
            _img: img,
            _mask: null,
            _overlay: null
        };
        img.onload = () => {
            this.render();
            if (item.has_collision) {
                item._mask = this.createMask(img);
                item._overlay = this.createOverlay(img);
            }
        };
        this.assets.push(item);
        this.selected = item;
        this.updateProps();
        this.render();
    }

    startDragNew(e, assetId) {
        const w = this.screenToWorld(e.clientX, e.clientY);
        this.addAssetAt(assetId, w.x, w.y);
    }

    getAssetHit(mx, my) {
        for (let i = this.assets.length - 1; i >= 0; i--) {
            const a = this.assets[i];
            if ((a.layer || 0) !== this.activeLayer) continue;
            const img = a._img;
            if (!img || !img.complete || !img.naturalWidth) continue;
            const aw = img.naturalWidth * (a.scale || 1);
            const ah = img.naturalHeight * (a.scale || 1);
            if (mx >= a.pos_x && mx <= a.pos_x + aw && my >= a.pos_y && my <= a.pos_y + ah) {
                return a;
            }
        }
        return null;
    }

    setupInput() {
        this.canvas.onmousedown = (e) => this.onMouseDown(e);
        this.canvas.onmousemove = (e) => this.onMouseMove(e);
        this.canvas.onmouseup = () => { this.dragging = false; };
        this.canvas.onwheel = (e) => this.onWheel(e);
    }

    screenToWorld(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const sx = clientX - rect.left;
        const sy = clientY - rect.top;
        return {
            x: sx / this.zoom + this.camX,
            y: sy / this.zoom + this.camY
        };
    }
    onMouseDown(e) {
        if (this.previewMode) return;
        const w = this.screenToWorld(e.clientX, e.clientY);
        const hit = this.getAssetHit(w.x, w.y);

        if (hit) {
            this.selected = hit;
            this.dragging = true;
            this.dragOffset = { x: w.x - hit.pos_x, y: w.y - hit.pos_y };
        } else if (this.selected) {
            const src = this.selected;
            const img = new Image();
            img.src = src.asset_url;
            const clone = {
                _id: this.nextId++,
                asset_id: src.asset_id,
                asset_url: src.asset_url,
                pos_x: w.x,
                pos_y: w.y,
                scale: src.scale || 1,
                rotation: src.rotation || 0,
                z_index: this.assets.length,
                layer: this.activeLayer,
                _img: img
            };
            img.onload = () => this.render();
            this.assets.push(clone);
            this.selected = clone;
            this.dragging = true;
            this.dragOffset = { x: 0, y: 0 };
        } else {
            this.selected = null;
        }
        this.updateProps();
        this.render();
    }

    onMouseMove(e) {
        if (this.previewMode) return;
        if (!this.dragging || !this.selected) return;
        const w = this.screenToWorld(e.clientX, e.clientY);
        let newX = w.x - this.dragOffset.x;
        let newY = w.y - this.dragOffset.y;
        if (e.shiftKey) {
            newX = Math.round(newX / 32) * 32;
            newY = Math.round(newY / 32) * 32;
        }
        this.selected.pos_x = newX;
        this.selected.pos_y = newY;
        this.updateProps();
        this.render();
    }

    onWheel(e) {
        e.preventDefault();
        if (this.previewMode) return;

        if (e.ctrlKey && this.selected) {
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            this.selected.scale = Math.max(0.1, Math.min(5, (this.selected.scale || 1) + delta));
        } else {
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            this.zoom = Math.max(0.15, Math.min(4, this.zoom + delta));
        }
        this.updateProps();
        this.render();
    }

    updateProps() {
        const el = document.getElementById('cb-props-content');
        if (!this.selected) {
            el.innerHTML = '<span style="color:rgba(255,255,255,0.4)">Selecione um asset</span>';
            return;
        }
        const s = this.selected;
        const imgW = s._img?.naturalWidth || '?';
        const imgH = s._img?.naturalHeight || '?';
        el.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:8px;">
                <div style="color:#f59e0b;font-weight:700;font-size:13px;">${s.asset_id}</div>
                <div style="color:rgba(255,255,255,0.3);font-size:10px;">Original: ${imgW}x${imgH}px</div>
                <label style="color:rgba(255,255,255,0.5);font-size:11px;">Pos X
                    <input type="number" step="1" value="${Math.round(s.pos_x)}" onchange="window.cityBuilder.selected.pos_x=parseFloat(this.value);window.cityBuilder.render();" style="width:100%;padding:4px;border-radius:4px;border:1px solid #30363d;background:#0d1117;color:#fff;font-size:12px;box-sizing:border-box;">
                </label>
                <label style="color:rgba(255,255,255,0.5);font-size:11px;">Pos Y
                    <input type="number" step="1" value="${Math.round(s.pos_y)}" onchange="window.cityBuilder.selected.pos_y=parseFloat(this.value);window.cityBuilder.render();" style="width:100%;padding:4px;border-radius:4px;border:1px solid #30363d;background:#0d1117;color:#fff;font-size:12px;box-sizing:border-box;">
                </label>
                <label style="color:rgba(255,255,255,0.5);font-size:11px;">Escala (${(s.scale||1).toFixed(2)}x)
                    <input type="range" min="0.1" max="5" step="0.05" value="${s.scale||1}" oninput="window.cityBuilder.selected.scale=parseFloat(this.value);window.cityBuilder.updateProps();window.cityBuilder.render();" style="width:100%;">
                </label>
                <label style="color:rgba(255,255,255,0.5);font-size:11px;">Rotação
                    <select onchange="window.cityBuilder.selected.rotation=parseInt(this.value);window.cityBuilder.render();" style="width:100%;padding:4px;border-radius:4px;border:1px solid #30363d;background:#0d1117;color:#fff;font-size:12px;">
                        <option value="0" ${s.rotation===0?'selected':''}>0°</option>
                        <option value="90" ${s.rotation===90?'selected':''}>90°</option>
                        <option value="180" ${s.rotation===180?'selected':''}>180°</option>
                        <option value="270" ${s.rotation===270?'selected':''}>270°</option>
                    </select>
                </label>
                <label style="color:rgba(255,255,255,0.5);font-size:11px;">Z-Index
                    <input type="number" value="${s.z_index}" onchange="window.cityBuilder.selected.z_index=parseInt(this.value);window.cityBuilder.render();" style="width:100%;padding:4px;border-radius:4px;border:1px solid #30363d;background:#0d1117;color:#fff;font-size:12px;box-sizing:border-box;">
                </label>
                <label style="color:rgba(255,255,255,0.5);font-size:11px;display:flex;align-items:center;gap:6px;cursor:pointer;">
                    <input type="checkbox" ${s.has_collision ? 'checked' : ''} onchange="window.cityBuilder.selected.has_collision=this.checked;if(this.checked&&window.cityBuilder.selected._img){window.cityBuilder.selected._mask=window.cityBuilder.createMask(window.cityBuilder.selected._img);window.cityBuilder.selected._overlay=window.cityBuilder.createOverlay(window.cityBuilder.selected._img);}else{window.cityBuilder.selected._mask=null;window.cityBuilder.selected._overlay=null;}window.cityBuilder.updateProps();window.cityBuilder.render();" style="cursor:pointer;">
                    <span>Colisão (bloqueia passagem)</span>
                </label>
                <button onclick="window.cityBuilder.assets=window.cityBuilder.assets.filter(a=>a._id!==window.cityBuilder.selected._id);window.cityBuilder.selected=null;window.cityBuilder.updateProps();window.cityBuilder.render();" style="padding:6px;border:none;border-radius:4px;background:#e94560;color:#fff;font-size:11px;cursor:pointer;">Remover</button>
            </div>
        `;
    }

    async loadSavedLayout() {
        try {
            const { data } = await window.db.from('city_layout').select('*').order('z_index');
            if (data) {
                this.assets = data.map(a => {
                    const img = new Image();
                    img.src = a.asset_url;
                    img.onload = () => this.render();
                    return {
                        ...a,
                        _id: this.nextId++,
                    pos_x: a.pos_x ?? (a.grid_x * 64),
                    pos_y: a.pos_y ?? (a.grid_y * 64),
                    scale: a.scale ?? a.width ?? 1.0,
                    has_collision: a.has_collision || false,
                    layer: a.layer || 0,
                    _img: img,
                    _mask: null,
                    _overlay: null
                    };
                });
                this.assets.forEach(a => {
                    if (a.has_collision && a._img) {
                        const build = () => {
                            a._mask = this.createMask(a._img);
                            a._overlay = this.createOverlay(a._img);
                        };
                        a._img.onload = build;
                        if (a._img.complete && a._img.naturalWidth) build();
                    }
                });
                const layerSet = new Set(this.assets.map(a => a.layer || 0));
                this.layers = [...layerSet].sort((a, b) => a - b);
                if (this.layers.length === 0) this.layers = [0];
            }
        } catch (e) {
            console.warn('[CityBuilder] No saved layout');
        }
    }

    async save() {
        const status = document.getElementById('cb-save-btn');
        status.textContent = 'Salvando...';
        status.disabled = true;
        try {
            await window.db.from('city_layout').delete().neq('id', 0);
            const toSave = this.assets.map(a => ({
                asset_id: a.asset_id,
                asset_url: a.asset_url,
                pos_x: a.pos_x,
                pos_y: a.pos_y,
                scale: a.scale || 1,
                rotation: a.rotation || 0,
                z_index: a.z_index || 0,
                layer: a.layer || 0,
                has_collision: a.has_collision || false
            }));
            if (toSave.length > 0) {
                const { error } = await window.db.from('city_layout').insert(toSave);
                if (error) throw error;
            }
            status.textContent = 'Salvo!';
            setTimeout(() => { status.textContent = 'Salvar'; status.disabled = false; }, 2000);
        } catch (e) {
            console.error('[CityBuilder] Save error:', e);
            status.textContent = 'Erro';
            setTimeout(() => { status.textContent = 'Salvar'; status.disabled = false; }, 2000);
        }
    }

    createMask(img) {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const cx = c.getContext('2d');
        cx.drawImage(img, 0, 0);
        const data = cx.getImageData(0, 0, c.width, c.height).data;
        const mask = new Uint8Array(c.width * c.height);
        for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3];
        return { mask, w: c.width, h: c.height };
    }

    createOverlay(img) {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const cx = c.getContext('2d');
        cx.drawImage(img, 0, 0);
        const data = cx.getImageData(0, 0, c.width, c.height);
        const d = data.data;
        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] > 128) {
                d[i] = 231; d[i + 1] = 76; d[i + 2] = 60; d[i + 3] = 90;
            } else {
                d[i + 3] = 0;
            }
        }
        cx.putImageData(data, 0, 0);
        return c;
    }

    checkCollision(nx, ny) {
        const ps = this.playerSize;
        const px = nx - ps / 2;
        const py = ny - ps / 2;
        for (const a of this.assets) {
            if (!a.has_collision || !a._mask) continue;
            const m = a._mask;
            const sc = a.scale || 1;
            const aw = m.w * sc;
            const ah = m.h * sc;
            if (px + ps <= a.pos_x || px >= a.pos_x + aw) continue;
            if (py + ps <= a.pos_y || py >= a.pos_y + ah) continue;
            const step = Math.max(4, Math.floor(ps / 6));
            for (let sx = px + 2; sx < px + ps; sx += step) {
                for (let sy = py + 2; sy < py + ps; sy += step) {
                    if (sx < a.pos_x || sx >= a.pos_x + aw || sy < a.pos_y || sy >= a.pos_y + ah) continue;
                    const ix = Math.floor((sx - a.pos_x) / sc);
                    const iy = Math.floor((sy - a.pos_y) / sc);
                    if (ix >= 0 && ix < m.w && iy >= 0 && iy < m.h && m.mask[iy * m.w + ix] > 128) return true;
                }
            }
        }
        return false;
    }

    handlePlayerInput() {
        let dx = 0, dy = 0;
        if (this.playerKeys['w'] || this.playerKeys['W'] || this.playerKeys['ArrowUp']) { dy = -1; this.playerDir = 'up'; }
        else if (this.playerKeys['s'] || this.playerKeys['S'] || this.playerKeys['ArrowDown']) { dy = 1; this.playerDir = 'down'; }
        else if (this.playerKeys['a'] || this.playerKeys['A'] || this.playerKeys['ArrowLeft']) { dx = -1; this.playerDir = 'left'; }
        else if (this.playerKeys['d'] || this.playerKeys['D'] || this.playerKeys['ArrowRight']) { dx = 1; this.playerDir = 'right'; }

        if (dx || dy) {
            const len = Math.sqrt(dx * dx + dy * dy);
            const nx = this.playerX + (dx / len) * this.playerSpeed;
            const ny = this.playerY + (dy / len) * this.playerSpeed;
            if (!this.checkCollision(nx, ny)) {
                this.playerX = nx;
                this.playerY = ny;
            } else if (!this.checkCollision(nx, this.playerY)) {
                this.playerX = nx;
            } else if (!this.checkCollision(this.playerX, ny)) {
                this.playerY = ny;
            }
        }
    }

    loop() {
        if (!this.running) return;
        if (!this._inputSetup) {
            this.setupInput();
            this._inputSetup = true;
        }
        this.handlePlayerInput();
        this.render();
        requestAnimationFrame(() => this.loop());
    }

    render() {
        if (!this.ctx || !this.canvas) return;
        const ctx = this.ctx;
        const cw = this.canvas.width;
        const ch = this.canvas.height;
        if (cw === 0 || ch === 0) return;

        ctx.clearRect(0, 0, cw, ch);

        const zoom = this.previewMode ? 1 : this.zoom;
        const camX = this.playerX - cw / 2;
        const camY = this.playerY - ch / 2;
        this.camX = camX;
        this.camY = camY;

        ctx.save();
        ctx.translate(-camX * zoom, -camY * zoom);
        ctx.scale(zoom, zoom);

        ctx.fillStyle = '#2d5a27';
        ctx.fillRect(camX - 100, camY - 100, cw / zoom + 200, ch / zoom + 200);

        if (!this.previewMode) {
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.lineWidth = 1 / zoom;
            const gridSize = 64;
            const gxStart = Math.floor(camX / gridSize) * gridSize;
            const gyStart = Math.floor(camY / gridSize) * gridSize;
            const gxEnd = camX + cw / zoom + gridSize;
            const gyEnd = camY + ch / zoom + gridSize;
            for (let gx = gxStart; gx <= gxEnd; gx += gridSize) {
                ctx.beginPath(); ctx.moveTo(gx, camY - 100); ctx.lineTo(gx, gyEnd + 100); ctx.stroke();
            }
            for (let gy = gyStart; gy <= gyEnd; gy += gridSize) {
                ctx.beginPath(); ctx.moveTo(camX - 100, gy); ctx.lineTo(gxEnd + 100, gy); ctx.stroke();
            }
        }

        const sorted = [...this.assets].sort((a, b) => (a.layer || 0) - (b.layer || 0) || (a.z_index || 0) - (b.z_index || 0));
        sorted.forEach(a => {
            const img = a._img;
            if (!img || !img.complete || !img.naturalWidth) return;

            const aw = img.naturalWidth * (a.scale || 1);
            const ah = img.naturalHeight * (a.scale || 1);

            if (a.pos_x + aw < camX - 50 || a.pos_x > camX + cw / zoom + 50) return;
            if (a.pos_y + ah < camY - 50 || a.pos_y > camY + ch / zoom + 50) return;

            const isActive = (a.layer || 0) === this.activeLayer;
            ctx.save();
            if (!isActive && !this.previewMode) ctx.globalAlpha = 0.4;
            if (a.rotation) {
                ctx.translate(a.pos_x + aw / 2, a.pos_y + ah / 2);
                ctx.rotate((a.rotation || 0) * Math.PI / 180);
                ctx.drawImage(img, -aw / 2, -ah / 2, aw, ah);
            } else {
                ctx.drawImage(img, a.pos_x, a.pos_y, aw, ah);
            }

            if (!this.previewMode && isActive && this.selected && this.selected._id === a._id) {
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 2 / zoom;
                ctx.setLineDash([6 / zoom, 4 / zoom]);
                ctx.strokeRect(-2 / zoom, -2 / zoom, aw + 4 / zoom, ah + 4 / zoom);
                ctx.setLineDash([]);
            }
            if (a.has_collision) {
                if (a._overlay) {
                    ctx.drawImage(a._overlay, a.pos_x, a.pos_y, aw, ah);
                } else {
                    ctx.fillStyle = 'rgba(231, 76, 60, 0.3)';
                    ctx.fillRect(a.pos_x, a.pos_y, aw, ah);
                }
            }
            ctx.restore();
        });

        this.renderPlayer(ctx);

        ctx.restore();
    }

    renderPlayer(ctx) {
        const ps = this.playerSize;
        const px = this.playerX - ps / 2;
        const py = this.playerY - ps / 2;

        if (this.playerSkinImg && this.playerSkinImg.complete && this.playerSkinImg.naturalWidth) {
            const imgW = this.playerSkinImg.naturalWidth;
            const imgH = this.playerSkinImg.naturalHeight;
            const isGrid = imgW > 100 && imgH > 100 && Math.abs(imgW - imgH) < 20;

            if (isGrid) {
                const cols = 4, rows = 4;
                const frameW = imgW / cols;
                const frameH = imgH / rows;
                const dirs = ['down', 'left', 'right', 'up'];
                const row = dirs.indexOf(this.playerDir);
                ctx.drawImage(this.playerSkinImg,
                    0, row * frameH, frameW, frameH,
                    px, py, ps, ps
                );
            } else {
                ctx.drawImage(this.playerSkinImg, px, py, ps, ps);
            }
        } else {
            ctx.fillStyle = '#3498db';
            ctx.fillRect(px, py, ps, ps);
        }

        const game = window.pokefury;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 4;
        ctx.fillText(game?.playerName || 'Admin', this.playerX, py - 8);
        ctx.shadowBlur = 0;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.cityBuilder = new CityBuilder();
});
