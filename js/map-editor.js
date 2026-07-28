export class MapEditor {
    constructor() {
        this.canvas = document.getElementById('editor-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.displayTileSize = 32;
        this.gridW = 32;
        this.gridH = 24;
        this.tool = 'paint';
        this.activeLayer = 'ground';
        this.selectedColor = '#2d5a27';
        this.painting = false;
        this.camera = { x: 0, y: 0 };
        this.dragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.currentMapName = '';

        this.groundMap = [];
        this.objectMap = [];
        this.overlayMap = [];
        this.collisionMap = [];

        this.COLORS = [
            { id: 'grass', color: '#2d5a27', name: 'Grama' },
            { id: 'grass_light', color: '#3a7a33', name: 'Grama Clara' },
            { id: 'dirt', color: '#8B6914', name: 'Terra' },
            { id: 'dirt_dark', color: '#6B4F12', name: 'Terra Escura' },
            { id: 'path', color: '#C4A35A', name: 'Caminho' },
            { id: 'path_stone', color: '#9E9E9E', name: 'Pedra' },
            { id: 'water', color: '#1565C0', name: 'Água' },
            { id: 'water_deep', color: '#0D47A1', name: 'Água Profunda' },
            { id: 'sand', color: '#E8D68C', name: 'Areia' },
            { id: 'wall', color: '#5D4037', name: 'Parede' },
            { id: 'roof', color: '#C62828', name: 'Telhado' },
            { id: 'door', color: '#6D4C41', name: 'Porta' },
            { id: 'tree_trunk', color: '#5D4037', name: 'Tronco' },
            { id: 'tree_canopy', color: '#1B5E20', name: 'Copa' },
            { id: 'flower_red', color: '#E53935', name: 'Flores Vermelhas' },
            { id: 'flower_yellow', color: '#FDD835', name: 'Flores Amarelas' },
            { id: 'rock', color: '#616161', name: 'Pedra' },
            { id: 'fence', color: '#795548', name: 'Cerca' },
            { id: 'black', color: '#000000', name: 'Preto' },
            { id: 'white', color: '#FFFFFF', name: 'Branco' }
        ];

        this.init();
    }

    init() {
        this.generateEmptyMap();
        this.buildToolbar();
        this.buildLayerSelector();
        this.buildColorPalette();
        this.setupEvents();
        this.render();
    }

    generateEmptyMap() {
        this.groundMap = [];
        this.objectMap = [];
        this.overlayMap = [];
        this.collisionMap = [];
        for (let y = 0; y < this.gridH; y++) {
            this.groundMap[y] = [];
            this.objectMap[y] = [];
            this.overlayMap[y] = [];
            this.collisionMap[y] = [];
            for (let x = 0; x < this.gridW; x++) {
                this.groundMap[y][x] = null;
                this.objectMap[y][x] = null;
                this.overlayMap[y][x] = null;
                this.collisionMap[y][x] = 0;
            }
        }
    }

    buildToolbar() {
        const tools = [
            { id: 'paint', icon: '🖌️', label: 'Pintar' },
            { id: 'erase', icon: '🧹', label: 'Apagar' },
            { id: 'fill', icon: '🪣', label: 'Preencher' }
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

    buildLayerSelector() {
        const container = document.getElementById('editor-layers');
        if (!container) return;
        container.innerHTML = '';
        const layers = [
            { id: 'ground', name: 'Chão', icon: '🟫' },
            { id: 'object', name: 'Objetos', icon: '🌳' },
            { id: 'overlay', name: 'Sobreposição', icon: '🏠' }
        ];
        layers.forEach(layer => {
            const btn = document.createElement('button');
            btn.className = 'layer-btn' + (layer.id === this.activeLayer ? ' selected' : '');
            btn.innerHTML = `<span>${layer.icon}</span><span>${layer.name}</span>`;
            btn.onclick = () => {
                container.querySelectorAll('.layer-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.activeLayer = layer.id;
            };
            container.appendChild(btn);
        });
    }

    buildColorPalette() {
        const container = document.getElementById('tile-palette');
        if (!container) return;
        container.innerHTML = '';

        const grid = document.createElement('div');
        grid.className = 'palette-tile-grid';
        grid.style.gridTemplateColumns = 'repeat(5, 1fr)';

        this.COLORS.forEach((c, idx) => {
            const btn = document.createElement('button');
            btn.className = 'palette-tile-btn';
            btn.style.background = c.color;
            btn.style.width = '30px';
            btn.style.height = '30px';
            btn.title = c.name;
            if (c.id === this.selectedColor.replace('#', '')) btn.classList.add('selected');

            btn.onclick = () => {
                grid.querySelectorAll('.palette-tile-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.selectedColor = c.color;
            };

            grid.appendChild(btn);
        });

        container.appendChild(grid);
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
            const zoom = e.deltaY > 0 ? -4 : 4;
            this.displayTileSize = Math.max(16, Math.min(96, this.displayTileSize + zoom));
            this.render();
        }, { passive: false });
        this.canvas.style.cursor = 'crosshair';
    }

    getTileAt(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left + this.camera.x;
        const my = e.clientY - rect.top + this.camera.y;
        const ts = this.displayTileSize;
        return { x: Math.floor(mx / ts), y: Math.floor(my / ts) };
    }

    getActiveMap() {
        switch (this.activeLayer) {
            case 'ground': return this.groundMap;
            case 'object': return this.objectMap;
            case 'overlay': return this.overlayMap;
            default: return this.groundMap;
        }
    }

    handlePaint(e) {
        const { x, y } = this.getTileAt(e);
        if (x < 0 || x >= this.gridW || y < 0 || y >= this.gridH) return;
        const map = this.getActiveMap();

        if (this.tool === 'paint') {
            map[y][x] = this.selectedColor;
        } else if (this.tool === 'erase') {
            map[y][x] = null;
        } else if (this.tool === 'fill') {
            this.floodFill(x, y, map);
        }
        this.render();
    }

    floodFill(x, y, map) {
        const target = map[y][x];
        const newColor = this.selectedColor;
        if (target === newColor) return;

        const stack = [[x, y]];
        const visited = new Set();
        while (stack.length > 0) {
            const [cx, cy] = stack.pop();
            const key = `${cx},${cy}`;
            if (visited.has(key)) continue;
            if (cx < 0 || cx >= this.gridW || cy < 0 || cy >= this.gridH) continue;
            if (map[cy][cx] !== target) continue;
            visited.add(key);
            map[cy][cx] = newColor;
            stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
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

        const startX = Math.floor(this.camera.x / ts) - 1;
        const startY = Math.floor(this.camera.y / ts) - 1;
        const endX = Math.ceil((this.camera.x + w) / ts) + 1;
        const endY = Math.ceil((this.camera.y + h) / ts) + 1;

        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                if (x < 0 || x >= this.gridW || y < 0 || y >= this.gridH) continue;
                const sx = x * ts - this.camera.x;
                const sy = y * ts - this.camera.y;

                ctx.fillStyle = '#2d5a27';
                ctx.fillRect(sx, sy, ts, ts);

                const groundColor = this.groundMap[y][x];
                if (groundColor) {
                    ctx.fillStyle = groundColor;
                    ctx.fillRect(sx + 1, sy + 1, ts - 2, ts - 2);
                }

                const objectColor = this.objectMap[y][x];
                if (objectColor) {
                    ctx.fillStyle = objectColor;
                    ctx.fillRect(sx + 1, sy + 1, ts - 2, ts - 2);
                }

                const overlayColor = this.overlayMap[y][x];
                if (overlayColor) {
                    ctx.fillStyle = overlayColor;
                    ctx.fillRect(sx + 1, sy + 1, ts - 2, ts - 2);
                }

                if (this.collisionMap[y] && this.collisionMap[y][x]) {
                    ctx.fillStyle = 'rgba(255,0,0,0.25)';
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

        ctx.strokeStyle = 'rgba(233,69,96,0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(-this.camera.x, -this.camera.y, this.gridW * ts, this.gridH * ts);

        const coordsEl = document.getElementById('editor-coords');
        if (coordsEl) coordsEl.textContent = `${this.gridW}x${this.gridH} | Zoom: ${this.displayTileSize}px | Camada: ${this.activeLayer}`;
    }

    resize(w, h) {
        this.canvas.width = w;
        this.canvas.height = h;
        this.render();
    }

    setGridSize(w, h) {
        const newGround = [];
        const newObject = [];
        const newOverlay = [];
        const newCollision = [];
        for (let y = 0; y < h; y++) {
            newGround[y] = [];
            newObject[y] = [];
            newOverlay[y] = [];
            newCollision[y] = [];
            for (let x = 0; x < w; x++) {
                newGround[y][x] = (this.groundMap[y] && this.groundMap[y][x]) || null;
                newObject[y][x] = (this.objectMap[y] && this.objectMap[y][x]) || null;
                newOverlay[y][x] = (this.overlayMap[y] && this.overlayMap[y][x]) || null;
                newCollision[y][x] = (this.collisionMap[y] && this.collisionMap[y][x]) || 0;
            }
        }
        this.gridW = w;
        this.gridH = h;
        this.groundMap = newGround;
        this.objectMap = newObject;
        this.overlayMap = newOverlay;
        this.collisionMap = newCollision;
        this.render();
    }

    toJSON() {
        return JSON.stringify({
            width: this.gridW,
            height: this.gridH,
            displayTileSize: this.displayTileSize,
            ground: this.groundMap,
            objects: this.objectMap,
            overlay: this.overlayMap,
            collision: this.collisionMap
        });
    }

    fromJSON(json) {
        try {
            const data = typeof json === 'string' ? JSON.parse(json) : json;
            this.gridW = data.width;
            this.gridH = data.height;
            this.displayTileSize = data.displayTileSize || 32;
            if (data.ground) {
                this.groundMap = data.ground;
                this.objectMap = data.objects || this.emptyGrid();
                this.overlayMap = data.overlay || this.emptyGrid();
            } else if (data.map) {
                this.groundMap = data.map;
                this.objectMap = this.emptyGrid();
                this.overlayMap = this.emptyGrid();
            }
            this.collisionMap = data.collision || this.emptyGrid(0);
            this.render();
            return true;
        } catch (e) {
            console.error('[MapEditor] Failed to load map:', e);
            return false;
        }
    }

    emptyGrid(val = null) {
        const grid = [];
        for (let y = 0; y < this.gridH; y++) {
            grid[y] = [];
            for (let x = 0; x < this.gridW; x++) {
                grid[y][x] = val;
            }
        }
        return grid;
    }

    clear() {
        this.generateEmptyMap();
        this.currentMapName = '';
        this.render();
    }
}
