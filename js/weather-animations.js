// ============================================================
// WEATHER ANIMATIONS - Visual effects for battle weather
// Rain, Sun, Sandstorm, Hail with canvas particles
// ============================================================

export class WeatherAnimations {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.currentWeather = null;
        this.particles = [];
        this.animFrame = null;
        this.running = false;
        this.sunAngle = 0;
        this.sunRays = [];
        this._init();
    }

    _init() {
        this.canvas = document.getElementById('weather-canvas');
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.id = 'weather-canvas';
            const battleScreen = document.getElementById('battle-screen');
            if (battleScreen) {
                battleScreen.style.position = 'relative';
                battleScreen.appendChild(this.canvas);
            }
        }
        this.ctx = this.canvas.getContext('2d');
        this._resize();
        window.addEventListener('resize', () => this._resize());

        // Create overlay elements if they don't exist
        this._createOverlay('weather-sun-overlay');
        this._createOverlay('weather-rain-overlay');
        this._createOverlay('weather-sand-overlay');
        this._createOverlay('weather-hail-overlay');
        this._createLabel();
    }

    _createOverlay(id) {
        if (!document.getElementById(id)) {
            const el = document.createElement('div');
            el.id = id;
            const battleScreen = document.getElementById('battle-screen');
            if (battleScreen) {
                battleScreen.style.position = 'relative';
                battleScreen.appendChild(el);
            }
        }
    }

    _createLabel() {
        if (!document.getElementById('weather-label')) {
            const el = document.createElement('div');
            el.id = 'weather-label';
            const battleScreen = document.getElementById('battle-screen');
            if (battleScreen) {
                battleScreen.appendChild(el);
            }
        }
    }

    _resize() {
        if (!this.canvas) return;
        const pvpFullscreen = document.getElementById('pvp-fullscreen');
        const wildFullscreen = document.getElementById('wild-fullscreen');
        const host = pvpFullscreen || wildFullscreen;
        if (host) {
            this.canvas.width = host.clientWidth || window.innerWidth;
            this.canvas.height = host.clientHeight || window.innerHeight;
            return;
        }
        const battleScreen = document.getElementById('battle-screen');
        if (battleScreen) {
            this.canvas.width = battleScreen.offsetWidth;
            this.canvas.height = battleScreen.offsetHeight;
        }
    }

    setWeather(weather) {
        if (weather === this.currentWeather) return;
        this.currentWeather = weather;
        this.particles = [];
        this.sunRays = [];
        this._updateOverlays();
        this._updateLabel();

        if (weather) {
            this._resize();
            this._initParticles();
            if (!this.running) this._start();
        } else {
            this._stop();
        }
    }

    _updateOverlays() {
        const ids = ['weather-sun-overlay', 'weather-rain-overlay', 'weather-sand-overlay', 'weather-hail-overlay'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('active');
        });

        if (this.currentWeather === 'sun') {
            document.getElementById('weather-sun-overlay')?.classList.add('active');
        } else if (this.currentWeather === 'rain') {
            document.getElementById('weather-rain-overlay')?.classList.add('active');
        } else if (this.currentWeather === 'sandstorm') {
            document.getElementById('weather-sand-overlay')?.classList.add('active');
        } else if (this.currentWeather === 'hail') {
            document.getElementById('weather-hail-overlay')?.classList.add('active');
        }
    }

    _updateLabel() {
        const label = document.getElementById('weather-label');
        if (!label) return;

        label.className = '';
        if (!this.currentWeather) {
            label.classList.remove('active');
            return;
        }

        const info = {
            rain: { text: 'Chuva', class: 'weather-rain' },
            sun: { text: 'Sol Intenso', class: 'weather-sun' },
            sandstorm: { text: 'Tempestade de Areia', class: 'weather-sandstorm' },
            hail: { text: 'Neve', class: 'weather-hail' }
        }[this.currentWeather];

        if (info) {
            label.textContent = info.text;
            label.className = info.class + ' active';
        }
    }

    _initParticles() {
        const w = this.canvas.width;
        const h = this.canvas.height;

        if (this.currentWeather === 'rain') {
            for (let i = 0; i < 150; i++) {
                this.particles.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    speed: 8 + Math.random() * 6,
                    length: 15 + Math.random() * 15,
                    opacity: 0.2 + Math.random() * 0.4,
                    wind: -1.5 - Math.random() * 1
                });
            }
        } else if (this.currentWeather === 'hail') {
            for (let i = 0; i < 80; i++) {
                this.particles.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    speed: 1.5 + Math.random() * 2,
                    size: 2 + Math.random() * 4,
                    opacity: 0.4 + Math.random() * 0.5,
                    wobble: Math.random() * Math.PI * 2,
                    wobbleSpeed: 0.02 + Math.random() * 0.03,
                    rotation: Math.random() * Math.PI * 2,
                    rotSpeed: (Math.random() - 0.5) * 0.05
                });
            }
        } else if (this.currentWeather === 'sandstorm') {
            for (let i = 0; i < 120; i++) {
                this.particles.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    speed: 3 + Math.random() * 4,
                    size: 1 + Math.random() * 3,
                    opacity: 0.15 + Math.random() * 0.35,
                    wind: 4 + Math.random() * 3,
                    curve: (Math.random() - 0.5) * 0.1,
                    color: Math.random() > 0.5 ? '#d4a56a' : '#c49452'
                });
            }
        } else if (this.currentWeather === 'sun') {
            for (let i = 0; i < 6; i++) {
                this.sunRays.push({
                    angle: (i / 6) * Math.PI * 2,
                    length: 200 + Math.random() * 150,
                    width: 15 + Math.random() * 20,
                    speed: 0.003 + Math.random() * 0.004,
                    opacity: 0.06 + Math.random() * 0.06
                });
            }
            // Floating sparkles
            for (let i = 0; i < 25; i++) {
                this.particles.push({
                    x: Math.random() * w,
                    y: Math.random() * h * 0.7,
                    speed: 0.3 + Math.random() * 0.5,
                    size: 1 + Math.random() * 2,
                    opacity: 0.3 + Math.random() * 0.5,
                    twinkle: Math.random() * Math.PI * 2,
                    twinkleSpeed: 0.03 + Math.random() * 0.05
                });
            }
        }
    }

    _start() {
        this.running = true;
        this._animate();
    }

    _stop() {
        this.running = false;
        if (this.animFrame) {
            cancelAnimationFrame(this.animFrame);
            this.animFrame = null;
        }
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        this.canvas?.classList.remove('active');
    }

    _animate() {
        if (!this.running) return;
        this.animFrame = requestAnimationFrame(() => this._animate());

        if (!this.ctx || !this.canvas) return;
        const w = this.canvas.width;
        const h = this.canvas.height;
        this.ctx.clearRect(0, 0, w, h);

        if (this.currentWeather === 'rain') {
            this._drawRain(w, h);
        } else if (this.currentWeather === 'hail') {
            this._drawHail(w, h);
        } else if (this.currentWeather === 'sandstorm') {
            this._drawSandstorm(w, h);
        } else if (this.currentWeather === 'sun') {
            this._drawSun(w, h);
        }

        this.canvas.classList.add('active');
    }

    _drawRain(w, h) {
        const ctx = this.ctx;
        for (const p of this.particles) {
            p.x += p.wind;
            p.y += p.speed;

            if (p.y > h) {
                p.y = -p.length;
                p.x = Math.random() * w;
            }
            if (p.x < -20) p.x = w + 10;

            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + p.wind * 0.5, p.y + p.length);
            ctx.strokeStyle = `rgba(120,180,255,${p.opacity})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // Splash at bottom
            if (p.y + p.length >= h - 2) {
                ctx.beginPath();
                ctx.arc(p.x, h - 2, 2, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(150,200,255,${p.opacity * 0.5})`;
                ctx.fill();
            }
        }

        // Lightning flash (occasional)
        if (Math.random() < 0.002) {
            ctx.fillStyle = `rgba(200,220,255,0.08)`;
            ctx.fillRect(0, 0, w, h);
        }
    }

    _drawHail(w, h) {
        const ctx = this.ctx;
        for (const p of this.particles) {
            p.wobble += p.wobbleSpeed;
            p.rotation += p.rotSpeed;
            p.x += Math.sin(p.wobble) * 0.8;
            p.y += p.speed;

            if (p.y > h + 10) {
                p.y = -10;
                p.x = Math.random() * w;
            }

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.globalAlpha = p.opacity;

            // Draw ice crystal (hexagon)
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                const px = Math.cos(angle) * p.size;
                const py = Math.sin(angle) * p.size;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fillStyle = `rgba(200,230,255,${p.opacity})`;
            ctx.fill();
            ctx.strokeStyle = `rgba(150,200,255,${p.opacity * 0.6})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();

            // Inner sparkle
            ctx.beginPath();
            ctx.arc(0, 0, p.size * 0.3, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${p.opacity * 0.8})`;
            ctx.fill();

            ctx.globalAlpha = 1;
            ctx.restore();
        }
    }

    _drawSandstorm(w, h) {
        const ctx = this.ctx;
        for (const p of this.particles) {
            p.x += p.wind;
            p.y += p.speed + Math.sin(p.x * 0.01) * p.curve * 10;
            p.wind += (Math.random() - 0.5) * 0.3;

            if (p.x > w + 20) {
                p.x = -20;
                p.y = Math.random() * h;
            }
            if (p.y > h) {
                p.y = 0;
                p.x = Math.random() * w;
            }

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.opacity;
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        // Sand haze at bottom
        const gradient = ctx.createLinearGradient(0, h * 0.7, 0, h);
        gradient.addColorStop(0, 'rgba(180,140,60,0)');
        gradient.addColorStop(1, 'rgba(180,140,60,0.12)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, h * 0.7, w, h * 0.3);
    }

    _drawSun(w, h) {
        const ctx = this.ctx;
        this.sunAngle += 0.002;

        // Sun glow in top-right
        const sunX = w * 0.82;
        const sunY = h * 0.12;

        // Outer glow
        const outerGlow = ctx.createRadialGradient(sunX, sunY, 5, sunX, sunY, 120);
        outerGlow.addColorStop(0, 'rgba(255,220,80,0.25)');
        outerGlow.addColorStop(0.3, 'rgba(255,180,50,0.12)');
        outerGlow.addColorStop(1, 'rgba(255,150,30,0)');
        ctx.fillStyle = outerGlow;
        ctx.fillRect(0, 0, w, h);

        // Rotating rays
        for (const ray of this.sunRays) {
            ray.angle += ray.speed;
            ctx.save();
            ctx.translate(sunX, sunY);
            ctx.rotate(ray.angle);

            const grad = ctx.createLinearGradient(0, 0, ray.length, 0);
            grad.addColorStop(0, `rgba(255,220,80,${ray.opacity})`);
            grad.addColorStop(0.5, `rgba(255,180,50,${ray.opacity * 0.5})`);
            grad.addColorStop(1, 'rgba(255,150,30,0)');

            ctx.beginPath();
            ctx.moveTo(0, -ray.width / 2);
            ctx.lineTo(ray.length, -ray.width / 4);
            ctx.lineTo(ray.length, ray.width / 4);
            ctx.lineTo(0, ray.width / 2);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.restore();
        }

        // Core sun
        const coreGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 25);
        coreGlow.addColorStop(0, 'rgba(255,255,200,0.9)');
        coreGlow.addColorStop(0.5, 'rgba(255,220,100,0.5)');
        coreGlow.addColorStop(1, 'rgba(255,180,50,0)');
        ctx.fillStyle = coreGlow;
        ctx.beginPath();
        ctx.arc(sunX, sunY, 25, 0, Math.PI * 2);
        ctx.fill();

        // Floating sparkles
        for (const p of this.particles) {
            p.twinkle += p.twinkleSpeed;
            p.y += p.speed;
            if (p.y > h * 0.7) {
                p.y = -5;
                p.x = Math.random() * w;
            }

            const sparkleAlpha = p.opacity * (0.5 + Math.sin(p.twinkle) * 0.5);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,240,150,${sparkleAlpha})`;
            ctx.fill();

            // Star sparkle cross
            ctx.strokeStyle = `rgba(255,240,150,${sparkleAlpha * 0.4})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(p.x - p.size * 2, p.y);
            ctx.lineTo(p.x + p.size * 2, p.y);
            ctx.moveTo(p.x, p.y - p.size * 2);
            ctx.lineTo(p.x, p.y + p.size * 2);
            ctx.stroke();
        }
    }

    destroy() {
        this._stop();
        this.particles = [];
        this.sunRays = [];
        this.currentWeather = null;
    }
}
