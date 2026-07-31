const WORLD_MAP_REGIONS = [
    { name: 'Kanto',  cx: 0.13, cy: 0.14, hitR: 0.08 },
    { name: 'Johto',  cx: 0.33, cy: 0.14, hitR: 0.08 },
    { name: 'Hoenn',  cx: 0.53, cy: 0.14, hitR: 0.08 },
    { name: 'Sinnoh', cx: 0.77, cy: 0.14, hitR: 0.08 },
    { name: 'Unova',  cx: 0.20, cy: 0.46, hitR: 0.08 },
    { name: 'Kalos',  cx: 0.47, cy: 0.46, hitR: 0.08 },
    { name: 'Alola',  cx: 0.73, cy: 0.46, hitR: 0.08 },
    { name: 'Galar',  cx: 0.15, cy: 0.78, hitR: 0.08 },
    { name: 'Hisui',  cx: 0.38, cy: 0.78, hitR: 0.08 },
    { name: 'Paldea', cx: 0.63, cy: 0.78, hitR: 0.08 }
];

function buildWorldMapHotspots() {
    const container = document.getElementById('worldmap-hotspots');
    const img = document.getElementById('worldmap-img');
    const label = document.getElementById('worldmap-region-label');
    if (!container || !img) return;
    container.innerHTML = '';

    const currentRegion = window.pokefury?.currentRegion?.name || '';

    label.textContent = currentRegion ? `📍 Voce esta em: ${currentRegion}` : '';

    WORLD_MAP_REGIONS.forEach(r => {
        const spot = document.createElement('div');
        spot.className = 'worldmap-spot' + (r.name === currentRegion ? ' current' : '');
        spot.style.left = `calc(${r.cx * 100}% - 28px)`;
        spot.style.top = `calc(${r.cy * 100}% - 28px)`;

        const dot = document.createElement('div');
        dot.className = 'pokeball-dot';
        spot.appendChild(dot);

        spot.title = r.name;
        spot.addEventListener('click', () => travelToRegion(r.name));
        container.appendChild(spot);
    });
}

async function travelToRegion(regionName) {
    const game = window.pokefury;
    if (!game || !game.regionManager || !game.currentCharacterId) {
        console.warn('[WorldMap] Game not ready');
        return;
    }

    const region = game.regionManager.regions.find(
        r => r.name.toLowerCase() === regionName.toLowerCase()
    );
    if (!region) {
        console.warn('[WorldMap] Region not found:', regionName);
        alert(`Regiao "${regionName}" nao encontrada no banco de dados.`);
        return;
    }

    if (game.currentRegion && game.currentRegion.id === region.id) {
        closeWorldMap();
        return;
    }

    const maps = await game.regionManager.loadRegionMaps(region.id);
    if (!maps || maps.length === 0) {
        alert(`Regiao "${regionName}" nao possui mapas.`);
        return;
    }

    const firstMap = maps[0];
    const userId = window.GameData?.userId;

    await game.regionManager.initPlayerProgress(
        game.currentCharacterId, region.id, firstMap.id, userId
    );

    game.currentRegion = region;
    game.currentRegionMaps = maps;
    game.currentMap = firstMap;

    closeWorldMap();

    if (game.overworld2d) {
        await game.overworld2d.setCurrentMap(firstMap);
    }

    game.showTransitionBanner(`Viajando para ${regionName}...`);
}

function openWorldMap() {
    const overlay = document.getElementById('worldmap-overlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
    buildWorldMapHotspots();
}

function closeWorldMap() {
    const overlay = document.getElementById('worldmap-overlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.style.display = 'none';
}

window.openWorldMap = openWorldMap;
window.closeWorldMap = closeWorldMap;

document.getElementById('worldmap-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'worldmap-overlay') closeWorldMap();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const overlay = document.getElementById('worldmap-overlay');
        if (overlay && !overlay.classList.contains('hidden')) closeWorldMap();
    }
});
