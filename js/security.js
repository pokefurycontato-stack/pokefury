// ============================================================
// PokeFury - Watchdog de integridade do client (tamper detection)
// Detecta sobrescrita de funções críticas em runtime e registra
// eventos em security_events (via log_security_event RPC).
// Exposto como window.SecurityWatchdog para os scripts clássicos.
// ============================================================
import { executeTurn } from './battle.js';
import { calculateDamage } from './utils.js';

const INTERVAL_MS = 5000;
const BAN_POLL_MS = 15000;
const DEVICE_POLL_MS = 30000;

const WATCHDOG = {
    guards: [],
    registered: new Set(),
    loggedTamper: new Set(),
    _lastCheck: 0,
    _bannedShown: false,
    _deviceHash: null,
    _deviceRegistered: false,
    _forceLogoutSeen: null,
};

function computeDeviceHash() {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 220;
        canvas.height = 60;
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#e94560';
        ctx.fillRect(20, 10, 60, 40);
        ctx.fillStyle = '#4caf50';
        ctx.fillRect(80, 10, 60, 40);
        ctx.fillStyle = '#2196f3';
        ctx.fillRect(140, 10, 60, 40);
        ctx.fillStyle = '#fff';
        ctx.font = '15px monospace';
        ctx.fillText('PokeFury::device-fp', 12, 18);
        const dataUrl = canvas.toDataURL();
        const parts = [
            dataUrl,
            navigator.userAgent || '',
            String(screen.width) + 'x' + String(screen.height) + 'x' + String(screen.colorDepth || 24),
            String(screen.availWidth) + 'x' + String(screen.availHeight),
            String(navigator.language || ''),
            String(new Date().getTimezoneOffset()),
            String(navigator.hardwareConcurrency || ''),
            String(navigator.platform || ''),
            String(navigator.deviceMemory || ''),
        ];
        const raw = parts.join('|');
        let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
        for (let i = 0; i < raw.length; i++) {
            const ch = raw.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 2654435761);
            h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        const hex = (n) => (n >>> 0).toString(16).padStart(8, '0');
        return 'dev_' + hex(h1) + hex(h2);
    } catch (e) {
        const fallback = 'dev_fb_' + String(navigator.userAgent || '').length + '_' + String(screen.width || 0) + 'x' + String(screen.height || 0);
        return fallback;
    }
}

function getDeviceHash() {
    if (!WATCHDOG._deviceHash) WATCHDOG._deviceHash = computeDeviceHash();
    return WATCHDOG._deviceHash;
}

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
        .then(() => {})
        .catch(() => {});
}

function showBanned(reason) {
    if (WATCHDOG._bannedShown) return;
    WATCHDOG._bannedShown = true;
    const overlay = document.createElement('div');
    overlay.id = 'banned-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(10,10,15,0.96);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;color:#fff;font-family:Inter,sans-serif;text-align:center;padding:24px;';
    overlay.innerHTML =
        '<div style="font-size:44px;">🚫</div>' +
        '<div style="font-size:24px;font-weight:800;color:#e94560;">Conta banida</div>' +
        '<div style="font-size:14px;color:rgba(255,255,255,0.7);max-width:420px;">' + (reason || 'Esta conta foi banida por violação das regras. Se você acha que isso é um erro, entre em contato com o suporte.') + '</div>' +
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
        const deviceHash = getDeviceHash();
        if (!WATCHDOG._deviceRegistered) {
            WATCHDOG._deviceRegistered = true;
            try {
                await window.db
                    .rpc('register_device', { p_device_hash: deviceHash })
                    .then(() => {})
                    .catch(() => { WATCHDOG._deviceRegistered = false; });
            } catch (e) { WATCHDOG._deviceRegistered = false; }
        }
        const { data } = await window.db
            .rpc('get_my_ban_status', { p_device_hash: deviceHash })
            .then(r => r)
            .catch(() => ({ data: null }));
        if (data && data.success) {
            // Logout forçado pelo admin (desconectar, não banir).
            // Detecta quando force_logout_at MUDA em relação ao último
            // valor visto (persistido), sem depender de relógio.
            const fl = data.force_logout_at || null;
            if (fl && WATCHDOG._flSeen !== null && WATCHDOG._flSeen !== fl) {
                forceLocalLogout();
                return;
            }
            if (fl !== null) {
                if (WATCHDOG._flSeen === null) {
                    // Primeira leitura: adota o valor atual (só reage a mudanças futuras)
                    WATCHDOG._flSeen = fl;
                    try { localStorage.setItem('pf_fl_seen', fl); } catch (e) {}
                }
            }
            if (data.is_banned || data.device_banned) {
                if (data.device_banned && !data.is_banned) {
                    showBanned('Este dispositivo foi banido por violação das regras. Se você acha que isso é um erro, entre em contato com o suporte.');
                } else {
                    showBanned();
                }
            }
        }
    } catch (e) { /* sem sessão ou erro de rede: ignora */ }
}

function forceLocalLogout() {
    if (WATCHDOG._bannedShown) return;
    WATCHDOG._bannedShown = true;
    try { if (window.db) window.db.auth.signOut().catch(() => {}); } catch (e) {}
    try { localStorage.clear(); } catch (e) {}
    try {
        const overlay = document.createElement('div');
        overlay.id = 'force-logout-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(10,10,15,0.97);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;color:#fff;font-family:Inter,sans-serif;text-align:center;padding:24px;';
        overlay.innerHTML =
            '<div style="font-size:44px;">🔌</div>' +
            '<div style="font-size:22px;font-weight:800;color:#60a5fa;">Sessão desconectada</div>' +
            '<div style="font-size:14px;color:rgba(255,255,255,0.7);max-width:420px;">Um administrador desconectou esta conta. Você pode entrar novamente quando quiser.</div>' +
            '<button id="fl-reload" style="margin-top:12px;padding:10px 28px;border:none;border-radius:8px;background:#e94560;color:#fff;font-weight:700;cursor:pointer;">Voltar para o início</button>';
        document.body.appendChild(overlay);
        document.getElementById('fl-reload').addEventListener('click', () => { location.href = '/'; });
    } catch (e) {
        location.href = '/';
    }
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

    // Carrega o último force_logout_at visto (persistido), para que
    // uma página recarregada não reaja a um logout antigo.
    try {
        const seen = localStorage.getItem('pf_fl_seen');
        if (seen) WATCHDOG._flSeen = seen;
    } catch (e) {}

    // Reinicia a detecção em cada novo login/troca de conta
    if (window.db && window.db.auth) {
        try {
            window.db.auth.onAuthStateChange((event) => {
                if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
                    WATCHDOG._flSeen = null;
                    try { localStorage.removeItem('pf_fl_seen'); } catch (e) {}
                }
            });
        } catch (e) {}
    }

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

    // Re-registra o dispositivo periodicamente (mantém last_seen fresco)
    setInterval(() => { WATCHDOG._deviceRegistered = false; pollBanStatus(); }, DEVICE_POLL_MS);

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
