window.copyPlayerSpawns = async function() {
    const db = window.db;
    const { data: regions, error: e1 } = await db.from('regions').select('id, name');
    if (e1) throw e1;

    const kantoRegion = regions.find(r => r.name === 'Kanto');
    const { data: kanto, error: e2 } = await db.from('region_maps').select('id, name, player_spawn_x, player_spawn_y').eq('region_id', kantoRegion.id);
    if (e2) throw e2;

    console.log('Mapas Kanto:', kanto.filter(m => m.player_spawn_x != null).length, 'com spawn');
    const kantoMap = {};
    kanto.forEach(m => { kantoMap[m.name] = m; });

    let count = 0;
    for (const region of regions) {
        if (region.name === 'Kanto') continue;
        const { data: maps } = await db.from('region_maps').select('id, name').eq('region_id', region.id);
        for (const map of maps) {
            const source = kantoMap[map.name];
            if (source && source.player_spawn_x != null && source.player_spawn_y != null) {
                const { error } = await db.from('region_maps').update({ player_spawn_x: source.player_spawn_x, player_spawn_y: source.player_spawn_y }).eq('id', map.id);
                if (error) console.error(`Erro ao atualizar ${map.name}:`, error);
                else count++;
            }
        }
    }

    console.log(`Player spawns copiados: ${count} mapas atualizados`);
};
console.log('Execute: copyPlayerSpawns()');
