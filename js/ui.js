import { TYPE_COLORS } from './data.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

let battlePokemonContainer = null;
const battlePokemonSprites = { player: null, enemy: null };
const battlePokemonNames = { player: null, enemy: null };

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

    const playerInfo = $('#player-info');
    const enemyInfo = $('#enemy-info');

    if (playerPokemon) playerInfo.querySelector('.trainer-name').textContent = `Você - Lv.${playerPokemon.level}`;
    if (enemyPokemon) enemyInfo.querySelector('.trainer-name').textContent = `Inimigo - Lv.${enemyPokemon.level}`;

    updateTeamIndicators('#player-info .pokemon-team', playerTeam);
    updateTeamIndicators('#enemy-info .pokemon-team', enemyTeam);
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
        const msgEl = $('#battle-message');
        msgEl.textContent = '';
        let i = 0;
        const interval = setInterval(() => {
            if (i < message.length) {
                msgEl.textContent += message[i];
                i++;
            } else {
                clearInterval(interval);
                setTimeout(resolve, 600);
            }
        }, 25);
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
        btn.style.borderColor = typeColor + '60';
        btn.innerHTML = `
            <span class="move-name">${move.name}</span>
            <span class="move-type">${move.type.toUpperCase()}</span>
            <span class="move-pp">PP: ${move.currentPp}/${move.pp}</span>
            <span class="move-pp">Poder: ${move.power || '—'}</span>
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

export function preloadBattleBgImage(url) {
    return new Promise((resolve) => {
        if (!url) { resolve(); return; }
        let img = bgCache.get(url);
        if (img && img.complete && img.naturalWidth > 0) { resolve(); return; }
        img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => { bgCache.set(url, img); resolve(); };
        img.onerror = () => { resolve(); };
        img.src = url;
    });
}

export function drawBattleScene(ctx, canvas, playerPokemon, enemyPokemon, backgroundUrl = null) {
    const w = canvas.width;
    const h = canvas.height;

    if (backgroundUrl) {
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

    const playerX = w * 0.22 + 30;
    const playerY = h * 0.58 + 150;
    const enemyX = w * 0.73;
    const enemyY = h * 0.32 + 80;

    updateBattlePokemonDom('player', playerPokemon, playerX, playerY, 1.2);
    updateBattlePokemonDom('enemy', enemyPokemon, enemyX, enemyY, 1.0);

    drawBattlePokemonName(ctx, playerX, playerY, playerPokemon, 1.2);
    drawBattlePokemonName(ctx, enemyX, enemyY, enemyPokemon, 1.0);
}

function ensureBattlePokemonContainer() {
    if (battlePokemonContainer) return battlePokemonContainer;
    const mainArea = document.getElementById('main-area');
    if (!mainArea) return null;
    battlePokemonContainer = document.createElement('div');
    battlePokemonContainer.id = 'battle-pokemon-sprites';
    battlePokemonContainer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;';
    mainArea.appendChild(battlePokemonContainer);
    return battlePokemonContainer;
}

function getBattleSpriteUrl(pokemon, isPlayer) {
    if (!pokemon) return null;
    const spriteUrls = pokemon.spriteUrls || {};
    const shinyUrls = pokemon.shinySpriteUrls;
    const isShiny = pokemon.isShiny;
    let url;
    if (isPlayer) {
        if (isShiny && shinyUrls) url = shinyUrls.back || shinyUrls.front || shinyUrls.home || shinyUrls.official;
        if (!url) url = spriteUrls?.back || spriteUrls?.front || spriteUrls?.home || spriteUrls?.official;
    } else {
        if (isShiny && shinyUrls) url = shinyUrls.front || shinyUrls.home || shinyUrls.official;
        if (!url) url = spriteUrls?.front || spriteUrls?.home || spriteUrls?.official;
    }
    return url || null;
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

    if (!el) {
        el = document.createElement('img');
        el.style.cssText = 'position:absolute;pointer-events:none;image-rendering:auto;';
        container.appendChild(el);
        battlePokemonSprites[side] = el;
    }

    el.src = url;
    el.style.display = 'block';

    const maxDim = Math.round(140 * sizeScale);
    el.style.width = maxDim + 'px';
    el.style.height = maxDim + 'px';
    el.style.left = (x - maxDim / 2) + 'px';
    el.style.top = (y - maxDim / 2) + 'px';
}

function drawBattlePokemonName(ctx, x, y, pokemon, sizeScale) {
    if (!pokemon) return;
    const url = getBattleSpriteUrl(pokemon, true);
    const img = url ? PokeAPI.imageCache[url] : null;
    const isShiny = pokemon.isShiny;

    let spriteH = 140 * sizeScale;
    if (img && img.complete && img.naturalWidth > 0) {
        const maxW = Math.round(140 * sizeScale);
        const maxH = Math.round(140 * sizeScale);
        const s = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
        spriteH = img.naturalHeight * s;
    }

    ctx.fillStyle = isShiny ? '#ffd700' : '#fff';
    ctx.font = `600 ${Math.round(14 * sizeScale)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    let nameText = pokemon.name;
    if (pokemon.isMega) nameText = '★ ' + nameText;
    ctx.fillText(nameText, x, y + spriteH / 2 + Math.round(16 * sizeScale));
    ctx.font = `400 ${Math.round(11 * sizeScale)}px Inter, sans-serif`;
    ctx.fillStyle = isShiny ? 'rgba(255,215,0,0.7)' : 'rgba(255,255,255,0.6)';
    ctx.fillText(`Lv.${pokemon.level}`, x, y + spriteH / 2 + Math.round(32 * sizeScale));
    ctx.shadowBlur = 0;
}

export function hideBattlePokemonSprites() {
    if (battlePokemonSprites.player) battlePokemonSprites.player.style.display = 'none';
    if (battlePokemonSprites.enemy) battlePokemonSprites.enemy.style.display = 'none';
}

export function showBattlePokemonSprites() {
    if (battlePokemonSprites.player) battlePokemonSprites.player.style.display = 'block';
    if (battlePokemonSprites.enemy) battlePokemonSprites.enemy.style.display = 'block';
}

export function initBattleUI(onFight, onBag, onMega, onRun) {
    $$('.action-btn[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
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
