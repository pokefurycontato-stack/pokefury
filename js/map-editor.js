export class MapEditor {
    constructor() {
        this.canvas = document.getElementById('editor-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.tileSize = 32;
        this.gridW = 40;
        this.gridH = 30;
        this.tool = 'paint';
        this.selectedTile = 'grass';
        this.painting = false;
        this.map = [];
        this.collisionMap = [];
        this.grassMap = [];
        this.camera = { x: 0, y: 0 };
        this.dragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.currentMapId = null;
        this.currentMapName = '';

        this.TILES = {
            grass:       { color: '#2d5a27', label: 'Grama' },
            tall_grass:  { color: '#4a9a43', label: 'Grama Alta' },
            flower:      { color: '#e94560', label: 'Flores' },
            tree:        { color: '#1a3a15', label: 'Árvore' },
            water:       { color: '#2980b9', label: 'Água' },
            path:        { color: '#8d7b68', label: 'Caminho' },
            house:       { color: '#6c5ce7', label: 'Casa' },
            wall:        { color: '#5a3a1a', label: 'Parede' },
            door:        { color: '#d4a017', label: 'Porta' },
            sand:        { color: '#e8d5a3', label: 'Areia' },
            rock:        { color: '#7f8c8d', label: 'Pedra' },
            stairs:      { color: '#95a5a6', label: 'Escadas' },
            sign:        { color: '#f39c12', label: 'Placa' },
            fence_h:     { color: '#a0522d', label: 'Cerca H' },
            fence_v:     { color: '#8b4513', label: 'Cerca V' },
            empty:       { color: '#0d1117', label: 'Vazio' }
        };

        this.init();
    }

    init() {
        this.generateEmptyMap();
        this.buildPalette();
        this.buildToolbar();
        this.setupEvents();
        this.render();
    }

    generateEmptyMap() {
        this.map = [];
        this.collisionMap = [];
        this.grassMap = [];
        for (let y = 0; y < this.gridH; y++) {
            this.map[y] = [];
            this.collisionMap[y] = [];
            this.grassMap[y] = [];
            for (let x = 0; x < this.gridW; x++) {
                this.map[y][x] = 'grass';
                this.collisionMap[y][x] = 0;
                this.grassMap[y][x] = 0;
            }
        }
    }

    buildPalette() {
        const container = document.getElementById('tile-palette');
        if (!container) return;
        container.innerHTML = '';
        for (const [id, info] of Object.entries(this.TILES)) {
            const btn = document.createElement('button');
            btn.className = 'tile-btn' + (id === this.selectedTile ? ' selected' : '');
            btn.dataset.tile = id;
            btn.innerHTML = `<div class="tile-preview" style="background:${info.color}"></div><span>${info.label}</span>`;
            btn.onclick = () => {
                container.querySelectorAll('.tile-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.selectedTile = id;
            };
            container.appendChild(btn);
        }
    }

    buildToolbar() {
        const tools = [
            { id: 'paint',  icon: '🖌️', label: 'Pintar' },
            { id: 'erase',  icon: '🧹', label: 'Apagar' },
            { id: 'fill',   icon: '🪣', label: 'Preencher' },
            { id: 'pick',   icon: '💉', label: 'Copiar' },
            { id: 'rect',   icon: '⬜', label: 'Retângulo' }
        ];
        const container = document.getElementById('editor-tools');
        if (!container) return;
        container.innerHTML = '';
        tools.forEach(t => {
            const btn = document.createElement('button');
            btn.className = 'tool-btn' + (t.id === this.tool ? ' selected' : '');
            btn.dataset.tool = t.id;
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
            this.painting = true;
            this.handlePaint(e);
        });
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.dragging) {
                this.camera.x = this.dragStart.x - e.clientX;
                this.camera.y = this.dragStart.y - e.clientY;
                this.render();
                return;
            }
            if (this.painting) this.handlePaint(e);
            this.render();
        });
        this.canvas.addEventListener('mouseup', () => { this.painting = false; this.dragging = false; this.canvas.style.cursor = 'crosshair'; });
        this.canvas.addEventListener('mouseleave', () => { this.painting = false; this.dragging = false; });
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoom = e.deltaY > 0 ? -2 : 2;
            this.tileSize = Math.max(8, Math.min(64, this.tileSize + zoom));
            this.render();
        }, { passive: false });
        this.canvas.style.cursor = 'crosshair';
    }

    getTileAt(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left + this.camera.x;
        const my = e.clientY - rect.top + this.camera.y;
        const tx = Math.floor(mx / this.tileSize);
        const ty = Math.floor(my / this.tileSize);
        return { x: tx, y: ty };
    }

    handlePaint(e) {
        const { x, y } = this.getTileAt(e);
        if (x < 0 || x >= this.gridW || y < 0 || y >= this.gridH) return;

        if (this.tool === 'paint') {
            this.paintTile(x, y, this.selectedTile);
        } else if (this.tool === 'erase') {
            this.paintTile(x, y, 'empty');
        } else if (this.tool === 'fill') {
            this.floodFill(x, y, this.selectedTile);
        } else if (this.tool === 'pick') {
            this.selectedTile = this.map[y][x];
            document.querySelectorAll('#tile-palette .tile-btn').forEach(b => {
                b.classList.toggle('selected', b.dataset.tile === this.selectedTile);
            });
        } else if (this.tool === 'rect') {
            this.paintTile(x, y, this.selectedTile);
        }
        this.render();
    }

    paintTile(x, y, tile) {
        if (x < 0 || x >= this.gridW || y < 0 || y >= this.gridH) return;
        this.map[y][x] = tile;
        const isTree = tile === 'tree' || tile === 'wall' || tile === 'fence_h' || tile === 'fence_v' || tile === 'rock';
        const isGrass = tile === 'tall_grass' || tile === 'grass' || tile === 'flower';
        this.collisionMap[y][x] = isTree ? 1 : 0;
        this.grassMap[y][x] = isGrass && tile !== 'grass' ? 1 : 0;
    }

    floodFill(x, y, tile) {
        if (x < 0 || x >= this.gridW || y < 0 || y >= this.gridH) return;
        const target = this.map[y][x];
        if (target === tile) return;
        const stack = [[x, y]];
        const visited = new Set();
        while (stack.length > 0) {
            const [cx, cy] = stack.pop();
            const key = `${cx},${cy}`;
            if (visited.has(key)) continue;
            if (cx < 0 || cx >= this.gridW || cy < 0 || cy >= this.gridH) continue;
            if (this.map[cy][cx] !== target) continue;
            visited.add(key);
            this.paintTile(cx, cy, tile);
            stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
        }
    }

    render() {
        const w = this.canvas.width = this.canvas.parentElement.clientWidth;
        const h = this.canvas.height = this.canvas.parentElement.clientHeight;
        const ctx = this.ctx;
        const ts = this.tileSize;

        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, w, h);

        const startX = Math.floor(this.camera.x / ts);
        const startY = Math.floor(this.camera.y / ts);
        const endX = Math.ceil((this.camera.x + w) / ts);
        const endY = Math.ceil((this.camera.y + h) / ts);

        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                if (x < 0 || x >= this.gridW || y < 0 || y >= this.gridH) continue;
                const tile = this.map[y][x];
                const info = this.TILES[tile] || this.TILES.empty;
                const sx = x * ts - this.camera.x;
                const sy = y * ts - this.camera.y;

                ctx.fillStyle = info.color;
                ctx.fillRect(sx, sy, ts, ts);

                if (tile === 'tree') {
                    ctx.fillStyle = '#2d5a27';
                    ctx.beginPath();
                    ctx.arc(sx + ts / 2, sy + ts / 2 - 2, ts / 2 - 2, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#5a3a1a';
                    ctx.fillRect(sx + ts / 2 - 2, sy + ts / 2 + 4, 4, 10);
                } else if (tile === 'water') {
                    ctx.fillStyle = '#5dade2';
                    const wave = Math.sin(Date.now() * 0.003 + x * 0.5) * 2;
                    ctx.fillRect(sx, sy + ts / 2 + wave, ts, 2);
                } else if (tile === 'house') {
                    ctx.fillStyle = '#a29bfe';
                    ctx.fillRect(sx + 4, sy + 4, ts - 8, ts - 8);
                }

                if (this.collisionMap[y] && this.collisionMap[y][x]) {
                    ctx.fillStyle = 'rgba(255,0,0,0.15)';
                    ctx.fillRect(sx, sy, ts, ts);
                }
            }
        }

        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 0.5;
        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                if (x < 0 || x >= this.gridW || y < 0 || y >= this.gridH) continue;
                const sx = x * ts - this.camera.x;
                const sy = y * ts - this.camera.y;
                ctx.strokeRect(sx, sy, ts, ts);
            }
        }

        ctx.strokeStyle = 'rgba(233,69,96,0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(-this.camera.x, -this.camera.y, this.gridW * ts, this.gridH * ts);

        const coordsEl = document.getElementById('editor-coords');
        if (coordsEl) {
            coordsEl.textContent = `${this.gridW}x${this.gridH} | Tile: ${this.selectedTile}`;
        }
    }

    resize(w, h) {
        this.canvas.width = w;
        this.canvas.height = h;
        this.render();
    }

    setGridSize(w, h) {
        const newMap = [];
        const newCollision = [];
        const newGrass = [];
        for (let y = 0; y < h; y++) {
            newMap[y] = [];
            newCollision[y] = [];
            newGrass[y] = [];
            for (let x = 0; x < w; x++) {
                newMap[y][x] = (this.map[y] && this.map[y][x]) || 'grass';
                newCollision[y][x] = (this.collisionMap[y] && this.collisionMap[y][x]) || 0;
                newGrass[y][x] = (this.grassMap[y] && this.grassMap[y][x]) || 0;
            }
        }
        this.gridW = w;
        this.gridH = h;
        this.map = newMap;
        this.collisionMap = newCollision;
        this.grassMap = newGrass;
        this.render();
    }

    toJSON() {
        return JSON.stringify({
            width: this.gridW,
            height: this.gridH,
            tileSize: this.tileSize,
            map: this.map,
            collision: this.collisionMap,
            grass: this.grassMap
        });
    }

    fromJSON(json) {
        try {
            const data = typeof json === 'string' ? JSON.parse(json) : json;
            this.gridW = data.width;
            this.gridH = data.height;
            this.tileSize = data.tileSize || 32;
            this.map = data.map;
            this.collisionMap = data.collision;
            this.grassMap = data.grass;
            this.render();
            return true;
        } catch (e) {
            console.error('[MapEditor] Failed to load map:', e);
            return false;
        }
    }

    clear() {
        this.generateEmptyMap();
        this.currentMapId = null;
        this.currentMapName = '';
        this.render();
    }
}
