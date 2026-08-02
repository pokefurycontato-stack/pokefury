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

import { getPokemonScale } from './utils.js';

export class Overworld2D {
    constructor(game) {
        this.game = game;
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.tileSize = 32;
        this.tileW = 32;
        this.tileH = 32;
        this.worldCols = 32;
        this.worldRows = 24;
        this.gridCols = this.worldCols;
        this.gridRows = this.worldRows;

        this.player = {
            x: 16,
            y: 12,
            direction: 'down',
            frame: 0,
            frameTimer: 0,
            moving: false,
            moveProgress: 0,
            fromX: 20,
            fromY: 15
        };

        this.camera = { x: 0, y: 0 };
        this.mapOffsetX = 0;
        this.mapOffsetY = 0;
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
        this.pokemonFollowPos = { x: 16, y: 12 };

        this.mapPokemonEntities = [];
        this.mapPokemonEncounters = [];
        this.battleCooldown = 0;
        this.pokemonSpriteContainer = null;
        this.pokemonSpriteElements = new Map();

        this.wallpaperImg = new Image();
        this.wallpaperImg.src = 'assets/wallpapergrid.jpeg';

        this.bgVideo = document.getElementById('game-bg-video');
        this.bgVideo.src = 'assets/campobatalha.mp4';
        this.bgVideo.loop = true;
        this.bgVideo.muted = true;
        this.bgVideo.playsInline = true;
        this.bgVideo.play().catch(() => {});

        this.playerSprites = {};
        this.loaded = false;
        this.frameCount = 0;

        this.mapImageCache = {};
        this.mapThumbnails = {};
        this.mapNavigatorRects = [];

        this.neonEl = null;
        this.worldMapRect = null;

        this.worldMapImage = new Image();
        this.worldMapImage.crossOrigin = 'anonymous';
        this.worldMapImage.src = 'https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/ferramentas/mapamund.png';

        this.worldMapRegions = [
            { name: 'Kanto',  cx: 0.13, cy: 0.14, hitR: 0.08 },
            { name: 'Johto',  cx: 0.33, cy: 0.14, hitR: 0.08 },
            { name: 'Hoenn',  cx: 0.53, cy: 0.14, hitR: 0.08 },
            { name: 'Sinnoh', cx: 0.77, cy: 0.14, hitR: 0.08 },
            { name: 'Unova',  cx: 0.20, cy: 0.46, hitR: 0.08 },
            { name: 'Kalos',  cx: 0.47, cy: 0.46, hitR: 0.08 },
            { name: 'Alola',  cx: 0.73, cy: 0.46, hitR: 0.08 },
            { name: 'Galar',  cx: 0.15, cy: 0.78, hitR: 0.08 },
            { name: 'Hisui',  cx: 0.38, cy: 0.78, hitR: 0.08 },
            { name: 'Paldea', cx: 0.63, cy: 0.78, hitR: 0.08 }
        ];
        this.biomeColors = {
            'floresta':   { main: '#00cc44', dim: 'rgba(0,204,68,0.3)',  bright: '#66ff99' },
            'montanha':   { main: '#cc8800', dim: 'rgba(204,136,0,0.3)', bright: '#ffbb44' },
            'torre':      { main: '#aa44ff', dim: 'rgba(170,68,255,0.3)',bright: '#cc88ff' },
            'industrial': { main: '#8899aa', dim: 'rgba(136,153,170,0.3)',bright: '#bbccdd' },
            'penhasco':   { main: '#6644ff', dim: 'rgba(102,68,255,0.3)',bright: '#9988ff' },
            'praia':      { main: '#00aaff', dim: 'rgba(0,170,255,0.3)', bright: '#66ccff' },
            'vulcao':     { main: '#ff4400', dim: 'rgba(255,68,0,0.3)',  bright: '#ff8844' },
            'geleira':    { main: '#00dddd', dim: 'rgba(0,221,221,0.3)', bright: '#66ffff' },
            'centro pokemon': { main: '#ff2255', dim: 'rgba(255,34,85,0.3)', bright: '#ff6688' },
        };

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
        const containerW = mainArea ? mainArea.clientWidth : window.innerWidth - 460;
        const containerH = mainArea ? mainArea.clientHeight : window.innerHeight - 48;

        this.tileW = 32;
        this.tileH = 32;
        const mapW = this.worldCols * this.tileW;
        const mapH = this.worldRows * this.tileH;

        this.canvas.width = mapW;
        this.canvas.height = mapH;

        const scaleX = containerW / mapW;
        const scaleY = containerH / mapH;
        const scale = Math.min(scaleX, scaleY);

        const canvasEl = this.canvas;
        canvasEl.style.width = Math.floor(mapW * scale) + 'px';
        canvasEl.style.height = Math.floor(mapH * scale) + 'px';
        canvasEl.style.left = '50%';
        canvasEl.style.top = '50%';
        canvasEl.style.transform = 'translate(-50%, -50%)';

        if (!this.neonEl) {
            this.neonEl = document.createElement('div');
            this.neonEl.id = 'neon-border';
            this.canvas.parentElement.appendChild(this.neonEl);
        }

        this.mapOffsetX = 0;
        this.mapOffsetY = 0;

        const scaledW = Math.floor(mapW * scale);
        const scaledH = Math.floor(mapH * scale);
        const neonLeft = Math.floor((containerW - scaledW) / 2);
        const neonTop = Math.floor((containerH - scaledH) / 2);

        this.neonEl.style.left = neonLeft + 'px';
        this.neonEl.style.top = neonTop + 'px';
        this.neonEl.style.width = scaledW + 'px';
        this.neonEl.style.height = scaledH + 'px';
    }

    setNeonColor(mapName) {
        if (!this.neonEl) return;
        const key = (mapName || '').toLowerCase().trim();
        const colors = this.biomeColors[key] || { main: '#00ff88', dim: 'rgba(0,255,136,0.3)', bright: '#66ffbb' };
        this.neonEl.style.setProperty('--neon-color', colors.main);
        this.neonEl.style.setProperty('--neon-dim', colors.dim);
        this.neonEl.style.setProperty('--neon-bright', colors.bright);
    }

    setupInput() {
        document.addEventListener('keydown', (e) => {
            const tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            this.keys[e.key] = true;
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
                e.preventDefault();
            }
        });
        document.addEventListener('keyup', (e) => {
            const tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            this.keys[e.key] = false;
        });
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
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

        this.setNeonColor(mapData.name);

        this.encounterZones = [];
        this.transitionCooldown = 0;

        this.collisionZones = mapData.collision_zones || [];
        this.spawnZones = mapData.spawn_zones || [];

        if (mapData.player_spawn_x != null && mapData.player_spawn_y != null) {
            this.player.x = mapData.player_spawn_x;
            this.player.y = mapData.player_spawn_y;
        } else {
            this.player.x = Math.floor(this.worldCols / 2);
            this.player.y = Math.floor(this.worldRows / 2);
        }
        this.player.fromX = this.player.x;
        this.player.fromY = this.player.y;
        this.player.moving = false;
        this.player.direction = 'down';

        this.pokemonFollowPos = { x: this.player.x, y: this.player.y };

        this.camera.x = this.player.x * this.tileW - this.canvas.width / 2 + this.tileW / 2;
        this.camera.y = this.player.y * this.tileH - this.canvas.height / 2 + this.tileH / 2;

        if (this.pokemonSpriteContainer) {
            this.pokemonSpriteContainer.remove();
            this.pokemonSpriteContainer = null;
        }
        this.pokemonSpriteElements.clear();

        if (mapData.id && this.game.regionManager) {
            try {
                await this.loadOrSpawnMapPokemon(mapData.id);
            } catch (e) {
                console.warn('[Overworld] Failed to load encounters:', e);
                this.mapPokemonEntities = [];
            }
        }

        this.preloadMapThumbnails();
    }

    isCollisionAt(x, y) {
        for (const z of this.collisionZones) {
            if (x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h) return true;
        }

        if (this.game._gymLeaderEntity && this.game._gymLeaderEntity.active) {
            const leader = this.game._gymLeaderEntity;
            if (x === leader.x && y === leader.y) return true;
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

        if (this.frameCount % 30 === 0 && this.game.state === 'overworld') {
            this.game.updatePartyPanel();
        }

        try {
            if (this.game.state === 'battle') {
                this.render();
                this.game.render();
            } else {
                this.handleInput();
                this.update();
                this.render();
            }
        } catch (e) {
            console.error('[Overworld] Loop error:', e);
        }

        try {
            if (this.game.state === 'battle') {
                setTimeout(() => { try { this.loop(); } catch (e) {} }, 16);
            } else {
                requestAnimationFrame(() => { try { this.loop(); } catch (e) {} });
            }
        } catch (e) {
            setTimeout(() => { try { this.loop(); } catch (e2) {} }, 16);
        }
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

                if (this.game._isInGym) {
                    this.game.checkGymLeaderProximity();
                    this.game.checkGymExit();
                }
            }
        }

        this.updateMapPokemon();

        const halfW = this.canvas.width / 2;
        const halfH = this.canvas.height / 2;

        const mapW = this.worldCols * this.tileW;
        const mapH = this.worldRows * this.tileH;
        const canScrollX = mapW > this.canvas.width;
        const canScrollY = mapH > this.canvas.height;

        this.camera.x = canScrollX ? Math.max(0, Math.min(
            this.player.x * this.tileW + this.tileW / 2 - halfW + this.mapOffsetX,
            mapW - this.canvas.width + this.mapOffsetX * 2
        )) : 0;
        this.camera.y = canScrollY ? Math.max(0, Math.min(
            this.player.y * this.tileH + this.tileH / 2 - halfH + this.mapOffsetY,
            mapH - this.canvas.height + this.mapOffsetY * 2
        )) : 0;
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

    async spawnMapPokemon(encounters) {
        this.mapPokemonEntities = [];
        this.mapPokemonEncounters = encounters || [];
        if (encounters.length === 0) return;

        const count = 10;

        const TIER_WEIGHT = { common: 1, uncommon: 1, rare: 1, legendary: 0.00001, inicial: 0.00001 };
        const totalWeight = encounters.reduce((sum, e) => sum + (e.weight || 50) * (TIER_WEIGHT[e.rarity] ?? 1), 0);

        for (let i = 0; i < count; i++) {
            let roll = Math.random() * totalWeight;
            let enc = encounters[0];
            for (const e of encounters) {
                roll -= (e.weight || 50) * (TIER_WEIGHT[e.rarity] ?? 1);
                if (roll <= 0) { enc = e; break; }
            }

            let pos = this.findSpawnPosition();
            if (!pos) continue;

            const spriteUrl = (window.PokeAPI ? window.PokeAPI.getAnimatedFrontUrl(enc.pokemon_id) : null) || enc.sprite_url;

            this.mapPokemonEntities.push({
                entityId: `pokemon_${Date.now()}_${i}`,
                x: pos.x,
                y: pos.y,
                spriteUrl: spriteUrl,
                encounter: enc,
                active: true,
                respawnTimer: 0
            });
        }
    }

    async loadOrSpawnMapPokemon(mapId) {
        const db = window.db;
        const charId = this.game.currentCharacterId;
        if (!db || !charId) {
            const encounters = await this.game.regionManager.loadMapEncounters(mapId);
            this.spawnMapPokemon(encounters);
            return;
        }

        // Load existing entities from DB
        const { data: saved } = await db.from('map_pokemon_entities')
            .select('*, map_encounters(*)')
            .eq('character_id', charId)
            .eq('map_id', mapId);

        if (saved && saved.length > 0) {
            this.mapPokemonEntities = saved.map(row => ({
                dbId: row.id,
                entityId: `pokemon_${row.id}`,
                x: row.pos_x,
                y: row.pos_y,
                spriteUrl: (window.PokeAPI && row.map_encounters?.pokemon_id ? window.PokeAPI.getAnimatedFrontUrl(row.map_encounters.pokemon_id) : null) || row.map_encounters?.sprite_url || null,
                encounter: row.map_encounters,
                active: row.active,
                respawnTimer: row.respawn_timer || 0
            }));
            this.mapPokemonEncounters = await this.game.regionManager.loadMapEncounters(mapId);
            return;
        }

        // No saved entities — spawn fresh and save to DB
        const encounters = await this.game.regionManager.loadMapEncounters(mapId);
        this.mapPokemonEncounters = encounters;
        this.mapPokemonEntities = [];

        if (encounters.length === 0) return;

        const count = 10;
        const TIER_WEIGHT = { common: 1, uncommon: 1, rare: 1, legendary: 0.00001, inicial: 0.00001 };
        const totalWeight = encounters.reduce((sum, e) => sum + (e.weight || 50) * (TIER_WEIGHT[e.rarity] ?? 1), 0);

        for (let i = 0; i < count; i++) {
            let roll = Math.random() * totalWeight;
            let enc = encounters[0];
            for (const e of encounters) {
                roll -= (e.weight || 50) * (TIER_WEIGHT[e.rarity] ?? 1);
                if (roll <= 0) { enc = e; break; }
            }

            let pos = this.findSpawnPosition();
            if (!pos) continue;

            const spriteUrl = (window.PokeAPI ? window.PokeAPI.getAnimatedFrontUrl(enc.pokemon_id) : null) || enc.sprite_url;

            // Save to DB
            let dbId = null;
            if (enc.id) {
                const { data: inserted } = await db.from('map_pokemon_entities')
                    .insert({
                        character_id: charId,
                        map_id: mapId,
                        encounter_id: enc.id,
                        pos_x: pos.x,
                        pos_y: pos.y,
                        active: true,
                        respawn_timer: 0
                    })
                    .select('id')
                    .single();
                dbId = inserted?.id;
            }

            this.mapPokemonEntities.push({
                dbId: dbId,
                entityId: `pokemon_${Date.now()}_${i}`,
                x: pos.x,
                y: pos.y,
                spriteUrl: spriteUrl,
                encounter: enc,
                active: true,
                respawnTimer: 0
            });
        }
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
                        this.respawnEntity(p);
                    }
                }
                continue;
            }

            if (this.battleCooldown <= 0) {
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

        if (entity.isAlpha && this.game.eventManager && this.game.eventManager.alphaState) {
            await this.game.startAlphaBattle();
            if (this.game.state === 'battle') {
                entity.active = false;
            }
            return;
        }

        const enc = entity.encounter;

        const highestLevel = this.game.playerTeam.reduce((max, p) => Math.max(max, p.level || 1), 1);
        const maxWild = Math.min(highestLevel + 2, 100);
        const minWild = Math.max(maxWild - 2, 1);
        const level = minWild + Math.floor(Math.random() * (maxWild - minWild + 1));
        const battleId = enc.pokemon_id || enc.pokemon_name;
        const battleSprite = (window.PokeAPI ? window.PokeAPI.getAnimatedFrontUrl(enc.pokemon_id) : null) || entity.spriteUrl;
        await this.game.startBattleWithPokemon(battleId, level, battleSprite);

        if (this.game.state === 'battle') {
            entity.active = false;
            const RESPAWN = { common: 200, uncommon: 350, rare: 500, legendary: 800, inicial: 800 };
            entity.respawnTimer = RESPAWN[enc.rarity] || 300;

            if (entity.dbId && window.db) {
                await window.db.from('map_pokemon_entities')
                    .update({ active: false, respawn_timer: entity.respawnTimer })
                    .eq('id', entity.dbId);
            }
        }
    }

    async respawnEntity(entity) {
        const encounters = this.mapPokemonEncounters;
        if (!encounters || encounters.length === 0) return;

        // Pick new random encounter using weighted selection
        const totalWeight = encounters.reduce((sum, e) => sum + (e.weight || 50), 0);
        let roll = Math.random() * totalWeight;
        let newEnc = encounters[0];
        for (const e of encounters) {
            roll -= (e.weight || 50);
            if (roll <= 0) { newEnc = e; break; }
        }

        const pos = this.findSpawnPosition();
        if (!pos) return;

        const spriteUrl = (window.PokeAPI ? window.PokeAPI.getAnimatedFrontUrl(newEnc.pokemon_id) : null) || newEnc.sprite_url;

        entity.encounter = newEnc;
        entity.spriteUrl = spriteUrl;
        entity.x = pos.x;
        entity.y = pos.y;
        entity.active = true;
        entity.respawnTimer = 0;

        // Update DOM sprite element
        const el = this.pokemonSpriteElements?.get(entity.entityId);
        if (el && spriteUrl) el.src = spriteUrl;

        // Update DB: replace encounter, position, reactivate
        if (entity.dbId && window.db) {
            await window.db.from('map_pokemon_entities')
                .update({
                    encounter_id: newEnc.id,
                    pos_x: pos.x,
                    pos_y: pos.y,
                    active: true,
                    respawn_timer: 0
                })
                .eq('id', entity.dbId);
        }
    }

    render() {
        if (!this.loaded) return;

        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.clearRect(0, 0, w, h);

        if (this.game.state !== 'overworld') return;

        if (this.currentMapImage && this.currentMapImage.complete) {
            const mapDrawW = this.worldCols * this.tileW;
            const mapDrawH = this.worldRows * this.tileH;

            ctx.drawImage(
                this.currentMapImage,
                this.mapOffsetX - this.camera.x, this.mapOffsetY - this.camera.y,
                mapDrawW, mapDrawH
            );

            this.drawGrid(ctx, w, h);
            this.drawMapPokemon(ctx);
            this.drawGymExitZone(ctx);
        } else {
            ctx.fillStyle = '#2d5a27';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = '16px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Carregando mapa...', w / 2, h / 2);
        }

        this.drawPlayer(ctx);
        this.updateWorldMapMinimap();
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
                const sx = x * this.tileW - this.camera.x + this.mapOffsetX;
                const sy = y * this.tileH - this.camera.y + this.mapOffsetY;
                ctx.strokeRect(sx, sy, this.tileW, this.tileH);
            }
        }
    }

    drawMapPokemon(ctx) {
        const wrap = this.canvas.parentElement;
        if (!wrap) return;

        if (!this.pokemonSpriteContainer) {
            this.pokemonSpriteContainer = document.createElement('div');
            this.pokemonSpriteContainer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden;z-index:6;';
            wrap.appendChild(this.pokemonSpriteContainer);
        }

        const canvasRect = this.canvas.getBoundingClientRect();
        const wrapRect = wrap.getBoundingClientRect();
        const offsetX = canvasRect.left - wrapRect.left;
        const offsetY = canvasRect.top - wrapRect.top;

        const activeIds = new Set();

        for (const p of this.mapPokemonEntities) {
            if (!p.active) continue;
            activeIds.add(p.entityId);

            const drawX = p.x * this.tileW - this.camera.x + this.mapOffsetX;
            const drawY = p.y * this.tileH - this.camera.y + this.mapOffsetY;

            const pScale = (window.PokeAPI && p.encounter?.pokemon_id)
                ? getPokemonScale(window.PokeAPI.pokemonCache[p.encounter.pokemon_id]) : 1;
            const spriteSize = this.tileW * 1.2 * pScale;

            const finalY = drawY - this.tileH * 0.3;

            if (drawX + spriteSize < -50 || drawX > this.canvas.width + 50 ||
                finalY + spriteSize < -50 || finalY > this.canvas.height + 50) {
                if (this.pokemonSpriteElements.has(p.entityId)) {
                    this.pokemonSpriteElements.get(p.entityId).style.display = 'none';
                }
                continue;
            }

            let el = this.pokemonSpriteElements.get(p.entityId);
            if (!el) {
                el = document.createElement('img');
                el.style.cssText = `position:absolute;pointer-events:none;image-rendering:pixelated;`;
                // Prioriza a URL do GIF do banco de dados
                if (p.spriteUrl) el.src = p.spriteUrl;
                this.pokemonSpriteContainer.appendChild(el);
                this.pokemonSpriteElements.set(p.entityId, el);
            }

            el.style.display = 'block';
            el.style.left = (offsetX + drawX + (this.tileW - spriteSize) / 2) + 'px';
            el.style.top = (offsetY + finalY) + 'px';
            el.style.width = spriteSize + 'px';
            el.style.height = spriteSize + 'px';

            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath();
            ctx.ellipse(drawX + this.tileW / 2, finalY + spriteSize - 2, this.tileW / 4, 3, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        for (const [id, el] of this.pokemonSpriteElements) {
            if (!activeIds.has(id)) {
                el.style.display = 'none';
            }
        }
    }

    drawPlayer(ctx) {
        let drawX, drawY;

        if (this.player.moving) {
            const t = this.player.moveProgress;
            drawX = (this.player.fromX + (this.player.x - this.player.fromX) * t) * this.tileW - this.camera.x + this.mapOffsetX;
            drawY = (this.player.fromY + (this.player.y - this.player.fromY) * t) * this.tileH - this.camera.y + this.mapOffsetY;
        } else {
            drawX = this.player.x * this.tileW - this.camera.x + this.mapOffsetX;
            drawY = this.player.y * this.tileH - this.camera.y + this.mapOffsetY;
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

        const playerSize = this.tileW * 1.3;
        const playerOffset = (this.tileW - playerSize) / 2;

        if (sprite && sprite.complete) {
            ctx.drawImage(sprite, drawX + playerOffset, drawY + playerOffset, playerSize, playerSize);
        } else {
            ctx.fillStyle = '#3498db';
            ctx.fillRect(drawX + 4, drawY + 4, this.tileW - 8, this.tileH - 8);
        }

        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(drawX + this.tileW / 2, drawY + this.tileH - 2, this.tileW / 3, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        if (this.pokemonFollowing && this.pokemonFollowSprite && this.pokemonFollowSprite.complete) {
            const px = this.pokemonFollowPos.x * this.tileW - this.camera.x + this.mapOffsetX;
            const py = this.pokemonFollowPos.y * this.tileH - this.camera.y + this.mapOffsetY;
            const fScale = getPokemonScale(this.pokemonFollowing);
            const fSize = this.tileW * fScale;
            ctx.drawImage(this.pokemonFollowSprite, px + (this.tileW - fSize) / 2, py + (this.tileH - fSize) / 2, fSize, fSize);
        }

        this.drawGymLeader(ctx);
    }

    drawGymLeader(ctx) {
        const leader = this.game._gymLeaderEntity;
        if (!leader || !leader.active || !leader.spriteUrl) return;

        if (!this.gymLeaderImg) {
            this.gymLeaderImg = new Image();
            this.gymLeaderImg.src = leader.spriteUrl;
        }

        if (!this.gymLeaderImg.complete) return;

        const drawX = leader.x * this.tileW - this.camera.x + this.mapOffsetX;
        const drawY = leader.y * this.tileH - this.camera.y + this.mapOffsetY;

        const spriteW = this.tileW * 2;
        const spriteH = this.tileH * 2.5;

        ctx.drawImage(this.gymLeaderImg, drawX + (this.tileW - spriteW) / 2, drawY - spriteH + this.tileH, spriteW, spriteH);

        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 3;
        ctx.fillText(leader.name, drawX + this.tileW / 2, drawY - 8);
        ctx.shadowBlur = 0;
    }

    drawGymExitZone(ctx) {
        if (!this.game._isInGym || !this.game._gymExitZones) return;

        const time = Date.now() / 1000;
        const alpha = 0.3 + Math.sin(time * 2) * 0.15;

        for (const zone of this.game._gymExitZones) {
            const sx = zone.x * this.tileW - this.camera.x + this.mapOffsetX;
            const sy = zone.y * this.tileH - this.camera.y + this.mapOffsetY;
            const sw = zone.w * this.tileW;
            const sh = zone.h * this.tileH;

            ctx.fillStyle = `rgba(233, 69, 96, ${alpha})`;
            ctx.fillRect(sx, sy, sw, sh);

            ctx.strokeStyle = `rgba(233, 69, 96, ${alpha + 0.2})`;
            ctx.lineWidth = 2;
            ctx.strokeRect(sx, sy, sw, sh);

            ctx.fillStyle = `rgba(255, 255, 255, ${alpha + 0.3})`;
            ctx.font = 'bold 10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('← Sair', sx + sw / 2, sy + sh / 2 + 4);
        }
    }

    updateWorldMapMinimap() {
        const el = document.getElementById('worldmap-minimap');
        const dot = document.getElementById('worldmap-minimap-dot');
        if (!el) return;

        if (this.game.state !== 'overworld') {
            el.classList.add('hidden');
            return;
        }
        el.classList.remove('hidden');

        const currentRegionName = this.game.currentRegion?.name || '';
        if (currentRegionName && this.worldMapRegions) {
            const region = this.worldMapRegions.find(r => r.name === currentRegionName);
            if (region && dot) {
                dot.style.display = 'block';
                dot.style.left = (region.cx * 100) + '%';
                dot.style.top = (region.cy * 100) + '%';
                dot.style.transform = 'translate(-50%, -50%)';
            }
        }
    }

    drawHUD(ctx, w, h) {
        this.drawMapNavigator();

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

    async preloadMapThumbnails() {
        const maps = this.game.currentRegionMaps || [];
        for (const m of maps) {
            if (this.mapThumbnails[m.id]) continue;
            const img = await new Promise((resolve) => {
                const el = new Image();
                el.crossOrigin = 'anonymous';
                el.onload = () => resolve(el);
                el.onerror = () => resolve(null);
                el.src = m.image_url;
            });
            this.mapThumbnails[m.id] = img;
        }
    }

    drawMapNavigator() {
        const maps = this.game.currentRegionMaps || [];
        const navEl = document.getElementById('map-nav-canvas');
        if (!navEl) return;

        if (maps.length <= 1 || this.game.state !== 'overworld') {
            navEl.classList.add('hidden');
            this.mapNavigatorRects = [];
            return;
        }
        navEl.classList.remove('hidden');

        const thumbW = 68;
        const thumbH = 50;
        const gap = 6;
        const padX = 12;
        const padTop = 8;
        const padBottom = 20;
        const totalW = maps.length * thumbW + (maps.length - 1) * gap + padX * 2;
        const totalH = thumbH + padTop + padBottom;

        if (!this._navCanvas) {
            this._navCanvas = document.createElement('canvas');
            this._navCanvas.style.cursor = 'pointer';
            this._navCanvas.addEventListener('click', (e) => {
                const rect = this._navCanvas.getBoundingClientRect();
                const sx = this._navCanvas.width / rect.width;
                const sy = this._navCanvas.height / rect.height;
                const cx = (e.clientX - rect.left) * sx;
                const cy = (e.clientY - rect.top) * sy;
                for (const r of this.mapNavigatorRects) {
                    if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) {
                        if (r.map.id !== this.currentMapData?.id) {
                            this.teleportToMap(r.map);
                        }
                        return;
                    }
                }
            });
            navEl.appendChild(this._navCanvas);
        }

        this._navCanvas.width = totalW;
        this._navCanvas.height = totalH;
        const ctx = this._navCanvas.getContext('2d');

        const gameCanvas = this.canvas;
        const mainArea = document.getElementById('main-area');
        const containerW = mainArea ? mainArea.clientWidth : 960;
        const containerH = mainArea ? mainArea.clientHeight : 640;
        const canvasLeft = Math.max(0, Math.floor((containerW - gameCanvas.width) / 2));
        const canvasTop = Math.max(0, Math.floor((containerH - gameCanvas.height) / 2));

        navEl.style.left = (canvasLeft + (gameCanvas.width - totalW) / 2 - 4) + 'px';
        navEl.style.top = (canvasTop - 160 - 4) + 'px';

        this.mapNavigatorRects = [];

        for (let i = 0; i < maps.length; i++) {
            const m = maps[i];
            const x = padX + i * (thumbW + gap);
            const y = padTop;
            const isCurrent = m.id === this.currentMapData?.id;

            ctx.fillStyle = 'rgba(0,0,0,0.65)';
            ctx.beginPath();
            ctx.roundRect(x, y, thumbW, thumbH, 6);
            ctx.fill();

            const thumb = this.mapThumbnails[m.id];
            if (thumb && thumb.complete) {
                ctx.save();
                ctx.beginPath();
                ctx.roundRect(x, y, thumbW, thumbH, 6);
                ctx.clip();
                ctx.drawImage(thumb, x, y, thumbW, thumbH);
                ctx.restore();
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.15)';
                ctx.fillRect(x + 4, y + 4, thumbW - 8, thumbH - 8);
            }

            const runner = this.playerSprites?.down;
            if (runner && runner.complete) {
                ctx.drawImage(runner, x + 4, y + thumbH - 23, 16, 20);
            }

            if (isCurrent) {
                ctx.strokeStyle = '#e94560';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.roundRect(x, y, thumbW, thumbH, 6);
                ctx.stroke();
            }

            ctx.fillStyle = '#ffffff';
            ctx.font = '9px Inter, sans-serif';
            ctx.textAlign = 'center';
            const label = m.name.length > 10 ? m.name.slice(0, 9) + '..' : m.name;
            ctx.fillText(label, x + thumbW / 2, y + thumbH + 11);

            this.mapNavigatorRects.push({ x, y, w: thumbW, h: thumbH, map: m });
        }
    }

    handleCanvasClick(e) {
        if (this.game.state !== 'overworld') return;
    }

    async teleportToMap(mapData) {
        this.currentMapData = mapData;
        this.game.currentMap = mapData;

        if (this.game.regionManager && this.game.currentCharacterId) {
            const userId = window.GameData.userId;
            await this.game.regionManager.initPlayerProgress(
                this.game.currentCharacterId,
                mapData.region_id,
                mapData.id,
                userId
            );
        }

        await this.setCurrentMap(mapData);

        const locationEl = document.getElementById('location-name');
        if (locationEl) locationEl.textContent = mapData.name;
        this.game.showTransitionBanner(mapData.name);
    }

    show() {
        if (!this.loaded) return;
        this.canvas.style.display = 'block';
        if (this.pokemonSpriteContainer) this.pokemonSpriteContainer.style.display = 'block';
        if (this.neonEl) this.neonEl.style.display = 'block';
        this.resize();
    }

    hide() {
        if (this.pokemonSpriteContainer) this.pokemonSpriteContainer.style.display = 'none';
        if (this.neonEl) this.neonEl.style.display = 'none';
    }
}