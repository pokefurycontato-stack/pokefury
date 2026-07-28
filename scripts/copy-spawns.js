window.copyPlayerSpawns = async function() {
    const SUPABASE_URL = 'https://odevwnnpzsoltbrrjdts.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZXZ3bm5wenNvbHRicnJqZHRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MDE3NjEsImV4cCI6MjEwMDQ3Nzc2MX0.xlZ4LgzmQ-DZUz1kDk3oucmlvjCkty1TgzfN2IDxhoY';
    const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

    const regions = [
        { name: 'Kanto', id: 1 }, { name: 'Johto', id: 2 }, { name: 'Hoenn', id: 3 },
        { name: 'Sinnoh', id: 4 }, { name: 'Unova', id: 5 }, { name: 'Kalos', id: 6 },
        { name: 'Alola', id: 7 }, { name: 'Galar', id: 8 }, { name: 'Hisui', id: 9 },
        { name: 'Paldea', id: 10 }
    ];

    async function getMaps(regionId) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/region_maps?region_id=eq.${regionId}&select=id,name,player_spawn_x,player_spawn_y`, { headers });
        return res.json();
    }

    async function updateSpawn(mapId, x, y) {
        await fetch(`${SUPABASE_URL}/rest/v1/region_maps?id=eq.${mapId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ player_spawn_x: x, player_spawn_y: y })
        });
    }

    const kanto = await getMaps(1);
    const kantoMap = {};
    kanto.forEach(m => { kantoMap[m.name] = m; });

    let count = 0;
    for (const region of regions) {
        if (region.id === 1) continue;
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
