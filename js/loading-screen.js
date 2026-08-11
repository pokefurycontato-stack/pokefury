// ============================================================
// TELA DE CARREGAMENTO (LoadingScreen)
// Aparece por cima de tudo enquanto funcoes iniciam/carregam.
// Uso:
//   window.LoadingScreen.show()              -> mostra (sorteia uma dica)
//   window.LoadingScreen.setProgress(0..100) -> atualiza a barra
//   window.LoadingScreen.hide()              -> esconde
// ============================================================
(function () {
    'use strict';

    // Frases de dica sorteadas a cada abertura da tela
    const TIPS = [
        'Não esqueça de curar seu time na Enfermeira Joy!',
        'Sempre ande com várias Pokébolas para não perder uma captura.',
        'Fale com o Professor Carvalho para aceitar novas quests!',
        'Monte uma equipe equilibrada em tipos para batalhas mais fáceis.',
        'Visite a loja para comprar poções e itens essenciais.',
        'Troque seu Pokémon líder para aumentar a amizade mais rápido.',
        'Use o avião da cidade para viajar entre as regiões.',
        'O Modo Automático (AFK) pode facilitar o treino do seu time.',
        'Explore os Safaris da cidade para capturar pokémons de biomas diferentes.',
        'Complete quests para ganhar recompensas em Prata e Diamantes.',
        'Confira sua Mochila regularmente para usar os itens que você tem.',
        'Crie estratégias com movimentos de tipos diferentes na sua equipe.'
    ];

    let current = 0;

    function $(id) { return document.getElementById(id); }

    function show(opts) {
        const screen = $('loading-screen');
        if (!screen) return;
        const wasVisible = screen.style.display === 'flex';

        screen.style.display = 'flex';

        // Só sortea a dica e zera o progresso se a tela ainda não estava visível
        if (!wasVisible) {
            setProgress(0);
            const tipEl = $('loading-dica-text');
            if (tipEl) {
                tipEl.textContent = (opts && opts.tip)
                    ? opts.tip
                    : TIPS[Math.floor(Math.random() * TIPS.length)];
            }
        }
    }

    function setProgress(n) {
        n = Math.max(0, Math.min(100, Math.round(n)));
        current = n;
        const fill = $('loading-progress-fill');
        if (fill) fill.style.width = n + '%';
        const pct = $('loading-percent');
        if (pct) pct.textContent = n + '%';
    }

    function getProgress() { return current; }

    function hide() {
        const screen = $('loading-screen');
        if (screen) screen.style.display = 'none';
    }

    window.LoadingScreen = {
        show: show,
        setProgress: setProgress,
        getProgress: getProgress,
        hide: hide
    };
})();