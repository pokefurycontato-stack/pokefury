import { TYPE_COLORS } from './data.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

let battlePokemonContainer = null;
const battlePokemonSprites = { player: null, enemy: null };
const battlePokemonState = { player: null, enemy: null };
let battleMessageInterval = null;
let battleMessageResolve = null;

const battleCircleCache = new Map();

export async function detectBattleCircles(imgUrl) {
    if (battleCircleCache.has(imgUrl)) return battleCircleCache.get(imgUrl);

    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const sw = 160, sh = 120;
            const c = document.createElement('canvas');
            c.width = sw; c.height = sh;
            const cx = c.getContext('2d');
            cx.drawImage(img, 0, 0, sw, sh);
            const data = cx.getImageData(0, 0, sw, sh).data;

            const gridSize = 8;
            const cellW = Math.floor(sw / gridSize);
            const cellH = Math.floor(sh / gridSize);
            const cells = [];

            for (let gy = 0; gy < gridSize; gy++) {
                for (let gx = 0; gx < gridSize; gx++) {
                    let rSum = 0, gSum = 0, bSum = 0, count = 0;
                    let rVar = 0;
                    const samples = [];
                    for (let py = gy * cellH; py < (gy + 1) * cellH; py += 2) {
                        for (let px = gx * cellW; px < (gx + 1) * cellW; px += 2) {
                            const i = (py * sw + px) * 4;
                            samples.push([data[i], data[i+1], data[i+2]]);
                            rSum += data[i]; gSum += data[i+1]; bSum += data[i+2];
                            count++;
                        }
                    }
                    if (count === 0) continue;
                    const mr = rSum / count, mg = gSum / count, mb = bSum / count;
                    for (const [r, g, b] of samples) {
                        rVar += (r - mr) ** 2 + (g - mg) ** 2 + (b - mb) ** 2;
                    }
                    rVar /= count;
                    const brightness = (mr + mg + mb) / 3;
                    const saturation = (Math.max(mr, mg, mb) - Math.min(mr, mg, mb)) / Math.max(1, Math.max(mr, mg, mb));
                    cells.push({
                        gx, gy,
                        cx: (gx + 0.5) * cellW / sw,
                        cy: (gy + 0.5) * cellH / sh,
                        variance: rVar,
                        brightness,
                        saturation,
                        mr, mg, mb
                    });
                }
            }

            const sorted = [...cells].sort((a, b) => a.variance - b.variance);
            const smoothCells = sorted.slice(0, Math.floor(cells.length * 0.35));

            const leftBottom = smoothCells.filter(c => c.cx < 0.55 && c.cy > 0.45);
            const rightTop = smoothCells.filter(c => c.cx > 0.4 && c.cy < 0.6);

            function centroid(group) {
                if (group.length === 0) return null;
                let sx = 0, sy = 0;
                for (const c of group) { sx += c.cx; sy += c.cy; }
                return { x: sx / group.length, y: sy / group.length };
            }

            let playerCircle = centroid(leftBottom);
            let enemyCircle = centroid(rightTop);

            if (!playerCircle) playerCircle = { x: 0.25, y: 0.75 };
            if (!enemyCircle) enemyCircle = { x: 0.72, y: 0.4 };

            if (playerCircle.y < enemyCircle.y) {
                [playerCircle, enemyCircle] = [enemyCircle, playerCircle];
            }

            const result = { player: playerCircle, enemy: enemyCircle, imgW: img.naturalWidth, imgH: img.naturalHeight };
            battleCircleCache.set(imgUrl, result);
            resolve(result);
        };
        img.onerror = () => {
            const fallback = { player: { x: 0.25, y: 0.75 }, enemy: { x: 0.72, y: 0.4 }, imgW: 1, imgH: 1 };
            battleCircleCache.set(imgUrl, fallback);
            resolve(fallback);
        };
        img.src = imgUrl;
    });
}

export function showScreen(screenId) {
    const screens = ['battle-screen', 'hud'];
    screens.forEach(id => {
        const el = $(`#${id}`);
        if (el) el.classList.add('hidden');
    });
    const screen = $(`#${screenId}`);
    if (screen) screen.classList.remove('hidden');
}

export async function preloadBattleSprites(playerPokemon, enemyPokemon) {
    const urls = [];
    if (playerPokemon?.spriteUrls) urls.push(playerPokemon.spriteUrls.back || playerPokemon.spriteUrls.front || playerPokemon.spriteUrls.home || playerPokemon.spriteUrls.official);
    if (enemyPokemon?.spriteUrls) urls.push(enemyPokemon.spriteUrls.front || enemyPokemon.spriteUrls.home || enemyPokemon.spriteUrls.official);
    if (playerPokemon?.shinySpriteUrls) urls.push(playerPokemon.shinySpriteUrls.back || playerPokemon.shinySpriteUrls.front || playerPokemon.shinySpriteUrls.home || playerPokemon.shinySpriteUrls.official);
    if (enemyPokemon?.shinySpriteUrls) urls.push(enemyPokemon.shinySpriteUrls.front || enemyPokemon.shinySpriteUrls.home || enemyPokemon.shinySpriteUrls.official);
    await PokeAPI.preloadSprites(urls);
}

export function updateBattleUI(playerTeam, enemyTeam, activePlayerIdx = 0, activeEnemyIdx = 0) {
    const playerPokemon = playerTeam[activePlayerIdx];
    const enemyPokemon = enemyTeam[activeEnemyIdx];

    if (enemyPokemon) {
        const hpName = document.getElementById('enemy-hp-name');
        const hpLevel = document.getElementById('enemy-hp-level');
        const hpBarFill = document.getElementById('enemy-hp-bar-fill');
        const hpText = document.getElementById('enemy-hp-text');

        if (hpName) hpName.textContent = enemyPokemon.name;
        if (hpLevel) hpLevel.textContent = `Lv. ${enemyPokemon.level}`;

        const hpPct = enemyPokemon.stats.hp > 0 ? (enemyPokemon.currentHp / enemyPokemon.stats.hp) * 100 : 0;
        if (hpBarFill) {
            hpBarFill.style.width = hpPct + '%';
            if (hpPct > 50) hpBarFill.style.background = '#4caf50';
            else if (hpPct > 20) hpBarFill.style.background = '#ff9800';
            else hpBarFill.style.background = '#f44336';
        }
        if (hpText) hpText.textContent = `${enemyPokemon.currentHp} / ${enemyPokemon.stats.hp}`;
    }
}

function updateTeamIndicators(selector, team) {
    const container = $(selector);
    container.innerHTML = '';
    team.forEach(p => {
        const ball = document.createElement('div');
        ball.className = 'pokemon-ball';
        if (p.fainted) ball.classList.add('fainted');
        else ball.classList.add('active');
        container.appendChild(ball);
    });
}

export function showBattleMessage(message) {
    return new Promise(resolve => {
        try {
            const msgEl = $('#battle-message');
            if (!msgEl) { resolve(); return; }

            if (battleMessageInterval) {
                clearInterval(battleMessageInterval);
                battleMessageInterval = null;
            }
            if (battleMessageResolve) {
                battleMessageResolve();
                battleMessageResolve = null;
            }

            if (!message) { resolve(); return; }

            let i = 0;
            const fullText = String(message);
            battleMessageInterval = setInterval(() => {
                try {
                    if (i < fullText.length) {
                        i++;
                        msgEl.innerText = fullText.substring(0, i);
                    } else {
                        clearInterval(battleMessageInterval);
                        battleMessageInterval = null;
                        setTimeout(resolve, 600);
                    }
                } catch (e) {
                    clearInterval(battleMessageInterval);
                    battleMessageInterval = null;
                    resolve();
                }
            }, 25);
            battleMessageResolve = resolve;
        } catch (e) {
            resolve();
        }
    });
}

export function showMoveSelection(moves, onSelect) {
    const moveSelection = $('#move-selection');
    const moveButtons = $('#move-buttons');
    const battleActions = $('#battle-actions');

    moveButtons.innerHTML = '';
    battleActions.classList.add('hidden');
    moveSelection.classList.remove('hidden');

    moves.forEach(move => {
        if (move.currentPp <= 0) return;
        const btn = document.createElement('button');
        btn.className = `move-btn type-${move.type}`;
        const typeColor = TYPE_COLORS[move.type] || '#686868';
        btn.style.borderColor = typeColor + '40';
        btn.innerHTML = `
            <span style="font-size:11px">${move.name}</span>
            <span class="move-type" style="background:${typeColor}">${move.type.toUpperCase()}</span>
            <span class="move-pp">PP ${move.currentPp}/${move.pp}</span>
        `;
        btn.addEventListener('click', () => {
            onSelect(move);
            hideMoveSelection();
        });
        moveButtons.appendChild(btn);
    });

    $('#btn-back').onclick = () => {
        hideMoveSelection();
    };
}

export function hideMoveSelection() {
    $('#move-selection').classList.add('hidden');
    $('#battle-actions').classList.remove('hidden');
}

export function updateHpBar(pokemon) {
    const hpPercent = (pokemon.currentHp / pokemon.stats.hp) * 100;
    return `${pokemon.name}: ${pokemon.currentHp}/${pokemon.stats.hp} HP (${hpPercent.toFixed(0)}%)`;
}

export function showEffectivenessText(effectiveness) {
    if (effectiveness > 1) return 'Super efetivo!';
    if (effectiveness < 1 && effectiveness > 0) return 'Não é muito efetivo...';
    if (effectiveness === 0) return 'Não afetou o oponente!';
    return '';
}

const bgCache = new Map();
const videoCache = new Map();
let currentBattleVideo = null;

export function preloadBattleBgImage(url) {
    return new Promise((resolve) => {
        if (!url) { resolve(); return; }
        if (/\.(mp4|webm|ogg)$/i.test(url)) { resolve(); return; }
        let img = bgCache.get(url);
        if (img && img.complete && img.naturalWidth > 0) { resolve(); return; }
        img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => { bgCache.set(url, img); resolve(); };
        img.onerror = () => { resolve(); };
        img.src = url;
    });
}

export function drawBattleScene(ctx, canvas, playerPokemon, enemyPokemon, backgroundUrl = null, clipRect = null) {
    const w = canvas.width;
    const h = canvas.height;

    if (clipRect) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(clipRect.x, clipRect.y, clipRect.w, clipRect.h);
        ctx.clip();
    }

    if (backgroundUrl) {
        const isVideo = /\.(mp4|webm|ogg)$/i.test(backgroundUrl);

        if (isVideo) {
            let video = videoCache.get(backgroundUrl);
            if (!video) {
                video = document.createElement('video');
                video.src = backgroundUrl;
                video.loop = true;
                video.muted = true;
                video.playsInline = true;
                video.crossOrigin = 'anonymous';
                videoCache.set(backgroundUrl, video);
            }

            if (currentBattleVideo && currentBattleVideo !== video) {
                currentBattleVideo.pause();
                currentBattleVideo.currentTime = 0;
            }
            currentBattleVideo = video;

            if (video.readyState >= 2) {
                ctx.drawImage(video, 0, 0, w, h);
            } else {
                if (video.paused) video.play().catch(() => {});
                const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.5);
                skyGrad.addColorStop(0, '#0f3460');
                skyGrad.addColorStop(1, '#16213e');
                ctx.fillStyle = skyGrad;
                ctx.fillRect(0, 0, w, h);
            }
        } else {
            let img = bgCache.get(backgroundUrl);
            if (!img) {
                img = new Image();
                img.crossOrigin = 'anonymous';
                img.src = backgroundUrl;
                bgCache.set(backgroundUrl, img);
            }

            if (img.complete && img.naturalWidth > 0) {
                ctx.drawImage(img, 0, 0, w, h);
            } else if (img.complete) {
                const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.5);
                skyGrad.addColorStop(0, '#0f3460');
                skyGrad.addColorStop(1, '#16213e');
                ctx.fillStyle = skyGrad;
                ctx.fillRect(0, 0, w, h * 0.5);

                const groundGrad = ctx.createLinearGradient(0, h * 0.5, 0, h);
                groundGrad.addColorStop(0, '#1a3a1a');
                groundGrad.addColorStop(1, '#0d1f0d');
                ctx.fillStyle = groundGrad;
                ctx.fillRect(0, h * 0.5, w, h * 0.5);
            }
        }
    } else {
        const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.5);
        skyGrad.addColorStop(0, '#0f3460');
        skyGrad.addColorStop(1, '#16213e');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, h * 0.5);

        const groundGrad = ctx.createLinearGradient(0, h * 0.5, 0, h);
        groundGrad.addColorStop(0, '#1a3a1a');
        groundGrad.addColorStop(1, '#0d1f0d');
        ctx.fillStyle = groundGrad;
        ctx.fillRect(0, h * 0.5, w, h * 0.5);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        for (let i = 0; i < 10; i++) {
            const x = (i * 100 + 20) % w;
            ctx.beginPath();
            ctx.arc(x, h * 0.48, 20 + (i % 3) * 10, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    const cached = battleCircleCache.get(backgroundUrl);
    let playerX, playerY, enemyX, enemyY;

    if (cached) {
        playerX = cached.player.x * w;
        playerY = cached.player.y * h;
        enemyX = cached.enemy.x * w;
        enemyY = cached.enemy.y * h;
    } else {
        playerX = w * 0.22 + 500;
        playerY = h * 0.58 + 40;
        enemyX = w * 0.73 - 350;
        enemyY = h * 0.32 + 180;
    }

    updateBattlePokemonDom('player', playerPokemon, playerX, playerY, 0.5);
    updateBattlePokemonDom('enemy', enemyPokemon, enemyX, enemyY, 0.45);

    if (clipRect) ctx.restore();
}

export function stopBattleVideo() {
    if (currentBattleVideo) {
        currentBattleVideo.pause();
        currentBattleVideo.currentTime = 0;
        currentBattleVideo = null;
    }
}

function ensureBattlePokemonContainer() {
    if (battlePokemonContainer) return battlePokemonContainer;
    const mainArea = document.getElementById('main-area');
    if (!mainArea) return null;
    battlePokemonContainer = document.createElement('div');
    battlePokemonContainer.id = 'battle-pokemon-sprites';
    battlePokemonContainer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:25;';
    mainArea.appendChild(battlePokemonContainer);
    return battlePokemonContainer;
}

function getBattleSpriteUrl(pokemon, isPlayer) {
    if (!pokemon) return null;
    const spriteUrls = pokemon.spriteUrls || {};
    const shinyUrls = pokemon.shinySpriteUrls || {};
    const isShiny = pokemon.isShiny;

    if (isPlayer) {
        if (isShiny) return shinyUrls.back || shinyUrls.front || spriteUrls.back || spriteUrls.front;
        return spriteUrls.back || spriteUrls.front;
    } else {
        if (isShiny) return shinyUrls.front || shinyUrls.home || shinyUrls.official || spriteUrls.front;
        return spriteUrls.front || spriteUrls.home || spriteUrls.official;
    }
}

function updateBattlePokemonDom(side, pokemon, x, y, sizeScale) {
    const container = ensureBattlePokemonContainer();
    if (!container) return;
    const isPlayer = side === 'player';
    const url = getBattleSpriteUrl(pokemon, isPlayer);

    let el = battlePokemonSprites[side];
    if (!url || !pokemon) {
        if (el) el.style.display = 'none';
        return;
    }

    const stateKey = `${pokemon.id}_${pokemon.isShiny}_${pokemon.isMega}`;

    if (!el) {
        el = document.createElement('img');
        el.style.cssText = 'position:absolute;pointer-events:none;image-rendering:auto;';
        container.appendChild(el);
        battlePokemonSprites[side] = el;
        battlePokemonState[side] = null;
    }

    if (battlePokemonState[side] !== stateKey) {
        el.src = url;
        battlePokemonState[side] = stateKey;
    }
    el.style.display = 'block';

    const maxDim = Math.round(140 * sizeScale);
    el.style.width = maxDim + 'px';
    el.style.height = maxDim + 'px';
    el.style.left = (x - maxDim / 2) + 'px';
    el.style.top = (y - maxDim / 2) + 'px';
}

function drawBattlePokemonName(ctx, x, y, pokemon, sizeScale) {
    if (!pokemon) return;
    const isShiny = pokemon.isShiny;
    const spriteH = 120 * sizeScale;

    ctx.fillStyle = isShiny ? '#ffd700' : '#fff';
    ctx.font = `600 ${Math.round(14 * sizeScale)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    let nameText = pokemon.name;
    if (pokemon.isMega) nameText = '★ ' + nameText;
    ctx.fillText(nameText, x, y + spriteH / 2 + Math.round(36 * sizeScale));
    ctx.font = `400 ${Math.round(11 * sizeScale)}px Inter, sans-serif`;
    ctx.fillStyle = isShiny ? 'rgba(255,215,0,0.7)' : 'rgba(255,255,255,0.6)';
    ctx.fillText(`Lv.${pokemon.level}`, x, y + spriteH / 2 + Math.round(52 * sizeScale));
    ctx.shadowBlur = 0;
}

export function hideBattlePokemonSprites() {
    if (battleMessageInterval) {
        clearInterval(battleMessageInterval);
        battleMessageInterval = null;
    }
    if (battlePokemonSprites.player) battlePokemonSprites.player.style.display = 'none';
    if (battlePokemonSprites.enemy) battlePokemonSprites.enemy.style.display = 'none';
}

export function showBattlePokemonSprites() {
    if (battlePokemonSprites.player) battlePokemonSprites.player.style.display = 'block';
    if (battlePokemonSprites.enemy) battlePokemonSprites.enemy.style.display = 'block';
}

export function initBattleUI(onFight, onBag, onMega, onRun) {
    $$('.battle-action-zone[data-action]').forEach(zone => {
        zone.addEventListener('click', () => {
            const action = zone.dataset.action;
            if (action === 'fight') onFight();
            else if (action === 'bag') onBag();
            else if (action === 'pokemon') onMega();
            else if (action === 'run') onRun();
        });
    });
}

export function showBagSelection(items, onSelect) {
    const moveSelection = $('#move-selection');
    const moveButtons = $('#move-buttons');
    const battleActions = $('#battle-actions');

    moveButtons.innerHTML = '';
    battleActions.classList.add('hidden');
    moveSelection.classList.remove('hidden');

    items.forEach(inv => {
        const item = inv.items;
        const btn = document.createElement('button');
        btn.className = 'move-btn';
        btn.style.borderColor = '#78c85060';
        btn.innerHTML = `
            <span class="move-name">${item.name}</span>
            <span class="move-type">${item.category.toUpperCase()}</span>
            <span class="move-pp">x${inv.quantity}</span>
            <span class="move-pp">${item.description || ''}</span>
        `;
        btn.addEventListener('click', () => {
            onSelect(inv);
            hideMoveSelection();
        });
        moveButtons.appendChild(btn);
    });

    $('#btn-back').onclick = () => {
        hideMoveSelection();
    };
}

const TYPE_COLORS_MOVELEARN = {
    normal:'#A8A878',fire:'#F08030',water:'#6890F0',electric:'#F8D030',
    grass:'#78C850',ice:'#98D8D8',fighting:'#C03028',poison:'#A040A0',
    ground:'#E0C068',flying:'#A890F0',psychic:'#F85888',bug:'#A8B820',
    rock:'#B8A038',ghost:'#705898',dragon:'#7038F8',dark:'#705848',
    steel:'#B8B8D0',fairy:'#EE99AC'
};

export function showMoveLearnPopup(pokemon, newMove, currentMoves) {
    return new Promise(resolve => {
        const popup = $('#move-learn-popup');
        const nameEl = $('#learn-pokemon-name');
        const msgEl = $('#learn-msg');
        const infoEl = $('#learn-move-info');
        const btnsEl = $('#learn-buttons');

        popup.classList.remove('hidden');
        nameEl.textContent = pokemon.name;
        msgEl.textContent = `quer aprender ${newMove.name}!`;

        const typeColor = TYPE_COLORS_MOVELEARN[newMove.type] || '#686868';
        const catLabel = newMove.category === 'status' ? 'Status' : newMove.category === 'special' ? 'Especial' : 'Físico';
        const powerText = newMove.power > 0 ? newMove.power : '—';
        infoEl.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:6px;">
                <span style="background:${typeColor};color:#fff;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700;text-transform:uppercase;">${newMove.type}</span>
                <span style="color:rgba(255,255,255,0.6);font-size:11px;">${catLabel}</span>
            </div>
            <div style="color:#fff;font-size:14px;font-weight:600;">${newMove.name}</div>
            <div style="color:rgba(255,255,255,0.5);font-size:12px;margin-top:4px;">Poder: ${powerText} | Precisão: ${newMove.accuracy || '—'}</div>
        `;

        btnsEl.innerHTML = '';

        if (currentMoves.length < 4) {
            const teachBtn = document.createElement('button');
            teachBtn.className = 'action-btn';
            teachBtn.style.cssText = 'width:100%;margin-bottom:8px;';
            teachBtn.textContent = 'ENSINAR';
            teachBtn.addEventListener('click', () => {
                popup.classList.add('hidden');
                resolve({ teach: true, replaceIndex: -1 });
            });
            btnsEl.appendChild(teachBtn);
        } else {
            const subMsg = document.createElement('div');
            subMsg.style.cssText = 'color:rgba(255,255,255,0.6);font-size:12px;margin-bottom:10px;';
            subMsg.textContent = 'Escolha qual movimento substituir:';
            btnsEl.appendChild(subMsg);

            currentMoves.forEach((m, idx) => {
                const btn = document.createElement('button');
                btn.className = 'action-btn';
                btn.style.cssText = 'width:100%;margin-bottom:6px;text-align:left;padding:10px 14px;';
                const mTypeColor = TYPE_COLORS_MOVELEARN[m.type] || '#686868';
                const mCat = m.category === 'status' ? 'Status' : m.category === 'special' ? 'Esp' : 'Fís';
                const mPow = m.power > 0 ? m.power : '—';
                btn.innerHTML = `<span style="color:${mTypeColor};font-weight:700;text-transform:uppercase;font-size:11px;">[${m.type}]</span> <span style="color:#fff;font-weight:600;">${m.name}</span> <span style="color:rgba(255,255,255,0.4);font-size:11px;">${mCat} | Poder: ${mPow}</span>`;
                btn.addEventListener('click', () => {
                    popup.classList.add('hidden');
                    resolve({ teach: true, replaceIndex: idx });
                });
                btnsEl.appendChild(btn);
            });
        }

        const skipBtn = document.createElement('button');
        skipBtn.className = 'action-btn';
        skipBtn.style.cssText = 'width:100%;background:rgba(255,255,255,0.05);border-color:rgba(255,255,255,0.1);';
        skipBtn.textContent = 'NÃO ENSINAR';
        skipBtn.addEventListener('click', () => {
            popup.classList.add('hidden');
            resolve({ teach: false });
        });
        btnsEl.appendChild(skipBtn);
    });
}
