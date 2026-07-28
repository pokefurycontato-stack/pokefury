export class MapZoneEditor {
    constructor() {
        this.canvas = document.getElementById('zone-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.mapImage = null;
        this.mapData = null;
        this.gridW = 40;
        this.gridH = 30;
        this.displayTileSize = 32;
        this.camera = { x: 0, y: 0 };
        this.tool = 'collision';
        this.painting = false;
        this.dragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.drawRect = null;
        this.collisionZones = [];
        this.spawnZones = [];
        this.playerSpawn = null;
        this.onSave = null;
    }

    init() {
        this.buildTools();
        this.setupEvents();
    }

    buildTools() {
        const container = document.getElementById('zone-tools');
        if (!container) return;
        container.innerHTML = '';

        const tools = [
            { id: 'collision', icon: '🔴', label: 'Colisao' },
            { id: 'spawn', icon: '🟢', label: 'Spawn' },
            { id: 'player', icon: '🧑', label: 'Treinador' },
            { id: 'eraser', icon: '🧹', label: 'Apagar' }
        ];

        tools.forEach(t => {
            const btn = document.createElement('button');
            btn.className = 'tool-btn' + (t.id === this.tool ? ' selected' : '');
            btn.innerHTML = `<span>${t.icon}</span><span>${t.label}</span>`;
            btn.onclick = () => {
                container.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.tool = t.id;
            };
            container.appendChild(btn);
        });
    }

    setupEvents() {
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 1 || (e.button === 0 && e.altKey)) {
                this.dragging = true;
                this.dragStart = { x: e.clientX + this.camera.x, y: e.clientY + this.camera.y };
                this.canvas.style.cursor = 'grabbing';
                return;
            }
            if (e.button === 0) {
                if (this.tool === 'eraser') {
                    this.handleErase(e);
                } else if (this.tool === 'player') {
                    const pos = this.getTileAt(e);
                    this.playerSpawn = { x: pos.x, y: pos.y };
                    this.renderZoneList();
                    this.render();
                } else {
                    this.painting = true;
                    const pos = this.getTileAt(e);
                    this.drawRect = { x: pos.x, y: pos.y, w: 0, h: 0 };
                }
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.dragging) {
                this.camera.x = this.dragStart.x - e.clientX;
                this.camera.y = this.dragStart.y - e.clientY;
                this.render();
                return;
            }
            if (this.painting && this.drawRect) {
                const pos = this.getTileAt(e);
                this.drawRect.w = pos.x - this.drawRect.x;
                this.drawRect.h = pos.y - this.drawRect.y;
                this.render();
            }
        });

        this.canvas.addEventListener('mouseup', () => {
            if (this.painting && this.drawRect) {
                this.finishDraw();
            }
            this.painting = false;
            this.dragging = false;
            this.canvas.style.cursor = 'crosshair';
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.painting = false;
            this.dragging = false;
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoom = e.deltaY > 0 ? -4 : 4;
            this.displayTileSize = Math.max(8, Math.min(96, this.displayTileSize + zoom));
            this.render();
        }, { passive: false });

        this.canvas.style.cursor = 'crosshair';
    }

    getTileAt(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left + this.camera.x;
        const my = e.clientY - rect.top + this.camera.y;
        return {
            x: Math.floor(mx / this.displayTileSize),
            y: Math.floor(my / this.displayTileSize)
        };
    }

    finishDraw() {
        if (!this.drawRect) return;
        let { x, y, w, h } = this.drawRect;

        if (w < 0) { x += w + 1; w = -w; }
        if (h < 0) { y += h + 1; h = -h; }
        w += 1;
        h += 1;

        x = Math.max(0, Math.min(this.gridW - 1, x));
        y = Math.max(0, Math.min(this.gridH - 1, y));
        w = Math.min(w, this.gridW - x);
        h = Math.min(h, this.gridH - y);

        if (w < 1 || h < 1) { this.drawRect = null; return; }

        const zone = { x, y, w, h };
        if (this.tool === 'collision') {
            this.collisionZones.push(zone);
        } else if (this.tool === 'spawn') {
            this.spawnZones.push(zone);
        }

        this.drawRect = null;
        this.renderZoneList();
        this.render();
    }

    handleErase(e) {
        const pos = this.getTileAt(e);
        this.collisionZones = this.collisionZones.filter(z =>
            pos.x < z.x || pos.x > z.x + z.w - 1 || pos.y < z.y || pos.y > z.y + z.h - 1
        );
        this.spawnZones = this.spawnZones.filter(z =>
            pos.x < z.x || pos.x > z.x + z.w - 1 || pos.y < z.y || pos.y > z.y + z.h - 1
        );
        this.renderZoneList();
        this.render();
    }

    deleteZone(type, index) {
        if (type === 'collision') {
            this.collisionZones.splice(index, 1);
        } else {
            this.spawnZones.splice(index, 1);
        }
        this.renderZoneList();
        this.render();
    }

    renderZoneList() {
        const container = document.getElementById('zone-list');
        if (!container) return;
        container.innerHTML = '';

        this.collisionZones.forEach((z, i) => {
            const item = document.createElement('div');
            item.className = 'zone-list-item';
            item.innerHTML = `
                <div class="zone-color-dot" style="background:#f44336"></div>
                <div class="zone-coords">Colisao: (${z.x},${z.y}) ${z.w}x${z.h}</div>
                <button class="zone-delete" title="Remover">✕</button>
            `;
            item.querySelector('.zone-delete').onclick = () => this.deleteZone('collision', i);
            container.appendChild(item);
        });

        this.spawnZones.forEach((z, i) => {
            const item = document.createElement('div');
            item.className = 'zone-list-item';
            item.innerHTML = `
                <div class="zone-color-dot" style="background:#4caf50"></div>
                <div class="zone-coords">Spawn: (${z.x},${z.y}) ${z.w}x${z.h}</div>
                <button class="zone-delete" title="Remover">✕</button>
            `;
            item.querySelector('.zone-delete').onclick = () => this.deleteZone('spawn', i);
            container.appendChild(item);
        });

        if (this.playerSpawn) {
            const item = document.createElement('div');
            item.className = 'zone-list-item';
            item.innerHTML = `
                <div class="zone-color-dot" style="background:#2196f3"></div>
                <div class="zone-coords">Treinador: (${this.playerSpawn.x},${this.playerSpawn.y})</div>
                <button class="zone-delete" title="Remover">✕</button>
            `;
            item.querySelector('.zone-delete').onclick = () => { this.playerSpawn = null; this.renderZoneList(); this.render(); };
            container.appendChild(item);
        }

        if (this.collisionZones.length === 0 && this.spawnZones.length === 0 && !this.playerSpawn) {
            container.innerHTML = '<div style="color:rgba(255,255,255,0.3);font-size:11px;padding:8px">Nenhuma zona definida</div>';
        }
    }

    render() {
        const parent = this.canvas.parentElement;
        if (!parent) return;
        const w = this.canvas.width = parent.clientWidth;
        const h = this.canvas.height = parent.clientHeight;
        const ctx = this.ctx;
        const ts = this.displayTileSize;

        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, w, h);

        if (this.mapImage && this.mapImage.complete && this.mapImage.naturalWidth > 0) {
            const mapDrawW = this.gridW * ts;
            const mapDrawH = this.gridH * ts;
            ctx.drawImage(this.mapImage, -this.camera.x, -this.camera.y, mapDrawW, mapDrawH);
        }

        const startX = Math.floor(this.camera.x / ts) - 1;
        const startY = Math.floor(this.camera.y / ts) - 1;
        const endX = Math.ceil((this.camera.x + w) / ts) + 1;
        const endY = Math.ceil((this.camera.y + h) / ts) + 1;

        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 0.5;
        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                if (x < 0 || x >= this.gridW || y < 0 || y >= this.gridH) continue;
                ctx.strokeRect(x * ts - this.camera.x, y * ts - this.camera.y, ts, ts);
            }
        }

        for (const z of this.collisionZones) {
            ctx.fillStyle = 'rgba(244,67,54,0.3)';
            ctx.fillRect(z.x * ts - this.camera.x, z.y * ts - this.camera.y, z.w * ts, z.h * ts);
            ctx.strokeStyle = 'rgba(244,67,54,0.7)';
            ctx.lineWidth = 2;
            ctx.strokeRect(z.x * ts - this.camera.x, z.y * ts - this.camera.y, z.w * ts, z.h * ts);
        }

        for (const z of this.spawnZones) {
            ctx.fillStyle = 'rgba(76,175,80,0.3)';
            ctx.fillRect(z.x * ts - this.camera.x, z.y * ts - this.camera.y, z.w * ts, z.h * ts);
            ctx.strokeStyle = 'rgba(76,175,80,0.7)';
            ctx.lineWidth = 2;
            ctx.strokeRect(z.x * ts - this.camera.x, z.y * ts - this.camera.y, z.w * ts, z.h * ts);
        }

        if (this.playerSpawn) {
            const px = this.playerSpawn.x * ts - this.camera.x;
            const py = this.playerSpawn.y * ts - this.camera.y;
            ctx.fillStyle = 'rgba(33,150,243,0.5)';
            ctx.fillRect(px, py, ts, ts);
            ctx.strokeStyle = 'rgba(33,150,243,0.9)';
            ctx.lineWidth = 3;
            ctx.strokeRect(px, py, ts, ts);
            ctx.fillStyle = '#fff';
            ctx.font = `${Math.max(10, ts * 0.6)}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('🧑', px + ts / 2, py + ts * 0.75);
        }

        if (this.drawRect) {
            let { x, y, w, h } = this.drawRect;
            if (w < 0) { x += w + 1; w = -w; }
            if (h < 0) { y += h + 1; h = -h; }
            w += 1;
            h += 1;
            const color = this.tool === 'collision' ? 'rgba(244,67,54,0.4)' : 'rgba(76,175,80,0.4)';
            const borderColor = this.tool === 'collision' ? 'rgba(244,67,54,0.8)' : 'rgba(76,175,80,0.8)';
            ctx.fillStyle = color;
            ctx.fillRect(x * ts - this.camera.x, y * ts - this.camera.y, w * ts, h * ts);
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(x * ts - this.camera.x, y * ts - this.camera.y, w * ts, h * ts);
            ctx.setLineDash([]);
        }

        ctx.strokeStyle = 'rgba(233,69,96,0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(-this.camera.x, -this.camera.y, this.gridW * ts, this.gridH * ts);
    }

    open(mapData, imageLoader) {
        this.mapData = mapData;
        this.gridW = mapData.gridW || 40;
        this.gridH = mapData.gridH || 30;
        this.collisionZones = mapData.collision_zones ? [...mapData.collision_zones] : [];
        this.spawnZones = mapData.spawn_zones ? [...mapData.spawn_zones] : [];
        this.playerSpawn = (mapData.player_spawn_x != null && mapData.player_spawn_y != null)
            ? { x: mapData.player_spawn_x, y: mapData.player_spawn_y }
            : null;

        const overlay = document.getElementById('zone-editor-overlay');
        overlay.classList.remove('hidden');

        const nameEl = document.getElementById('zone-map-name');
        if (nameEl) nameEl.textContent = `Editor de Zonas - ${mapData.name || 'Mapa'}`;

        if (imageLoader) {
            imageLoader(mapData.image_url).then(img => {
                this.mapImage = img;
                this.centerCamera();
                this.render();
            });
        }

        this.renderZoneList();
        this.render();

        document.getElementById('zone-btn-close').onclick = () => {
            overlay.classList.add('hidden');
        };

        document.getElementById('zone-btn-save').onclick = () => {
            if (this.onSave) {
                this.onSave(this.collisionZones, this.spawnZones, this.playerSpawn);
            }
            overlay.classList.add('hidden');
        };
    }

    centerCamera() {
        const parent = this.canvas.parentElement;
        if (!parent) return;
        const worldW = this.gridW * this.displayTileSize;
        const worldH = this.gridH * this.displayTileSize;
        this.camera.x = Math.max(0, (worldW - parent.clientWidth) / 2);
        this.camera.y = Math.max(0, (worldH - parent.clientHeight) / 2);
    }
}
