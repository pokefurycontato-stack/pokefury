// ============================================================
// PokeFury - Watchdog de integridade do client (tamper detection)
// Detecta sobrescrita de funções críticas em runtime e registra
// eventos em security_events (via log_security_event RPC).
// Exposto como window.SecurityWatchdog para os scripts clássicos.
// ============================================================
import { executeTurn } from './battle.js';
import { calculateDamage } from './utils.js';

const INTERVAL_MS = 5000;
const BAN_POLL_MS = 60000;

const WATCHDOG = {
    guards: [],
    registered: new Set(),
    loggedTamper: new Set(),
    _lastCheck: 0,
    _bannedShown: false,
};

function register(label, resolver) {
    if (WATCHDOG.registered.has(label)) return;
    let code = null;
    try {
        const fn = resolver();
        if (fn && typeof fn === 'function') {
            code = Function.prototype.toString.call(fn);
        }
    } catch (e) { code = null; }
    WATCHDOG.registered.add(label);
    if (code) {
        WATCHDOG.guards.push({ label, resolver, code });
    }
}

function checkIntegrity() {
    const now = Date.now();
    if (now - WATCHDOG._lastCheck < 1000) return;
    WATCHDOG._lastCheck = now;

    // Registra guards do jogo assim que a instância existir (idempotente)
    if (window.pokefury) {
        register('game.executeBattleTurn', () => window.pokefury.executeBattleTurn);
        register('game.enemyTurn', () => window.pokefury.enemyTurn);
        register('game.healAllPokemon', () => window.pokefury.healAllPokemon);
        register('game.saveTeam', () => window.pokefury.saveTeam);
        register('game.endBattle', () => window.pokefury.endBattle);
        register('game.calculateCatchRate', () => window.pokefury.calculateCatchRate);
    }
    if (window.GameData) {
        register('gamedata._doSaveTeam', () => window.GameData._doSaveTeam);
        register('gamedata.addPokemonToTeam', () => window.GameData.addPokemonToTeam);
        register('gamedata.grantExp', () => window.GameData.grantExp);
        register('gamedata.levelUp', () => window.GameData.levelUp);
        register('gamedata.evolve', () => window.GameData.evolve);
    }
    register('battle.executeTurn', () => executeTurn);
    register('utils.calculateDamage', () => calculateDamage);

    for (const g of WATCHDOG.guards) {
        let current = null;
        try {
            const fn = g.resolver();
            if (fn && typeof fn === 'function') current = Function.prototype.toString.call(fn);
        } catch (e) { current = null; }
        if (current !== g.code) {
            if (!WATCHDOG.loggedTamper.has(g.label)) {
                WATCHDOG.loggedTamper.add(g.label);
                logEvent('function_tamper', g.label, {
                    tampered: true,
                    current_src: String(current || '').slice(0, 500),
                });
            }
        }
    }
}

function logEvent(type, fnLabel, detail) {
    if (!window.db) return;
    const charId =
        (window.pokefury && window.pokefury.currentCharacterId) ||
        (window.GameData && window.GameData.currentCharacterId) ||
        null;
    window.db
        .rpc('log_security_event', {
            p_character_id: charId,
            p_event_type: type,
            p_function_name: fnLabel || null,
            p_detail: detail || {},
            p_url: (window.location.pathname || '') + (window.location.search || ''),
        })
        .catch(() => {});
}

function showBanned() {
    if (WATCHDOG._bannedShown) return;
    WATCHDOG._bannedShown = true;
    const overlay = document.createElement('div');
    overlay.id = 'banned-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(10,10,15,0.96);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;color:#fff;font-family:Inter,sans-serif;text-align:center;padding:24px;';
    overlay.innerHTML =
        '<div style="font-size:44px;">🚫</div>' +
        '<div style="font-size:24px;font-weight:800;color:#e94560;">Conta banida</div>' +
        '<div style="font-size:14px;color:rgba(255,255,255,0.7);max-width:420px;">Esta conta foi banida por violação das regras. Se você acha que isso é um erro, entre em contato com o suporte.</div>' +
        '<button id="banned-logout" style="margin-top:12px;padding:10px 28px;border:none;border-radius:8px;background:#e94560;color:#fff;font-weight:700;cursor:pointer;">Sair</button>';
    document.body.appendChild(overlay);
    document.getElementById('banned-logout').addEventListener('click', () => {
        if (window.db) window.db.auth.signOut().catch(() => {});
        localStorage.clear();
        location.href = '/';
    });
}

async function pollBanStatus() {
    if (!window.db) return;
    try {
        const { data } = await window.db.rpc('get_my_ban_status');
        if (data && data.success && data.is_banned) {
            showBanned();
        }
    } catch (e) { /* sem sessão ou erro de rede: ignora */ }
}

function onRpcError(error, fnLabel) {
    const msg = (error && (error.message || error.error)) || '';
    const dataErr = error && error.data && error.data.error;
    const full = String(msg) + ' ' + String(dataErr || '');
    if (full.toLowerCase().includes('banned')) {
        showBanned();
        return true;
    }
    if (full.toLowerCase().includes('rate limit')) {
        logEvent('server_reject', fnLabel || null, { reason: 'rate_limit' });
        return true;
    }
    return false;
}

function setup() {
    // Checagem periódica de integridade
    setInterval(checkIntegrity, INTERVAL_MS);

    // Checa quando o jogador volta para a aba (provável momento de edição)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) checkIntegrity();
    });
    window.addEventListener('focus', checkIntegrity);

    // Erros não capturados = sinal forense
    window.addEventListener('error', (e) => {
        logEvent('client_error', e.filename || null, {
            message: String(e.message || '').slice(0, 500),
            line: e.lineno,
            col: e.colno,
        });
    });

    // Verifica status de ban periodicamente
    setInterval(pollBanStatus, BAN_POLL_MS);
    setTimeout(pollBanStatus, 5000);

    // Snapshot inicial o quanto antes (registra guards do game/gamedata)
    setTimeout(checkIntegrity, 0);
}

const SecurityWatchdog = {
    check() {
        checkIntegrity();
    },
    log(type, fnLabel, detail) {
        logEvent(type, fnLabel, detail);
    },
    onRpcError(error, fnLabel) {
        return onRpcError(error, fnLabel);
    },
    showBanned() {
        showBanned();
    },
};

if (typeof window !== 'undefined') {
    window.SecurityWatchdog = SecurityWatchdog;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setup);
    } else {
        setup();
    }
}
