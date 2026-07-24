import { TYPE_COLORS } from './data.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

export function showScreen(screenId) {
    $$('.hidden').forEach(el => el.classList.add('hidden'));
    const screen = $(`#${screenId}`);
    if (screen) screen.classList.remove('hidden');
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
        btn.innerHTML = `
            <span class="move-name">${move.name}</span>
            <span class="move-pp">PP: ${move.currentPp}/${move.pp}</span>
            <span class="move-pp">Poder: ${move.power}</span>
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
    const msg = $('#battle-message');
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
    skyGrad.addColorStop(0, '#87CEEB');
    skyGrad.addColorStop(1, '#B0E0E6');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h * 0.5);

    ctx.fillStyle = '#3a7d44';
    ctx.fillRect(0, h * 0.5, w, h * 0.5);

    ctx.fillStyle = '#2d6a33';
    for (let i = 0; i < 10; i++) {
        const x = (i * 100 + 20) % w;
        ctx.beginPath();
        ctx.arc(x, h * 0.45, 30 + Math.random() * 20, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.fillStyle = '#8B4513';
    ctx.fillRect(w * 0.15, h * 0.35, 120, 80);
    ctx.fillStyle = '#A0522D';
    ctx.fillRect(w * 0.15, h * 0.35, 120, 10);

    drawPokemonSprite(ctx, w * 0.15 + 60, h * 0.3, playerPokemon, false);

    ctx.fillStyle = '#8B4513';
    ctx.fillRect(w * 0.65, h * 0.15, 100, 60);
    ctx.fillStyle = '#A0522D';
    ctx.fillRect(w * 0.65, h * 0.15, 100, 8);

    drawPokemonSprite(ctx, w * 0.65 + 50, h * 0.1, enemyPokemon, true);
}

function drawPokemonSprite(ctx, x, y, pokemon, flipped) {
    const color = pokemon.color;
    const size = flipped ? 40 : 50;

    ctx.save();
    ctx.translate(x, y);
    if (flipped) ctx.scale(-1, 1);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.6, size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, -size * 0.5, size * 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-size * 0.12, -size * 0.55, size * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-size * 0.1, -size * 0.55, size * 0.06, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(size * 0.12, -size * 0.55, size * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(size * 0.14, -size * 0.55, size * 0.06, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-size * 0.15, -size * 0.42);
    ctx.quadraticCurveTo(0, -size * 0.38, size * 0.15, -size * 0.42);
    ctx.stroke();

    ctx.restore();
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
