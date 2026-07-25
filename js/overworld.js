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
        this.tileW = 32;
        this.tileH = 32;
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
        this.collisionZones = [];
        this.spawnZones = [];

        this.pokemonFollowing = null;
        this.pokemonFollowSprite = null;
        this.pokemonFollowPos = { x: 20, y: 15 };

        this.mapPokemonEntities = [];
        this.mapPokemonEncounters = [];
        this.battleCooldown = 0;

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
        this.tileW = this.canvas.width / this.worldCols;
        this.tileH = this.canvas.height / this.worldRows;
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
        const gender = this.game.playerGender === 'female' ? 'feminino' : 'masculino';
        const spriteSheetUrl = `assets/perso_${gender}.webp`;

        try {
            const spriteSheet = await new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('Failed to load sprite sheet'));
                img.src = spriteSheetUrl;
            });

            this.playerSpriteFrames = {};
            const directions = ['down', 'left', 'right', 'up'];
            const frameCount = 4;
            const frameW = spriteSheet.width / frameCount;
            const frameH = spriteSheet.height / frameCount;

            for (let row = 0; row < directions.length; row++) {
                const frames = [];
                for (let col = 0; col < frameCount; col++) {
                    const canvas = document.createElement('canvas');
                    canvas.width = frameW;
                    canvas.height = frameH;
                    const ctx = canvas.getContext('2d');
                    ctx.imageSmoothingEnabled = false;
                    ctx.drawImage(
                        spriteSheet,
                        col * frameW, row * frameH, frameW, frameH,
                        0, 0, frameW, frameH
                    );
                    const img = new Image();
                    img.src = canvas.toDataURL();
                    frames.push(new Promise(resolve => { img.onload = () => resolve(img); }));
                }
                this.playerSpriteFrames[directions[row]] = await Promise.all(frames);
            }

            this.playerSprites = {};
            for (const dir of directions) {
                this.playerSprites[dir] = this.playerSpriteFrames[dir][0];
            }

            console.log(`[PokeFury] Sprite sheet loaded: ${gender} (${frameW}x${frameH} per frame)`);
        } catch (e) {
            console.warn('[PokeFury] Sprite sheet not found, using procedural sprites:', e.message);
            this.playerSprites = {
                down: await this.createPlayerSprite('down'),
                up: await this.createPlayerSprite('up'),
                left: await this.createPlayerSprite('left'),
                right: await this.createPlayerSprite('right')
            };
            this.playerSpriteFrames = null;
        }
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

        this.collisionZones = mapData.collision_zones || [];
        this.spawnZones = mapData.spawn_zones || [];

        this.player.x = Math.floor(this.worldCols / 2);
        this.player.y = Math.floor(this.worldRows / 2);
        this.player.fromX = this.player.x;
        this.player.fromY = this.player.y;
        this.player.moving = false;
        this.player.direction = 'down';

        this.pokemonFollowPos = { x: this.player.x, y: this.player.y };

        this.camera.x = this.player.x * this.tileW - this.canvas.width / 2 + this.tileW / 2;
        this.camera.y = this.player.y * this.tileH - this.canvas.height / 2 + this.tileH / 2;

        if (mapData.id && this.game.regionManager) {
            try {
                const encounters = await this.game.regionManager.loadMapEncounters(mapData.id);
                console.log('[Overworld] Encounters loaded:', encounters.length, encounters.map(e => e.pokemon_name + ' sprite:' + (e.sprite_url ? 'yes' : 'no')));
                this.spawnMapPokemon(encounters);
            } catch (e) {
                console.warn('[Overworld] Failed to load encounters:', e);
                this.mapPokemonEntities = [];
            }
        }
    }

    isCollisionAt(x, y) {
        for (const z of this.collisionZones) {
            if (x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h) return true;
        }
        return false;
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

            if (this.isCollisionAt(nx, ny)) return;

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

        this.updateMapPokemon();

        const halfW = this.canvas.width / 2;
        const halfH = this.canvas.height / 2;

        this.camera.x = Math.max(0, Math.min(
            this.player.x * this.tileW + this.tileW / 2 - halfW,
            Math.max(0, this.worldCols * this.tileW - this.canvas.width)
        ));
        this.camera.y = Math.max(0, Math.min(
            this.player.y * this.tileH + this.tileH / 2 - halfH,
            Math.max(0, this.worldRows * this.tileH - this.canvas.height)
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

        if (this.spawnZones.length > 0) {
            let inSpawnZone = false;
            for (const z of this.spawnZones) {
                if (this.player.x >= z.x && this.player.x < z.x + z.w &&
                    this.player.y >= z.y && this.player.y < z.y + z.h) {
                    inSpawnZone = true;
                    break;
                }
            }
            if (!inSpawnZone) return;
        }

        const zone = this.encounterZones[0];
        if (!zone) return;

        if (Math.random() < zone.rate) {
            this.encounterCooldown = 20;
            this.game.startWildBattle(zone.minLevel, zone.maxLevel);
        }
    }

    async spawnMapPokemon(encounters) {
        this.mapPokemonEntities = [];
        this.mapPokemonEncounters = encounters || [];
        console.log('[Overworld] spawnMapPokemon called with', encounters.length, 'encounters');
        if (encounters.length === 0) return;

        const count = Math.min(4, Math.max(1, Math.floor(encounters.length * 1.5)));
        console.log('[Overworld] Spawning', count, 'pokemon entities');

        for (let i = 0; i < count; i++) {
            const enc = encounters[Math.floor(Math.random() * encounters.length)];
            let pos = this.findSpawnPosition();
            if (!pos) { console.log('[Overworld] No spawn position found for', enc.pokemon_name); continue; }

            const spriteUrl = enc.sprite_url || (window.PokeAPI ? window.PokeAPI.getAnimatedFrontUrl(enc.pokemon_id) : null);
            console.log('[Overworld] Loading sprite for', enc.pokemon_name, ':', spriteUrl);
            let sprite = null;
            if (spriteUrl) {
                sprite = await new Promise(resolve => {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => { console.log('[Overworld] Sprite loaded OK:', enc.pokemon_name); resolve(img); };
                    img.onerror = () => { console.log('[Overworld] Sprite FAILED:', enc.pokemon_name, spriteUrl); resolve(null); };
                    img.src = spriteUrl;
                });
            }

            this.mapPokemonEntities.push({
                x: pos.x,
                y: pos.y,
                fromX: pos.x,
                fromY: pos.y,
                moving: false,
                moveProgress: 0,
                sprite: sprite,
                encounter: enc,
                wanderTimer: Math.floor(Math.random() * 120),
                wanderCooldown: 60 + Math.floor(Math.random() * 120),
                active: true,
                respawnTimer: 0
            });
        }
        console.log('[Overworld] Total map pokemon entities:', this.mapPokemonEntities.length);
    }

    findSpawnPosition() {
        for (let attempt = 0; attempt < 30; attempt++) {
            let x, y;
            if (this.spawnZones.length > 0) {
                const z = this.spawnZones[Math.floor(Math.random() * this.spawnZones.length)];
                x = z.x + Math.floor(Math.random() * z.w);
                y = z.y + Math.floor(Math.random() * z.h);
            } else {
                x = Math.floor(Math.random() * this.worldCols);
                y = Math.floor(Math.random() * this.worldRows);
            }

            if (x < 0 || x >= this.worldCols || y < 0 || y >= this.worldRows) continue;
            if (this.isCollisionAt(x, y)) continue;
            if (x === this.player.x && y === this.player.y) continue;

            const occupied = this.mapPokemonEntities.some(p => p.active && p.x === x && p.y === y);
            if (!occupied) return { x, y };
        }
        return null;
    }

    updateMapPokemon() {
        if (this.battleCooldown > 0) this.battleCooldown--;

        for (const p of this.mapPokemonEntities) {
            if (!p.active) {
                if (p.respawnTimer > 0) {
                    p.respawnTimer--;
                    if (p.respawnTimer <= 0) {
                        p.active = true;
                        const pos = this.findSpawnPosition();
                        if (pos) {
                            p.x = pos.x;
                            p.y = pos.y;
                            p.fromX = pos.x;
                            p.fromY = pos.y;
                        }
                    }
                }
                continue;
            }

            if (p.moving) {
                p.moveProgress += 0.15;
                if (p.moveProgress >= 1) {
                    p.moveProgress = 1;
                    p.moving = false;
                    p.fromX = p.x;
                    p.fromY = p.y;
                }
            } else {
                p.wanderTimer--;
                if (p.wanderTimer <= 0) {
                    p.wanderTimer = p.wanderCooldown + Math.floor(Math.random() * 60);
                    const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
                    const dir = dirs[Math.floor(Math.random() * dirs.length)];
                    const nx = p.x + dir.dx;
                    const ny = p.y + dir.dy;

                    if (nx >= 0 && nx < this.worldCols && ny >= 0 && ny < this.worldRows &&
                        !this.isCollisionAt(nx, ny) &&
                        !(nx === this.player.x && ny === this.player.y)) {
                        p.fromX = p.x;
                        p.fromY = p.y;
                        p.x = nx;
                        p.y = ny;
                        p.moving = true;
                        p.moveProgress = 0;
                    }
                }
            }
        }

        if (this.battleCooldown <= 0) {
            for (const p of this.mapPokemonEntities) {
                if (!p.active || p.moving) continue;
                const dx = Math.abs(p.x - this.player.x);
                const dy = Math.abs(p.y - this.player.y);
                if (dx + dy <= 1) {
                    this.battleCooldown = 60;
                    this.triggerPokemonBattle(p);
                    break;
                }
            }
        }
    }

    async triggerPokemonBattle(entity) {
        if (!entity.encounter) return;

        const enc = entity.encounter;
        entity.active = false;
        entity.respawnTimer = 300;

        const level = enc.min_level + Math.floor(Math.random() * ((enc.max_level || enc.min_level + 3) - enc.min_level + 1));
        this.game.startBattleWithPokemon(enc.pokemon_name, level);
    }

    render() {
        if (!this.loaded || this.game.state !== 'overworld') return;

        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, w, h);

        if (this.currentMapImage && this.currentMapImage.complete) {
            const mapDrawW = this.worldCols * this.tileW;
            const mapDrawH = this.worldRows * this.tileH;

            ctx.drawImage(
                this.currentMapImage,
                -this.camera.x, -this.camera.y,
                mapDrawW, mapDrawH
            );

            this.drawGrid(ctx, w, h);
        this.drawMapPokemon(ctx);
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
        const startX = Math.floor(this.camera.x / this.tileW);
        const startY = Math.floor(this.camera.y / this.tileH);
        const endX = Math.ceil((this.camera.x + w) / this.tileW);
        const endY = Math.ceil((this.camera.y + h) / this.tileH);

        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 0.5;
        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                const sx = x * this.tileW - this.camera.x;
                const sy = y * this.tileH - this.camera.y;
                ctx.strokeRect(sx, sy, this.tileW, this.tileH);
            }
        }
    }

    drawMapPokemon(ctx) {
        for (const p of this.mapPokemonEntities) {
            if (!p.active && p.respawnTimer > 0) continue;
            if (!p.active) continue;

            let drawX, drawY;
            if (p.moving) {
                const t = p.moveProgress;
                drawX = (p.fromX + (p.x - p.fromX) * t) * this.tileW - this.camera.x;
                drawY = (p.fromY + (p.y - p.fromY) * t) * this.tileH - this.camera.y;
            } else {
                drawX = p.x * this.tileW - this.camera.x;
                drawY = p.y * this.tileH - this.camera.y;
            }

            const bobY = Math.sin(Date.now() / 400 + p.x * 3 + p.y * 7) * 3;

            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath();
            ctx.ellipse(drawX + this.tileW / 2, drawY + this.tileH - 1, this.tileW / 4, 3, 0, 0, Math.PI * 2);
            ctx.fill();

            if (p.sprite && p.sprite.complete && p.sprite.naturalWidth > 0) {
                const spriteSize = this.tileW * 1.4;
                const offset = (this.tileW - spriteSize) / 2;
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(p.sprite, drawX + offset, drawY + bobY - spriteSize * 0.15, spriteSize, spriteSize);
            } else {
                ctx.fillStyle = '#ffd700';
                ctx.beginPath();
                ctx.arc(drawX + this.tileW / 2, drawY + this.tileH / 2 + bobY, this.tileW / 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.font = `bold ${Math.floor(this.tileW / 3)}px Inter, sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText('?', drawX + this.tileW / 2, drawY + this.tileH / 2 + bobY + 4);
            }
        }
    }

    drawPlayer(ctx) {
        let drawX, drawY;

        if (this.player.moving) {
            const t = this.player.moveProgress;
            drawX = (this.player.fromX + (this.player.x - this.player.fromX) * t) * this.tileW - this.camera.x;
            drawY = (this.player.fromY + (this.player.y - this.player.fromY) * t) * this.tileH - this.camera.y;
        } else {
            drawX = this.player.x * this.tileW - this.camera.x;
            drawY = this.player.y * this.tileH - this.camera.y;
        }

        let sprite;
        if (this.playerSpriteFrames) {
            const frames = this.playerSpriteFrames[this.player.direction];
            if (this.player.moving) {
                const walkFrame = Math.min(Math.floor(this.player.moveProgress * frames.length), frames.length - 1);
                sprite = frames[walkFrame];
            } else {
                sprite = frames[0];
            }
        } else {
            sprite = this.playerSprites[this.player.direction];
        }

        if (sprite && sprite.complete) {
            ctx.drawImage(sprite, drawX, drawY, this.tileW, this.tileH);
        } else {
            ctx.fillStyle = '#3498db';
            ctx.fillRect(drawX + 4, drawY + 4, this.tileW - 8, this.tileH - 8);
        }

        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(drawX + this.tileW / 2, drawY + this.tileH - 2, this.tileW / 3, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        if (this.pokemonFollowing && this.pokemonFollowSprite && this.pokemonFollowSprite.complete) {
            const px = this.pokemonFollowPos.x * this.tileW - this.camera.x;
            const py = this.pokemonFollowPos.y * this.tileH - this.camera.y;
            ctx.drawImage(this.pokemonFollowSprite, px, py, this.tileW, this.tileH);
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
