/* =============================================================
   music.js — Musica de fundo + musica de batalha + volume
   ============================================================= */

export class MusicManager {
    constructor() {
        this.backgroundAudio = null;
        this.battleAudio = null;
        this.volume = parseFloat(localStorage.getItem('pokefury_music_volume') || '0.6');
        this.current = 'background';
        this._boundInteraction = null;
    }

    init() {
        if (this.backgroundAudio) return;
        this.backgroundAudio = new Audio('assets/musicas/musicafundo1.MP3');
        this.backgroundAudio.loop = true;
        this.backgroundAudio.volume = this.volume;
        this.battleAudio = new Audio('assets/musicas/musicabatalha.MP3');
        this.battleAudio.loop = true;
        this.battleAudio.volume = this.volume;
    }

    playBackground() {
        this.init();
        if (this.current === 'background') { this._safePlay(this.backgroundAudio); return; }
        this.current = 'background';
        try { this.battleAudio.pause(); this.battleAudio.currentTime = 0; } catch (e) {}
        this._safePlay(this.backgroundAudio);
    }

    playBattle() {
        this.init();
        if (this.current === 'battle') { this._safePlay(this.battleAudio); return; }
        this.current = 'battle';
        try { this.backgroundAudio.pause(); } catch (e) {}
        this._safePlay(this.battleAudio);
    }

    _safePlay(audio) {
        if (this.volume <= 0) return;
        audio.volume = this.volume;
        let p;
        try { p = audio.play(); } catch (e) { p = null; }
        if (p && p.catch) {
            p.catch(() => {
                if (!this._boundInteraction) {
                    this._boundInteraction = () => {
                        try { audio.play(); } catch (e) {}
                        document.removeEventListener('click', this._boundInteraction);
                        document.removeEventListener('keydown', this._boundInteraction);
                        this._boundInteraction = null;
                    };
                    document.addEventListener('click', this._boundInteraction);
                    document.addEventListener('keydown', this._boundInteraction);
                }
            });
        }
    }

    setVolume(v) {
        this.volume = Math.max(0, Math.min(1, v));
        localStorage.setItem('pokefury_music_volume', String(this.volume));
        if (this.backgroundAudio) this.backgroundAudio.volume = this.volume;
        if (this.battleAudio) this.battleAudio.volume = this.volume;
    }
}
