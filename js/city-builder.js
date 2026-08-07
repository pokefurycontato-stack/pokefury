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
        this.collisionEditMode = false;
        this.colDrawStart = null;
        this.colDrawBox = null;
        this.colSelectedIdx = -1;

        this.collisionZoneMode = false;
        this.collisionZones = [];
        this.zoneDrawStart = null;
        this.zoneDrawCurrent = null;
        this.zoneSelectedIdx = -1;
        this.zoneDragging = false;
        this.zoneDragOffset = { x: 0, y: 0 };

        this.teleportMode = false;
        this.teleports = [];
        this.teleportPlacing = null;
        this.teleportSelectedIdx = -1;
        this.teleportDragging = false;
        this.teleportDragPart = null;
        this.teleportDragOffset = { x: 0, y: 0 };

        this.npcRegionMode = false;
        this.npcRegions = [];
        this.npcRegionDragging = false;
        this.npcRegionSelectedIdx = -1;
        this.npcRegionDragOffset = { x: 0, y: 0 };

        this.battleZoneMode = false;
        this.battleZones = [];
        this.battleZoneDrawStart = null;
        this.battleZoneDrawCurrent = null;
        this.battleZoneSelectedIdx = -1;
        this.battleZoneDragging = false;
        this.battleZoneDragOffset = { x: 0, y: 0 };

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
        const zoneBtn = document.getElementById('cb-collision-zone-btn');
        if (zoneBtn) zoneBtn.addEventListener('click', () => this.toggleCollisionZoneMode());
        const teleportBtn = document.getElementById('cb-teleport-btn');
        if (teleportBtn) teleportBtn.addEventListener('click', () => this.toggleTeleportMode());
        const npcRegionBtn = document.getElementById('cb-npc-region-btn');
        if (npcRegionBtn) npcRegionBtn.addEventListener('click', () => this.toggleNpcRegionMode());
        const battleZoneBtn = document.getElementById('cb-battle-zone-btn');
        if (battleZoneBtn) battleZoneBtn.addEventListener('click', () => this.toggleBattleZoneMode());
        const addLayerBtn = document.getElementById('cb-add-layer-btn');
        if (addLayerBtn) addLayerBtn.addEventListener('click', () => this.addLayer());

        document.addEventListener('keydown', (e) => {
            if (!this.running) return;
            if (this.collisionEditMode) {
                if (e.key === 'Escape') { this.exitCollisionDraw(); return; }
                if ((e.key === 'Delete' || e.key === 'Backspace') && this.colSelectedIdx >= 0) {
                    e.preventDefault();
                    this.selected.collision_boxes.splice(this.colSelectedIdx, 1);
                    this.colSelectedIdx = -1;
                    return;
                }
                return;
            }
            if (this.collisionZoneMode && (e.key === 'Delete' || e.key === 'Backspace')) {
                e.preventDefault();
                this.deleteSelectedZone();
                return;
            }
            if (this.collisionZoneMode && e.key === 'Escape') {
                this.toggleCollisionZoneMode();
                return;
            }
            if (this.teleportMode) {
                if (e.key === 'Escape') { this.teleportPlacing = null; this.render(); return; }
                if (e.key === 'Enter' && this.teleportPlacing) { this.confirmTeleportPlace(); return; }
                if ((e.key === 'Delete' || e.key === 'Backspace') && this.teleportSelectedIdx >= 0) {
                    e.preventDefault();
                    this.deleteSelectedTeleport();
                    return;
                }
                return;
            }
            if (this.npcRegionMode) {
                if (e.key === 'Escape') { this.toggleNpcRegionMode(); return; }
                if ((e.key === 'Delete' || e.key === 'Backspace') && this.npcRegionSelectedIdx >= 0) {
                    e.preventDefault();
                    this.deleteSelectedNpcRegion();
                    return;
                }
                return;
            }
            if (this.battleZoneMode) {
                if (e.key === 'Escape') { this.toggleBattleZoneMode(); return; }
                if ((e.key === 'Delete' || e.key === 'Backspace') && this.battleZoneSelectedIdx >= 0) {
                    e.preventDefault();
                    this.deleteSelectedBattleZone();
                    return;
                }
                return;
            }
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

    toggleCollision(checked) {
        if (!this.selected) return;
        this.selected.has_collision = checked;
        if (checked) {
            if (!this.selected.collision_boxes) this.selected.collision_boxes = [];
            if (this.selected._img) {
                this.selected._mask = this.createMask(this.selected._img);
                this.selected._overlay = this.createOverlay(this.selected._img);
            }
        } else {
            this.selected.collision_boxes = [];
            this.selected._mask = null;
            this.selected._overlay = null;
        }
        this.updateProps();
        this.render();
    }

    renderCollisionBoxesUI(s) {
        const boxes = s.collision_boxes || [];
        const drawBtn = `<button onclick="window.cityBuilder.startCollisionDraw()" style="width:100%;padding:6px;border:none;border-radius:4px;background:#f59e0b;color:#000;font-size:11px;font-weight:700;cursor:pointer;margin-bottom:6px;">Desenhar Colisão</button>`;
        if (boxes.length === 0) {
            return `<div style="background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:8px;margin-top:4px;">
                <div style="color:rgba(255,255,255,0.4);font-size:10px;margin-bottom:6px;">Sem caixas = colisão no PNG inteiro</div>
                ${drawBtn}
            </div>`;
        }
        const boxRows = boxes.map((b, i) =>
            `<div style="display:flex;gap:4px;align-items:center;margin-bottom:4px;">
                <span style="color:rgba(255,255,255,0.3);font-size:10px;width:14px;">${i+1}</span>
                <input type="number" step="1" min="0" max="100" value="${Math.round(b.x*100)}" onchange="window.cityBuilder.updateBox(${i},'x',this.value)" placeholder="X%" style="width:42px;padding:3px;border-radius:3px;border:1px solid #30363d;background:#0d1117;color:#fff;font-size:10px;text-align:center;">
                <input type="number" step="1" min="0" max="100" value="${Math.round(b.y*100)}" onchange="window.cityBuilder.updateBox(${i},'y',this.value)" placeholder="Y%" style="width:42px;padding:3px;border-radius:3px;border:1px solid #30363d;background:#0d1117;color:#fff;font-size:10px;text-align:center;">
                <input type="number" step="1" min="1" max="100" value="${Math.round(b.w*100)}" onchange="window.cityBuilder.updateBox(${i},'w',this.value)" placeholder="W%" style="width:42px;padding:3px;border-radius:3px;border:1px solid #30363d;background:#0d1117;color:#fff;font-size:10px;text-align:center;">
                <input type="number" step="1" min="1" max="100" value="${Math.round(b.h*100)}" onchange="window.cityBuilder.updateBox(${i},'h',this.value)" placeholder="H%" style="width:42px;padding:3px;border-radius:3px;border:1px solid #30363d;background:#0d1117;color:#fff;font-size:10px;text-align:center;">
                <button onclick="window.cityBuilder.removeCollisionBox(${i})" style="border:none;background:none;color:#e94560;font-size:13px;cursor:pointer;padding:0 2px;">x</button>
            </div>`
        ).join('');
        return `<div style="background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:8px;margin-top:4px;">
            <div style="color:rgba(255,255,255,0.4);font-size:10px;margin-bottom:6px;">Caixas (X,Y,W,H % da imagem)</div>
            ${boxRows}
            ${drawBtn}
        </div>`;
    }

    addCollisionBox() {
        if (!this.selected) return;
        if (!this.selected.collision_boxes) this.selected.collision_boxes = [];
        this.selected.collision_boxes.push({ x: 0, y: 0, w: 1, h: 1 });
        this.updateProps();
        this.render();
    }

    updateBox(index, prop, val) {
        if (!this.selected || !this.selected.collision_boxes) return;
        this.selected.collision_boxes[index][prop] = Math.max(0, Math.min(1, parseFloat(val) / 100));
        this.render();
    }

    removeCollisionBox(index) {
        if (!this.selected || !this.selected.collision_boxes) return;
        this.selected.collision_boxes.splice(index, 1);
        this.updateProps();
        this.render();
    }

    startCollisionDraw() {
        if (!this.selected || !this.selected._img || !this.selected._img.naturalWidth) return;
        this.collisionEditMode = true;
        this.colSelectedIdx = -1;
        this.colDrawBox = null;
        this.colDrawStart = null;
        const sidebar = document.getElementById('cb-assets-panel');
        const props = document.getElementById('cb-props-panel');
        const layersBar = document.getElementById('cb-layers-bar');
        if (sidebar) sidebar.style.display = 'none';
        if (props) props.style.display = 'none';
        if (layersBar) layersBar.style.display = 'none';
        this.resizeCanvas();
    }

    exitCollisionDraw() {
        this.collisionEditMode = false;
        this.colDrawBox = null;
        this.colDrawStart = null;
        this.colSelectedIdx = -1;
        const sidebar = document.getElementById('cb-assets-panel');
        const props = document.getElementById('cb-props-panel');
        const layersBar = document.getElementById('cb-layers-bar');
        if (sidebar) sidebar.style.display = '';
        if (props) props.style.display = '';
        if (layersBar) layersBar.style.display = '';
        this.resizeCanvas();
        this.updateProps();
    }

    colScreenToWorld(clientX, clientY) {
        const a = this.selected;
        if (!a || !a._img) return { x: 0, y: 0 };
        const rect = this.canvas.getBoundingClientRect();
        const sx = clientX - rect.left;
        const sy = clientY - rect.top;
        const img = a._img;
        const cw = this.canvas.width;
        const ch = this.canvas.height;
        const imgW = img.naturalWidth;
        const imgH = img.naturalHeight;
        const scale = Math.min((cw - 80) / imgW, (ch - 100) / imgH);
        const drawW = imgW * scale;
        const drawH = imgH * scale;
        const ox = (cw - drawW) / 2;
        const oy = (ch - drawH) / 2;
        return {
            x: Math.max(0, Math.min(1, (sx - ox) / drawW)),
            y: Math.max(0, Math.min(1, (sy - oy) / drawH))
        };
    }

    onCollisionMouseDown(e) {
        if (e.button === 2) { e.preventDefault(); this.exitCollisionDraw(); return; }
        const w = this.colScreenToWorld(e.clientX, e.clientY);
        const a = this.selected;
        const boxes = a?.collision_boxes || [];
        let hitIdx = -1;
        for (let i = boxes.length - 1; i >= 0; i--) {
            const b = boxes[i];
            if (w.x >= b.x && w.x <= b.x + b.w && w.y >= b.y && w.y <= b.y + b.h) {
                hitIdx = i;
                break;
            }
        }
        if (hitIdx >= 0) {
            this.colSelectedIdx = hitIdx;
            this.colDrawStart = { x: w.x, y: w.y, mode: 'move' };
        } else {
            this.colSelectedIdx = -1;
            this.colDrawStart = { x: w.x, y: w.y, mode: 'draw' };
            this.colDrawBox = { x: w.x, y: w.y, w: 0, h: 0 };
        }
    }

    onCollisionMouseMove(e) {
        if (!this.colDrawStart || !this.selected) return;
        const w = this.colScreenToWorld(e.clientX, e.clientY);
        if (this.colDrawStart.mode === 'draw' && this.colDrawBox) {
            this.colDrawBox.w = w.x - this.colDrawStart.x;
            this.colDrawBox.h = w.y - this.colDrawStart.y;
        } else if (this.colDrawStart.mode === 'move' && this.colSelectedIdx >= 0) {
            const b = this.selected.collision_boxes[this.colSelectedIdx];
            const dx = w.x - this.colDrawStart.x;
            const dy = w.y - this.colDrawStart.y;
            b.x = Math.max(0, Math.min(1 - b.w, b.x + dx));
            b.y = Math.max(0, Math.min(1 - b.h, b.y + dy));
            this.colDrawStart = { x: w.x, y: w.y, mode: 'move' };
        }
    }

    onCollisionMouseUp(e) {
        if (this.colDrawStart?.mode === 'draw' && this.colDrawBox) {
            let b = this.colDrawBox;
            if (b.w < 0) { b.x += b.w; b.w = -b.w; }
            if (b.h < 0) { b.y += b.h; b.h = -b.h; }
            if (b.w > 0.01 && b.h > 0.01) {
                b.x = Math.round(b.x * 100) / 100;
                b.y = Math.round(b.y * 100) / 100;
                b.w = Math.round(b.w * 100) / 100;
                b.h = Math.round(b.h * 100) / 100;
                if (!this.selected.collision_boxes) this.selected.collision_boxes = [];
                this.selected.collision_boxes.push(b);
            }
            this.colDrawBox = null;
        }
        this.colDrawStart = null;
    }

    toggleCollisionZoneMode() {
        this.collisionZoneMode = !this.collisionZoneMode;
        const btn = document.getElementById('cb-collision-zone-btn');
        if (btn) btn.style.background = this.collisionZoneMode ? '#e74c3c' : 'rgba(255,255,255,0.15)';
        if (this.collisionZoneMode) {
            this.selected = null;
            this.updateProps();
            this.canvas.style.cursor = 'crosshair';
        } else {
            this.zoneDrawStart = null;
            this.zoneDrawCurrent = null;
            this.zoneSelectedIdx = -1;
            this.canvas.style.cursor = 'default';
        }
        this.render();
    }

    onZoneMouseDown(e) {
        const w = this.screenToWorld(e.clientX, e.clientY);
        for (let i = this.collisionZones.length - 1; i >= 0; i--) {
            const z = this.collisionZones[i];
            if (w.x >= z.pos_x && w.x <= z.pos_x + z.width && w.y >= z.pos_y && w.y <= z.pos_y + z.height) {
                this.zoneSelectedIdx = i;
                this.zoneDragging = true;
                this.zoneDragOffset = { x: w.x - z.pos_x, y: w.y - z.pos_y };
                this.render();
                return;
            }
        }
        this.zoneSelectedIdx = -1;
        this.zoneDrawStart = { x: w.x, y: w.y };
        this.zoneDrawCurrent = { x: w.x, y: w.y };
        this.render();
    }

    onZoneMouseMove(e) {
        const w = this.screenToWorld(e.clientX, e.clientY);
        if (this.zoneDragging && this.zoneSelectedIdx >= 0) {
            const z = this.collisionZones[this.zoneSelectedIdx];
            z.pos_x = w.x - this.zoneDragOffset.x;
            z.pos_y = w.y - this.zoneDragOffset.y;
            this.render();
        } else if (this.zoneDrawStart) {
            this.zoneDrawCurrent = { x: w.x, y: w.y };
            this.render();
        }
    }

    onZoneMouseUp(e) {
        if (this.zoneDrawStart && this.zoneDrawCurrent) {
            let x = this.zoneDrawStart.x;
            let y = this.zoneDrawStart.y;
            let w = this.zoneDrawCurrent.x - x;
            let h = this.zoneDrawCurrent.y - y;
            if (w < 0) { x += w; w = -w; }
            if (h < 0) { y += h; h = -h; }
            if (w > 4 && h > 4) {
                this.collisionZones.push({ pos_x: Math.round(x), pos_y: Math.round(y), width: Math.round(w), height: Math.round(h) });
            }
            this.zoneDrawStart = null;
            this.zoneDrawCurrent = null;
        }
        this.zoneDragging = false;
        this.render();
    }

    deleteSelectedZone() {
        if (this.zoneSelectedIdx >= 0) {
            this.collisionZones.splice(this.zoneSelectedIdx, 1);
            this.zoneSelectedIdx = -1;
            this.render();
        }
    }

    toggleTeleportMode() {
        this.teleportMode = !this.teleportMode;
        const btn = document.getElementById('cb-teleport-btn');
        if (btn) btn.style.background = this.teleportMode ? '#8b5cf6' : 'rgba(255,255,255,0.15)';
        if (this.teleportMode) {
            this.selected = null;
            this.collisionZoneMode = false;
            const zBtn = document.getElementById('cb-collision-zone-btn');
            if (zBtn) zBtn.style.background = 'rgba(255,255,255,0.15)';
            this.updateProps();
            this.canvas.style.cursor = 'crosshair';
            this.teleportPlacing = null;
        } else {
            this.teleportPlacing = null;
            this.teleportSelectedIdx = -1;
            this.canvas.style.cursor = 'default';
        }
        this.render();
    }

    onTeleportMouseDown(e) {
        if (e.button === 2) { this.teleportPlacing = null; this.render(); return; }
        const w = this.screenToWorld(e.clientX, e.clientY);

        if (this.teleportPlacing) {
            const tp = this.teleportPlacing;
            if (w.x >= tp.dest_x && w.x <= tp.dest_x + 32 && w.y >= tp.dest_y && w.y <= tp.dest_y + 32) {
                this.teleportDragging = true;
                this.teleportDragPart = 'dest';
                this.teleportDragOffset = { x: w.x - tp.dest_x, y: w.y - tp.dest_y };
                return;
            }
            if (w.x >= tp.sign_x && w.x <= tp.sign_x + tp.sign_width && w.y >= tp.sign_y && w.y <= tp.sign_y + tp.sign_height) {
                this.teleportDragging = true;
                this.teleportDragPart = 'sign';
                this.teleportDragOffset = { x: w.x - tp.sign_x, y: w.y - tp.sign_y };
                return;
            }
            return;
        }

        for (let i = this.teleports.length - 1; i >= 0; i--) {
            const t = this.teleports[i];
            const dx = t.dest_x + 16;
            const dy = t.dest_y + 16;
            if (Math.sqrt((w.x - dx) ** 2 + (w.y - dy) ** 2) < 20) {
                this.teleportSelectedIdx = i;
                this.teleportDragging = true;
                this.teleportDragPart = 'dest';
                this.teleportDragOffset = { x: w.x - t.dest_x, y: w.y - t.dest_y };
                return;
            }
            if (w.x >= t.sign_x && w.x <= t.sign_x + t.sign_width && w.y >= t.sign_y && w.y <= t.sign_y + t.sign_height) {
                this.teleportSelectedIdx = i;
                this.teleportDragging = true;
                this.teleportDragPart = 'sign';
                this.teleportDragOffset = { x: w.x - t.sign_x, y: w.y - t.sign_y };
                return;
            }
        }

        const name = prompt('Nome do teleport (ex: Pokemart, Laboratório):');
        if (!name) return;

        this.teleportPlacing = {
            name: name,
            sign_x: Math.round(w.x),
            sign_y: Math.round(w.y),
            sign_width: 64,
            sign_height: 64,
            dest_x: Math.round(w.x),
            dest_y: Math.round(w.y + 120)
        };
        this.render();
    }

    onTeleportMouseMove(e) {
        if (!this.teleportDragging) return;
        const w = this.screenToWorld(e.clientX, e.clientY);

        if (this.teleportPlacing) {
            if (this.teleportDragPart === 'sign') {
                this.teleportPlacing.sign_x = Math.round(w.x - this.teleportDragOffset.x);
                this.teleportPlacing.sign_y = Math.round(w.y - this.teleportDragOffset.y);
            } else {
                this.teleportPlacing.dest_x = Math.round(w.x - this.teleportDragOffset.x);
                this.teleportPlacing.dest_y = Math.round(w.y - this.teleportDragOffset.y);
            }
        } else if (this.teleportSelectedIdx >= 0) {
            const t = this.teleports[this.teleportSelectedIdx];
            if (this.teleportDragPart === 'sign') {
                t.sign_x = Math.round(w.x - this.teleportDragOffset.x);
                t.sign_y = Math.round(w.y - this.teleportDragOffset.y);
            } else {
                t.dest_x = Math.round(w.x - this.teleportDragOffset.x);
                t.dest_y = Math.round(w.y - this.teleportDragOffset.y);
            }
        }
        this.render();
    }

    onTeleportMouseUp(e) {
        this.teleportDragging = false;
        this.teleportDragPart = null;
    }

    confirmTeleportPlace() {
        if (!this.teleportPlacing) return;
        this.teleports.push({ ...this.teleportPlacing });
        this.teleportPlacing = null;
        this.render();
    }

    deleteSelectedTeleport() {
        if (this.teleportSelectedIdx >= 0) {
            this.teleports.splice(this.teleportSelectedIdx, 1);
            this.teleportSelectedIdx = -1;
            this.render();
        }
    }

    toggleNpcRegionMode() {
        this.npcRegionMode = !this.npcRegionMode;
        const btn = document.getElementById('cb-npc-region-btn');
        if (btn) btn.style.background = this.npcRegionMode ? '#f59e0b' : 'rgba(255,255,255,0.15)';
        if (this.npcRegionMode) {
            this.selected = null;
            this.collisionZoneMode = false;
            this.teleportMode = false;
            const zBtn = document.getElementById('cb-collision-zone-btn');
            if (zBtn) zBtn.style.background = 'rgba(255,255,255,0.15)';
            const tBtn = document.getElementById('cb-teleport-btn');
            if (tBtn) tBtn.style.background = 'rgba(255,255,255,0.15)';
            this.updateProps();
            this.canvas.style.cursor = 'crosshair';
        } else {
            this.npcRegionSelectedIdx = -1;
            this.canvas.style.cursor = 'default';
        }
        this.render();
    }

    onNpcRegionMouseDown(e) {
        const w = this.screenToWorld(e.clientX, e.clientY);
        for (let i = this.npcRegions.length - 1; i >= 0; i--) {
            const n = this.npcRegions[i];
            if (w.x >= n.pos_x && w.x <= n.pos_x + n.width && w.y >= n.pos_y && w.y <= n.pos_y + n.height) {
                this.npcRegionSelectedIdx = i;
                this.npcRegionDragging = true;
                this.npcRegionDragOffset = { x: w.x - n.pos_x, y: w.y - n.pos_y };
                this.render();
                return;
            }
        }
        const npc = {
            npc_type: 'region_selector',
            pos_x: Math.round(w.x),
            pos_y: Math.round(w.y),
            width: 64,
            height: 64,
            interaction_width: 128,
            interaction_height: 128,
            name: 'Aviador'
        };
        this.npcRegions.push(npc);
        this.npcRegionSelectedIdx = this.npcRegions.length - 1;
        this.render();
    }

    onNpcRegionMouseMove(e) {
        const w = this.screenToWorld(e.clientX, e.clientY);
        if (this.npcRegionDragging && this.npcRegionSelectedIdx >= 0) {
            const n = this.npcRegions[this.npcRegionSelectedIdx];
            n.pos_x = Math.round(w.x - this.npcRegionDragOffset.x);
            n.pos_y = Math.round(w.y - this.npcRegionDragOffset.y);
            this.render();
        }
    }

    onNpcRegionMouseUp(e) {
        this.npcRegionDragging = false;
    }

    deleteSelectedNpcRegion() {
        if (this.npcRegionSelectedIdx >= 0) {
            this.npcRegions.splice(this.npcRegionSelectedIdx, 1);
            this.npcRegionSelectedIdx = -1;
            this.render();
        }
    }

    toggleBattleZoneMode() {
        this.battleZoneMode = !this.battleZoneMode;
        const btn = document.getElementById('cb-battle-zone-btn');
        if (btn) btn.style.background = this.battleZoneMode ? '#e94560' : 'rgba(255,255,255,0.15)';
        if (this.battleZoneMode) {
            this.selected = null;
            this.collisionZoneMode = false;
            this.teleportMode = false;
            this.npcRegionMode = false;
            const zBtn = document.getElementById('cb-collision-zone-btn');
            if (zBtn) zBtn.style.background = 'rgba(255,255,255,0.15)';
            const tBtn = document.getElementById('cb-teleport-btn');
            if (tBtn) tBtn.style.background = 'rgba(255,255,255,0.15)';
            const nBtn = document.getElementById('cb-npc-region-btn');
            if (nBtn) nBtn.style.background = 'rgba(255,255,255,0.15)';
            this.updateProps();
            this.canvas.style.cursor = 'crosshair';
        } else {
            this.battleZoneDrawStart = null;
            this.battleZoneDrawCurrent = null;
            this.battleZoneSelectedIdx = -1;
            this.canvas.style.cursor = 'default';
        }
        this.render();
    }

    onBattleZoneMouseDown(e) {
        const w = this.screenToWorld(e.clientX, e.clientY);
        for (let i = this.battleZones.length - 1; i >= 0; i--) {
            const z = this.battleZones[i];
            if (w.x >= z.pos_x && w.x <= z.pos_x + z.width && w.y >= z.pos_y && w.y <= z.pos_y + z.height) {
                this.battleZoneSelectedIdx = i;
                this.battleZoneDragging = true;
                this.battleZoneDragOffset = { x: w.x - z.pos_x, y: w.y - z.pos_y };
                this.render();
                return;
            }
        }
        this.battleZoneSelectedIdx = -1;
        this.battleZoneDrawStart = { x: w.x, y: w.y };
        this.battleZoneDrawCurrent = { x: w.x, y: w.y };
        this.render();
    }

    onBattleZoneMouseMove(e) {
        const w = this.screenToWorld(e.clientX, e.clientY);
        if (this.battleZoneDragging && this.battleZoneSelectedIdx >= 0) {
            const z = this.battleZones[this.battleZoneSelectedIdx];
            z.pos_x = w.x - this.battleZoneDragOffset.x;
            z.pos_y = w.y - this.battleZoneDragOffset.y;
            this.render();
        } else if (this.battleZoneDrawStart) {
            this.battleZoneDrawCurrent = { x: w.x, y: w.y };
            this.render();
        }
    }

    onBattleZoneMouseUp(e) {
        if (this.battleZoneDrawStart && this.battleZoneDrawCurrent) {
            let x = this.battleZoneDrawStart.x;
            let y = this.battleZoneDrawStart.y;
            let w = this.battleZoneDrawCurrent.x - x;
            let h = this.battleZoneDrawCurrent.y - y;
            if (w < 0) { x += w; w = -w; }
            if (h < 0) { y += h; h = -h; }
            if (w > 4 && h > 4) {
                const name = prompt('Nome da zona de batalha (ex: Floresta, Caverna):') || 'Batalha';
                this.battleZones.push({ zone_name: name, pos_x: Math.round(x), pos_y: Math.round(y), width: Math.round(w), height: Math.round(h) });
            }
            this.battleZoneDrawStart = null;
            this.battleZoneDrawCurrent = null;
        }
        this.battleZoneDragging = false;
        this.render();
    }

    deleteSelectedBattleZone() {
        if (this.battleZoneSelectedIdx >= 0) {
            this.battleZones.splice(this.battleZoneSelectedIdx, 1);
            this.battleZoneSelectedIdx = -1;
            this.render();
        }
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
            'escada.png', 'barro.png', 'barranco.png', 'arvore.png',
            'casa1.png', 'casa2.png', 'casa3.png', 'casa4.png', 'casa5.png',
            'pokemart.png', 'laboratorio.png',
            'centropokemon.png', 'basquete.png', 'arena.png',
            'cerca1.png', 'cerca2.png', 'cerca3.png', 'placa.png', 'granite-cave-b1.png', 'hoenn-route-102.png', 'kanto-route-19.png', 'mt-coronet-f3.png', 'mt-pyre-exterior.png', 'pokemon-center.png', 'rock-tunnel-b1.png', 'safari.png', 'shoal-cave-ice-room.png', 'terra-cave-end.png',
            'pedra.png', 'gramav1.png', 'pedrav1.png', 'aguav1.png', 'icev1.png', 'psiv1.png', 'eletricov1.png', 'vulcv1.png',
            'coqueiro1.png', 'gelo1.png', 'gelo2.png', 'gelo3.png', 'grade1.png', 'grade2.png', 'pisometal.png', 'praia1.png', 'praia2.png', 'praia3.png', 'psi1.png', 'psi2.png', 'psi3.png', 'aviao.png', 'vulc1.png', 'vulc2.png', 'vulc3.png'
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
        this.canvas.onmouseup = (e) => {
            if (this.collisionEditMode) { this.onCollisionMouseUp(e); return; }
            if (this.collisionZoneMode) { this.onZoneMouseUp(e); return; }
            if (this.teleportMode) { this.onTeleportMouseUp(e); return; }
            if (this.npcRegionMode) { this.onNpcRegionMouseUp(e); return; }
            if (this.battleZoneMode) { this.onBattleZoneMouseUp(e); return; }
            this.dragging = false;
        };
        this.canvas.onwheel = (e) => this.onWheel(e);
        this.canvas.oncontextmenu = (e) => e.preventDefault();
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
        if (this.collisionEditMode) { this.onCollisionMouseDown(e); return; }
        if (this.collisionZoneMode) { this.onZoneMouseDown(e); return; }
        if (this.teleportMode) { this.onTeleportMouseDown(e); return; }
        if (this.npcRegionMode) { this.onNpcRegionMouseDown(e); return; }
        if (this.battleZoneMode) { this.onBattleZoneMouseDown(e); return; }
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
        if (this.collisionEditMode) { this.onCollisionMouseMove(e); return; }
        if (this.collisionZoneMode) { this.onZoneMouseMove(e); return; }
        if (this.teleportMode) { this.onTeleportMouseMove(e); return; }
        if (this.npcRegionMode) { this.onNpcRegionMouseMove(e); return; }
        if (this.battleZoneMode) { this.onBattleZoneMouseMove(e); return; }
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
                    <input type="checkbox" ${s.has_collision ? 'checked' : ''} onchange="window.cityBuilder.toggleCollision(this.checked)" style="cursor:pointer;">
                    <span>Colisão (bloqueia passagem)</span>
                </label>
                ${s.has_collision ? this.renderCollisionBoxesUI(s) : ''}
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
                    collision_boxes: a.collision_boxes || [],
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
            const { data: zones } = await window.db.from('city_collision_zones').select('*');
            if (zones) {
                this.collisionZones = zones.map(z => ({
                    pos_x: z.pos_x, pos_y: z.pos_y, width: z.width, height: z.height
                }));
            }
            const { data: tps } = await window.db.from('city_teleports').select('*');
            if (tps) {
                this.teleports = tps.map(t => ({
                    name: t.name,
                    sign_x: t.sign_x, sign_y: t.sign_y,
                    sign_width: t.sign_width, sign_height: t.sign_height,
                    dest_x: t.dest_x, dest_y: t.dest_y
                }));
            }
            const { data: npcs } = await window.db.from('city_npcs').select('*');
            if (npcs) {
                this.npcRegions = npcs.map(n => ({
                    npc_type: n.npc_type,
                    pos_x: n.pos_x, pos_y: n.pos_y,
                    width: n.width, height: n.height,
                    interaction_width: n.interaction_width, interaction_height: n.interaction_height,
                    name: n.name,
                    sprite_url: n.sprite_url
                }));
            }
            const { data: bz } = await window.db.from('city_battle_zones').select('*');
            if (bz) {
                this.battleZones = bz.map(z => ({
                    zone_name: z.zone_name,
                    pos_x: z.pos_x, pos_y: z.pos_y,
                    width: z.width, height: z.height
                }));
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
                has_collision: a.has_collision || false,
                collision_boxes: (a.collision_boxes && a.collision_boxes.length > 0) ? JSON.parse(JSON.stringify(a.collision_boxes)) : null
            }));
            if (toSave.length > 0) {
                const { error } = await window.db.from('city_layout').insert(toSave);
                if (error) throw error;
            }
            await window.db.from('city_collision_zones').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (this.collisionZones.length > 0) {
                const zonesToSave = this.collisionZones.map(z => ({
                    pos_x: z.pos_x, pos_y: z.pos_y, width: z.width, height: z.height
                }));
                const { error: ze } = await window.db.from('city_collision_zones').insert(zonesToSave);
                if (ze) throw ze;
            }
            await window.db.from('city_teleports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (this.teleports.length > 0) {
                const tpToSave = this.teleports.map(t => ({
                    name: t.name,
                    sign_x: t.sign_x, sign_y: t.sign_y,
                    sign_width: t.sign_width, sign_height: t.sign_height,
                    dest_x: t.dest_x, dest_y: t.dest_y
                }));
                const { error: te } = await window.db.from('city_teleports').insert(tpToSave);
                if (te) throw te;
            }
            await window.db.from('city_npcs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (this.npcRegions.length > 0) {
                const npcToSave = this.npcRegions.map(n => ({
                    npc_type: n.npc_type || 'region_selector',
                    pos_x: n.pos_x, pos_y: n.pos_y,
                    width: n.width, height: n.height,
                    interaction_width: n.interaction_width, interaction_height: n.interaction_height,
                    name: n.name || 'Aviador',
                    sprite_url: n.sprite_url || null
                }));
                const { error: ne } = await window.db.from('city_npcs').insert(npcToSave);
                if (ne) throw ne;
            }
            await window.db.from('city_battle_zones').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (this.battleZones.length > 0) {
                const bzToSave = this.battleZones.map(z => ({
                    zone_name: z.zone_name,
                    pos_x: z.pos_x, pos_y: z.pos_y,
                    width: z.width, height: z.height
                }));
                const { error: bze } = await window.db.from('city_battle_zones').insert(bzToSave);
                if (bze) throw bze;
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
            if (!a.has_collision) continue;
            const img = a._img;
            if (!img || !img.complete || !img.naturalWidth) continue;
            const sc = a.scale || 1;
            const aw = img.naturalWidth * sc;
            const ah = img.naturalHeight * sc;
            const boxes = a.collision_boxes;
            if (boxes && boxes.length > 0) {
                for (const b of boxes) {
                    const bx = a.pos_x + b.x * aw;
                    const by = a.pos_y + b.y * ah;
                    const bw = b.w * aw;
                    const bh = b.h * ah;
                    if (px < bx + bw && px + ps > bx && py < by + bh && py + ps > by) return true;
                }
            } else if (a._mask) {
                const m = a._mask;
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
            } else {
                if (px < a.pos_x + aw && px + ps > a.pos_x && py < a.pos_y + ah && py + ps > a.pos_y) return true;
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

        if (this.collisionEditMode && this.selected) {
            this.renderCollisionEdit(ctx, cw, ch);
            return;
        }

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
                const boxes = a.collision_boxes;
                if (boxes && boxes.length > 0) {
                    ctx.fillStyle = 'rgba(231, 76, 60, 0.35)';
                    ctx.strokeStyle = 'rgba(231, 76, 60, 0.8)';
                    ctx.lineWidth = 2 / zoom;
                    for (const b of boxes) {
                        const bx = a.pos_x + b.x * aw;
                        const by = a.pos_y + b.y * ah;
                        const bw = b.w * aw;
                        const bh = b.h * ah;
                        ctx.fillRect(bx, by, bw, bh);
                        ctx.strokeRect(bx, by, bw, bh);
                    }
                } else if (a._overlay) {
                    ctx.drawImage(a._overlay, a.pos_x, a.pos_y, aw, ah);
                } else {
                    ctx.fillStyle = 'rgba(231, 76, 60, 0.3)';
                    ctx.fillRect(a.pos_x, a.pos_y, aw, ah);
                }
            }
            ctx.restore();
        });

        if (this.collisionZoneMode || this.collisionZones.length > 0) {
            ctx.fillStyle = 'rgba(231, 76, 60, 0.25)';
            ctx.strokeStyle = 'rgba(231, 76, 60, 0.8)';
            ctx.lineWidth = 2 / this.zoom;
            this.collisionZones.forEach((z, i) => {
                if (i === this.zoneSelectedIdx) {
                    ctx.fillStyle = 'rgba(231, 76, 60, 0.4)';
                    ctx.strokeStyle = '#fff';
                } else {
                    ctx.fillStyle = 'rgba(231, 76, 60, 0.25)';
                    ctx.strokeStyle = 'rgba(231, 76, 60, 0.8)';
                }
                ctx.fillRect(z.pos_x, z.pos_y, z.width, z.height);
                ctx.strokeRect(z.pos_x, z.pos_y, z.width, z.height);
            });
            if (this.zoneDrawStart && this.zoneDrawCurrent) {
                let dx = Math.min(this.zoneDrawStart.x, this.zoneDrawCurrent.x);
                let dy = Math.min(this.zoneDrawStart.y, this.zoneDrawCurrent.y);
                let dw = Math.abs(this.zoneDrawCurrent.x - this.zoneDrawStart.x);
                let dh = Math.abs(this.zoneDrawCurrent.y - this.zoneDrawStart.y);
                ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
                ctx.strokeStyle = '#22c55e';
                ctx.lineWidth = 2 / this.zoom;
                ctx.fillRect(dx, dy, dw, dh);
                ctx.strokeRect(dx, dy, dw, dh);
            }
        }

        if (this.teleportMode || this.teleports.length > 0) {
            this.teleports.forEach((t, i) => {
                const isSelected = i === this.teleportSelectedIdx;

                ctx.fillStyle = isSelected ? 'rgba(139, 92, 246, 0.5)' : 'rgba(139, 92, 246, 0.3)';
                ctx.strokeStyle = isSelected ? '#fff' : '#8b5cf6';
                ctx.lineWidth = 2 / this.zoom;
                ctx.fillRect(t.sign_x, t.sign_y, t.sign_width, t.sign_height);
                ctx.strokeRect(t.sign_x, t.sign_y, t.sign_width, t.sign_height);

                ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
                ctx.strokeStyle = '#22c55e';
                ctx.lineWidth = 2 / this.zoom;
                ctx.beginPath();
                ctx.arc(t.dest_x + 16, t.dest_y + 16, 16, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
                ctx.lineWidth = 1 / this.zoom;
                ctx.setLineDash([6 / this.zoom, 4 / this.zoom]);
                ctx.beginPath();
                ctx.moveTo(t.sign_x + t.sign_width / 2, t.sign_y + t.sign_height);
                ctx.lineTo(t.dest_x + 16, t.dest_y);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.fillStyle = '#fff';
                ctx.font = `bold ${12 / this.zoom}px Inter, sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText(t.name, t.sign_x + t.sign_width / 2, t.sign_y - 6 / this.zoom);
            });

            if (this.teleportPlacing) {
                const tp = this.teleportPlacing;
                ctx.fillStyle = 'rgba(139, 92, 246, 0.4)';
                ctx.strokeStyle = '#8b5cf6';
                ctx.lineWidth = 2 / this.zoom;
                ctx.fillRect(tp.sign_x, tp.sign_y, tp.sign_width, tp.sign_height);
                ctx.strokeRect(tp.sign_x, tp.sign_y, tp.sign_width, tp.sign_height);

                ctx.fillStyle = 'rgba(34, 197, 94, 0.4)';
                ctx.strokeStyle = '#22c55e';
                ctx.beginPath();
                ctx.arc(tp.dest_x + 16, tp.dest_y + 16, 16, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#fff';
                ctx.font = `bold ${12 / this.zoom}px Inter, sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText(tp.name + ' (Enter=confirmar)', tp.sign_x + tp.sign_width / 2, tp.sign_y - 6 / this.zoom);
            }
        }

        if (this.npcRegionMode || this.npcRegions.length > 0) {
            this.npcRegions.forEach((n, i) => {
                const isSelected = i === this.npcRegionSelectedIdx;
                ctx.fillStyle = isSelected ? 'rgba(245, 158, 11, 0.5)' : 'rgba(245, 158, 11, 0.3)';
                ctx.strokeStyle = isSelected ? '#fff' : '#f59e0b';
                ctx.lineWidth = 2 / this.zoom;
                ctx.fillRect(n.pos_x, n.pos_y, n.width, n.height);
                ctx.strokeRect(n.pos_x, n.pos_y, n.width, n.height);

                ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
                ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
                ctx.lineWidth = 1 / this.zoom;
                ctx.setLineDash([6 / this.zoom, 4 / this.zoom]);
                const ix = n.pos_x + n.width / 2 - n.interaction_width / 2;
                const iy = n.pos_y + n.height / 2 - n.interaction_height / 2;
                ctx.strokeRect(ix, iy, n.interaction_width, n.interaction_height);
                ctx.setLineDash([]);

                ctx.fillStyle = '#f59e0b';
                ctx.font = `bold ${12 / this.zoom}px Inter, sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText('✈️ ' + n.name, n.pos_x + n.width / 2, n.pos_y - 6 / this.zoom);
            });
        }

        if (this.battleZoneMode || this.battleZones.length > 0) {
            this.battleZones.forEach((z, i) => {
                const isSelected = i === this.battleZoneSelectedIdx;
                ctx.fillStyle = isSelected ? 'rgba(233, 69, 96, 0.45)' : 'rgba(233, 69, 96, 0.25)';
                ctx.strokeStyle = isSelected ? '#fff' : '#e94560';
                ctx.lineWidth = 2 / this.zoom;
                ctx.fillRect(z.pos_x, z.pos_y, z.width, z.height);
                ctx.strokeRect(z.pos_x, z.pos_y, z.width, z.height);

                ctx.fillStyle = '#e94560';
                ctx.font = `bold ${12 / this.zoom}px Inter, sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText('⚔️ ' + z.zone_name, z.pos_x + z.width / 2, z.pos_y - 6 / this.zoom);
            });
            if (this.battleZoneDrawStart && this.battleZoneDrawCurrent) {
                let dx = Math.min(this.battleZoneDrawStart.x, this.battleZoneDrawCurrent.x);
                let dy = Math.min(this.battleZoneDrawStart.y, this.battleZoneDrawCurrent.y);
                let dw = Math.abs(this.battleZoneDrawCurrent.x - this.battleZoneDrawStart.x);
                let dh = Math.abs(this.battleZoneDrawCurrent.y - this.battleZoneDrawStart.y);
                ctx.fillStyle = 'rgba(233, 69, 96, 0.3)';
                ctx.strokeStyle = '#e94560';
                ctx.lineWidth = 2 / this.zoom;
                ctx.fillRect(dx, dy, dw, dh);
                ctx.strokeRect(dx, dy, dw, dh);
            }
        }

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

    renderCollisionEdit(ctx, cw, ch) {
        const a = this.selected;
        const img = a._img;
        if (!img || !img.complete || !img.naturalWidth) return;

        ctx.fillStyle = '#0a0e1a';
        ctx.fillRect(0, 0, cw, ch);

        const imgW = img.naturalWidth;
        const imgH = img.naturalHeight;
        const scale = Math.min((cw - 80) / imgW, (ch - 100) / imgH);
        const drawW = imgW * scale;
        const drawH = imgH * scale;
        const ox = (cw - drawW) / 2;
        const oy = (ch - drawH) / 2;

        ctx.drawImage(img, ox, oy, drawW, drawH);

        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(ox, oy, drawW, drawH);

        const boxes = a.collision_boxes || [];
        for (let i = 0; i < boxes.length; i++) {
            const b = boxes[i];
            const bx = ox + b.x * drawW;
            const by = oy + b.y * drawH;
            const bw = b.w * drawW;
            const bh = b.h * drawH;
            ctx.fillStyle = i === this.colSelectedIdx ? 'rgba(231, 76, 60, 0.5)' : 'rgba(231, 76, 60, 0.3)';
            ctx.fillRect(bx, by, bw, bh);
            ctx.strokeStyle = i === this.colSelectedIdx ? '#fff' : 'rgba(231, 76, 60, 0.9)';
            ctx.lineWidth = i === this.colSelectedIdx ? 2 : 1;
            ctx.strokeRect(bx, by, bw, bh);
        }

        if (this.colDrawBox && this.colDrawBox.w !== 0 && this.colDrawBox.h !== 0) {
            let db = this.colDrawBox;
            let dx = db.w < 0 ? db.x + db.w : db.x;
            let dy = db.h < 0 ? db.y + db.h : db.y;
            let dw = Math.abs(db.w);
            let dh = Math.abs(db.h);
            ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
            ctx.fillRect(ox + dx * drawW, oy + dy * drawH, dw * drawW, dh * drawH);
            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 2;
            ctx.strokeRect(ox + dx * drawW, oy + dy * drawH, dw * drawW, dh * drawH);
        }

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(a.asset_id, cw / 2, oy - 16);
        ctx.font = '11px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('Click+Arrastar: desenhar caixa | Click na caixa: selecionar/mover | Delete: remover | Esc: concluir', cw / 2, oy + drawH + 24);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.cityBuilder = new CityBuilder();
});
