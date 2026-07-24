import { TYPE_COLORS } from './data.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

export function showScreen(screenId) {
    const screens = ['battle-screen', 'hud', 'character-screen'];
    screens.forEach(id => {
        const el = $(`#${id}`);
        if (el) el.classList.add('hidden');
    });
    const screen = $(`#${screenId}`);
    if (screen) screen.classList.remove('hidden');
}

export async function preloadBattleSprites(playerPokemon, enemyPokemon) {
    const urls = [];
    if (playerPokemon.spriteUrls) urls.push(playerPokemon.spriteUrls.home || playerPokemon.spriteUrls.official);
    if (enemyPokemon.spriteUrls) urls.push(enemyPokemon.spriteUrls.home || enemyPokemon.spriteUrls.official);
    await PokeAPI.preloadSprites(urls);
}

export function updateBattleUI(playerTeam, enemyTeam, activePlayerIdx = 0, activeEnemyIdx = 0) {
    const playerPokemon = playerTeam[activePlayerIdx];
    const enemyPokemon = enemyTeam[activeEnemyIdx];

    const playerInfo = $('#player-info');
    const enemyInfo = $('#enemy-info');

    playerInfo.querySelector('.trainer-name').textContent = `Você - Lv.${playerPokemon.level}`;
    enemyInfo.querySelector('.trainer-name').textContent = `Inimigo - Lv.${enemyPokemon.level}`;

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

export function drawBattleScene(ctx, canvas, playerPokemon, enemyPokemon) {
    const w = canvas.width;
    const h = canvas.height;

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

    drawPokemonSprite(ctx, w * 0.22, h * 0.38, playerPokemon);
    drawPokemonSprite(ctx, w * 0.75, h * 0.18, enemyPokemon);
}

function drawPokemonSprite(ctx, x, y, pokemon) {
    const spriteUrls = pokemon.spriteUrls;
    const spriteUrl = spriteUrls?.home || spriteUrls?.official || spriteUrls?.front;
    const img = spriteUrl ? PokeAPI.imageCache[spriteUrl] : null;
    const typeColor = TYPE_COLORS[pokemon.type] || '#686868';

    if (img && img.complete && img.naturalWidth > 0) {
        ctx.shadowColor = typeColor;
        ctx.shadowBlur = 30;

        const maxW = 160;
        const maxH = 160;
        const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
        const drawW = img.naturalWidth * scale;
        const drawH = img.naturalHeight * scale;

        ctx.drawImage(img, x - drawW / 2, y - drawH / 2, drawW, drawH);
        ctx.shadowBlur = 0;
    } else {
        ctx.shadowColor = typeColor;
        ctx.shadowBlur = 40;
        ctx.fillStyle = typeColor;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(x, y, 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#fff';
        ctx.font = '600 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('?', x, y + 5);
    }

    ctx.fillStyle = '#fff';
    ctx.font = '600 14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(pokemon.name, x, y + 90);
    ctx.font = '400 11px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(`Lv.${pokemon.level}`, x, y + 108);
    ctx.shadowBlur = 0;
}

export function initBattleUI(onFight, onRun) {
    $$('.action-btn[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            if (action === 'fight') onFight();
            else if (action === 'run') onRun();
        });
    });
}
