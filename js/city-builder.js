class CityBuilder {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.assets = [];
        this.gridAssets = [];
        this.selected = null;
        this.dragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.tileSize = 64;
        this.zoom = 1;
        this.pan = { x: 0, y: 0 };
        this.availableAssets = [];
        this.nextId = 1;

        this.bindEvents();
    }

    bindEvents() {
        const btn = document.getElementById('admin-btn-city-builder');
        if (btn) btn.addEventListener('click', () => this.open());

        const closeBtn = document.getElementById('cb-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', () => this.close());

        const saveBtn = document.getElementById('cb-save-btn');
        if (saveBtn) saveBtn.addEventListener('click', () => this.save());
    }

    async open() {
        document.getElementById('city-builder-screen').classList.remove('hidden');
        this.canvas = document.getElementById('cb-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        this.setupInput();
        await this.loadAssets();
        await this.loadSavedLayout();
        this.render();
    }

    close() {
        document.getElementById('city-builder-screen').classList.add('hidden');
    }

    resizeCanvas() {
        const wrap = document.getElementById('cb-canvas-wrap');
        if (!wrap || !this.canvas) return;
        this.canvas.width = wrap.clientWidth;
        this.canvas.height = wrap.clientHeight;
        this.render();
    }

    async loadAssets() {
        const assetFiles = [
            'textgrama.png', 'pedraterreno.png', 'pedraretang.png', 'pedrapeq.png',
            'lago3.png', 'lago2.png', 'lago1.png', 'grama.png',
            'escada.png', 'barro.png', 'barranco.png', 'arvore.png'
        ];

        this.availableAssets = assetFiles.map(f => ({
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
            el.addEventListener('mousedown', (e) => this.startDragNew(e, el.dataset.id));
        });
    }

    startDragNew(e, assetId) {
        const asset = this.availableAssets.find(a => a.id === assetId);
        if (!asset) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.zoom - this.pan.x;
        const y = (e.clientY - rect.top) / this.zoom - this.pan.y;

        const newItem = {
            _id: this.nextId++,
            asset_id: asset.id,
            asset_url: asset.url,
            grid_x: x / this.tileSize,
            grid_y: y / this.tileSize,
            width: 1,
            height: 1,
            rotation: 0,
            z_index: this.gridAssets.length,
            _img: null
        };

        this.loadImage(newItem);
        this.gridAssets.push(newItem);
        this.selected = newItem;
        this.dragging = true;
        this.dragOffset = { x: 0, y: 0 };

        this.setupCanvasDrag();
        this.updateProps();
        this.render();
    }

    setupInput() {
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.onMouseUp());
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
    }

    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) / this.zoom - this.pan.x;
        const my = (e.clientY - rect.top) / this.zoom - this.pan.y;

        this.selected = null;
        for (let i = this.gridAssets.length - 1; i >= 0; i--) {
            const a = this.gridAssets[i];
            const ax = a.grid_x * this.tileSize;
            const ay = a.grid_y * this.tileSize;
            const aw = a.width * this.tileSize;
            const ah = a.height * this.tileSize;
            if (mx >= ax && mx <= ax + aw && my >= ay && my <= ay + ah) {
                this.selected = a;
                this.dragging = true;
                this.dragOffset = { x: mx - ax, y: my - ay };
                break;
            }
        }

        this.updateProps();
        this.render();
    }

    onMouseMove(e) {
        if (!this.dragging || !this.selected) return;
        const rect = this.canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) / this.zoom - this.pan.x;
        const my = (e.clientY - rect.top) / this.zoom - this.pan.y;

        let newX = (mx - this.dragOffset.x) / this.tileSize;
        let newY = (my - this.dragOffset.y) / this.tileSize;

        if (e.shiftKey) {
            newX = Math.round(newX * 2) / 2;
            newY = Math.round(newY * 2) / 2;
        } else {
            newX = Math.round(newX * 4) / 4;
            newY = Math.round(newY * 4) / 4;
        }

        this.selected.grid_x = newX;
        this.selected.grid_y = newY;
        this.updateProps();
        this.render();
    }

    onMouseUp() {
        this.dragging = false;
    }

    onWheel(e) {
        e.preventDefault();
        if (e.ctrlKey) {
            this.selected && (this.selected.width = Math.max(0.25, Math.min(5, this.selected.width + (e.deltaY > 0 ? -0.25 : 0.25))));
            this.selected && (this.selected.height = this.selected.width);
        } else {
            this.zoom = Math.max(0.25, Math.min(3, this.zoom + (e.deltaY > 0 ? -0.1 : 0.1)));
        }
        this.updateProps();
        this.render();
    }

    onKeyDown(e) {
        if (!document.getElementById('city-builder-screen') || document.getElementById('city-builder-screen').classList.contains('hidden')) return;

        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (this.selected) {
                this.gridAssets = this.gridAssets.filter(a => a._id !== this.selected._id);
                this.selected = null;
                this.updateProps();
                this.render();
            }
        }

        if ((e.key === 'r' || e.key === 'R') && this.selected) {
            this.selected.rotation = (this.selected.rotation + 90) % 360;
            this.updateProps();
            this.render();
        }

        if (e.key === 'ArrowUp' && this.selected) { this.selected.grid_y -= 0.25; this.updateProps(); this.render(); }
        if (e.key === 'ArrowDown' && this.selected) { this.selected.grid_y += 0.25; this.updateProps(); this.render(); }
        if (e.key === 'ArrowLeft' && this.selected) { this.selected.grid_x -= 0.25; this.updateProps(); this.render(); }
        if (e.key === 'ArrowRight' && this.selected) { this.selected.grid_x += 0.25; this.updateProps(); this.render(); }
    }

    setupCanvasDrag() {}

    loadImage(item) {
        const img = new Image();
        img.src = item.asset_url;
        img.onload = () => { item._img = img; this.render(); };
        item._img = img;
    }

    async loadSavedLayout() {
        try {
            const { data } = await window.db.from('city_layout').select('*').order('z_index');
            if (data) {
                this.gridAssets = data.map((a, i) => ({ ...a, _id: this.nextId++, _img: null }));
                this.gridAssets.forEach(a => this.loadImage(a));
            }
        } catch (e) {
            console.warn('[CityBuilder] No saved layout');
        }
    }

    updateProps() {
        const el = document.getElementById('cb-props-content');
        if (!this.selected) {
            el.innerHTML = '<span style="color:rgba(255,255,255,0.4)">Selecione um asset</span>';
            return;
        }
        const s = this.selected;
        el.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:8px;">
                <div style="color:#c9d1d9;font-weight:700;">${s.asset_id}</div>
                <label style="color:rgba(255,255,255,0.5);font-size:11px;">Pos X
                    <input type="number" step="0.25" value="${s.grid_x.toFixed(2)}" onchange="window.cityBuilder.selected.grid_x=parseFloat(this.value);window.cityBuilder.render();" style="width:100%;padding:4px;border-radius:4px;border:1px solid #30363d;background:#0d1117;color:#fff;font-size:12px;box-sizing:border-box;">
                </label>
                <label style="color:rgba(255,255,255,0.5);font-size:11px;">Pos Y
                    <input type="number" step="0.25" value="${s.grid_y.toFixed(2)}" onchange="window.cityBuilder.selected.grid_y=parseFloat(this.value);window.cityBuilder.render();" style="width:100%;padding:4px;border-radius:4px;border:1px solid #30363d;background:#0d1117;color:#fff;font-size:12px;box-sizing:border-box;">
                </label>
                <label style="color:rgba(255,255,255,0.5);font-size:11px;">Tamanho
                    <input type="number" step="0.25" min="0.25" max="10" value="${s.width}" onchange="window.cityBuilder.selected.width=parseFloat(this.value);window.cityBuilder.selected.height=parseFloat(this.value);window.cityBuilder.render();" style="width:100%;padding:4px;border-radius:4px;border:1px solid #30363d;background:#0d1117;color:#fff;font-size:12px;box-sizing:border-box;">
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
                <button onclick="window.cityBuilder.gridAssets=window.cityBuilder.gridAssets.filter(a=>a._id!==window.cityBuilder.selected._id);window.cityBuilder.selected=null;window.cityBuilder.updateProps();window.cityBuilder.render();" style="padding:6px;border:none;border-radius:4px;background:#e94560;color:#fff;font-size:11px;cursor:pointer;">🗑️ Remover</button>
            </div>
        `;
    }

    async save() {
        const status = document.getElementById('cb-save-btn');
        status.textContent = 'Salvando...';
        status.disabled = true;

        try {
            await window.db.from('city_layout').delete().neq('id', 0);

            const toSave = this.gridAssets.map(a => ({
                asset_id: a.asset_id,
                asset_url: a.asset_url,
                grid_x: a.grid_x,
                grid_y: a.grid_y,
                width: a.width,
                height: a.height,
                rotation: a.rotation,
                z_index: a.z_index
            }));

            if (toSave.length > 0) {
                const { error } = await window.db.from('city_layout').insert(toSave);
                if (error) throw error;
            }

            status.textContent = '✅ Salvo!';
            setTimeout(() => { status.textContent = '💾 Salvar'; status.disabled = false; }, 2000);
        } catch (e) {
            console.error('[CityBuilder] Save error:', e);
            status.textContent = '❌ Erro';
            setTimeout(() => { status.textContent = '💾 Salvar'; status.disabled = false; }, 2000);
        }
    }

    render() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        ctx.clearRect(0, 0, w, h);

        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(this.pan.x, this.pan.y);

        const ts = this.tileSize;
        const gridW = 50;
        const gridH = 50;

        for (let gx = 0; gx <= gridW; gx++) {
            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            ctx.beginPath();
            ctx.moveTo(gx * ts, 0);
            ctx.lineTo(gx * ts, gridH * ts);
            ctx.stroke();
        }
        for (let gy = 0; gy <= gridH; gy++) {
            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            ctx.beginPath();
            ctx.moveTo(0, gy * ts);
            ctx.lineTo(gridW * ts, gy * ts);
            ctx.stroke();
        }

        const sorted = [...this.gridAssets].sort((a, b) => a.z_index - b.z_index);
        sorted.forEach(a => {
            const ax = a.grid_x * ts;
            const ay = a.grid_y * ts;
            const aw = a.width * ts;
            const ah = a.height * ts;

            ctx.save();
            ctx.translate(ax + aw / 2, ay + ah / 2);
            ctx.rotate((a.rotation || 0) * Math.PI / 180);

            if (a._img && a._img.complete && a._img.naturalWidth) {
                ctx.drawImage(a._img, -aw / 2, -ah / 2, aw, ah);
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.1)';
                ctx.fillRect(-aw / 2, -ah / 2, aw, ah);
            }

            if (this.selected && this.selected._id === a._id) {
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 4]);
                ctx.strokeRect(-aw / 2 - 2, -ah / 2 - 2, aw + 4, ah + 4);
                ctx.setLineDash([]);
            }

            ctx.restore();
        });

        ctx.restore();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.cityBuilder = new CityBuilder();
});
