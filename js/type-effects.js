export class TypeEffects {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.animFrame = null;
        this.running = false;
        this._init();
    }

    _init() {
        this.canvas = document.getElementById('type-effects-canvas');
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.id = 'type-effects-canvas';
            this.canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:30;';
            const mainArea = document.getElementById('main-area');
            if (mainArea) {
                mainArea.style.position = mainArea.style.position || 'relative';
                mainArea.appendChild(this.canvas);
            }
        }
        this.ctx = this.canvas.getContext('2d');
        this._resize();
        window.addEventListener('resize', () => this._resize());
    }

    _resize() {
        const mainArea = document.getElementById('main-area');
        const fullscreen = document.getElementById('pvp-fullscreen');
        if (!this.canvas) return;
        if (fullscreen) {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        } else if (mainArea) {
            this.canvas.width = mainArea.offsetWidth;
            this.canvas.height = mainArea.offsetHeight;
        }
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    _getColors(type) {
        const palettes = {
            fire:      ['#ff4500', '#ff6a00', '#ff8c00', '#ffb347', '#fff176', '#ff2200'],
            water:     ['#1565c0', '#1e88e5', '#42a5f5', '#90caf9', '#e3f2fd', '#bbdefb'],
            grass:     ['#2e7d32', '#43a047', '#66bb6a', '#a5d6a7', '#c8e6c9', '#81c784'],
            ice:       ['#b3e5fc', '#81d4fa', '#4fc3f7', '#29b6f6', '#ffffff', '#e1f5fe'],
            electric:  ['#f9a825', '#fdd835', '#ffee58', '#fff176', '#ffffff', '#ffeb3b'],
            fighting:  ['#d32f2f', '#e53935', '#ef5350', '#ff8a65', '#ffccbc', '#ff1744'],
            poison:    ['#7b1fa2', '#9c27b0', '#ab47bc', '#ce93d8', '#e1bee7', '#ea80fc'],
            ground:    ['#8d6e63', '#a1887f', '#bcaaa4', '#d7ccc8', '#efebe9', '#795548'],
            flying:    ['#90caf9', '#bbdefb', '#e3f2fd', '#ffffff', '#f3e5f5', '#80d8ff'],
            psychic:   ['#e91e63', '#f06292', '#f48fb1', '#f8bbd0', '#fce4ec', '#ff80ab'],
            bug:       ['#558b2f', '#689f38', '#7cb342', '#9ccc65', '#c5e1a5', '#aed581'],
            rock:      ['#5d4037', '#795548', '#8d6e63', '#a1887f', '#d7ccc8', '#bcaaa4'],
            ghost:     ['#4a148c', '#6a1b9a', '#8e24aa', '#ab47bc', '#ce93d8', '#b388ff'],
            dragon:    ['#1a237e', '#283593', '#3949ab', '#5c6bc0', '#7986cb', '#9fa8da'],
            dark:      ['#212121', '#424242', '#616161', '#9e9e9e', '#bdbdbd', '#37474f'],
            steel:     ['#78909c', '#90a4ae', '#b0bec5', '#cfd8dc', '#eceff1', '#546e7a'],
            fairy:     ['#f06292', '#f48fb1', '#f8bbd0', '#fce4ec', '#ffffff', '#f48fb1'],
            normal:    ['#bdbdbd', '#e0e0e0', '#eeeeee', '#f5f5f5', '#ffffff', '#c0c0c0']
        };
        return palettes[type] || palettes.normal;
    }

    _addHitFlash(x, y, color, size) {
        this.particles.push(
            { x, y, vx: 0, vy: 0, life: 12, maxLife: 12, size: size || 30, color: '#ffffff', type: 'circle', gravity: 0, alpha: 0.9 },
            { x, y, vx: 0, vy: 0, life: 18, maxLife: 18, size: (size || 30) * 1.8, color: color || '#ffffff', type: 'circle', gravity: 0, alpha: 0.3 }
        );
    }

    _createParticles(type, x, y, power) {
        const count = Math.min(35 + Math.floor(power / 5), 80);
        const colors = this._getColors(type);
        const variation = Math.floor(Math.random() * 4);

        this._addHitFlash(x, y, colors[0], 25 + Math.floor(power / 8));

        switch (type) {
            case 'fire': return this._fireParticles(x, y, count, colors, variation);
            case 'water': return this._waterParticles(x, y, count, colors, variation);
            case 'grass': return this._grassParticles(x, y, count, colors, variation);
            case 'ice': return this._iceParticles(x, y, count, colors, variation);
            case 'electric': return this._electricParticles(x, y, count, colors, variation);
            case 'fighting': return this._fightingParticles(x, y, count, colors, variation);
            case 'poison': return this._poisonParticles(x, y, count, colors, variation);
            case 'ground': return this._groundParticles(x, y, count, colors, variation);
            case 'flying': return this._flyingParticles(x, y, count, colors, variation);
            case 'psychic': return this._psychicParticles(x, y, count, colors, variation);
            case 'bug': return this._bugParticles(x, y, count, colors, variation);
            case 'rock': return this._rockParticles(x, y, count, colors, variation);
            case 'ghost': return this._ghostParticles(x, y, count, colors, variation);
            case 'dragon': return this._dragonParticles(x, y, count, colors, variation);
            case 'dark': return this._darkParticles(x, y, count, colors, variation);
            case 'steel': return this._steelParticles(x, y, count, colors, variation);
            case 'fairy': return this._fairyParticles(x, y, count, colors, variation);
            default: return this._normalParticles(x, y, count, colors, variation);
        }
    }

    _fireParticles(x, y, count, colors, v) {
        const particles = [];
        if (v === 0) {
            for (let i = 0; i < count; i++) {
                const spread = (Math.random() - 0.5) * 40;
                particles.push({ x: x + spread, y: y + Math.random() * 15, vx: (Math.random() - 0.5) * 2.5, vy: -3 - Math.random() * 5, life: 55 + Math.random() * 45, maxLife: 100, size: 6 + Math.random() * 10, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: -0.06, glow: true });
            }
            for (let i = 0; i < 5; i++) {
                particles.push({ x: x + (Math.random() - 0.5) * 50, y: y - 10, vx: (Math.random() - 0.5) * 1.5, vy: -4 - Math.random() * 3, life: 30 + Math.random() * 20, maxLife: 50, size: 2 + Math.random() * 3, color: '#fff176', type: 'circle', gravity: -0.08 });
            }
        } else if (v === 1) {
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2;
                const speed = 3 + Math.random() * 4;
                particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 45 + Math.random() * 35, maxLife: 80, size: 5 + Math.random() * 8, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0, glow: true });
            }
        } else if (v === 2) {
            for (let i = 0; i < count; i++) {
                particles.push({ x: x - 30 + Math.random() * 60, y: y - 15 + Math.random() * 30, vx: 5 + Math.random() * 4, vy: (Math.random() - 0.5) * 3, life: 40 + Math.random() * 30, maxLife: 70, size: 7 + Math.random() * 10, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: -0.04, glow: true });
            }
        } else {
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI;
                const speed = 2 + Math.random() * 5;
                particles.push({ x, y: y + 10, vx: Math.cos(angle) * speed, vy: -Math.abs(Math.sin(angle) * speed), life: 50 + Math.random() * 40, maxLife: 90, size: 5 + Math.random() * 12, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0.03, glow: true });
            }
        }
        return particles;
    }

    _waterParticles(x, y, count, colors, v) {
        const particles = [];
        if (v === 0) {
            for (let i = 0; i < count; i++) {
                particles.push({ x: x + (Math.random() - 0.5) * 40, y: y - 15, vx: (Math.random() - 0.5) * 1.5, vy: 3 + Math.random() * 4, life: 50 + Math.random() * 35, maxLife: 85, size: 5 + Math.random() * 7, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0.12, glow: true });
            }
            for (let i = 0; i < 6; i++) {
                particles.push({ x: x + (Math.random() - 0.5) * 30, y: y + 5, vx: (Math.random() - 0.5) * 3, vy: -2 - Math.random() * 3, life: 35 + Math.random() * 25, maxLife: 60, size: 3 + Math.random() * 4, color: '#e3f2fd', type: 'circle', gravity: 0.08 });
            }
        } else if (v === 1) {
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2;
                particles.push({ x, y, vx: Math.cos(angle) * (2 + Math.random() * 3), vy: Math.sin(angle) * (2 + Math.random() * 3), life: 45 + Math.random() * 30, maxLife: 75, size: 6 + Math.random() * 8, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0.06, glow: true });
            }
        } else if (v === 2) {
            for (let i = 0; i < count; i++) {
                particles.push({ x: x - 50, y: y + (Math.random() - 0.5) * 35, vx: 6 + Math.random() * 3, vy: (Math.random() - 0.5) * 3, life: 35 + Math.random() * 25, maxLife: 60, size: 4 + Math.random() * 5, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0, glow: true });
            }
        } else {
            for (let i = 0; i < count; i++) {
                particles.push({ x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 30, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5, life: 40 + Math.random() * 35, maxLife: 75, size: 4 + Math.random() * 8, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0.08, glow: true });
            }
        }
        return particles;
    }

    _grassParticles(x, y, count, colors, v) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            if (v === 0) {
                const angle = Math.random() * Math.PI * 2;
                particles.push({ x, y: y + 15, vx: Math.cos(angle) * (1.5 + Math.random() * 2.5), vy: -2.5 - Math.random() * 4, life: 55 + Math.random() * 40, maxLife: 95, size: 5 + Math.random() * 7, color: colors[Math.floor(Math.random() * colors.length)], type: 'leaf', gravity: 0.04, rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.25, glow: true });
            } else if (v === 1) {
                particles.push({ x: x + (Math.random() - 0.5) * 60, y: y + 10, vx: (Math.random() - 0.5) * 1.5, vy: -1.5 - Math.random() * 3, life: 60 + Math.random() * 45, maxLife: 105, size: 6 + Math.random() * 8, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: -0.025, glow: true });
            } else if (v === 2) {
                const angle = (i / count) * Math.PI * 2;
                particles.push({ x, y, vx: Math.cos(angle) * 3, vy: Math.sin(angle) * 3, life: 45 + Math.random() * 35, maxLife: 80, size: 4 + Math.random() * 5, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0, glow: true });
            } else {
                particles.push({ x: x + (Math.random() - 0.5) * 50, y: y + 5, vx: (Math.random() - 0.5) * 2.5, vy: -1.5 - Math.random() * 3, life: 50 + Math.random() * 35, maxLife: 85, size: 5 + Math.random() * 7, color: colors[Math.floor(Math.random() * colors.length)], type: 'leaf', gravity: 0.03, rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.2, glow: true });
            }
        }
        return particles;
    }

    _iceParticles(x, y, count, colors, v) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            if (v === 0) {
                const angle = (i / count) * Math.PI * 2;
                const speed = 2.5 + Math.random() * 3;
                particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 50 + Math.random() * 35, maxLife: 85, size: 5 + Math.random() * 8, color: colors[Math.floor(Math.random() * colors.length)], type: 'diamond', gravity: 0, rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.15, glow: true });
            } else if (v === 1) {
                for (let j = 0; j < 3; j++) {
                    particles.push({ x: x + (Math.random() - 0.5) * 40, y: y - 15 + Math.random() * 10, vx: (Math.random() - 0.5) * 1.5, vy: 2 + Math.random() * 3, life: 50 + Math.random() * 40, maxLife: 90, size: 5 + Math.random() * 7, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0.06, glow: true });
                }
            } else if (v === 2) {
                for (let i = 0; i < count; i++) {
                    particles.push({ x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20, vx: 5 + Math.random() * 3, vy: (Math.random() - 0.5) * 2, life: 35 + Math.random() * 25, maxLife: 60, size: 8 + Math.random() * 12, color: colors[Math.floor(Math.random() * colors.length)], type: 'diamond', gravity: 0, rotation: Math.PI / 4, rotSpeed: 0, glow: true });
                }
            } else {
                for (let j = 0; j < 5; j++) {
                    particles.push({ x: x + (Math.random() - 0.5) * 40, y: y + (Math.random() - 0.5) * 40, vx: 0, vy: 0, life: 55 + Math.random() * 45, maxLife: 100, size: 12 + Math.random() * 18, color: colors[Math.floor(Math.random() * colors.length)], type: 'crystal', gravity: 0, rotation: Math.random() * Math.PI, rotSpeed: (Math.random() - 0.5) * 0.06, alpha: 0.65, glow: true });
                }
            }
        }
        return particles;
    }

    _electricParticles(x, y, count, colors, v) {
        const particles = [];
        if (v === 0) {
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                particles.push({ x, y, vx: Math.cos(angle) * (4 + Math.random() * 5), vy: Math.sin(angle) * (4 + Math.random() * 5), life: 30 + Math.random() * 20, maxLife: 50, size: 4 + Math.random() * 5, color: colors[Math.floor(Math.random() * colors.length)], type: 'spark', gravity: 0, glow: true });
            }
            for (let i = 0; i < 4; i++) {
                particles.push({ x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 30, vx: 0, vy: 0, life: 15 + Math.random() * 10, maxLife: 25, size: 15 + Math.random() * 10, color: '#ffee58', type: 'circle', gravity: 0, alpha: 0.4, pulse: true });
            }
        } else if (v === 1) {
            for (let i = 0; i < count; i++) {
                particles.push({ x: x + (Math.random() - 0.5) * 35, y: y - 15 + Math.random() * 30, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, life: 22 + Math.random() * 18, maxLife: 40, size: 3 + Math.random() * 4, color: colors[Math.floor(Math.random() * colors.length)], type: 'spark', gravity: 0, glow: true });
            }
        } else if (v === 2) {
            for (let i = 0; i < count; i++) {
                particles.push({ x, y: y + (Math.random() - 0.5) * 25, vx: 7 + Math.random() * 3, vy: (Math.random() - 0.5) * 8, life: 20 + Math.random() * 15, maxLife: 35, size: 4 + Math.random() * 4, color: colors[Math.floor(Math.random() * colors.length)], type: 'spark', gravity: 0, glow: true });
            }
        } else {
            for (let i = 0; i < count; i++) {
                particles.push({ x: x + (Math.random() - 0.5) * 70, y: y + (Math.random() - 0.5) * 70, vx: 0, vy: 0, life: 35 + Math.random() * 25, maxLife: 60, size: 5 + Math.random() * 8, color: colors[Math.floor(Math.random() * colors.length)], type: 'spark', gravity: 0, pulse: true, glow: true });
            }
        }
        return particles;
    }

    _fightingParticles(x, y, count, colors, v) {
        const particles = [];
        if (v === 0) {
            for (let i = 0; i < count; i++) {
                const angle = (Math.random() - 0.5) * 1.0;
                particles.push({ x: x - 30, y: y + (Math.random() - 0.5) * 15, vx: 7 + Math.random() * 4, vy: angle * 4, life: 30 + Math.random() * 20, maxLife: 50, size: 6 + Math.random() * 7, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0, glow: true });
            }
            this.particles.push({ x, y, vx: 0, vy: 0, life: 8, maxLife: 8, size: 40, color: '#ffffff', type: 'circle', gravity: 0, alpha: 0.7 });
        } else if (v === 1) {
            for (let i = 0; i < count; i++) {
                particles.push({ x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 30, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, life: 25 + Math.random() * 18, maxLife: 43, size: 8 + Math.random() * 12, color: colors[Math.floor(Math.random() * colors.length)], type: 'impact', gravity: 0, glow: true });
            }
        } else if (v === 2) {
            for (let i = 0; i < 5; i++) {
                const angle = -Math.PI / 3 + (i / 4) * (Math.PI * 2 / 3);
                particles.push({ x, y, vx: Math.cos(angle) * 6, vy: Math.sin(angle) * 6, life: 35 + Math.random() * 20, maxLife: 55, size: 8 + Math.random() * 6, color: colors[0], type: 'impact', gravity: 0, glow: true });
            }
        } else {
            for (let i = 0; i < count; i++) {
                particles.push({ x: x + (Math.random() - 0.5) * 40, y: y + (Math.random() - 0.5) * 40, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, life: 40 + Math.random() * 25, maxLife: 65, size: 5 + Math.random() * 7, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0, glow: true });
            }
        }
        return particles;
    }

    _poisonParticles(x, y, count, colors, v) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.5 + Math.random() * 2.5;
            particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1.5, life: 60 + Math.random() * 45, maxLife: 105, size: 6 + Math.random() * 9, color: colors[Math.floor(Math.random() * colors.length)], type: 'bubble', gravity: -0.04, glow: true });
        }
        for (let i = 0; i < 4; i++) {
            particles.push({ x: x + (Math.random() - 0.5) * 20, y: y + 5, vx: (Math.random() - 0.5) * 1, vy: -1 - Math.random() * 2, life: 50 + Math.random() * 35, maxLife: 85, size: 8 + Math.random() * 10, color: colors[4] || '#e1bee7', type: 'circle', gravity: -0.02, alpha: 0.3, glow: true });
        }
        return particles;
    }

    _groundParticles(x, y, count, colors, v) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            particles.push({ x: x + Math.cos(angle) * 8, y: y + 5, vx: Math.cos(angle) * (3 + Math.random() * 4), vy: -2 - Math.random() * 5, life: 40 + Math.random() * 30, maxLife: 70, size: 5 + Math.random() * 8, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0.18, glow: true });
        }
        for (let i = 0; i < 5; i++) {
            particles.push({ x: x + (Math.random() - 0.5) * 25, y: y + 8, vx: (Math.random() - 0.5) * 2, vy: -1 - Math.random() * 2, life: 35 + Math.random() * 25, maxLife: 60, size: 4 + Math.random() * 5, color: '#d7ccc8', type: 'circle', gravity: 0.1 });
        }
        return particles;
    }

    _flyingParticles(x, y, count, colors, v) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            particles.push({ x: x + (Math.random() - 0.5) * 40, y: y + (Math.random() - 0.5) * 30, vx: (Math.random() - 0.5) * 3, vy: -1.5 - Math.random() * 3, life: 50 + Math.random() * 40, maxLife: 90, size: 5 + Math.random() * 7, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: -0.03, glow: true });
        }
        for (let i = 0; i < 3; i++) {
            particles.push({ x: x + (Math.random() - 0.5) * 20, y: y, vx: (Math.random() - 0.5) * 4, vy: -3 - Math.random() * 2, life: 40 + Math.random() * 30, maxLife: 70, size: 3 + Math.random() * 4, color: '#ffffff', type: 'leaf', gravity: -0.02, rotation: Math.random() * Math.PI, rotSpeed: (Math.random() - 0.5) * 0.3 });
        }
        return particles;
    }

    _psychicParticles(x, y, count, colors, v) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const radius = 15 + Math.random() * 25;
            particles.push({ x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius, vx: Math.cos(angle + Math.PI / 2) * 0.8, vy: Math.sin(angle + Math.PI / 2) * 0.8, life: 55 + Math.random() * 40, maxLife: 95, size: 5 + Math.random() * 6, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0, pulse: true, glow: true });
        }
        for (let i = 0; i < 3; i++) {
            particles.push({ x, y, vx: 0, vy: 0, life: 30 + Math.random() * 20, maxLife: 50, size: 15 + Math.random() * 10, color: colors[0], type: 'circle', gravity: 0, alpha: 0.2, pulse: true });
        }
        return particles;
    }

    _bugParticles(x, y, count, colors, v) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            particles.push({ x: x + (Math.random() - 0.5) * 35, y: y + (Math.random() - 0.5) * 35, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, life: 40 + Math.random() * 30, maxLife: 70, size: 4 + Math.random() * 5, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0, glow: true });
        }
        for (let i = 0; i < 4; i++) {
            particles.push({ x: x + (Math.random() - 0.5) * 18, y: y + (Math.random() - 0.5) * 18, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, life: 35 + Math.random() * 25, maxLife: 60, size: 2 + Math.random() * 3, color: '#c5e1a5', type: 'leaf', gravity: 0, rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.4 });
        }
        return particles;
    }

    _rockParticles(x, y, count, colors, v) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            particles.push({ x, y, vx: Math.cos(angle) * (3 + Math.random() * 5), vy: Math.sin(angle) * (3 + Math.random() * 5) - 3, life: 35 + Math.random() * 30, maxLife: 65, size: 6 + Math.random() * 11, color: colors[Math.floor(Math.random() * colors.length)], type: 'rock', gravity: 0.18, rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.25, glow: true });
        }
        for (let i = 0; i < 4; i++) {
            particles.push({ x: x + (Math.random() - 0.5) * 20, y: y + 5, vx: (Math.random() - 0.5) * 2, vy: -1 - Math.random() * 2, life: 30 + Math.random() * 20, maxLife: 50, size: 5 + Math.random() * 6, color: '#bcaaa4', type: 'circle', gravity: 0.12, alpha: 0.5 });
        }
        return particles;
    }

    _ghostParticles(x, y, count, colors, v) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            particles.push({ x: x + Math.cos(angle) * 18, y: y + Math.sin(angle) * 18, vx: Math.cos(angle) * 0.5, vy: -0.8 - Math.random() * 1.5, life: 60 + Math.random() * 45, maxLife: 105, size: 7 + Math.random() * 12, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: -0.025, alpha: 0.55, glow: true });
        }
        for (let i = 0; i < 3; i++) {
            particles.push({ x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20, vx: 0, vy: -0.3, life: 55 + Math.random() * 35, maxLife: 90, size: 12 + Math.random() * 10, color: '#b388ff', type: 'circle', gravity: -0.01, alpha: 0.2, pulse: true });
        }
        return particles;
    }

    _dragonParticles(x, y, count, colors, v) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const speed = 4 + Math.random() * 4;
            particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 45 + Math.random() * 35, maxLife: 80, size: 6 + Math.random() * 9, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0, glow: true });
        }
        for (let i = 0; i < 3; i++) {
            particles.push({ x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20, vx: 0, vy: 0, life: 35 + Math.random() * 25, maxLife: 60, size: 15 + Math.random() * 12, color: colors[4] || '#7986cb', type: 'circle', gravity: 0, alpha: 0.25, pulse: true });
        }
        return particles;
    }

    _darkParticles(x, y, count, colors, v) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            particles.push({ x: x + Math.cos(angle) * 15, y: y + Math.sin(angle) * 15, vx: Math.cos(angle) * -0.7, vy: Math.sin(angle) * -0.7, life: 55 + Math.random() * 40, maxLife: 95, size: 6 + Math.random() * 9, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0, alpha: 0.6, glow: true });
        }
        for (let i = 0; i < 4; i++) {
            const angle = Math.random() * Math.PI * 2;
            particles.push({ x: x + Math.cos(angle) * 8, y: y + Math.sin(angle) * 8, vx: Math.cos(angle) * 1.5, vy: Math.sin(angle) * 1.5, life: 45 + Math.random() * 30, maxLife: 75, size: 4 + Math.random() * 6, color: '#37474f', type: 'circle', gravity: 0, alpha: 0.8 });
        }
        return particles;
    }

    _steelParticles(x, y, count, colors, v) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            particles.push({ x, y, vx: Math.cos(angle) * (3 + Math.random() * 3), vy: Math.sin(angle) * (3 + Math.random() * 3), life: 40 + Math.random() * 25, maxLife: 65, size: 5 + Math.random() * 7, color: colors[Math.floor(Math.random() * colors.length)], type: 'diamond', gravity: 0, rotation: Math.PI / 4, rotSpeed: 0, glow: true });
        }
        for (let i = 0; i < 4; i++) {
            particles.push({ x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, life: 25 + Math.random() * 15, maxLife: 40, size: 2 + Math.random() * 3, color: '#eceff1', type: 'spark', gravity: 0, glow: true });
        }
        return particles;
    }

    _fairyParticles(x, y, count, colors, v) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.8 + Math.random() * 2;
            particles.push({ x: x + Math.cos(angle) * 12, y: y + Math.sin(angle) * 12, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1.5, life: 60 + Math.random() * 45, maxLife: 105, size: 5 + Math.random() * 8, color: colors[Math.floor(Math.random() * colors.length)], type: 'star', gravity: -0.04, glow: true });
        }
        for (let i = 0; i < 5; i++) {
            particles.push({ x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 30, vx: (Math.random() - 0.5) * 1.5, vy: -1 - Math.random(), life: 50 + Math.random() * 35, maxLife: 85, size: 3 + Math.random() * 5, color: '#ffffff', type: 'star', gravity: -0.02, glow: true });
        }
        return particles;
    }

    _normalParticles(x, y, count, colors, v) {
        const particles = [];
        if (v === 0) {
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2;
                particles.push({ x, y, vx: Math.cos(angle) * (3 + Math.random() * 4), vy: Math.sin(angle) * (3 + Math.random() * 4), life: 35 + Math.random() * 25, maxLife: 60, size: 5 + Math.random() * 6, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0, glow: true });
            }
        } else if (v === 1) {
            for (let i = 0; i < count; i++) {
                particles.push({ x: x - 55, y: y + (Math.random() - 0.5) * 35, vx: 6 + Math.random() * 3, vy: (Math.random() - 0.5) * 3, life: 30 + Math.random() * 20, maxLife: 50, size: 5 + Math.random() * 5, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0, glow: true });
            }
        } else {
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                particles.push({ x, y, vx: Math.cos(angle) * 4, vy: Math.sin(angle) * 4, life: 35 + Math.random() * 25, maxLife: 60, size: 6 + Math.random() * 9, color: colors[Math.floor(Math.random() * colors.length)], type: 'impact', gravity: 0, glow: true });
            }
        }
        return particles;
    }

    // ============================================================
    // SPECIAL EFFECTS: HEAL / BUFF / DEBUFF
    // ============================================================

    _healParticles(x, y, count) {
        const particles = [];
        const colors = ['#4caf50', '#81c784', '#a5d6a7', '#c8e6c9', '#ffffff', '#69f0ae'];
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const radius = 12 + Math.random() * 30;
            particles.push({
                x: x + Math.cos(angle) * radius,
                y: y + Math.sin(angle) * radius * 0.6,
                vx: Math.cos(angle) * 0.4,
                vy: -2 - Math.random() * 3,
                life: 60 + Math.random() * 45,
                maxLife: 105,
                size: 4 + Math.random() * 6,
                color: colors[Math.floor(Math.random() * colors.length)],
                type: 'star',
                gravity: -0.05,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.12,
                glow: true
            });
        }
        for (let i = 0; i < Math.floor(count * 0.5); i++) {
            const angle = Math.random() * Math.PI * 2;
            particles.push({
                x: x + Math.cos(angle) * 8,
                y: y + 12,
                vx: Math.cos(angle) * 0.6,
                vy: -2.5 - Math.random() * 4,
                life: 45 + Math.random() * 35,
                maxLife: 80,
                size: 5 + Math.random() * 7,
                color: colors[Math.floor(Math.random() * colors.length)],
                type: 'circle',
                gravity: -0.07,
                glow: true
            });
        }
        for (let i = 0; i < 4; i++) {
            particles.push({
                x: x + (Math.random() - 0.5) * 25,
                y: y + (Math.random() - 0.5) * 25,
                vx: 0,
                vy: -0.6,
                life: 55 + Math.random() * 35,
                maxLife: 90,
                size: 15 + Math.random() * 20,
                color: '#69f0ae',
                type: 'circle',
                gravity: -0.025,
                alpha: 0.2,
                pulse: true,
                glow: true
            });
        }
        return particles;
    }

    _buffParticles(x, y, count, statType) {
        const particles = [];
        const statColors = {
            attack:  ['#f44336', '#ef5350', '#ff8a80', '#ff5252', '#ffffff'],
            defense: ['#2196f3', '#42a5f5', '#90caf9', '#64b5f6', '#ffffff'],
            spAtk:   ['#9c27b0', '#ab47bc', '#ce93d8', '#ba68c8', '#ffffff'],
            spDef:   ['#00bcd4', '#26c6da', '#80deea', '#4dd0e1', '#ffffff'],
            speed:   ['#ff9800', '#ffa726', '#ffcc80', '#ffb74d', '#ffffff'],
            accuracy:['#ffeb3b', '#ffee58', '#fff9c4', '#fff176', '#ffffff'],
            default: ['#e040fb', '#ea80fc', '#f8bbd0', '#ce93d8', '#ffffff']
        };
        const colors = statColors[statType] || statColors.default;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const radius = 18 + Math.random() * 25;
            particles.push({
                x: x + Math.cos(angle) * radius,
                y: y + Math.sin(angle) * radius * 0.5,
                vx: Math.cos(angle + Math.PI / 2) * 1.5,
                vy: -1 - Math.random() * 2,
                life: 50 + Math.random() * 40,
                maxLife: 90,
                size: 4 + Math.random() * 6,
                color: colors[Math.floor(Math.random() * colors.length)],
                type: 'star',
                gravity: -0.035,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.18,
                glow: true
            });
        }
        for (let i = 0; i < 5; i++) {
            particles.push({
                x: x + (Math.random() - 0.5) * 35,
                y: y + (Math.random() - 0.5) * 35,
                vx: 0,
                vy: -0.4,
                life: 55 + Math.random() * 35,
                maxLife: 90,
                size: 18 + Math.random() * 15,
                color: colors[0],
                type: 'circle',
                gravity: -0.015,
                alpha: 0.18,
                pulse: true,
                glow: true
            });
        }
        return particles;
    }

    _debuffParticles(x, y, count) {
        const particles = [];
        const colors = ['#424242', '#616161', '#757575', '#9e9e9e', '#b71c1c'];
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 12 + Math.random() * 25;
            particles.push({
                x: x + Math.cos(angle) * radius,
                y: y + Math.sin(angle) * radius * 0.5,
                vx: Math.cos(angle) * -0.5,
                vy: 1 + Math.random() * 2,
                life: 45 + Math.random() * 35,
                maxLife: 80,
                size: 5 + Math.random() * 6,
                color: colors[Math.floor(Math.random() * colors.length)],
                type: 'circle',
                gravity: 0.05,
                alpha: 0.7,
                glow: true
            });
        }
        for (let i = 0; i < 4; i++) {
            particles.push({
                x: x + (Math.random() - 0.5) * 30,
                y: y - 12,
                vx: (Math.random() - 0.5) * 2.5,
                vy: 2.5 + Math.random() * 3,
                life: 40 + Math.random() * 30,
                maxLife: 70,
                size: 8 + Math.random() * 10,
                color: colors[Math.floor(Math.random() * colors.length)],
                type: 'circle',
                gravity: 0.1,
                alpha: 0.45
            });
        }
        return particles;
    }

    _selfBuffParticles(x, y, count, statType) {
        return this._buffParticles(x, y, count, statType);
    }

    _selfDebuffParticles(x, y, count) {
        const particles = [];
        const colors = ['#ff1744', '#d50000', '#b71c1c', '#ff5252', '#ff8a80'];
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const radius = 15 + Math.random() * 22;
            particles.push({
                x: x + Math.cos(angle) * radius,
                y: y + Math.sin(angle) * radius * 0.5,
                vx: Math.cos(angle) * 1,
                vy: 0.6 + Math.random() * 1.5,
                life: 45 + Math.random() * 35,
                maxLife: 80,
                size: 5 + Math.random() * 6,
                color: colors[Math.floor(Math.random() * colors.length)],
                type: 'circle',
                gravity: 0.04,
                alpha: 0.7,
                glow: true
            });
        }
        for (let i = 0; i < 3; i++) {
            particles.push({
                x: x + (Math.random() - 0.5) * 25,
                y: y,
                vx: 0,
                vy: 0,
                life: 35 + Math.random() * 25,
                maxLife: 60,
                size: 15 + Math.random() * 12,
                color: '#ff1744',
                type: 'circle',
                gravity: 0,
                alpha: 0.25,
                pulse: true,
                glow: true
            });
        }
        return particles;
    }

    // ============================================================
    // RENDER & ANIMATION
    // ============================================================

    _drawParticle(p) {
        const ctx = this.ctx;
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = p.alpha !== undefined ? p.alpha * alpha : alpha;
        ctx.fillStyle = p.color;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.5;

        if (p.glow) {
            ctx.shadowColor = p.color;
            ctx.shadowBlur = Math.min(p.size * 2, 20);
        }

        ctx.save();
        if (p.rotation) ctx.translate(p.x, p.y), ctx.rotate(p.rotation);

        switch (p.type) {
            case 'circle':
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'diamond':
                ctx.beginPath();
                ctx.moveTo(p.x, p.y - p.size);
                ctx.lineTo(p.x + p.size * 0.6, p.y);
                ctx.lineTo(p.x, p.y + p.size);
                ctx.lineTo(p.x - p.size * 0.6, p.y);
                ctx.closePath();
                ctx.fill();
                break;
            case 'spark':
                ctx.beginPath();
                ctx.moveTo(p.x - p.size, p.y);
                ctx.lineTo(p.x, p.y - p.size * 1.5);
                ctx.lineTo(p.x + p.size, p.y);
                ctx.lineTo(p.x, p.y + p.size * 1.5);
                ctx.closePath();
                ctx.fill();
                break;
            case 'impact':
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * 1.6, 0, Math.PI * 2);
                ctx.stroke();
                break;
            case 'bubble':
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = alpha * 0.5;
                ctx.beginPath();
                ctx.arc(p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.3, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
                break;
            case 'leaf':
                ctx.beginPath();
                ctx.ellipse(p.x, p.y, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'rock':
                ctx.beginPath();
                ctx.moveTo(p.x - p.size, p.y - p.size * 0.5);
                ctx.lineTo(p.x - p.size * 0.3, p.y - p.size);
                ctx.lineTo(p.x + p.size * 0.5, p.y - p.size * 0.7);
                ctx.lineTo(p.x + p.size, p.y);
                ctx.lineTo(p.x + p.size * 0.5, p.y + p.size * 0.6);
                ctx.lineTo(p.x - p.size * 0.2, p.y + p.size);
                ctx.closePath();
                ctx.fill();
                break;
            case 'star':
                ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
                    ctx.lineTo(p.x + Math.cos(angle) * p.size, p.y + Math.sin(angle) * p.size);
                    const innerAngle = angle + (2 * Math.PI) / 10;
                    ctx.lineTo(p.x + Math.cos(innerAngle) * p.size * 0.4, p.y + Math.sin(innerAngle) * p.size * 0.4);
                }
                ctx.closePath();
                ctx.fill();
                break;
            case 'crystal':
                ctx.beginPath();
                ctx.moveTo(p.x, p.y - p.size);
                ctx.lineTo(p.x + p.size * 0.5, p.y - p.size * 0.2);
                ctx.lineTo(p.x + p.size * 0.3, p.y + p.size);
                ctx.lineTo(p.x - p.size * 0.3, p.y + p.size);
                ctx.lineTo(p.x - p.size * 0.5, p.y - p.size * 0.2);
                ctx.closePath();
                ctx.fill();
                break;
            default:
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
        }
        ctx.restore();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }

    _update() {
        if (!this.running) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity || 0;
            p.life--;
            if (p.rotation !== undefined) p.rotation += p.rotSpeed || 0;
            if (p.pulse) p.size = p.size + Math.sin(p.life * 0.3) * 0.4;
            if (p.life <= 0) { this.particles.splice(i, 1); continue; }
            this._drawParticle(p);
        }

        if (this.particles.length > 0) {
            this.animFrame = requestAnimationFrame(() => this._update());
        } else {
            this.running = false;
        }
    }

    // ============================================================
    // PUBLIC API
    // ============================================================

    async playEffect(type, targetX, targetY, power = 50) {
        if (!this.ctx) return;
        this._resize();
        const newParticles = this._createParticles(type, targetX, targetY, power);
        this.particles.push(...newParticles);
        if (!this.running) {
            this.running = true;
            this._update();
        }
        await this._sleep(1200);
    }

    async playHealEffect(targetX, targetY) {
        if (!this.ctx) return;
        this._resize();
        const newParticles = this._healParticles(targetX, targetY, 40);
        this.particles.push(...newParticles);
        if (!this.running) {
            this.running = true;
            this._update();
        }
        await this._sleep(1200);
    }

    async playBuffEffect(targetX, targetY, statType) {
        if (!this.ctx) return;
        this._resize();
        const newParticles = this._buffParticles(targetX, targetY, 35, statType);
        this.particles.push(...newParticles);
        if (!this.running) {
            this.running = true;
            this._update();
        }
        await this._sleep(1100);
    }

    async playDebuffEffect(targetX, targetY) {
        if (!this.ctx) return;
        this._resize();
        const newParticles = this._debuffParticles(targetX, targetY, 35);
        this.particles.push(...newParticles);
        if (!this.running) {
            this.running = true;
            this._update();
        }
        await this._sleep(1000);
    }

    async playSelfBuffEffect(targetX, targetY, statType) {
        if (!this.ctx) return;
        this._resize();
        const newParticles = this._selfBuffParticles(targetX, targetY, 35, statType);
        this.particles.push(...newParticles);
        if (!this.running) {
            this.running = true;
            this._update();
        }
        await this._sleep(1100);
    }

    async playSelfDebuffEffect(targetX, targetY) {
        if (!this.ctx) return;
        this._resize();
        const newParticles = this._selfDebuffParticles(targetX, targetY, 30);
        this.particles.push(...newParticles);
        if (!this.running) {
            this.running = true;
            this._update();
        }
        await this._sleep(1000);
    }

    async playDualEffect(type, targetX, targetY, selfX, selfY, power = 50) {
        if (!this.ctx) return;
        this._resize();
        const attackParticles = this._createParticles(type, targetX, targetY, power);
        this.particles.push(...attackParticles);
        if (!this.running) {
            this.running = true;
            this._update();
        }
        await this._sleep(700);
        const healParticles = this._healParticles(selfX, selfY, 30);
        this.particles.push(...healParticles);
        if (!this.running) {
            this.running = true;
            this._update();
        }
        await this._sleep(900);
    }

    stop() {
        this.running = false;
        this.particles = [];
        if (this.animFrame) cancelAnimationFrame(this.animFrame);
        if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}
