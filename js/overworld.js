if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii) {
        let r;
        if (typeof radii === 'number') {
            r = [radii, radii, radii, radii];
        } else if (Array.isArray(radii)) {
            r = [radii[0] || 0, radii[1] || radii[0] || 0, radii[2] || radii[0] || 0, radii[3] || radii[1] || radii[0] || 0];
        } else {
            r = [0, 0, 0, 0];
        }
        this.moveTo(x + r[0], y);
        this.arcTo(x + w, y, x + w, y + h, r[1]);
        this.arcTo(x + w, y + h, x, y + h, r[2]);
        this.arcTo(x, y + h, x, y, r[3]);
        this.arcTo(x, y, x + w, y, r[0]);
        this.closePath();
    };
}

export class Overworld2D {
    constructor(game) {
        this.game = game;
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.tileSize = 32;
        this.worldCols = 40;
        this.worldRows = 30;
        this.gridCols = this.worldCols;
        this.gridRows = this.worldRows;

        this.player = {
            x: 20,
            y: 15,
            direction: 'down',
            frame: 0,
            frameTimer: 0,
            moving: false,
            moveProgress: 0,
            fromX: 20,
            fromY: 15
        };

        this.camera = { x: 0, y: 0 };
        this.keys = {};
        this.moveCooldown = 0;
        this.encounterCooldown = 0;
        this.transitionCooldown = 0;

        this.currentMapImage = null;
        this.currentMapData = null;
        this.encounterZones = [];

        this.pokemonFollowing = null;
        this.pokemonFollowSprite = null;
        this.pokemonFollowPos = { x: 20, y: 15 };

        this.playerSprites = {};
        this.loaded = false;
        this.frameCount = 0;

        this.mapImageCache = {};

        this.init();
    }

    async init() {
        this.setupInput();
        await this.loadSprites();
        this.loaded = true;
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.loop();
    }

    resize() {
        const mainArea = document.getElementById('main-area');
        if (mainArea) {
            this.canvas.width = mainArea.clientWidth;
            this.canvas.height = mainArea.clientHeight;
        } else {
            this.canvas.width = window.innerWidth - 240;
            this.canvas.height = window.innerHeight - 48;
        }
    }

    setupInput() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
                e.preventDefault();
            }
        });
        document.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });
    }

    async loadSprites() {
        this.playerSprites = {
            down: await this.createPlayerSprite('down'),
            up: await this.createPlayerSprite('up'),
            left: await this.createPlayerSprite('left'),
            right: await this.createPlayerSprite('right')
        };
    }

    async createPlayerSprite(direction) {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');

        const bodyColor = this.game.playerGender === 'female' ? '#e94560' : '#3498db';
        const skinColor = '#f5cba7';
        const hairColor = '#2c3e50';
        const pantsColor = '#34495e';

        ctx.imageSmoothingEnabled = false;

        ctx.fillStyle = bodyColor;
        ctx.fillRect(8, 10, 16, 10);
        ctx.fillStyle = skinColor;
        ctx.fillRect(10, 2, 12, 10);
        ctx.fillStyle = hairColor;
        ctx.fillRect(10, 0, 12, 4);
        ctx.fillStyle = pantsColor;
        ctx.fillRect(9, 20, 6, 10);
        ctx.fillRect(17, 20, 6, 10);
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(8, 8, 16, 2);

        if (direction === 'down') {
            ctx.fillStyle = '#000';
            ctx.fillRect(12, 5, 2, 2);
            ctx.fillRect(18, 5, 2, 2);
        } else if (direction === 'up') {
            ctx.fillStyle = hairColor;
            ctx.fillRect(10, 0, 12, 8);
        } else if (direction === 'left') {
            ctx.fillStyle = '#000';
            ctx.fillRect(10, 5, 2, 2);
        } else if (direction === 'right') {
            ctx.fillStyle = '#000';
            ctx.fillRect(20, 5, 2, 2);
        }

        const img = new Image();
        img.src = canvas.toDataURL();
        return new Promise(resolve => { img.onload = () => resolve(img); });
    }

    async loadMapImage(url) {
        if (this.mapImageCache[url]) return this.mapImageCache[url];
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                this.mapImageCache[url] = img;
                resolve(img);
            };
            img.onerror = () => resolve(null);
            img.src = url;
        });
    }

    async setCurrentMap(mapData) {
        this.currentMapData = mapData;
        this.currentMapImage = await this.loadMapImage(mapData.image_url);

        this.encounterZones = [];
        this.transitionCooldown = 0;

        if (mapData.encounter_rate > 0) {
            this.encounterZones.push({
                rate: mapData.encounter_rate / 100,
                minLevel: mapData.min_level || 2,
                maxLevel: mapData.max_level || 8
            });
        }

        this.player.x = Math.floor(this.worldCols / 2);
        this.player.y = Math.floor(this.worldRows / 2);
        this.player.fromX = this.player.x;
        this.player.fromY = this.player.y;
        this.player.moving = false;
        this.player.direction = 'down';

        this.pokemonFollowPos = { x: this.player.x, y: this.player.y };

        this.camera.x = this.player.x * this.tileSize - this.canvas.width / 2 + this.tileSize / 2;
        this.camera.y = this.player.y * this.tileSize - this.canvas.height / 2 + this.tileSize / 2;
    }

    async loadPokemonFollowSprite(pokemon) {
        if (!pokemon) return;
        const spriteUrl = pokemon.spriteUrls?.front || pokemon.spriteUrls?.home || pokemon.spriteUrls?.official;
        if (spriteUrl) {
            this.pokemonFollowSprite = await PokeAPI.preloadSprite(spriteUrl);
        }
        this.pokemonFollowing = pokemon;
    }

    loop() {
        this.frameCount++;
        if (this.encounterCooldown > 0) this.encounterCooldown--;
        if (this.moveCooldown > 0) this.moveCooldown--;
        if (this.transitionCooldown > 0) this.transitionCooldown--;

        try {
            this.handleInput();
            this.update();
            this.render();
        } catch (e) {
            console.error('[Overworld] Loop error:', e);
        }

        requestAnimationFrame(() => this.loop());
    }

    handleInput() {
        if (this.game.state !== 'overworld') return;
        if (this.player.moving) return;
        if (this.moveCooldown > 0) return;
        if (this.transitionCooldown > 0) return;

        let dx = 0, dy = 0, dir = null;

        if (this.keys['ArrowUp'] || this.keys['w'] || this.keys['W']) { dy = -1; dir = 'up'; }
        else if (this.keys['ArrowDown'] || this.keys['s'] || this.keys['S']) { dy = 1; dir = 'down'; }
        else if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) { dx = -1; dir = 'left'; }
        else if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) { dx = 1; dir = 'right'; }

        if (dir) {
            this.player.direction = dir;
            const nx = this.player.x + dx;
            const ny = this.player.y + dy;

            if (nx < 0 || nx >= this.worldCols || ny < 0 || ny >= this.worldRows) {
                this.handleTransition(dir);
                return;
            }

            this.player.fromX = this.player.x;
            this.player.fromY = this.player.y;
            this.player.x = nx;
            this.player.y = ny;
            this.player.moving = true;
            this.player.moveProgress = 0;
            this.player.frame = (this.player.frame + 1) % 4;
        }
    }

    handleTransition(direction) {
        if (this.transitionCooldown > 0) return;
        this.transitionCooldown = 30;
        if (this.game.regionManager) {
            this.game.advanceToNextMap();
        }
    }

    update() {
        if (this.player.moving) {
            this.player.moveProgress += 0.1;
            if (this.player.moveProgress >= 1) {
                this.player.moveProgress = 1;
                this.player.moving = false;
                this.player.fromX = this.player.x;
                this.player.fromY = this.player.y;
                this.moveCooldown = 6;

                this.updatePokemonFollow();

                if (this.encounterCooldown <= 0 && this.encounterZones.length > 0) {
                    this.tryEncounter();
                }
            }
        }

        const ts = this.tileSize;
        const halfW = this.canvas.width / 2;
        const halfH = this.canvas.height / 2;
        const maxCamX = this.worldCols * ts - this.canvas.width;
        const maxCamY = this.worldRows * ts - this.canvas.height;

        this.camera.x = Math.max(0, Math.min(
            this.player.x * ts + ts / 2 - halfW,
            Math.max(0, maxCamX)
        ));
        this.camera.y = Math.max(0, Math.min(
            this.player.y * ts + ts / 2 - halfH,
            Math.max(0, maxCamY)
        ));
    }

    updatePokemonFollow() {
        if (!this.pokemonFollowing) return;
        const dx = this.player.x - this.pokemonFollowPos.x;
        const dy = this.player.y - this.pokemonFollowPos.y;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            if (Math.abs(dx) >= Math.abs(dy)) this.pokemonFollowPos.x += Math.sign(dx);
            else this.pokemonFollowPos.y += Math.sign(dy);
        } else {
            if (Math.abs(dx) === 1) this.pokemonFollowPos.x += Math.sign(dx);
            if (Math.abs(dy) === 1) this.pokemonFollowPos.y += Math.sign(dy);
        }
    }

    tryEncounter() {
        if (this.game.state !== 'overworld') return;
        if (!this.game.playerTeam || this.game.playerTeam.length === 0) return;

        const zone = this.encounterZones[0];
        if (!zone) return;

        if (Math.random() < zone.rate) {
            this.encounterCooldown = 20;
            this.game.startWildBattle(zone.minLevel, zone.maxLevel);
        }
    }

    render() {
        if (!this.loaded || this.game.state !== 'overworld') return;

        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, w, h);

        if (this.currentMapImage && this.currentMapImage.complete) {
            const mapDrawW = this.worldCols * this.tileSize;
            const mapDrawH = this.worldRows * this.tileSize;

            ctx.drawImage(
                this.currentMapImage,
                -this.camera.x, -this.camera.y,
                mapDrawW, mapDrawH
            );

            this.drawGrid(ctx, w, h);
        } else {
            ctx.fillStyle = '#2d5a27';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = '16px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Carregando mapa...', w / 2, h / 2);
        }

        this.drawPlayer(ctx);
        this.drawMinimap(ctx, w, h);
        this.drawHUD(ctx, w, h);
    }

    drawGrid(ctx, w, h) {
        const ts = this.tileSize;
        const startX = Math.floor(this.camera.x / ts);
        const startY = Math.floor(this.camera.y / ts);
        const endX = Math.ceil((this.camera.x + w) / ts);
        const endY = Math.ceil((this.camera.y + h) / ts);

        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 0.5;
        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                const sx = x * ts - this.camera.x;
                const sy = y * ts - this.camera.y;
                ctx.strokeRect(sx, sy, ts, ts);
            }
        }
    }

    drawPlayer(ctx) {
        const ts = this.tileSize;
        let drawX, drawY;

        if (this.player.moving) {
            const t = this.player.moveProgress;
            drawX = (this.player.fromX + (this.player.x - this.player.fromX) * t) * ts - this.camera.x;
            drawY = (this.player.fromY + (this.player.y - this.player.fromY) * t) * ts - this.camera.y;
        } else {
            drawX = this.player.x * ts - this.camera.x;
            drawY = this.player.y * ts - this.camera.y;
        }

        const sprite = this.playerSprites[this.player.direction];
        if (sprite && sprite.complete) {
            ctx.drawImage(sprite, drawX, drawY, ts, ts);
        } else {
            ctx.fillStyle = '#3498db';
            ctx.fillRect(drawX + 4, drawY + 4, ts - 8, ts - 8);
        }

        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(drawX + ts / 2, drawY + ts - 2, ts / 3, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        if (this.pokemonFollowing && this.pokemonFollowSprite && this.pokemonFollowSprite.complete) {
            const px = this.pokemonFollowPos.x * ts - this.camera.x;
            const py = this.pokemonFollowPos.y * ts - this.camera.y;
            ctx.drawImage(this.pokemonFollowSprite, px, py, ts, ts);
        }
    }

    drawMinimap(ctx, screenW, screenH) {
        if (!this.currentMapImage || !this.currentMapImage.complete) return;

        const mmW = 140;
        const mmH = 100;
        const mmX = screenW - mmW - 12;
        const mmY = screenH - mmH - 12;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.strokeStyle = 'rgba(233, 69, 96, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(mmX - 4, mmY - 4, mmW + 8, mmH + 8, 6);
        ctx.fill();
        ctx.stroke();

        ctx.drawImage(this.currentMapImage, mmX, mmY, mmW, mmH);

        const px = mmX + (this.player.x / this.worldCols) * mmW;
        const py = mmY + (this.player.y / this.worldRows) * mmH;
        ctx.fillStyle = '#e94560';
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();

        const mapName = this.currentMapData?.name || 'Mapa';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(mapName, mmX + mmW / 2, mmY - 8);
    }

    drawHUD(ctx, w, h) {
        const mapName = this.currentMapData?.name || '';
        const regionName = this.game.currentRegion?.name || '';

        if (regionName) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.beginPath();
            ctx.roundRect(12, 12, ctx.measureText(regionName).width + 24, 24, 6);
            ctx.fill();
            ctx.fillStyle = '#e94560';
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(regionName, 24, 28);
        }

        if (mapName) {
            const rw = regionName ? ctx.measureText(regionName).width + 36 : 0;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.beginPath();
            ctx.roundRect(12 + rw, 12, ctx.measureText(mapName).width + 24, 24, 6);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.font = '12px Inter, sans-serif';
            ctx.fillText(mapName, 24 + rw, 28);
        }

        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('WASD/Setas para mover | Chegue na borda para avançar', 12, h - 12);
    }

    show() {
        if (!this.loaded) return;
        this.canvas.style.display = 'block';
        this.resize();
    }

    hide() {
        this.canvas.style.display = 'none';
    }
}
