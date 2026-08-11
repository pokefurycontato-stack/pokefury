// ============================================================
// SYNC KANTO MAPS TO ALL REGIONS
// Run in browser console on PokeFury (logged in as admin)
// Uses window.db (your logged-in session)
// ============================================================

(async () => {
    const db = window.db;
    if (!db) { console.error('window.db not found! Make sure you are on the PokeFury page.'); return; }

    console.log('[Sync] Starting...');

    const { data: regions, error: e1 } = await db.from('regions').select('id, name').order('sort_order');
    if (e1) { console.error('Error loading regions:', e1); return; }
    console.log('[Sync] Regions:', regions.map(r => r.name).join(', '));

    const kanto = regions.find(r => r.name === 'Kanto');
    if (!kanto) { console.error('Kanto not found!'); return; }

    const { data: kantoMaps, error: e2 } = await db.from('region_maps')
        .select('*')
        .eq('region_id', kanto.id)
        .order('sort_order');
    if (e2) { console.error('Error loading Kanto maps:', e2); return; }

    console.log('[Sync] Kanto maps loaded:', kantoMaps.length);
    kantoMaps.forEach(m => {
        const c = (m.collision_zones || []).length;
        const s = (m.spawn_zones || []).length;
        const sp = m.player_spawn_x != null ? `spawn:(${m.player_spawn_x},${m.player_spawn_y})` : 'no spawn';
        console.log(`  ${m.name} | img:${m.image_url ? 'yes' : 'no'} | coll:${c} | spawn:${s} | ${sp}`);
    });

    const kantoByName = {};
    kantoMaps.forEach(m => { kantoByName[m.name] = m; });

    const otherRegions = regions.filter(r => r.id !== kanto.id);
    let totalUpdated = 0;
    let totalErrors = 0;

    for (const region of otherRegions) {
        const { data: regionMaps, error: e3 } = await db.from('region_maps')
            .select('id, name')
            .eq('region_id', region.id);

        if (e3) { console.error(`Error loading ${region.name}:`, e3); continue; }
        console.log(`\n[Sync] ${region.name}: ${regionMaps.length} maps`);

        for (const rMap of regionMaps) {
            const kMap = kantoByName[rMap.name];
            if (!kMap) { console.warn(`  ${rMap.name} - no match, SKIP`); continue; }

            const { error } = await db.from('region_maps')
                .update({
                    image_url: kMap.image_url,
                    collision_zones: kMap.collision_zones || [],
                    spawn_zones: kMap.spawn_zones || [],
                    battle_bg_url: kMap.battle_bg_url || null,
                    player_spawn_x: kMap.player_spawn_x,
                    player_spawn_y: kMap.player_spawn_y
                })
                .eq('id', rMap.id);

            if (error) { totalErrors++; console.error(`  ${rMap.name} ERROR:`, error.message); }
            else { totalUpdated++; console.log(`  ${rMap.name} ✓`); }
        }
    }

    console.log(`\n[DONE] ${totalUpdated} maps updated, ${totalErrors} errors`);
    console.log('Refresh the page to see changes.');
})();
