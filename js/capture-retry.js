    showCapturePrompt() {
        if (this._capturePromptOpen) return Promise.resolve(false);
        this._capturePromptOpen = true;
        const MAX_CAPTURE_ATTEMPTS = 3;

        return new Promise(async (resolve) => {
            const cleanup = () => {
                this._capturePromptOpen = false;
                const el = document.getElementById('capture-prompt-overlay');
                if (el) el.remove();
            };

            const timeout = setTimeout(() => { cleanup(); resolve(false); }, 30000);

            const enemyPokemon = this.enemyTeam[0];
            if (!enemyPokemon || enemyPokemon.currentHp > 0) { clearTimeout(timeout); cleanup(); resolve(false); return; }

            if (this.afkManager && this.afkManager.running) {
                if (!this.afkManager.autoCapture) {
                    clearTimeout(timeout); cleanup(); resolve(false); return;
                }
                const captureConfig = this.afkManager.getCaptureConfigForPokemon(enemyPokemon);
                if (!captureConfig || !captureConfig.ballId) {
                    const label = enemyPokemon.isShiny ? 'Shiny' : (enemyPokemon.rarity || 'common');
                    await showBattleMessage(`${enemyPokemon.name} (${label}) nao esta nas raridades configuradas. Pulando captura...`);
                    resolve(false); return;
                }
                let afkCaught = false;
                for (let a = 0; a < MAX_CAPTURE_ATTEMPTS && !afkCaught; a++) {
                    const items = await window.GameData.getInventory();
                    const ballInv = items.find(inv => inv.items && inv.items.id === captureConfig.ballId && inv.quantity > 0);
                    if (!ballInv) { await showBattleMessage('Pokebola nao disponivel.'); break; }
                    afkCaught = await this.tryCaptureWithBall(enemyPokemon, ballInv.items);
                }
                clearTimeout(timeout); cleanup(); resolve(afkCaught);
                return;
            }

            const inventory = await window.GameData.getInventory();
            const balls = inventory.filter(inv => inv.quantity > 0 && inv.items && inv.items.category === 'pokeball');
            if (balls.length === 0) {
                await showBattleMessage('Voce nao tem nenhuma Pokebola!');
                clearTimeout(timeout); cleanup(); resolve(false); return;
            }

            const overlay = document.createElement('div');
            overlay.id = 'capture-prompt-overlay';
            overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:10001;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.3s';
            const popup = document.createElement('div');
            popup.style.cssText = 'background:rgba(15,20,35,0.95);border:1px solid rgba(233,69,96,0.4);border-radius:16px;padding:24px 28px;max-width:360px;width:90%;text-align:center;backdrop-filter:blur(12px);box-shadow:0 0 30px rgba(233,69,96,0.2);';
            const spriteUrl = enemyPokemon.spriteUrls?.front || enemyPokemon.spriteUrl || '';
            popup.innerHTML = `
                <div style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">Pokemon derrotado!</div>
                <div style="display:flex;justify-content:center;margin:10px 0">
                    <img src="${spriteUrl}" style="width:80px;height:80px;image-rendering:pixelated;filter:drop-shadow(0 0 8px rgba(233,69,96,0.4))" onerror="this.style.display='none'">
                </div>
                <div style="font-size:16px;color:#fff;font-weight:700;margin-bottom:4px">${enemyPokemon.name}</div>
                <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:16px">Lv. ${enemyPokemon.level}</div>
                <div style="font-size:14px;color:rgba(255,255,255,0.8);margin-bottom:18px">Quer capturar este Pokemon?</div>
                <div style="display:flex;gap:10px;justify-content:center">
                    <button id="cap-yes" style="padding:10px 28px;border:none;border-radius:10px;background:linear-gradient(135deg,#e94560,#c23152);color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;transition:transform 0.15s">Sim</button>
                    <button id="cap-no" style="padding:10px 28px;border:1px solid rgba(255,255,255,0.2);border-radius:10px;background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.7);font-size:14px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif;transition:transform 0.15s">Nao</button>
                </div>
            `;
            overlay.appendChild(popup);
            document.body.appendChild(overlay);
            popup.querySelectorAll('button').forEach(b => {
                b.onmouseenter = () => { b.style.transform = 'scale(1.05)'; };
                b.onmouseleave = () => { b.style.transform = 'scale(1)'; };
            });

            document.getElementById('cap-yes').onclick = () => {
                overlay.remove();
                this._capturePromptOpen = false;
                this._startCaptureAttempts(MAX_CAPTURE_ATTEMPTS, timeout, resolve);
            };
            document.getElementById('cap-no').onclick = () => {
                clearTimeout(timeout); overlay.remove();
                this._capturePromptOpen = false;
                resolve(false);
            };
        });
    }

    async _startCaptureAttempts(maxAttempts, outerTimeout, resolve) {
        const enemyPokemon = this.enemyTeam[0];
        if (!enemyPokemon) { clearTimeout(outerTimeout); resolve(false); return; }

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const captured = await this._showBallSelectionWithRetry(attempt, maxAttempts);
            if (captured) {
                clearTimeout(outerTimeout);
                resolve(true);
                return;
            }
            if (attempt < maxAttempts) {
                const retry = await this._showRetryPrompt(attempt, maxAttempts);
                if (!retry) break;
            }
        }
        clearTimeout(outerTimeout);
        await showBattleMessage(`${enemyPokemon.name} nao foi capturado.`);
        resolve(false);
    }

    _showBallSelectionWithRetry(attempt, maxAttempts) {
        return new Promise(async (resolve) => {
            const enemyPokemon = this.enemyTeam[0];
            if (!enemyPokemon) { resolve(false); return; }

            const inventory = await window.GameData.getInventory();
            const balls = inventory.filter(inv => inv.items && inv.items.category === 'pokeball' && inv.quantity > 0);
            if (balls.length === 0) {
                await showBattleMessage('Voce nao tem nenhuma Pokebola!');
                resolve(false); return;
            }

            const overlay = document.createElement('div');
            overlay.id = 'capture-ball-overlay';
            overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:10001;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.3s';
            const popup = document.createElement('div');
            popup.style.cssText = 'background:rgba(15,20,35,0.95);border:1px solid rgba(233,69,96,0.4);border-radius:16px;padding:24px 28px;max-width:380px;width:90%;text-align:center;backdrop-filter:blur(12px);box-shadow:0 0 30px rgba(233,69,96,0.2);';

            let html = '<div style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px">Escolha uma Pokebola</div>';
            html += '<div style="font-size:12px;color:rgba(255,255,255,0.7);margin-bottom:12px">Tentativa <b style="color:#e94560">' + attempt + '/' + maxAttempts + '</b></div>';
            html += '<div style="display:flex;flex-direction:column;gap:8px">';
            for (const inv of balls) {
                const item = inv.items;
                const multiplier = item.effect_value || 1;
                const label = multiplier >= 100 ? '100%' : 'x' + multiplier;
                html += '<button class="cap-ball-btn" data-ball-id="' + item.id + '" style="display:flex;align-items:center;gap:12px;padding:10px 14px;border:1px solid rgba(255,255,255,0.1);border-radius:10px;background:rgba(255,255,255,0.04);cursor:pointer;transition:all 0.15s;text-align:left">';
                html += '<img src="' + (item.sprite_url || '') + '" style="width:36px;height:36px" onerror="this.style.display=\'none\'">';
                html += '<div style="flex:1"><div style="color:#fff;font-size:13px;font-weight:700">' + item.name + '</div>';
                html += '<div style="color:rgba(255,255,255,0.4);font-size:11px">x' + inv.quantity + ' - Chance: ' + label + '</div></div></button>';
            }
            html += '</div>';
            html += '<button id="cap-cancel" style="margin-top:12px;padding:8px 20px;border:1px solid rgba(255,255,255,0.15);border-radius:8px;background:transparent;color:rgba(255,255,255,0.5);font-size:12px;cursor:pointer;font-family:Inter,sans-serif">Cancelar</button>';
            popup.innerHTML = html;
            overlay.appendChild(popup);
            document.body.appendChild(overlay);

            popup.querySelectorAll('.cap-ball-btn').forEach(btn => {
                btn.onmouseenter = () => { btn.style.borderColor = '#e94560'; btn.style.background = 'rgba(233,69,96,0.1)'; };
                btn.onmouseleave = () => { btn.style.borderColor = 'rgba(255,255,255,0.1)'; btn.style.background = 'rgba(255,255,255,0.04)'; };
                btn.onclick = async () => {
                    const ballId = parseInt(btn.dataset.ballId);
                    const ballItem = balls.find(b => b.items.id === ballId);
                    if (!ballItem) return;
                    overlay.remove();
                    const captured = await this.attemptCapture(ballItem);
                    resolve(captured);
                };
            });
            document.getElementById('cap-cancel').onclick = () => { overlay.remove(); resolve(false); };
        });
    }

    _showRetryPrompt(attempt, maxAttempts) {
        return new Promise(async (resolve) => {
            const enemyPokemon = this.enemyTeam[0];
            if (!enemyPokemon) { resolve(false); return; }

            const overlay = document.createElement('div');
            overlay.id = 'capture-prompt-overlay';
            overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:10001;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.3s';
            const popup = document.createElement('div');
            popup.style.cssText = 'background:rgba(15,20,35,0.95);border:1px solid rgba(233,69,96,0.4);border-radius:16px;padding:24px 28px;max-width:360px;width:90%;text-align:center;backdrop-filter:blur(12px);box-shadow:0 0 30px rgba(233,69,96,0.2);';
            const spriteUrl = enemyPokemon.spriteUrls?.front || enemyPokemon.spriteUrl || '';
            popup.innerHTML = `
                <div style="font-size:14px;color:rgba(255,255,255,0.8);margin-bottom:12px">
                    <span style="color:#f87171">&#10005;</span> ${enemyPokemon.name} nao foi capturado!
                </div>
                <div style="display:flex;justify-content:center;margin:10px 0">
                    <img src="${spriteUrl}" style="width:64px;height:64px;image-rendering:pixelated;filter:drop-shadow(0 0 8px rgba(233,69,96,0.4))" onerror="this.style.display='none'">
                </div>
                <div style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:4px">Tentativa ${attempt}/${maxAttempts}</div>
                <div style="font-size:14px;color:rgba(255,255,255,0.8);margin-bottom:16px">Gostaria de tentar novamente?</div>
                <div style="display:flex;gap:10px;justify-content:center">
                    <button id="retry-yes" style="padding:10px 24px;border:none;border-radius:10px;background:linear-gradient(135deg,#e94560,#c23152);color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;transition:transform 0.15s">Sim (${attempt+1}/${maxAttempts})</button>
                    <button id="retry-no" style="padding:10px 24px;border:1px solid rgba(255,255,255,0.2);border-radius:10px;background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.7);font-size:14px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif;transition:transform 0.15s">Nao</button>
                </div>
            `;
            overlay.appendChild(popup);
            document.body.appendChild(overlay);
            popup.querySelectorAll('button').forEach(b => {
                b.onmouseenter = () => { b.style.transform = 'scale(1.05)'; };
                b.onmouseleave = () => { b.style.transform = 'scale(1)'; };
            });
            document.getElementById('retry-yes').onclick = () => { overlay.remove(); resolve(true); };
            document.getElementById('retry-no').onclick = () => { overlay.remove(); resolve(false); };
        });
    }

    async attemptCapture(ballInventory) {
        const itemData = ballInventory.items;
        const enemyPokemon = this.enemyTeam[0];
        if (!enemyPokemon) return false;

        await window.GameData.removeItem(ballInventory.item_id, 1);
        const catchRate = this.calculateCatchRate(enemyPokemon, itemData);
        const caught = Math.random() < catchRate;

        if (this.battleAnimations) {
            const sprites = getBattlePokemonSprites();
            const overlayRect = this.battleAnimations._getBoundingClientRect();
            const startX = overlayRect.width * 0.15;
            const startY = overlayRect.height * 0.65;
            let targetX = overlayRect.width * 0.5;
            let targetY = overlayRect.height * 0.35;
            if (sprites.enemy) {
                const eRect = sprites.enemy.getBoundingClientRect();
                targetX = eRect.left - overlayRect.left + eRect.width * 0.5;
                targetY = eRect.top - overlayRect.top + eRect.height * 0.5;
            }
            if (sprites.player) sprites.player.style.display = 'none';
            const ballSpriteUrl = itemData.sprite_url || '';
            this._captureInProgress = true;
            setSkipEnemyRender(true);
            const result = await this.battleAnimations.playCaptureThrow(ballSpriteUrl, startX, startY, targetX, targetY);
            if (caught) {
                await this.battleAnimations.playShake(result.ball, result.hitX, result.hitY, 3);
                await this.battleAnimations.playCaptureSuccess(result.ball, result.hitX, result.hitY, enemyPokemon.name);
            } else {
                await this.battleAnimations.playShake(result.ball, result.hitX, result.hitY, 1);
                await new Promise(r => setTimeout(r, 600));
                await this.battleAnimations.playCaptureFail(result.ball, result.hitX, result.hitY, targetX, targetY, sprites.enemy);
            }
            this._captureInProgress = false;
            setSkipEnemyRender(false);
        }

        if (caught) {
            await showBattleMessage(`Capturou ${enemyPokemon.name} com ${itemData.name}!`);
            const added = await window.GameData.addPokemonToTeam(enemyPokemon);
            if (added === 'team') {
                this.playerTeam.push(enemyPokemon);
                await showBattleMessage(`${enemyPokemon.name} foi adicionado a equipe!`);
            } else if (added === 'pc') {
                await showBattleMessage(`Equipe cheia! ${enemyPokemon.name} foi enviado ao PC.`);
            } else {
                await showBattleMessage('Equipe e PC lotados! Pokemon perdido.');
            }
            window.ProfessorQuests?.incrementProfessorQuestProgress?.('catch_pokemon', 1, this._currentBiome || null, enemyPokemon.id);
            this.recordCaptureStat(enemyPokemon);
            return true;
        } else {
            await showBattleMessage(`O Pokemon escapou da ${itemData.name}!`);
            return false;
        }
    }
