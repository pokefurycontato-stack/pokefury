import { TYPE_COLORS } from './data.js';
import { getPokemonScale } from './utils.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

let battlePokemonContainer = null;
const battlePokemonSprites = { player: null, enemy: null };
const battlePokemonState = { player: null, enemy: null };
let battleMessageInterval = null;
let battleMessageResolve = null;
let skipPlayerRender = false;
let skipEnemyRender = false;
let battlePositions = null;
let battleEffects = { player: 'none', enemy: 'none' };

export const BATTLE_FX_LIST = [
    { id: 'none', name: 'Nenhum', icon: '❌' },
    { id: 'grass', name: 'Grama', icon: '🌿' },
    { id: 'water', name: 'Água', icon: '💧' },
    { id: 'dirt', name: 'Terra', icon: '🟤' },
    { id: 'snow', name: 'Neve', icon: '❄️' },
    { id: 'purple', name: 'Terra Roxa', icon: '🟣' },
    { id: 'electric', name: 'Elétrica', icon: '⚡' },
    { id: 'fire', name: 'Fogo', icon: '🔥' },
];

export function setBattleEffects(playerFx, enemyFx) {
    battleEffects.player = playerFx || 'none';
    battleEffects.enemy = enemyFx || 'none';
}

const fxParticles = { player: [], enemy: [] };

function initFxParticles(side, type, x, y) {
    const particles = [];
    const count = type === 'water' ? 8 : 12;
    for (let i = 0; i < count; i++) {
        particles.push(createParticle(type, x, y, i));
    }
    fxParticles[side] = particles;
}

function createParticle(type, cx, cy, i) {
    const spread = 50;
    const base = { x: cx + (Math.random() - 0.5) * spread, y: cy, type, age: Math.random() * 60, maxAge: 60 + Math.random() * 40 };
    switch (type) {
        case 'grass':
            base.color = `hsl(${100 + Math.random() * 30}, ${60 + Math.random() * 20}%, ${30 + Math.random() * 15}%)`;
            base.h = 6 + Math.random() * 10;
            base.w = 2 + Math.random() * 2;
            base.sway = Math.random() * Math.PI * 2;
            base.growDir = -1;
            break;
        case 'water':
            base.radius = 3 + Math.random() * 5;
            base.maxRadius = base.radius + 8 + Math.random() * 6;
            base.color = 'rgba(80,160,255,0.4)';
            break;
        case 'dirt':
            base.vx = (Math.random() - 0.5) * 1.5;
            base.vy = -0.5 - Math.random() * 1.2;
            base.size = 1.5 + Math.random() * 2.5;
            base.color = `rgba(${140 + Math.random() * 40},${90 + Math.random() * 30},${50 + Math.random() * 20},0.6)`;
            break;
        case 'snow':
            base.vx = (Math.random() - 0.5) * 0.3;
            base.vy = 0.2 + Math.random() * 0.4;
            base.size = 1.5 + Math.random() * 3;
            base.wobble = Math.random() * Math.PI * 2;
            break;
        case 'purple':
            base.vx = (Math.random() - 0.5) * 1.2;
            base.vy = -0.4 - Math.random() * 1;
            base.size = 1.5 + Math.random() * 2.5;
            base.color = `rgba(${130 + Math.random() * 40},${50 + Math.random() * 20},${160 + Math.random() * 40},0.55)`;
            break;
        case 'electric':
            base.vx = (Math.random() - 0.5) * 2;
            base.vy = -1 - Math.random() * 2;
            base.size = 1 + Math.random() * 2;
            base.boltAngle = Math.random() * Math.PI * 2;
            base.boltLen = 8 + Math.random() * 14;
            base.maxAge = 25 + Math.random() * 20;
            base.age = Math.random() * base.maxAge;
            break;
        case 'fire':
            base.vx = (Math.random() - 0.5) * 1.5;
            base.vy = -1.5 - Math.random() * 2;
            base.size = 3 + Math.random() * 5;
            base.maxAge = 30 + Math.random() * 25;
            base.age = Math.random() * base.maxAge;
            break;
    }
    return base;
}

export function drawBattleFx(ctx, side, type, x, y, dt) {
    if (type === 'none') return;

    if (fxParticles[side].length === 0) {
        initFxParticles(side, type, x, y);
    }

    const particles = fxParticles[side];
    const baseY = y + 10;

    for (const p of particles) {
        p.age += dt * 0.06;
        if (p.age >= p.maxAge) {
            Object.assign(p, createParticle(type, x, baseY, Math.random() * 100));
        }

        const progress = p.age / p.maxAge;
        ctx.save();

        switch (type) {
            case 'grass': {
                const sway = Math.sin(p.age * 0.08 + p.sway) * 4;
                const growProgress = Math.min(1, progress * 3);
                const h = p.h * growProgress;
                ctx.strokeStyle = p.color;
                ctx.lineWidth = p.w;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(p.x, baseY);
                ctx.quadraticCurveTo(p.x + sway, baseY - h * 0.6, p.x + sway * 1.2, baseY - h);
                ctx.stroke();
                break;
            }
            case 'water': {
                const r = p.radius + (p.maxRadius - p.radius) * progress;
                const alpha = 0.4 * (1 - progress);
                ctx.strokeStyle = `rgba(80,180,255,${alpha})`;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.ellipse(p.x, baseY, r, r * 0.35, 0, 0, Math.PI * 2);
                ctx.stroke();
                break;
            }
            case 'dirt':
            case 'purple': {
                const dx = p.x + p.vx * p.age * 0.5;
                const dy = baseY + p.vy * p.age * 0.5 + 0.02 * p.age * p.age * 0.3;
                const alpha2 = 1 - progress;
                const col = p.color.replace(/[\d.]+\)$/, (alpha2 * 0.6).toFixed(2) + ')');
                ctx.fillStyle = col;
                ctx.beginPath();
                ctx.arc(dx, dy, p.size * (1 - progress * 0.3), 0, Math.PI * 2);
                ctx.fill();
                break;
            }
            case 'snow': {
                const sx = p.x + p.vx * p.age * 0.5 + Math.sin(p.age * 0.05 + p.wobble) * 3;
                const sy = baseY - 15 + p.vy * p.age * 0.5;
                const alpha3 = progress < 0.1 ? progress * 10 : progress > 0.8 ? (1 - progress) * 5 : 1;
                ctx.fillStyle = `rgba(240,248,255,${alpha3 * 0.8})`;
                ctx.beginPath();
                ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = `rgba(200,230,255,${alpha3 * 0.3})`;
                ctx.beginPath();
                ctx.arc(sx, sy, p.size * 1.8, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
            case 'electric': {
                const ex = p.x + p.vx * p.age * 0.3;
                const ey = baseY + p.vy * p.age * 0.4;
                const alpha4 = progress < 0.15 ? progress / 0.15 : progress > 0.7 ? (1 - progress) / 0.3 : 1;
                const flicker = Math.random() > 0.3 ? 1 : 0.3;
                ctx.strokeStyle = `rgba(255,255,100,${alpha4 * 0.9 * flicker})`;
                ctx.lineWidth = 1.5 + Math.random();
                ctx.shadowColor = 'rgba(255,255,0,0.8)';
                ctx.shadowBlur = 6;
                ctx.beginPath();
                let bx = ex, by = ey;
                ctx.moveTo(bx, by);
                const segments = 3 + Math.floor(Math.random() * 2);
                for (let s = 0; s < segments; s++) {
                    const nextX = bx + (Math.random() - 0.5) * 12;
                    const nextY = by - p.boltLen / segments + (Math.random() - 0.5) * 6;
                    ctx.lineTo(nextX, nextY);
                    bx = nextX;
                    by = nextY;
                }
                ctx.stroke();
                ctx.shadowBlur = 0;
                const sparkSize = 1.5 + Math.random() * 2;
                ctx.fillStyle = `rgba(255,255,200,${alpha4 * flicker})`;
                ctx.beginPath();
                ctx.arc(ex + (Math.random() - 0.5) * 6, ey - Math.random() * 8, sparkSize, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
            case 'fire': {
                const fx = p.x + p.vx * p.age * 0.25;
                const fy = baseY + p.vy * p.age * 0.35;
                const shrink = 1 - progress * 0.5;
                const r = p.size * shrink;
                const alpha5 = progress < 0.1 ? progress / 0.1 : progress > 0.6 ? (1 - progress) / 0.4 : 1;
                const innerR = r * 0.4;
                const grad = ctx.createRadialGradient(fx, fy, innerR, fx, fy, r);
                grad.addColorStop(0, `rgba(255,255,180,${alpha5 * 0.9})`);
                grad.addColorStop(0.3, `rgba(255,160,30,${alpha5 * 0.7})`);
                grad.addColorStop(0.7, `rgba(255,60,10,${alpha5 * 0.4})`);
                grad.addColorStop(1, `rgba(180,20,0,0)`);
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.ellipse(fx, fy, r, r * 1.3, 0, 0, Math.PI * 2);
                ctx.fill();
                if (Math.random() > 0.5) {
                    const sparkX = fx + (Math.random() - 0.5) * r * 1.5;
                    const sparkY = fy - r * 0.8 - Math.random() * r;
                    ctx.fillStyle = `rgba(255,220,100,${alpha5 * 0.6})`;
                    ctx.beginPath();
                    ctx.arc(sparkX, sparkY, 1 + Math.random() * 1.5, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            }
        }
        ctx.restore();
    }
}

export function resetBattleFx() {
    fxParticles.player = [];
    fxParticles.enemy = [];
}

const battleCircleCache = new Map();

export function setBattlePositions(positions) {
    battlePositions = positions;
}

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

let _battleSpeedMultiplier = 1;

export function setBattleSpeed(multiplier) {
    _battleSpeedMultiplier = multiplier || 1;
}

export function getBattleSpeed() {
    return _battleSpeedMultiplier;
}

export function showBattleMessage(message, autoHideMs = 0) {
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

            msgEl.classList.remove('visible');

            let i = 0;
            const fullText = String(message);
            const charDelay = Math.round(25 / _battleSpeedMultiplier);
            battleMessageInterval = setInterval(() => {
                try {
                    if (i < fullText.length) {
                        i++;
                        msgEl.innerText = fullText.substring(0, i);
                        if (i === 1) msgEl.classList.add('visible');
                    } else {
                        clearInterval(battleMessageInterval);
                        battleMessageInterval = null;
                        const waitMs = autoHideMs > 0 ? Math.round(autoHideMs / _battleSpeedMultiplier) : Math.round(600 / _battleSpeedMultiplier);
                        if (autoHideMs > 0) {
                            setTimeout(() => {
                                msgEl.classList.remove('visible');
                                setTimeout(resolve, Math.round(300 / _battleSpeedMultiplier));
                            }, waitMs);
                        } else {
                            setTimeout(resolve, waitMs);
                        }
                    }
                } catch (e) {
                    clearInterval(battleMessageInterval);
                    battleMessageInterval = null;
                    resolve();
                }
            }, charDelay);
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

export function showSwitchPokemonSelection(team, activeIndex, onSelect) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:200;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';

    const popup = document.createElement('div');
    popup.style.cssText = 'background:rgba(15,20,35,0.97);border:1px solid rgba(233,69,96,0.3);border-radius:12px;padding:16px;max-width:350px;width:90%;max-height:80vh;overflow-y:auto';

    popup.innerHTML = `
        <div style="text-align:center;margin-bottom:12px;">
            <div style="color:#e94560;font-size:14px;font-weight:700;">Trocar Pokémon</div>
            <div style="color:rgba(255,255,255,0.5);font-size:11px;margin-top:2px;">Escolha um Pokémon do seu time</div>
        </div>
        <div id="switch-team-list"></div>
        <div style="text-align:center;margin-top:12px;">
            <button id="switch-cancel" style="padding:8px 20px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:rgba(255,255,255,0.6);font-size:11px;cursor:pointer;font-family:Inter">Cancelar</button>
        </div>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    const teamList = popup.querySelector('#switch-team-list');
    team.forEach((p, i) => {
        if (i === activeIndex || p.fainted) return;
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px;border-radius:6px;cursor:pointer;transition:background 0.2s;border:1px solid rgba(255,255,255,0.06);margin-bottom:4px;';
        row.innerHTML = `
            <div style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.05);overflow:hidden;flex-shrink:0;">
                <img src="${p.spriteUrls?.front || p.spriteUrls?.home || ''}" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none'">
            </div>
            <div style="flex:1;min-width:0;">
                <div style="font-size:11px;font-weight:700;color:#fff;">${p.name} <span style="color:rgba(255,255,255,0.4);font-weight:400;">Lv.${p.level}</span></div>
                <div style="width:100%;height:5px;background:rgba(0,0,0,0.4);border-radius:3px;overflow:hidden;margin-top:3px;">
                    <div style="height:100%;width:${(p.currentHp / p.stats.hp) * 100}%;background:${p.currentHp > p.stats.hp * 0.5 ? '#4caf50' : '#ff9800'};border-radius:3px;"></div>
                </div>
                <div style="font-size:9px;color:rgba(255,255,255,0.4);margin-top:1px;">HP ${p.currentHp}/${p.stats.hp}</div>
            </div>
        `;
        row.addEventListener('mouseenter', () => row.style.background = 'rgba(255,255,255,0.06)');
        row.addEventListener('mouseleave', () => row.style.background = 'transparent');
        row.addEventListener('click', () => {
            overlay.remove();
            onSelect(i);
        });
        teamList.appendChild(row);
    });

    popup.querySelector('#switch-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
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
    syncBattleContainerToCanvas();
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

    const dw = clipRect ? clipRect.w : w;
    const dh = clipRect ? clipRect.h : h;
    const dx = clipRect ? clipRect.x : 0;
    const dy = clipRect ? clipRect.y : 0;
    let playerX, playerY, enemyX, enemyY;

    if (battlePositions) {
        playerX = dx + battlePositions.playerX * dw;
        playerY = dy + battlePositions.playerY * dh;
        enemyX = dx + battlePositions.enemyX * dw;
        enemyY = dy + battlePositions.enemyY * dh;
    } else {
        const saved = JSON.parse(localStorage.getItem('pvpBattlePositions') || '{"playerX":0.25,"playerY":0.75,"enemyX":0.72,"enemyY":0.4}');
        playerX = dx + saved.playerX * dw;
        playerY = dy + saved.playerY * dh;
        enemyX = dx + saved.enemyX * dw;
        enemyY = dy + saved.enemyY * dh;
    }

    const playerScale = getPokemonScale(playerPokemon);
    const enemyScale = getPokemonScale(enemyPokemon);
    updateBattlePokemonDom('player', playerPokemon, playerX, playerY, 0.5 * playerScale);
    updateBattlePokemonDom('enemy', enemyPokemon, enemyX, enemyY, 0.45 * enemyScale);

    const now = performance.now();
    const dt = 16;
    drawBattleFx(ctx, 'player', battleEffects.player, playerX, playerY + 50, dt);
    drawBattleFx(ctx, 'enemy', battleEffects.enemy, enemyX, enemyY + 50, dt);

    if (clipRect) ctx.restore();
}

export function stopBattleVideo() {
    if (currentBattleVideo) {
        currentBattleVideo.pause();
        currentBattleVideo.currentTime = 0;
        currentBattleVideo = null;
    }
}

function syncBattleContainerToCanvas() {
    const gameCanvas = document.getElementById('game-canvas');
    if (!gameCanvas || !battlePokemonContainer) return;
    const mainArea = document.getElementById('main-area');
    const mainRect = mainArea ? mainArea.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    battlePokemonContainer.style.left = '0';
    battlePokemonContainer.style.top = '0';
    battlePokemonContainer.style.width = mainRect.width + 'px';
    battlePokemonContainer.style.height = mainRect.height + 'px';
}

function ensureBattlePokemonContainer() {
    if (battlePokemonContainer) return battlePokemonContainer;
    const mainArea = document.getElementById('main-area');
    if (!mainArea) return null;
    battlePokemonContainer = document.createElement('div');
    battlePokemonContainer.id = 'battle-pokemon-sprites';
    battlePokemonContainer.style.cssText = 'position:absolute;pointer-events:none;z-index:25;';
    mainArea.appendChild(battlePokemonContainer);
    syncBattleContainerToCanvas();
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
    if (isPlayer && skipPlayerRender) return;
    if (!isPlayer && skipEnemyRender) return;
    const url = getBattleSpriteUrl(pokemon, isPlayer);

    let el = battlePokemonSprites[side];
    if (!url || !pokemon) {
        if (el) el.style.display = 'none';
        return;
    }

    const stateKey = `${pokemon.id}_${pokemon.isShiny}_${pokemon.isMega}_${pokemon._transformed || ''}_${pokemon._transformed ? pokemon.name : ''}`;

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

    const mainArea = document.getElementById('main-area');
    const mainRect = mainArea ? mainArea.getBoundingClientRect() : { width: 1024, height: 768 };
    const sx = 1;
    const sy = 1;

    const maxDim = Math.round(140 * sizeScale);
    el.style.width = Math.round(maxDim * sx) + 'px';
    el.style.height = Math.round(maxDim * sy) + 'px';
    el.style.left = Math.round(x * sx - maxDim * sx / 2) + 'px';
    el.style.top = Math.round(y * sy - maxDim * sy / 2) + 'px';
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
    if (battlePokemonSprites.player) {
        battlePokemonSprites.player.style.display = 'none';
        battlePokemonSprites.player.remove();
        battlePokemonSprites.player = null;
    }
    if (battlePokemonSprites.enemy) {
        battlePokemonSprites.enemy.style.display = 'none';
        battlePokemonSprites.enemy.remove();
        battlePokemonSprites.enemy = null;
    }
    battlePokemonState.player = null;
    battlePokemonState.enemy = null;
    if (battlePokemonContainer) {
        battlePokemonContainer.remove();
        battlePokemonContainer = null;
    }
    resetBattleFx();
}

export function showBattlePokemonSprites() {
    if (battlePokemonSprites.player) battlePokemonSprites.player.style.display = 'block';
    if (battlePokemonSprites.enemy) battlePokemonSprites.enemy.style.display = 'block';
}

export function getBattlePokemonSprites() {
    return battlePokemonSprites;
}

export function getPlayerSpriteSrc() {
    const el = battlePokemonSprites.player;
    return el ? el.src : null;
}

export function removePlayerSprite() {
    const el = battlePokemonSprites.player;
    if (el) {
        el.remove();
        battlePokemonSprites.player = null;
        battlePokemonState.player = null;
    }
}

export function setPlayerSpriteRef(el) {
    battlePokemonSprites.player = el;
}

export function setSkipPlayerRender(val) {
    skipPlayerRender = val;
}

export function setSkipEnemyRender(val) {
    skipEnemyRender = val;
}

export function setPlayerSpriteSrc(url) {
    if (battlePokemonSprites.player) {
        battlePokemonSprites.player.src = url;
    }
}

export function initBattleUI(onFight, onBag, onSwitch, onRun) {
    let battleReady = false;
    setTimeout(() => { battleReady = true; }, 800);

    $$('.battle-action-zone[data-action]').forEach(zone => {
        zone.addEventListener('click', () => {
            if (!battleReady) return;
            const action = zone.dataset.action;
            if (action === 'fight') onFight();
            else if (action === 'bag') onBag();
            else if (action === 'pokemon') onSwitch();
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
