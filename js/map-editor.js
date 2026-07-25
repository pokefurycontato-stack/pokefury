export class MapEditor {
    constructor() {
        this.canvas = document.getElementById('editor-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.tileSize = 16;
        this.displayTileSize = 32;
        this.gridW = 40;
        this.gridH = 30;
        this.tool = 'paint';
        this.selectedTileIndex = null;
        this.selectedTileSheet = null;
        this.painting = false;
        this.map = [];
        this.collisionMap = [];
        this.grassMap = [];
        this.camera = { x: 0, y: 0 };
        this.dragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.currentMapName = '';
        this.tilesets = {};
        this.allTiles = [];

        this.TILESET_SOURCES = [
            { id: 'frlg_outdoor', url: 'tilesets/frlg-outdoor.png', name: 'FRLG Exterior', cols: 8, tileSize: 16 },
            { id: 'frlg_tileset1', url: 'tilesets/frlg-tileset1.png', name: 'FRLG Routes', cols: 8, tileSize: 16 },
            { id: 'frlg_tileset2', url: 'tilesets/frlg-tileset2.png', name: 'FRLG Cidades', cols: 8, tileSize: 16 },
            { id: 'frlg_buildings', url: 'tilesets/frlg-buildings.png', name: 'FRLG Prédios', cols: 8, tileSize: 16 },
            { id: 'pokemon', url: 'tilesets/pokemon-inspired.png', name: 'Pokémon Insp.', cols: 8, tileSize: 16 },
            { id: 'terrain', url: 'tilesets/1_terrain.png', name: 'Terreno', cols: 8, tileSize: 16 },
            { id: 'plants', url: 'tilesets/3_plants.png', name: 'Plantas', cols: 8, tileSize: 16 },
            { id: 'water', url: 'tilesets/5_waterfall.png', name: 'Água', cols: 8, tileSize: 16 }
        ];

        this.SUPABASE_URL = 'https://odevwnnpzsoltbrrjdts.supabase.co';
        this.STORAGE_URL = `${this.SUPABASE_URL}/storage/v1/object/public/sprites`;

        this.init();
    }

    async init() {
        this.generateEmptyMap();
        this.buildToolbar();
        this.setupEvents();
        await this.loadAllTilesets();
        this.render();
    }

    async loadAllTilesets() {
        const container = document.getElementById('tile-palette');
        if (container) container.innerHTML = '<div style="color:rgba(255,255,255,0.3);font-size:11px;padding:8px">Carregando tiles...</div>';

        const promises = this.TILESET_SOURCES.map(src => this.loadTileset(src));
        await Promise.all(promises);

        this.buildPalette();
        if (this.allTiles.length > 0) {
            this.selectedTileIndex = 0;
            this.selectedTileSheet = this.allTiles[0].sheet;
        }
    }

    loadTileset(source) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                this.tilesets[source.id] = {
                    img,
                    cols: source.cols,
                    rows: Math.ceil(img.height / 16),
                    name: source.name
                };
                this.parseTileset(source.id);
                resolve();
            };
            img.onerror = () => {
                console.warn(`[MapEditor] Failed to load tileset: ${source.id}`);
                resolve();
            };
            img.src = `${this.STORAGE_URL}/${source.url}`;
        });
    }

    parseTileset(sheetId) {
        const sheet = this.tilesets[sheetId];
        if (!sheet) return;

        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');

        for (let r = 0; r < sheet.rows; r++) {
            for (let c = 0; c < sheet.cols; c++) {
                ctx.clearRect(0, 0, 16, 16);
                ctx.drawImage(sheet.img, c * 16, r * 16, 16, 16, 0, 0, 16, 16);

                const data = ctx.getImageData(0, 0, 16, 16).data;
                let hasContent = false;
                for (let i = 3; i < data.length; i += 4) {
                    if (data[i] > 0) { hasContent = true; break; }
                }
                if (!hasContent) continue;

                const tileCanvas = document.createElement('canvas');
                tileCanvas.width = 16;
                tileCanvas.height = 16;
                tileCanvas.getContext('2d').drawImage(sheet.img, c * 16, r * 16, 16, 16, 0, 0, 16, 16);

                this.allTiles.push({
                    sheet: sheetId,
                    col: c,
                    row: r,
                    canvas: tileCanvas,
                    label: `${sheet.name} ${r * sheet.cols + c}`
                });
            }
        }
    }

    buildPalette() {
        const container = document.getElementById('tile-palette');
        if (!container) return;
        container.innerHTML = '';

        const categories = {};
        this.TILESET_SOURCES.forEach(src => {
            const sheet = this.tilesets[src.id];
            if (!sheet) return;
            categories[src.id] = { name: src.name, tiles: [] };
        });

        this.allTiles.forEach((tile, idx) => {
            if (categories[tile.sheet]) {
                categories[tile.sheet].tiles.push({ ...tile, globalIndex: idx });
            }
        });

        for (const [catId, cat] of Object.entries(categories)) {
            if (cat.tiles.length === 0) continue;

            const header = document.createElement('div');
            header.className = 'palette-category-header';
            header.textContent = cat.name;
            header.onclick = () => {
                const items = header.nextElementSibling;
                if (items) items.classList.toggle('collapsed');
            };
            container.appendChild(header);

            const grid = document.createElement('div');
            grid.className = 'palette-tile-grid';

            cat.tiles.forEach(tile => {
                const btn = document.createElement('button');
                btn.className = 'palette-tile-btn';
                btn.dataset.index = tile.globalIndex;

                const preview = document.createElement('canvas');
                preview.width = 16;
                preview.height = 16;
                preview.style.width = '32px';
                preview.style.height = '32px';
                preview.style.imageRendering = 'pixelated';
                preview.getContext('2d').drawImage(tile.canvas, 0, 0);
                btn.appendChild(preview);

                btn.onclick = () => {
                    container.querySelectorAll('.palette-tile-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    this.selectedTileIndex = tile.globalIndex;
                    this.selectedTileSheet = tile.sheet;
                };

                grid.appendChild(btn);
            });

            container.appendChild(grid);
        }
    }

    buildToolbar() {
        const tools = [
            { id: 'paint', icon: '🖌️', label: 'Pintar' },
            { id: 'erase', icon: '🧹', label: 'Apagar' },
            { id: 'fill', icon: '🪣', label: 'Preencher' },
            { id: 'pick', icon: '💉', label: 'Copiar' }
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

    generateEmptyMap() {
        this.map = [];
        this.collisionMap = [];
        this.grassMap = [];
        for (let y = 0; y < this.gridH; y++) {
            this.map[y] = [];
            this.collisionMap[y] = [];
            this.grassMap[y] = [];
            for (let x = 0; x < this.gridW; x++) {
                this.map[y][x] = null;
                this.collisionMap[y][x] = 0;
                this.grassMap[y][x] = 0;
            }
        }
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

    handlePaint(e) {
        const { x, y } = this.getTileAt(e);
        if (x < 0 || x >= this.gridW || y < 0 || y >= this.gridH) return;

        if (this.tool === 'paint') {
            this.paintTileAt(x, y);
        } else if (this.tool === 'erase') {
            this.map[y][x] = null;
            this.collisionMap[y][x] = 0;
            this.grassMap[y][x] = 0;
        } else if (this.tool === 'fill') {
            this.floodFill(x, y);
        } else if (this.tool === 'pick') {
            const t = this.map[y][x];
            if (t) {
                const idx = this.allTiles.findIndex(tile => tile.sheet === t.sheet && tile.col === t.col && tile.row === t.row);
                if (idx >= 0) {
                    this.selectedTileIndex = idx;
                    document.querySelectorAll('.palette-tile-btn').forEach(b => {
                        b.classList.toggle('selected', parseInt(b.dataset.index) === idx);
                    });
                }
            }
        }
        this.render();
    }

    paintTileAt(x, y) {
        if (this.selectedTileIndex === null) return;
        const tile = this.allTiles[this.selectedTileIndex];
        if (!tile) return;
        this.map[y][x] = { sheet: tile.sheet, col: tile.col, row: tile.row };
        const isSolid = tile.sheet === 'buildings' || tile.sheet === 'roofs';
        const isGrassDetail = tile.sheet === 'plants' || tile.sheet === 'grass_cliff';
        this.collisionMap[y][x] = isSolid ? 1 : 0;
        this.grassMap[y][x] = isGrassDetail ? 1 : 0;
    }

    floodFill(x, y) {
        if (this.selectedTileIndex === null) return;
        const target = this.map[y][x];
        const newTile = { ...this.allTiles[this.selectedTileIndex] };
        delete newTile.canvas;
        delete newTile.label;

        if (target && newTile.sheet === target.sheet && newTile.col === target.col && newTile.row === target.row) return;

        const stack = [[x, y]];
        const visited = new Set();
        while (stack.length > 0) {
            const [cx, cy] = stack.pop();
            const key = `${cx},${cy}`;
            if (visited.has(key)) continue;
            if (cx < 0 || cx >= this.gridW || cy < 0 || cy >= this.gridH) continue;
            const current = this.map[cy][cx];
            const match = (!target && !current) || (target && current && current.sheet === target.sheet && current.col === target.col && current.row === target.row);
            if (!match) continue;
            visited.add(key);
            this.map[cy][cx] = newTile;
            this.collisionMap[cy][cx] = 0;
            this.grassMap[cy][cx] = 0;
            stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
        }
    }

    getTileCanvas(tileData) {
        if (!tileData) return null;
        const sheet = this.tilesets[tileData.sheet];
        if (!sheet) return null;

        const key = `${tileData.sheet}_${tileData.col}_${tileData.row}`;
        if (sheet._cache && sheet._cache[key]) return sheet._cache[key];

        const c = document.createElement('canvas');
        c.width = 16;
        c.height = 16;
        c.getContext('2d').drawImage(sheet.img, tileData.col * 16, tileData.row * 16, 16, 16, 0, 0, 16, 16);

        if (!sheet._cache) sheet._cache = {};
        sheet._cache[key] = c;
        return c;
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
                const tileData = this.map[y][x];

                if (tileData) {
                    const tileCanvas = this.getTileCanvas(tileData);
                    if (tileCanvas) {
                        ctx.drawImage(tileCanvas, 0, 0, 16, 16, sx, sy, ts, ts);
                    }
                } else {
                    ctx.fillStyle = '#2d5a27';
                    ctx.fillRect(sx, sy, ts, ts);
                    ctx.fillStyle = '#3a7a33';
                    const gx = sx + ((x * 7) % ts);
                    const gy = sy + ((y * 13) % ts);
                    ctx.fillRect(gx, gy, 2, 3);
                }

                if (this.collisionMap[y] && this.collisionMap[y][x]) {
                    ctx.fillStyle = 'rgba(255,0,0,0.2)';
                    ctx.fillRect(sx, sy, ts, ts);
                    ctx.strokeStyle = 'rgba(255,0,0,0.4)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(sx, sy); ctx.lineTo(sx + ts, sy + ts);
                    ctx.moveTo(sx + ts, sy); ctx.lineTo(sx, sy + ts);
                    ctx.stroke();
                }
            }
        }

        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
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
        if (coordsEl) coordsEl.textContent = `${this.gridW}x${this.gridH} | Zoom: ${this.displayTileSize}px`;
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
                newMap[y][x] = (this.map[y] && this.map[y][x]) || null;
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
            displayTileSize: this.displayTileSize,
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
            this.displayTileSize = data.displayTileSize || 32;
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
        this.currentMapName = '';
        this.render();
    }
}
