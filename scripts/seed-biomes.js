// ============================================================
// BIOME ENCOUNTERS SEEDER
// Run this in the browser console on the PokeFury page
// Make sure you are logged in as admin
// ============================================================

(async () => {
    const db = window.db;
    if (!db) { console.error('window.db not found. Are you on the PokeFury page?'); return; }

    const SUPABASE_URL = window.SUPABASE_URL;
    const ANIMATED_URL = `${SUPABASE_URL}/storage/v1/object/public/sprites/animated-front`;

    // Biome definitions: name → array of matching types
    const BIOMES = {
        'Floresta':   ['grass', 'bug', 'poison', 'normal'],
        'Montanha':   ['ground', 'rock', 'fighting'],
        'Torre':      ['ghost', 'psychic', 'dark', 'fairy'],
        'Industrial': ['steel', 'electric'],
        'Penhasco':   ['dragon', 'flying'],
        'Praia':      ['water'],
        'Vulcao':     ['fire'],
        'Geleira':    ['ice']
    };

    // Generation ranges: sort_order → [min_id, max_id]
    const GENS = {
        1: [1, 151],     // Kanto
        2: [152, 251],   // Johto
        3: [252, 386],   // Hoenn
        4: [387, 493],   // Sinnoh
        5: [494, 649],   // Unova
        6: [650, 721],   // Kalos
        7: [722, 809],   // Alola
        8: [810, 905],   // Galar
        9: [906, 1025]   // Paldea
    };

    // Level ranges per biome
    const LEVELS = {
        'Floresta':   [3, 15],
        'Montanha':   [5, 20],
        'Torre':      [7, 25],
        'Industrial': [5, 20],
        'Penhasco':   [7, 25],
        'Praia':      [3, 15],
        'Vulcao':     [8, 30],
        'Geleira':    [6, 25]
    };

    console.log('[Biomes] Starting encounter seed...');

    // 1) Load all regions
    const { data: regions, error: regErr } = await db.from('regions').select('*').order('sort_order');
    if (regErr) { console.error('Failed to load regions:', regErr); return; }
    console.log(`[Biomes] Found ${regions.length} regions:`, regions.map(r => `${r.name} (sort=${r.sort_order})`));

    // 2) Load all pokemon (only variant=normal)
    const { data: allPokemon, error: pokeErr } = await db.from('pokemon')
        .select('id, name, types, variant')
        .eq('variant', 'normal');
    if (pokeErr) { console.error('Failed to load pokemon:', pokeErr); return; }
    console.log(`[Biomes] Found ${allPokemon.length} pokemon with variant=normal`);

    // Debug: show first 5 pokemon types
    console.log('[Biomes] Sample pokemon types:', allPokemon.slice(0, 5).map(p => `${p.name}: ${JSON.stringify(p.types)}`));

    // 3) Load all region_maps
    const { data: allMaps, error: mapErr } = await db.from('region_maps').select('*');
    if (mapErr) { console.error('Failed to load maps:', mapErr); return; }
    console.log(`[Biomes] Found ${allMaps.length} maps:`, allMaps.map(m => m.name));

    // 4) Load existing encounters to avoid duplicates
    const { data: existing } = await db.from('map_encounters').select('map_id, pokemon_id');
    const existingSet = new Set((existing || []).map(e => `${e.map_id}_${e.pokemon_id}`));
    console.log(`[Biomes] Found ${existingSet.size} existing encounters`);

    // 5) For each region, create encounters for each biome map
    let totalInserted = 0;

    for (const region of regions) {
        const genRange = GENS[region.sort_order];
        if (!genRange) {
            console.warn(`[Biomes] No gen range for sort_order=${region.sort_order}, skipping ${region.name}`);
            continue;
        }
        const [minId, maxId] = genRange;

        // Get this region's maps
        const regionMaps = allMaps.filter(m => m.region_id === region.id);
        console.log(`[Biomes] ${region.name} (gen ${region.sort_order}, IDs ${minId}-${maxId}): ${regionMaps.length} maps`);

        // Filter pokemon for this generation
        const genPokemon = allPokemon.filter(p => p.id >= minId && p.id <= maxId);
        console.log(`[Biomes] ${region.name}: ${genPokemon.length} pokemon in generation range`);

        for (const map of regionMaps) {
            const biomeTypes = BIOMES[map.name];
            if (!biomeTypes) {
                console.warn(`[Biomes] No biome types for "${map.name}", skipping`);
                continue;
            }

            const [minLvl, maxLvl] = LEVELS[map.name] || [3, 15];

            // Find pokemon that have at least one matching type
            const matching = genPokemon.filter(p => {
                if (!p.types || !Array.isArray(p.types)) return false;
                return p.types.some(t => biomeTypes.includes(t));
            });

            if (matching.length === 0) {
                console.warn(`[Biomes] No matching pokemon for ${map.name} in ${region.name}`);
                continue;
            }

            // Build encounter rows, skip duplicates
            const rows = matching
                .filter(p => !existingSet.has(`${map.id}_${p.id}`))
                .map(p => ({
                    map_id: map.id,
                    pokemon_name: p.name,
                    pokemon_id: p.id,
                    weight: 50,
                    min_level: minLvl,
                    max_level: maxLvl,
                    is_shiny: false,
                    sprite_url: `${ANIMATED_URL}/${p.id}.gif`
                }));

            if (rows.length === 0) {
                console.log(`[Biomes] ${map.name} (${region.name}): all encounters already exist`);
                continue;
            }

            // Insert in batches of 50
            for (let i = 0; i < rows.length; i += 50) {
                const batch = rows.slice(i, i + 50);
                const { error: insErr } = await db.from('map_encounters').insert(batch);
                if (insErr) {
                    console.error(`[Biomes] Insert error for ${map.name}:`, insErr);
                } else {
                    totalInserted += batch.length;
                }
            }

            console.log(`[Biomes] ${map.name} (${region.name}): ${rows.length} encounters inserted (${matching.length} total matching pokemon)`);
        }
    }

    console.log(`[Biomes] Done! Total encounters inserted: ${totalInserted}`);
})();
