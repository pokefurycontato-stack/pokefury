/* =============================================================
   sfx.js — Efeitos sonoros de ambiente (passos, noite, chuva, ...)
   Volume individual por som, armazenado em localStorage.
   Capacidade (cap) baixa por som: nunca cobrem a musica do jogo.
   Para adicionar um som novo: registre aqui e chame set<Nome>() no city.
   ============================================================= */

export class SfxManager {
    constructor() {
        // Volume antigo global (uma barra so): usado como default enquanto o
        // jogador nao mexer nas barras individuais (migracao suave).
        this._legacyVolume = parseFloat(localStorage.getItem('pokefury_sfx_volume') || '0.8');
        this._sounds = {
            steps: { label: 'Passos', file: 'assets/sounds/passos.MP3', cap: 0.22 },
            night: { label: 'Coruja (noite)', file: 'assets/sounds/noite.MP3', cap: 0.16 },
            rain: { label: 'Chuva', file: 'assets/sounds/chuva.MP3', cap: 0.18 }
        };
        this._audios = {};
        this._on = {};
    }

    // ---- Metadados (usados pelo menu Som para renderizar uma barra por som) ----
    getSoundIds() {
        return Object.keys(this._sounds);
    }

    getSoundMeta(id) {
        return this._sounds[id];
    }

    // ---- Volume individual ----
    getVolume(id) {
        const raw = localStorage.getItem('pokefury_sfx_volume_' + id);
        if (raw === null) return this._legacyVolume; // fallback p/ config antiga
        const v = parseFloat(raw);
        return Number.isFinite(v) ? v : this._legacyVolume;
    }

    setVolume(id, v) {
        v = Math.max(0, Math.min(1, v));
        localStorage.setItem('pokefury_sfx_volume_' + id, String(v));
        if (this._audios[id]) this._audios[id].volume = this._eff(id);
    }

    // Volume efetivo = barra do jogador * cap do som (cap baixo = nao cobrir musica)
    _eff(id) {
        const meta = this._sounds[id];
        if (!meta) return 0;
        return Math.max(0, Math.min(1, this.getVolume(id))) * meta.cap;
    }

    _ensure(id) {
        if (this._audios[id]) return;
        const meta = this._sounds[id];
        if (!meta) return;
        const a = new Audio(meta.file);
        a.loop = true;
        a.volume = this._eff(id);
        this._audios[id] = a;
    }

    _play(id) {
        if (this._on[id]) return;
        this._ensure(id);
        const a = this._audios[id];
        if (!a) return;
        this._on[id] = true;
        const p = a.play();
        // Se o navegador bloquear (autoplay), marca como nao tocando para
        // tentar de novo no proximo frame (quando ja houver interacao do usuario).
        if (p && p.catch) p.catch(() => { this._on[id] = false; });
    }

    _pause(id) {
        if (!this._on[id]) return;
        this._on[id] = false;
        try { this._audios[id].pause(); } catch (e) {}
    }

    _toggle(id, on) {
        if (on) this._play(id);
        else this._pause(id);
    }

    setSteps(on) { this._toggle('steps', on); }
    setNight(on) { this._toggle('night', on); }
    setRain(on) { this._toggle('rain', on); }

    stopAll() {
        Object.keys(this._sounds).forEach(id => this._pause(id));
    }
}