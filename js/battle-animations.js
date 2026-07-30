export class BattleAnimations {
    constructor(gameContainer) {
        this.container = gameContainer;
        this.overlay = null;
        this._ensureOverlay();
    }

    _ensureOverlay() {
        if (this.overlay && this.container.contains(this.overlay)) return;
        this.overlay = document.createElement('div');
        this.overlay.id = 'battle-anim-overlay';
        this.container.appendChild(this.overlay);
    }

    _clear() {
        if (this.overlay) this.overlay.innerHTML = '';
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    _createBall() {
        const ball = document.createElement('div');
        ball.className = 'battle-pokeball';
        this.overlay.appendChild(ball);
        return ball;
    }

    _createLightBeam(x, y, size) {
        const beam = document.createElement('div');
        beam.className = 'battle-light-beam';
        beam.style.left = (x - size / 2) + 'px';
        beam.style.top = (y - size / 2) + 'px';
        beam.style.width = size + 'px';
        beam.style.height = size + 'px';
        this.overlay.appendChild(beam);
        return beam;
    }

    _createStar(x, y) {
        const star = document.createElement('div');
        star.className = 'capture-star';
        star.style.left = x + 'px';
        star.style.top = y + 'px';
        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 40;
        star.style.setProperty('--star-x', Math.cos(angle) * dist + 'px');
        star.style.setProperty('--star-y', Math.sin(angle) * dist + 'px');
        this.overlay.appendChild(star);
        return star;
    }

    _getBoundingClientRect() {
        return this.container.getBoundingClientRect();
    }

    async playWildEntrance(enemySpriteEl) {
        if (!enemySpriteEl) return;
        enemySpriteEl.style.display = 'block';
        enemySpriteEl.style.opacity = '0';
        enemySpriteEl.style.transform = 'scale(0.3)';
        enemySpriteEl.style.filter = 'brightness(3) blur(8px)';
        enemySpriteEl.style.transition = 'none';

        await this._sleep(50);

        enemySpriteEl.style.transition = 'all 0.5s ease-out';
        enemySpriteEl.style.opacity = '1';
        enemySpriteEl.style.transform = 'scale(1)';
        enemySpriteEl.style.filter = 'brightness(1) blur(0px)';

        await this._sleep(550);
        enemySpriteEl.style.transition = '';
        enemySpriteEl.style.filter = '';
    }

    async playPlayerEntrance(endX, endY, spriteUrl) {
        this._ensureOverlay();
        this._clear();

        const startX = -30;
        const startY = endY + 30;

        const ball = this._createBall();
        ball.style.left = startX + 'px';
        ball.style.top = startY + 'px';

        const dx = endX - startX;
        const dy = endY - startY;
        const midX = (startX + endX) / 2;
        const midY = Math.min(startY, endY) - 70;

        ball.animate([
            { transform: 'translate(0,0) scale(0.6) rotate(0deg)' },
            { transform: `translate(${midX - startX}px, ${midY - startY}px) scale(1.1) rotate(200deg)`, offset: 0.5 },
            { transform: `translate(${dx}px, ${dy}px) scale(0.9) rotate(400deg)`, offset: 0.85 },
            { transform: `translate(${dx}px, ${dy}px) scale(0.8) rotate(440deg)` }
        ], {
            duration: 500, easing: 'ease-out', fill: 'forwards'
        });

        await this._sleep(480);

        const beam = this._createLightBeam(endX, endY, 70);
        beam.style.animation = 'ballOpenGlow 0.4s ease-out forwards';

        ball.style.transition = 'opacity 0.3s';
        ball.style.opacity = '0';

        await this._sleep(200);

        if (spriteUrl) {
            const img = document.createElement('img');
            img.src = spriteUrl;
            img.style.cssText = `position:absolute;pointer-events:none;image-rendering:auto;display:block;opacity:0;transform:scale(0.3);filter:brightness(3) blur(6px);left:${endX - 35}px;top:${endY - 35}px;width:70px;height:70px;z-index:18;`;
            this.overlay.appendChild(img);
            this._playerEntranceSprite = img;

            await this._sleep(50);

            img.style.transition = 'all 0.4s ease-out';
            img.style.opacity = '1';
            img.style.transform = 'scale(1)';
            img.style.filter = 'brightness(1) blur(0px)';

            await this._sleep(500);
            img.style.transition = '';
            img.style.filter = '';

            const spriteContainer = document.getElementById('battle-pokemon-sprites');
            if (spriteContainer) {
                const overlayRect = this.overlay.getBoundingClientRect();
                const containerRect = spriteContainer.getBoundingClientRect();
                img.style.left = (endX - 35 + containerRect.left - overlayRect.left) + 'px';
                img.style.top = (endY - 35 + containerRect.top - overlayRect.top) + 'px';
                spriteContainer.appendChild(img);
            }
        }
    }

    cleanupEntrance() {
        this._playerEntranceSprite = null;
        this._clear();
    }

    async playCaptureThrow(ballSpriteUrl, startX, startY, targetX, targetY) {
        this._ensureOverlay();
        this._clear();

        const groundY = targetY + 40;

        const ball = this._createBall();
        if (ballSpriteUrl) {
            const img = document.createElement('img');
            img.src = ballSpriteUrl;
            img.style.cssText = 'width:28px;height:28px;position:absolute;top:-2px;left:-2px;border-radius:50%;';
            ball.appendChild(img);
            ball.style.background = 'none';
            ball.style.border = 'none';
        }

        const dx = targetX - startX;
        const dy = targetY - startY;
        const midX = (startX + targetX) / 2;
        const midY = Math.min(startY, targetY) - 80;

        ball.style.left = startX + 'px';
        ball.style.top = startY + 'px';

        ball.animate([
            { transform: 'translate(0,0) scale(0.5) rotate(0deg)' },
            { transform: `translate(${midX - startX}px, ${midY - startY}px) scale(1) rotate(270deg)`, offset: 0.45 },
            { transform: `translate(${dx}px, ${dy}px) scale(0.85) rotate(540deg)`, offset: 0.8 },
            { transform: `translate(${dx}px, ${dy}px) scale(0.8) rotate(630deg)` }
        ], {
            duration: 700, easing: 'ease-out', fill: 'forwards'
        });

        await this._sleep(680);

        const impactFlash = this._createLightBeam(targetX, targetY, 70);
        impactFlash.style.animation = 'ballOpenGlow 0.3s ease-out forwards';

        await this._sleep(300);

        ball.animate([
            { transform: `translate(${dx}px, ${dy}px) scale(0.8)` },
            { transform: `translate(${dx}px, ${groundY}px) scale(0.9)`, offset: 0.6 },
            { transform: `translate(${dx}px, ${groundY - 6}px) scale(0.85)`, offset: 0.8 },
            { transform: `translate(${dx}px, ${groundY}px) scale(0.9)` }
        ], {
            duration: 400, easing: 'ease-in', fill: 'forwards'
        });

        await this._sleep(420);

        return { ball, groundY, endX: dx, endY: groundY };
    }

    async playShake(ball, endX, groundY, count) {
        for (let i = 0; i < count; i++) {
            ball.animate([
                { transform: `translate(${endX}px, ${groundY}px) rotate(0deg)` },
                { transform: `translate(${endX - 14}px, ${groundY}px) rotate(-30deg)`, offset: 0.15 },
                { transform: `translate(${endX + 14}px, ${groundY}px) rotate(30deg)`, offset: 0.35 },
                { transform: `translate(${endX - 10}px, ${groundY}px) rotate(-18deg)`, offset: 0.55 },
                { transform: `translate(${endX + 10}px, ${groundY}px) rotate(18deg)`, offset: 0.75 },
                { transform: `translate(${endX}px, ${groundY}px) rotate(0deg)` }
            ], {
                duration: 700, easing: 'ease-in-out', fill: 'forwards'
            });
            await this._sleep(800);
        }
    }

    async playCaptureSuccess(ball, endX, groundY, enemyPokemonName) {
        ball.animate([
            { transform: `translate(${endX}px, ${groundY}px) scale(0.9)`, boxShadow: '0 0 5px rgba(255,215,0,0.5)' },
            { transform: `translate(${endX}px, ${groundY}px) scale(1.1)`, boxShadow: '0 0 40px rgba(255,215,0,1), 0 0 80px rgba(255,215,0,0.5)', offset: 0.4 },
            { transform: `translate(${endX}px, ${groundY}px) scale(0.95)`, boxShadow: '0 0 10px rgba(255,215,0,0.6)', offset: 0.7 },
            { transform: `translate(${endX}px, ${groundY}px) scale(1)`, boxShadow: '0 0 15px rgba(255,215,0,0.7)' }
        ], {
            duration: 800, fill: 'forwards'
        });

        for (let i = 0; i < 8; i++) {
            const star = this._createStar(endX + 14, groundY + 14);
            star.style.animation = `starBurst 0.6s ease-out ${i * 0.08}s forwards`;
        }

        await this._sleep(1000);
        this._clear();
    }

    async playCaptureFail(ball, endX, groundY, targetX, targetY, pokemonSpriteEl) {
        ball.animate([
            { transform: `translate(${endX}px, ${groundY}px) scale(0.9) rotate(0deg)` },
            { transform: `translate(${endX}px, ${groundY - 5}px) scale(1.05) rotate(5deg)`, offset: 0.2 },
            { transform: `translate(${endX - 20}px, ${groundY - 15}px) scale(1) rotate(-40deg)`, opacity: 0.8, offset: 0.5 },
            { transform: `translate(${endX + 10}px, ${groundY + 5}px) scale(0.8) rotate(20deg)`, opacity: 0.4, offset: 0.8 },
            { transform: `translate(${endX}px, ${groundY + 10}px) scale(0.6) rotate(0deg)`, opacity: 0 }
        ], {
            duration: 700, easing: 'ease-out', fill: 'forwards'
        });

        await this._sleep(350);

        const flash2 = this._createLightBeam(targetX, targetY, 80);
        flash2.style.background = 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.3) 50%, transparent 70%)';
        flash2.style.animation = 'ballOpenGlow 0.5s ease-out forwards';

        await this._sleep(150);

        if (pokemonSpriteEl) {
            pokemonSpriteEl.style.display = 'block';
            pokemonSpriteEl.style.opacity = '0';
            pokemonSpriteEl.style.transform = 'scale(0.3)';
            pokemonSpriteEl.style.filter = 'brightness(3) blur(6px)';

            await this._sleep(50);

            pokemonSpriteEl.style.transition = 'all 0.4s ease-out';
            pokemonSpriteEl.style.opacity = '1';
            pokemonSpriteEl.style.transform = 'scale(1)';
            pokemonSpriteEl.style.filter = 'brightness(1) blur(0px)';
        }

        await this._sleep(600);
        if (pokemonSpriteEl) {
            pokemonSpriteEl.style.transition = '';
            pokemonSpriteEl.style.filter = '';
        }
        this._clear();
    }
}
