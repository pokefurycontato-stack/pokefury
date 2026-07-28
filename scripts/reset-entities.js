// ============================================================
// RESET MAP ENTITIES TO USE NEW SPAWN ZONES
// Deletes all map_pokemon_entities so they respawn at correct positions
// Run in browser console on the PokeFury page
// ============================================================

(async () => {
    const db = window.db;
    if (!db) { console.error('window.db not found'); return; }

    console.log('[ResetEntities] Deleting all map_pokemon_entities...');

    const { data, error } = await db.from('map_pokemon_entities').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
        console.error('[ResetEntities] Error:', error);
    } else {
        console.log('[ResetEntities] Done! All entities deleted. Next map load will respawn at correct positions.');
    }
})();
