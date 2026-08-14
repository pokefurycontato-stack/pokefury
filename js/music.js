/* =============================================================
   music.js — Musica de fundo + musica de batalha + volume
   ============================================================= */

export class MusicManager {
    constructor() {
        this.backgroundAudio = null;
        this.battleAudio = null;
        this.volume = parseFloat(localStorage.getItem('pokefury_music_volume') || '0.6');
        this.current = 'background';
        this.started = false;
    }

    init() {
        if (this.backgroundAudio) return;
        this.backgroundAudio = new Audio('assets/musicas/musicafundo1.MP3');
        this.backgroundAudio.loop = true;
        this.backgroundAudio.volume = this.volume;
        this.battleAudio = new Audio('assets/musicas/musicabatalha.MP3');
        this.battleAudio.loop = true;
        this.battleAudio.volume = this.volume;
        this._bindStart();
    }

    _bindStart() {
        if (this._boundStart) return;
        const start = () => {
            if (this.started) return;
            this.started = true;
            this.playBackground();
            document.removeEventListener('click', start);
            document.removeEventListener('keydown', start);
        };
        this._boundStart = true;
        document.addEventListener('click', start);
        document.addEventListener('keydown', start);
    }

    _play(audio) {
        if (this.volume <= 0) return;
        audio.volume = this.volume;
        audio.play().catch(() => {});
    }

    playBackground() {
        this.init();
        this.current = 'background';
        try { this.battleAudio.pause(); this.battleAudio.currentTime = 0; } catch (e) {}
        this._play(this.backgroundAudio);
    }

    playBattle() {
        this.init();
        this.current = 'battle';
        try { this.backgroundAudio.pause(); } catch (e) {}
        this._play(this.battleAudio);
    }

    setVolume(v) {
        this.volume = Math.max(0, Math.min(1, v));
        localStorage.setItem('pokefury_music_volume', String(this.volume));
        if (this.backgroundAudio) this.backgroundAudio.volume = this.volume;
        if (this.battleAudio) this.battleAudio.volume = this.volume;
    }
}
