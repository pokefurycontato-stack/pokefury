// ============================================================
// RESET MAP ENTITIES - Pokemon respawn at correct positions
// Run in browser console on PokeFury (logged in)
// ============================================================

(async () => {
    const db = window.db;
    if (!db) { console.error('window.db not found!'); return; }

    console.log('[Reset] Deleting all map entities...');

    const { data, error } = await db.from('map_pokemon_entities').delete().neq('id', '00000000-0000-0000-0000-000000000000').select();

    if (error) {
        console.error('[Reset] Error:', error.message);
    } else {
        console.log(`[Reset] Done! ${data ? data.length : 0} entities deleted.`);
        console.log('[Reset] Refresh the page. Pokemon will respawn in the correct zones.');
    }
})();
