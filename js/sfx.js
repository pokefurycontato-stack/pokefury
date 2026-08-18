/* =============================================================
   sfx.js — Efeitos sonoros de ambiente (passos, noite, chuva)
   Volumes complementares: nunca cobrem a musica do jogo.
   ============================================================= */

export class SfxManager {
    constructor() {
        this.volume = parseFloat(localStorage.getItem('pokefury_sfx_volume') || '0.8');
        this._steps = null;
        this._night = null;
        this._rain = null;
        this._stepsOn = false;
        this._nightOn = false;
        this._rainOn = false;
        // Volume efetivo de cada som = slider do jogador * cap.
        // Caps baixos: som ambiente de apoio, sem esconder a musica (maximo ~0.22).
        this._caps = {
            steps: 0.22,
            night: 0.16,
            rain: 0.18
        };
    }

    _ensure() {
        if (this._steps) return;
        this._steps = new Audio('assets/sounds/passos.MP3');
        this._steps.loop = true;
        this._steps.volume = this._eff('steps');
        this._night = new Audio('assets/sounds/noite.MP3');
        this._night.loop = true;
        this._night.volume = this._eff('night');
        this._rain = new Audio('assets/sounds/chuva.MP3');
        this._rain.loop = true;
        this._rain.volume = this._eff('rain');
    }

    _eff(kind) {
        return Math.max(0, Math.min(1, this.volume)) * this._caps[kind];
    }

    setVolume(v) {
        this.volume = Math.max(0, Math.min(1, v));
        localStorage.setItem('pokefury_sfx_volume', String(this.volume));
        if (this._steps) this._steps.volume = this._eff('steps');
        if (this._night) this._night.volume = this._eff('night');
        if (this._rain) this._rain.volume = this._eff('rain');
    }

    _play(kind, stateKey) {
        if (this[stateKey]) return;
        this._ensure();
        const a = this['_' + kind];
        if (!a) return;
        this[stateKey] = true;
        const p = a.play();
        // Se o navegador bloquear (autoplay), marca como nao tocando para
        // tentar de novo no proximo frame (quando ja houver interacao do usuario).
        if (p && p.catch) p.catch(() => { this[stateKey] = false; });
    }

    _pause(kind, stateKey) {
        if (!this[stateKey]) return;
        this[stateKey] = false;
        try { this['_' + kind].pause(); } catch (e) {}
    }

    setSteps(on) { this._playOrPause(on, 'steps', '_stepsOn'); }
    setNight(on) { this._playOrPause(on, 'night', '_nightOn'); }
    setRain(on) { this._playOrPause(on, 'rain', '_rainOn'); }

    _playOrPause(on, kind, stateKey) {
        if (on) this._play(kind, stateKey);
        else this._pause(kind, stateKey);
    }

    stopAll() {
        this.setSteps(false);
        this.setNight(false);
        this.setRain(false);
    }
}
