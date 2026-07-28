window.copyPlayerSpawns = async function() {
    const SUPABASE_URL = 'https://odevwnnpzsoltbrrjdts.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZXZ3bm5wenNvbHRicnJqZHRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MDE3NjEsImV4cCI6MjEwMDQ3Nzc2MX0.xlZ4LgzmQ-DZUz1kDk3oucmlvjCkty1TgzfN2IDxhoY';
    const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

    async function getRegions() {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/regions?select=id,name`, { headers });
        if (!res.ok) throw new Error(`Failed to fetch regions: ${await res.text()}`);
        return res.json();
    }

    async function getMaps(regionId) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/region_maps?region_id=eq.${regionId}&select=id,name,player_spawn_x,player_spawn_y`, { headers });
        if (!res.ok) throw new Error(`Failed to fetch maps: ${await res.text()}`);
        return res.json();
    }

    async function updateSpawn(mapId, x, y) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/region_maps?id=eq.${mapId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ player_spawn_x: x, player_spawn_y: y })
        });
        if (!res.ok) throw new Error(`Failed to update map ${mapId}: ${await res.text()}`);
    }

    const regions = await getRegions();
    console.log('Regioes encontradas:', regions.map(r => `${r.name} (${r.id})`));

    const kantoRegion = regions.find(r => r.name === 'Kanto');
    if (!kantoRegion) throw new Error('Kanto region not found');

    const kanto = await getMaps(kantoRegion.id);
    console.log('Mapas Kanto:', kanto.length, kanto.filter(m => m.player_spawn_x != null).length, 'com spawn');
    const kantoMap = {};
    kanto.forEach(m => { kantoMap[m.name] = m; });

    let count = 0;
    for (const region of regions) {
        if (region.name === 'Kanto') continue;
        const maps = await getMaps(region.id);
        for (const map of maps) {
            const source = kantoMap[map.name];
            if (source && source.player_spawn_x != null && source.player_spawn_y != null) {
                await updateSpawn(map.id, source.player_spawn_x, source.player_spawn_y);
                count++;
            }
        }
    }

    console.log(`Player spawns copiados: ${count} mapas atualizados`);
};
console.log('Script carregado. Execute: copyPlayerSpawns()');
