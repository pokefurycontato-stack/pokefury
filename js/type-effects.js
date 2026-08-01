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
            this.canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:50;';
            const battleScreen = document.getElementById('battle-screen');
            if (battleScreen) {
                battleScreen.style.position = 'relative';
                battleScreen.appendChild(this.canvas);
            }
        }
        this.ctx = this.canvas.getContext('2d');
        this._resize();
        window.addEventListener('resize', () => this._resize());
    }

    _resize() {
        const battleScreen = document.getElementById('battle-screen');
        if (!battleScreen || !this.canvas) return;
        this.canvas.width = battleScreen.offsetWidth;
        this.canvas.height = battleScreen.offsetHeight;
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ============================================================
    // COLOR PALETTES PER TYPE
    // ============================================================

    _getColors(type) {
        const palettes = {
            fire:      ['#ff4500', '#ff6a00', '#ff8c00', '#ffb347', '#fff176'],
            water:     ['#1565c0', '#1e88e5', '#42a5f5', '#90caf9', '#e3f2fd'],
            grass:     ['#2e7d32', '#43a047', '#66bb6a', '#a5d6a7', '#c8e6c9'],
            ice:       ['#b3e5fc', '#81d4fa', '#4fc3f7', '#29b6f6', '#ffffff'],
            electric:  ['#f9a825', '#fdd835', '#ffee58', '#fff176', '#ffffff'],
            fighting:  ['#d32f2f', '#e53935', '#ef5350', '#ff8a65', '#ffccbc'],
            poison:    ['#7b1fa2', '#9c27b0', '#ab47bc', '#ce93d8', '#e1bee7'],
            ground:    ['#8d6e63', '#a1887f', '#bcaaa4', '#d7ccc8', '#efebe9'],
            flying:    ['#90caf9', '#bbdefb', '#e3f2fd', '#ffffff', '#f3e5f5'],
            psychic:   ['#e91e63', '#f06292', '#f48fb1', '#f8bbd0', '#fce4ec'],
            bug:       ['#558b2f', '#689f38', '#7cb342', '#9ccc65', '#c5e1a5'],
            rock:      ['#5d4037', '#795548', '#8d6e63', '#a1887f', '#d7ccc8'],
            ghost:     ['#4a148c', '#6a1b9a', '#8e24aa', '#ab47bc', '#ce93d8'],
            dragon:    ['#1a237e', '#283593', '#3949ab', '#5c6bc0', '#7986cb'],
            dark:      ['#212121', '#424242', '#616161', '#9e9e9e', '#bdbdbd'],
            steel:     ['#78909c', '#90a4ae', '#b0bec5', '#cfd8dc', '#eceff1'],
            fairy:     ['#f06292', '#f48fb1', '#f8bbd0', '#fce4ec', '#ffffff'],
            normal:    ['#bdbdbd', '#e0e0e0', '#eeeeee', '#f5f5f5', '#ffffff']
        };
        return palettes[type] || palettes.normal;
    }

    // ============================================================
    // PARTICLE GENERATORS PER TYPE
    // ============================================================

    _createParticles(type, x, y, power) {
        const count = Math.min(20 + Math.floor(power / 10), 50);
        const colors = this._getColors(type);
        const variation = Math.floor(Math.random() * 4);

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
                particles.push({ x, y: y + Math.random() * 20, vx: (Math.random() - 0.5) * 3, vy: -2 - Math.random() * 4, life: 40 + Math.random() * 30, maxLife: 70, size: 4 + Math.random() * 6, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: -0.05 });
            }
        } else if (v === 1) {
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2;
                particles.push({ x, y, vx: Math.cos(angle) * (2 + Math.random() * 3), vy: Math.sin(angle) * (2 + Math.random() * 3), life: 30 + Math.random() * 20, maxLife: 50, size: 3 + Math.random() * 5, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0 });
            }
        } else if (v === 2) {
            for (let i = 0; i < count; i++) {
                particles.push({ x: x - 40 + Math.random() * 80, y: y - 10 + Math.random() * 20, vx: 4 + Math.random() * 3, vy: (Math.random() - 0.5) * 2, life: 25 + Math.random() * 15, maxLife: 40, size: 5 + Math.random() * 7, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: -0.03 });
            }
        } else {
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI;
                const speed = 1 + Math.random() * 4;
                particles.push({ x, y: y + 10, vx: Math.cos(angle) * speed, vy: -Math.abs(Math.sin(angle) * speed), life: 35 + Math.random() * 25, maxLife: 60, size: 3 + Math.random() * 8, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0.02 });
            }
        }
        return particles;
    }

    _waterParticles(x, y, count, colors, v) {
        const particles = [];
        if (v === 0) {
            for (let i = 0; i < count; i++) {
                particles.push({ x: x + (Math.random() - 0.5) * 60, y: y - 30, vx: (Math.random() - 0.5) * 1, vy: 3 + Math.random() * 3, life: 30 + Math.random() * 20, maxLife: 50, size: 3 + Math.random() * 4, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0.15 });
            }
        } else if (v === 1) {
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2;
                particles.push({ x, y, vx: Math.cos(angle) * (1 + Math.random() * 2), vy: Math.sin(angle) * (1 + Math.random() * 2), life: 25 + Math.random() * 15, maxLife: 40, size: 4 + Math.random() * 5, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0.05 });
            }
        } else if (v === 2) {
            for (let i = 0; i < count; i++) {
                particles.push({ x: x - 50, y: y + (Math.random() - 0.5) * 30, vx: 5 + Math.random() * 2, vy: (Math.random() - 0.5) * 2, life: 20 + Math.random() * 15, maxLife: 35, size: 2 + Math.random() * 3, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0 });
            }
        } else {
            for (let i = 0; i < count; i++) {
                particles.push({ x, y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, life: 20 + Math.random() * 20, maxLife: 40, size: 2 + Math.random() * 6, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0.1 });
            }
        }
        return particles;
    }

    _grassParticles(x, y, count, colors, v) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            if (v === 0) {
                const angle = Math.random() * Math.PI * 2;
                particles.push({ x, y: y + 15, vx: Math.cos(angle) * (1 + Math.random() * 2), vy: -2 - Math.random() * 3, life: 35 + Math.random() * 25, maxLife: 60, size: 3 + Math.random() * 4, color: colors[Math.floor(Math.random() * colors.length)], type: 'leaf', gravity: 0.03, rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.2 });
            } else if (v === 1) {
                particles.push({ x: x + (Math.random() - 0.5) * 50, y: y + 10, vx: (Math.random() - 0.5) * 1, vy: -1 - Math.random() * 2, life: 40 + Math.random() * 30, maxLife: 70, size: 4 + Math.random() * 5, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: -0.02 });
            } else if (v === 2) {
                const angle = (i / count) * Math.PI * 2;
                particles.push({ x, y, vx: Math.cos(angle) * 2, vy: Math.sin(angle) * 2, life: 30 + Math.random() * 20, maxLife: 50, size: 2 + Math.random() * 3, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0 });
            } else {
                particles.push({ x: x + (Math.random() - 0.5) * 40, y: y + 5, vx: (Math.random() - 0.5) * 2, vy: -1 - Math.random() * 2, life: 30 + Math.random() * 20, maxLife: 50, size: 3 + Math.random() * 4, color: colors[Math.floor(Math.random() * colors.length)], type: 'leaf', gravity: 0.02, rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.15 });
            }
        }
        return particles;
    }

    _iceParticles(x, y, count, colors, v) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            if (v === 0) {
                const angle = (i / count) * Math.PI * 2;
                const speed = 2 + Math.random() * 2;
                particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 30 + Math.random() * 20, maxLife: 50, size: 3 + Math.random() * 5, color: colors[Math.floor(Math.random() * colors.length)], type: 'diamond', gravity: 0, rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.1 });
            } else if (v === 1) {
                particles.push({ x: x + (Math.random() - 0.5) * 80, y: y - 40, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3, life: 35 + Math.random() * 25, maxLife: 60, size: 2 + Math.random() * 4, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0.05 });
            } else if (v === 2) {
                particles.push({ x: x - 40, y: y, vx: 5 + Math.random() * 2, vy: (Math.random() - 0.5) * 2, life: 20 + Math.random() * 15, maxLife: 35, size: 6 + Math.random() * 8, color: colors[Math.floor(Math.random() * colors.length)], type: 'diamond', gravity: 0, rotation: Math.PI / 4, rotSpeed: 0 });
            } else {
                for (let j = 0; j < 3; j++) {
                    particles.push({ x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 30, vx: 0, vy: 0, life: 40 + Math.random() * 30, maxLife: 70, size: 8 + Math.random() * 12, color: colors[Math.floor(Math.random() * colors.length)], type: 'crystal', gravity: 0, rotation: Math.random() * Math.PI, rotSpeed: (Math.random() - 0.5) * 0.05, alpha: 0.6 });
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
                particles.push({ x, y, vx: Math.cos(angle) * (3 + Math.random() * 4), vy: Math.sin(angle) * (3 + Math.random() * 4), life: 15 + Math.random() * 10, maxLife: 25, size: 2 + Math.random() * 3, color: colors[Math.floor(Math.random() * colors.length)], type: 'spark', gravity: 0 });
            }
        } else if (v === 1) {
            for (let i = 0; i < count; i++) {
                particles.push({ x: x + (Math.random() - 0.5) * 40, y: y - 20 + Math.random() * 40, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, life: 10 + Math.random() * 8, maxLife: 18, size: 1 + Math.random() * 2, color: colors[Math.floor(Math.random() * colors.length)], type: 'spark', gravity: 0 });
            }
        } else if (v === 2) {
            for (let i = 0; i < count; i++) {
                particles.push({ x, y: y + (Math.random() - 0.5) * 20, vx: 6 + Math.random() * 2, vy: (Math.random() - 0.5) * 6, life: 8 + Math.random() * 7, maxLife: 15, size: 2 + Math.random() * 2, color: colors[Math.floor(Math.random() * colors.length)], type: 'spark', gravity: 0 });
            }
        } else {
            for (let i = 0; i < count; i++) {
                particles.push({ x: x + (Math.random() - 0.5) * 60, y: y + (Math.random() - 0.5) * 60, vx: 0, vy: 0, life: 20 + Math.random() * 15, maxLife: 35, size: 3 + Math.random() * 5, color: colors[Math.floor(Math.random() * colors.length)], type: 'spark', gravity: 0, pulse: true });
            }
        }
        return particles;
    }

    _fightingParticles(x, y, count, colors, v) {
        const particles = [];
        if (v === 0) {
            for (let i = 0; i < count; i++) {
                const angle = (Math.random() - 0.5) * 0.8;
                particles.push({ x: x - 60, y, vx: 6 + Math.random() * 3, vy: angle * 3, life: 15 + Math.random() * 10, maxLife: 25, size: 4 + Math.random() * 4, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0 });
            }
        } else if (v === 1) {
            for (let i = 0; i < count; i++) {
                particles.push({ x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, life: 12 + Math.random() * 8, maxLife: 20, size: 5 + Math.random() * 8, color: colors[Math.floor(Math.random() * colors.length)], type: 'impact', gravity: 0 });
            }
        } else if (v === 2) {
            for (let i = 0; i < 3; i++) {
                const angle = -Math.PI / 4 + (i / 2) * (Math.PI / 4);
                particles.push({ x, y, vx: Math.cos(angle) * 5, vy: Math.sin(angle) * 5, life: 20 + Math.random() * 10, maxLife: 30, size: 6 + Math.random() * 4, color: colors[0], type: 'impact', gravity: 0 });
            }
        } else {
            for (let i = 0; i < count; i++) {
                particles.push({ x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 30, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, life: 25 + Math.random() * 15, maxLife: 40, size: 3 + Math.random() * 5, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0 });
            }
        }
        return particles;
    }

    _poisonParticles(x, y, count, colors, v) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 2;
            particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1, life: 40 + Math.random() * 30, maxLife: 70, size: 4 + Math.random() * 6, color: colors[Math.floor(Math.random() * colors.length)], type: 'bubble', gravity: -0.03 });
        }
        return particles;
    }

    _groundParticles(x, y, count, colors, v) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            particles.push({ x: x + Math.cos(angle) * 10, y: y + 10, vx: Math.cos(angle) * (2 + Math.random() * 3), vy: -1 - Math.random() * 3, life: 25 + Math.random() * 20, maxLife: 45, size: 3 + Math.random() * 5, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0.15 });
        }
        return particles;
    }

    _flyingParticles(x, y, count, colors, v) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            particles.push({ x: x + (Math.random() - 0.5) * 60, y: y + (Math.random() - 0.5) * 40, vx: (Math.random() - 0.5) * 2, vy: -1 - Math.random() * 2, life: 30 + Math.random() * 25, maxLife: 55, size: 3 + Math.random() * 5, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: -0.02 });
        }
        return particles;
    }

    _psychicParticles(x, y, count, colors, v) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const radius = 20 + Math.random() * 30;
            particles.push({ x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius, vx: Math.cos(angle + Math.PI / 2) * 0.5, vy: Math.sin(angle + Math.PI / 2) * 0.5, life: 35 + Math.random() * 25, maxLife: 60, size: 3 + Math.random() * 4, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0, pulse: true });
        }
        return particles;
    }

    _bugParticles(x, y, count, colors, v) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            particles.push({ x: x + (Math.random() - 0.5) * 40, y: y + (Math.random() - 0.5) * 40, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, life: 25 + Math.random() * 20, maxLife: 45, size: 2 + Math.random() * 3, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0 });
        }
        return particles;
    }

    _rockParticles(x, y, count, colors, v) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            particles.push({ x, y, vx: Math.cos(angle) * (2 + Math.random() * 4), vy: Math.sin(angle) * (2 + Math.random() * 4) - 2, life: 20 + Math.random() * 20, maxLife: 40, size: 4 + Math.random() * 7, color: colors[Math.floor(Math.random() * colors.length)], type: 'rock', gravity: 0.15, rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.2 });
        }
        return particles;
    }

    _ghostParticles(x, y, count, colors, v) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            particles.push({ x: x + Math.cos(angle) * 15, y: y + Math.sin(angle) * 15, vx: Math.cos(angle) * 0.3, vy: -0.5 - Math.random() * 1, life: 40 + Math.random() * 30, maxLife: 70, size: 5 + Math.random() * 8, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: -0.02, alpha: 0.5 });
        }
        return particles;
    }

    _dragonParticles(x, y, count, colors, v) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            particles.push({ x, y, vx: Math.cos(angle) * (3 + Math.random() * 3), vy: Math.sin(angle) * (3 + Math.random() * 3), life: 30 + Math.random() * 20, maxLife: 50, size: 4 + Math.random() * 6, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0 });
        }
        return particles;
    }

    _darkParticles(x, y, count, colors, v) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            particles.push({ x: x + Math.cos(angle) * 20, y: y + Math.sin(angle) * 20, vx: Math.cos(angle) * -0.5, vy: Math.sin(angle) * -0.5, life: 35 + Math.random() * 25, maxLife: 60, size: 4 + Math.random() * 6, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0, alpha: 0.6 });
        }
        return particles;
    }

    _steelParticles(x, y, count, colors, v) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            particles.push({ x, y, vx: Math.cos(angle) * (2 + Math.random() * 2), vy: Math.sin(angle) * (2 + Math.random() * 2), life: 25 + Math.random() * 15, maxLife: 40, size: 3 + Math.random() * 4, color: colors[Math.floor(Math.random() * colors.length)], type: 'diamond', gravity: 0, rotation: Math.PI / 4, rotSpeed: 0 });
        }
        return particles;
    }

    _fairyParticles(x, y, count, colors, v) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.5 + Math.random() * 1.5;
            particles.push({ x: x + Math.cos(angle) * 10, y: y + Math.sin(angle) * 10, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1, life: 40 + Math.random() * 30, maxLife: 70, size: 3 + Math.random() * 5, color: colors[Math.floor(Math.random() * colors.length)], type: 'star', gravity: -0.03 });
        }
        return particles;
    }

    _normalParticles(x, y, count, colors, v) {
        const particles = [];
        if (v === 0) {
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2;
                particles.push({ x, y, vx: Math.cos(angle) * (2 + Math.random() * 3), vy: Math.sin(angle) * (2 + Math.random() * 3), life: 20 + Math.random() * 15, maxLife: 35, size: 3 + Math.random() * 4, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0 });
            }
        } else if (v === 1) {
            for (let i = 0; i < count; i++) {
                particles.push({ x: x - 50, y: y + (Math.random() - 0.5) * 30, vx: 5 + Math.random() * 2, vy: (Math.random() - 0.5) * 2, life: 15 + Math.random() * 10, maxLife: 25, size: 3 + Math.random() * 3, color: colors[Math.floor(Math.random() * colors.length)], type: 'circle', gravity: 0 });
            }
        } else {
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                particles.push({ x, y, vx: Math.cos(angle) * 3, vy: Math.sin(angle) * 3, life: 20 + Math.random() * 15, maxLife: 35, size: 4 + Math.random() * 6, color: colors[Math.floor(Math.random() * colors.length)], type: 'impact', gravity: 0 });
            }
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
        ctx.lineWidth = 1;

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
                ctx.arc(p.x, p.y, p.size * 1.5, 0, Math.PI * 2);
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
                    const r = i === 0 ? p.size : p.size;
                    ctx.lineTo(p.x + Math.cos(angle) * r, p.y + Math.sin(angle) * r);
                    const innerAngle = angle + (2 * Math.PI) / 10;
                    ctx.lineTo(p.x + Math.cos(innerAngle) * r * 0.4, p.y + Math.sin(innerAngle) * r * 0.4);
                }
                ctx.closePath();
                ctx.fill();
                break;
            default:
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
        }
        ctx.restore();
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
            if (p.pulse) p.size = p.size + Math.sin(p.life * 0.3) * 0.3;
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
        await this._sleep(600);
    }

    stop() {
        this.running = false;
        this.particles = [];
        if (this.animFrame) cancelAnimationFrame(this.animFrame);
        if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}
