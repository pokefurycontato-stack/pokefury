// ============================================================
// COPY KANTO MAP CONFIGS TO ALL REGIONS
// Run in browser console on the PokeFury page (logged in as admin)
// Copies: image_url, collision_zones, spawn_zones, battle_bg_url,
//         battle_player_x/y, battle_enemy_x/y, battle_player_fx, battle_enemy_fx
// Does NOT copy encounters (map_encounters table)
// ============================================================

(async () => {
    const db = window.db;
    if (!db) { console.error('window.db not found'); return; }

    console.log('[CopyMaps] Starting...');

    // 1) Load all regions
    const { data: regions } = await db.from('regions').select('*').order('sort_order');
    console.log('[CopyMaps] Regions:', regions.map(r => r.name));

    // 2) Find Kanto
    const kanto = regions.find(r => r.name === 'Kanto');
    if (!kanto) { console.error('[CopyMaps] Kanto not found!'); return; }

    // 3) Load Kanto's maps
    const { data: kantoMaps } = await db.from('region_maps')
        .select('*')
        .eq('region_id', kanto.id)
        .order('sort_order');

    console.log('[CopyMaps] Kanto maps:', kantoMaps.map(m => `${m.name} (img: ${m.image_url ? 'yes' : 'no'}, coll: ${(m.collision_zones||[]).length}, spawn: ${(m.spawn_zones||[]).length}, bg: ${m.battle_bg_url ? 'yes' : 'no'}, pos: ${m.battle_player_x != null ? 'yes' : 'no'}, fx: ${m.battle_player_fx || 'none'})`));

    // 4) For each other region, update matching biome maps
    const otherRegions = regions.filter(r => r.id !== kanto.id);
    let totalUpdated = 0;

    for (const region of otherRegions) {
        const { data: regionMaps } = await db.from('region_maps')
            .select('*')
            .eq('region_id', region.id)
            .order('sort_order');

        for (const rMap of regionMaps) {
            const kMap = kantoMaps.find(k => k.name === rMap.name);
            if (!kMap) {
                console.warn(`[CopyMaps] No Kanto match for ${region.name}/${rMap.name}`);
                continue;
            }

            const update = {
                image_url: kMap.image_url,
                collision_zones: kMap.collision_zones || [],
                spawn_zones: kMap.spawn_zones || [],
                battle_bg_url: kMap.battle_bg_url || null,
                battle_player_x: kMap.battle_player_x,
                battle_player_y: kMap.battle_player_y,
                battle_enemy_x: kMap.battle_enemy_x,
                battle_enemy_y: kMap.battle_enemy_y,
                battle_player_fx: kMap.battle_player_fx || null,
                battle_enemy_fx: kMap.battle_enemy_fx || null
            };

            const { error } = await db.from('region_maps')
                .update(update)
                .eq('id', rMap.id);

            if (error) {
                console.error(`[CopyMaps] Error updating ${region.name}/${rMap.name}:`, error);
            } else {
                totalUpdated++;
                console.log(`[CopyMaps] ${region.name}/${rMap.name} <- Kanto (bg:${update.battle_bg_url?'✓':'✗'} pos:${update.battle_player_x!=null?'✓':'✗'} fx:${update.battle_player_fx||'none'})`);
            }
        }
    }

    console.log(`[CopyMaps] Done! Updated ${totalUpdated} maps across ${otherRegions.length} regions`);
})();
