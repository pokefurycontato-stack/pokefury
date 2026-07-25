class Overworld2D {
    constructor(game) {
        this.game = game;
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.tileSize = 32;
        this.mapWidth = 50;
        this.mapHeight = 50;

        this.player = {
            x: 25,
            y: 25,
            sprite: null,
            direction: 'down',
            frame: 0,
            frameTimer: 0,
            moving: false,
            moveProgress: 0,
            fromX: 25,
            fromY: 25
        };

        this.camera = { x: 0, y: 0 };
        this.keys = {};
        this.moveQueue = [];
        this.moveCooldown = 0;
        this.encounterCooldown = 0;

        this.map = null;
        this.collisionMap = null;
        this.grassMap = null;

        this.pokemonFollowing = null;
        this.pokemonFollowSprite = null;
        this.pokemonFollowPos = { x: 25, y: 25 };

        this.tileImages = {};
        this.playerSprites = {};
        this.pokemonSprites = {};
        this.loaded = false;

        this.frameCount = 0;

        this.init();
    }

    async init() {
        this.generateMap();
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

    generateMap() {
        this.map = [];
        this.collisionMap = [];
        this.grassMap = [];

        for (let y = 0; y < this.mapHeight; y++) {
            this.map[y] = [];
            this.collisionMap[y] = [];
            this.grassMap[y] = [];

            for (let x = 0; x < this.mapWidth; x++) {
                this.collisionMap[y][x] = 0;
                this.grassMap[y][x] = 0;

                if (y < 3 || y >= this.mapHeight - 3 || x < 3 || x >= this.mapWidth - 3) {
                    this.map[y][x] = 'tree';
                    this.collisionMap[y][x] = 1;
                } else if (y < 5 || y >= this.mapHeight - 5 || x < 5 || x >= this.mapWidth - 5) {
                    this.map[y][x] = 'grass';
                    this.grassMap[y][x] = 1;
                } else if ((x === 10 || x === 40) && y > 10 && y < 40) {
                    this.map[y][x] = 'water';
                    this.collisionMap[y][x] = 1;
                } else if ((y === 15 || y === 35) && x > 8 && x < 42) {
                    this.map[y][x] = 'path';
                } else if (x === 25 && y === 15) {
                    this.map[y][x] = 'path';
                } else if (x >= 22 && x <= 28 && y >= 20 && y <= 25) {
                    this.map[y][x] = 'house';
                    if (x > 22 && x < 28 && y > 20 && y < 25) {
                        this.collisionMap[y][x] = 1;
                    }
                } else {
                    const r = Math.random();
                    if (r < 0.15) {
                        this.map[y][x] = 'flower';
                    } else if (r < 0.25) {
                        this.map[y][x] = 'tall_grass';
                        this.grassMap[y][x] = 1;
                    } else {
                        this.map[y][x] = 'grass';
                    }
                }
            }
        }

        for (let y = 10; y < 40; y++) {
            this.map[y][15] = 'path';
            this.collisionMap[y][15] = 0;
        }
        for (let x = 10; x < 42; x++) {
            this.map[25][x] = 'path';
            this.collisionMap[25][x] = 0;
        }

        this.player.x = 25;
        this.player.y = 25;
    }

    setupInput() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(e.key)) {
                e.preventDefault();
            }
        });
        document.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });
    }

    async loadSprites() {
        const SUPABASE_URL = 'https://odevwnnpzsoltbrrjdts.supabase.co';
        const STORAGE_URL = `${SUPABASE_URL}/storage/v1/object/public`;

        const playerGender = this.game.playerGender || 'male';
        const playerModel = playerGender === 'female'
            ? `${STORAGE_URL}/models-3d/player/player-female.glb`
            : `${STORAGE_URL}/models-3d/player/player-male.glb`;

        this.playerSprites = {
            down: await this.createPlayerSprite('down'),
            up: await this.createPlayerSprite('up'),
            left: await this.createPlayerSprite('left'),
            right: await this.createPlayerSprite('right')
        };
    }

    async createPlayerSprite(direction) {
        const canvas = document.createElement('canvas');
        canvas.width = this.tileSize;
        canvas.height = this.tileSize;
        const ctx = canvas.getContext('2d');

        const bodyColor = this.game.playerGender === 'female' ? '#e94560' : '#3498db';
        const skinColor = '#f5cba7';
        const hairColor = '#2c3e50';
        const pantsColor = '#34495e';

        ctx.fillStyle = bodyColor;
        ctx.fillRect(8, 8, 16, 12);

        ctx.fillStyle = skinColor;
        ctx.fillRect(10, 2, 12, 8);

        ctx.fillStyle = hairColor;
        ctx.fillRect(10, 0, 12, 4);

        ctx.fillStyle = pantsColor;
        ctx.fillRect(8, 20, 7, 10);
        ctx.fillRect(17, 20, 7, 10);

        if (direction === 'down') {
            ctx.fillStyle = '#000';
            ctx.fillRect(12, 5, 2, 2);
            ctx.fillRect(18, 5, 2, 2);
        } else if (direction === 'up') {
            ctx.fillStyle = hairColor;
            ctx.fillRect(10, 0, 12, 6);
        } else if (direction === 'left') {
            ctx.fillStyle = '#000';
            ctx.fillRect(10, 5, 2, 2);
        } else if (direction === 'right') {
            ctx.fillStyle = '#000';
            ctx.fillRect(20, 5, 2, 2);
        }

        const img = new Image();
        img.src = canvas.toDataURL();
        return new Promise(resolve => {
            img.onload = () => resolve(img);
        });
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

        this.handleInput();
        this.update();
        this.render();

        requestAnimationFrame(() => this.loop());
    }

    handleInput() {
        if (this.game.state !== 'overworld') return;
        if (this.player.moving) return;
        if (this.moveCooldown > 0) return;

        let dx = 0, dy = 0;
        let dir = null;

        if (this.keys['ArrowUp'] || this.keys['w'] || this.keys['W']) {
            dy = -1; dir = 'up';
        } else if (this.keys['ArrowDown'] || this.keys['s'] || this.keys['S']) {
            dy = 1; dir = 'down';
        } else if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) {
            dx = -1; dir = 'left';
        } else if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) {
            dx = 1; dir = 'right';
        }

        if (dir) {
            this.player.direction = dir;
            const nx = this.player.x + dx;
            const ny = this.player.y + dy;

            if (nx >= 0 && nx < this.mapWidth && ny >= 0 && ny < this.mapHeight) {
                if (!this.collisionMap[ny][nx]) {
                    this.player.fromX = this.player.x;
                    this.player.fromY = this.player.y;
                    this.player.x = nx;
                    this.player.y = ny;
                    this.player.moving = true;
                    this.player.moveProgress = 0;
                    this.player.frame = (this.player.frame + 1) % 4;
                }
            }
        }
    }

    update() {
        if (this.player.moving) {
            this.player.moveProgress += 0.2;
            if (this.player.moveProgress >= 1) {
                this.player.moveProgress = 1;
                this.player.moving = false;
                this.player.fromX = this.player.x;
                this.player.fromY = this.player.y;
                this.moveCooldown = 3;

                this.updatePokemonFollow();

                if (this.grassMap[this.player.y][this.player.x] && this.encounterCooldown <= 0) {
                    this.tryEncounter();
                }
            }
        }

        this.camera.x = this.player.x * this.tileSize - this.canvas.width / 2 + this.tileSize / 2;
        this.camera.y = this.player.y * this.tileSize - this.canvas.height / 2 + this.tileSize / 2;
    }

    updatePokemonFollow() {
        if (!this.pokemonFollowing) return;

        const dx = this.player.x - this.pokemonFollowPos.x;
        const dy = this.player.y - this.pokemonFollowPos.y;

        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            if (Math.abs(dx) >= Math.abs(dy)) {
                this.pokemonFollowPos.x += Math.sign(dx);
            } else {
                this.pokemonFollowPos.y += Math.sign(dy);
            }
        } else if (Math.abs(dx) === 1 && Math.abs(dy) === 0) {
            this.pokemonFollowPos.x += Math.sign(dx);
        } else if (Math.abs(dy) === 1 && Math.abs(dx) === 0) {
            this.pokemonFollowPos.y += Math.sign(dy);
        }
    }

    tryEncounter() {
        if (this.game.state !== 'overworld') return;
        if (this.playerTeamIsEmpty()) return;

        const chance = 0.08;
        if (Math.random() < chance) {
            this.encounterCooldown = 20;
            console.log('[Overworld] Wild encounter!');
            this.game.startWildBattle();
        }
    }

    playerTeamIsEmpty() {
        return !this.game.playerTeam || this.game.playerTeam.length === 0;
    }

    render() {
        if (!this.loaded) return;
        if (this.game.state !== 'overworld') return;

        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const ts = this.tileSize;

        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, w, h);

        const startX = Math.floor(this.camera.x / ts) - 1;
        const startY = Math.floor(this.camera.y / ts) - 1;
        const endX = Math.ceil((this.camera.x + w) / ts) + 1;
        const endY = Math.ceil((this.camera.y + h) / ts) + 1;

        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) continue;

                const tile = this.map[y][x];
                const sx = x * ts - this.camera.x;
                const sy = y * ts - this.camera.y;

                this.drawTile(ctx, tile, sx, sy, x, y);
            }
        }

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

        if (this.pokemonFollowing && this.pokemonFollowSprite && this.pokemonFollowSprite.complete) {
            const px = this.pokemonFollowPos.x * ts - this.camera.x;
            const py = this.pokemonFollowPos.y * ts - this.camera.y;
            ctx.drawImage(this.pokemonFollowSprite, px, py, ts, ts);
        }

        this.drawMinimap(ctx, w, h);
    }

    drawTile(ctx, tile, sx, sy, mapX, mapY) {
        const ts = this.tileSize;

        switch (tile) {
            case 'grass':
                ctx.fillStyle = '#2d5a27';
                ctx.fillRect(sx, sy, ts, ts);
                ctx.fillStyle = '#3a7a33';
                for (let i = 0; i < 3; i++) {
                    const gx = sx + ((mapX * 7 + i * 11) % ts);
                    const gy = sy + ((mapY * 13 + i * 7) % ts);
                    ctx.fillRect(gx, gy, 2, 4);
                }
                break;

            case 'tall_grass':
                ctx.fillStyle = '#2d5a27';
                ctx.fillRect(sx, sy, ts, ts);
                ctx.fillStyle = '#4a9a43';
                for (let i = 0; i < 5; i++) {
                    const gx = sx + ((mapX * 7 + i * 8) % (ts - 4));
                    const gy = sy + ((mapY * 11 + i * 6) % (ts - 8));
                    ctx.fillRect(gx + 2, gy, 3, 8);
                    ctx.fillRect(gx + 4, gy - 2, 2, 4);
                }
                if (this.frameCount % 60 < 30) {
                    ctx.fillStyle = '#5aba53';
                    ctx.fillRect(sx + 8, sy + 4, 2, 6);
                    ctx.fillRect(sx + 20, sy + 12, 2, 6);
                }
                break;

            case 'tree':
                ctx.fillStyle = '#1a3a15';
                ctx.fillRect(sx, sy, ts, ts);
                ctx.fillStyle = '#2d5a27';
                ctx.beginPath();
                ctx.arc(sx + ts / 2, sy + ts / 2 - 2, ts / 2 - 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#5a3a1a';
                ctx.fillRect(sx + ts / 2 - 2, sy + ts / 2 + 4, 4, 10);
                break;

            case 'water':
                ctx.fillStyle = '#1a5276';
                ctx.fillRect(sx, sy, ts, ts);
                ctx.fillStyle = '#2980b9';
                const waveOff = Math.sin((this.frameCount * 0.05) + mapX * 0.3 + mapY * 0.5) * 3;
                ctx.fillRect(sx, sy + ts / 2 + waveOff, ts, 3);
                ctx.fillStyle = '#5dade2';
                ctx.fillRect(sx + 8, sy + ts / 2 + waveOff + 2, 6, 1);
                break;

            case 'path':
                ctx.fillStyle = '#8d7b68';
                ctx.fillRect(sx, sy, ts, ts);
                ctx.fillStyle = '#a08e7c';
                ctx.fillRect(sx + 4, sy + 4, 4, 3);
                ctx.fillRect(sx + 16, sy + 14, 5, 3);
                ctx.fillRect(sx + 10, sy + 22, 3, 3);
                break;

            case 'flower':
                ctx.fillStyle = '#2d5a27';
                ctx.fillRect(sx, sy, ts, ts);
                const colors = ['#e94560', '#f39c12', '#9b59b6', '#e74c3c', '#f1c40f'];
                for (let i = 0; i < 4; i++) {
                    ctx.fillStyle = colors[(mapX + mapY + i) % colors.length];
                    const fx = sx + ((mapX * 3 + i * 9) % (ts - 6)) + 3;
                    const fy = sy + ((mapY * 5 + i * 7) % (ts - 6)) + 3;
                    ctx.beginPath();
                    ctx.arc(fx, fy, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.fillStyle = '#27ae60';
                ctx.fillRect(sx + 4, sy + 14, 1, 6);
                ctx.fillRect(sx + 14, sy + 8, 1, 6);
                break;

            case 'house':
                if (mapX === 22 && mapY === 20) {
                    ctx.fillStyle = '#6c5ce7';
                    ctx.fillRect(sx, sy, ts, ts);
                    ctx.fillStyle = '#a29bfe';
                    ctx.fillRect(sx + 4, sy + 4, ts - 8, ts - 8);
                } else if (mapY === 20) {
                    ctx.fillStyle = '#6c5ce7';
                    ctx.fillRect(sx, sy, ts, ts);
                } else if (mapY === 25) {
                    ctx.fillStyle = '#6c5ce7';
                    ctx.fillRect(sx, sy, ts, ts);
                    if (mapX === 25) {
                        ctx.fillStyle = '#8b6914';
                        ctx.fillRect(sx + 8, sy + 4, 16, 28);
                        ctx.fillStyle = '#d4a017';
                        ctx.fillRect(sx + 20, sy + 14, 3, 3);
                    }
                } else {
                    ctx.fillStyle = '#8e7cc3';
                    ctx.fillRect(sx, sy, ts, ts);
                    ctx.fillStyle = '#f5e6ca';
                    ctx.fillRect(sx + 8, sy + 4, 16, 12);
                }
                break;

            default:
                ctx.fillStyle = '#2d5a27';
                ctx.fillRect(sx, sy, ts, ts);
        }
    }

    drawMinimap(ctx, screenW, screenH) {
        const mmW = 120;
        const mmH = 120;
        const mmX = screenW - mmW - 12;
        const mmY = screenH - mmH - 12;
        const mmScale = mmW / this.mapWidth;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.strokeStyle = 'rgba(233, 69, 96, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(mmX - 4, mmY - 4, mmW + 8, mmH + 8, 6);
        ctx.fill();
        ctx.stroke();

        for (let y = 0; y < this.mapHeight; y++) {
            for (let x = 0; x < this.mapWidth; x++) {
                const tile = this.map[y][x];
                let color;
                switch (tile) {
                    case 'tree': color = '#1a3a15'; break;
                    case 'water': color = '#2980b9'; break;
                    case 'path': color = '#8d7b68'; break;
                    case 'house': color = '#6c5ce7'; break;
                    default: color = '#2d5a27';
                }
                ctx.fillStyle = color;
                ctx.fillRect(mmX + x * mmScale, mmY + y * mmScale, Math.ceil(mmScale), Math.ceil(mmScale));
            }
        }

        ctx.fillStyle = '#e94560';
        ctx.fillRect(
            mmX + this.player.x * mmScale - 1,
            mmY + this.player.y * mmScale - 1,
            3, 3
        );

        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Mapa', mmX + mmW / 2, mmY - 8);
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
