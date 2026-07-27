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

    // Generation ranges: region name → [min_id, max_id]
    const GENS = {
        'Kanto':  [1, 151],
        'Johto':  [152, 251],
        'Hoenn':  [252, 386],
        'Sinnoh': [387, 493],
        'Unova':  [494, 649],
        'Kalos':  [650, 721],
        'Alola':  [722, 809],
        'Galar':  [810, 905],
        'Hisui':  [387, 493],
        'Paldea': [906, 1025]
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

    // 2) Load all pokemon (only variant=normal) WITH STATS for rarity calculation
    const { data: allPokemon, error: pokeErr } = await db.from('pokemon')
        .select('id, name, types, variant, hp, attack, defense, sp_atk, sp_def, speed')
        .eq('variant', 'normal');
    if (pokeErr) { console.error('Failed to load pokemon:', pokeErr); return; }
    console.log(`[Biomes] Found ${allPokemon.length} pokemon with variant=normal`);

    // Helper: Starter Pokemon ID ranges (each gen: 3 starters × 3 evolutions = 9 IDs)
    const STARTER_IDS = new Set();
    const STARTER_RANGES = [
        [1, 9],       // Gen 1: Bulbasaur-venusaur, Charmander-charizard, Squirtle-blastoise
        [152, 160],   // Gen 2: Chikorita-meganium, Cyndaquil-typhlosion, Totodile-feraligatr
        [252, 260],   // Gen 3: Treecko-sceptile, Torchic-blaziken, Mudkip-swampert
        [387, 395],   // Gen 4: Turtwig-torterra, Chimchar-infernape, Piplup-empoleon
        [495, 503],   // Gen 5: Snivy-serperior, Tepig-emboar, Oshawott-samurott
        [650, 658],   // Gen 6: Chespin-chesnaught, Fennekin-delphox, Froakie-greninja
        [722, 730],   // Gen 7: Rowlet-decidueye, Litten-incineroar, Popplio-primarina
        [810, 818],   // Gen 8: Grookey-rillaboom, Scorbunny-cinderace, Sobble-inteleon
        [906, 914]    // Gen 9: Sprigatito-meowscarada, Fuecoco-skeledirge, Quaxly-quaquaval
    ];
    for (const [min, max] of STARTER_RANGES) {
        for (let i = min; i <= max; i++) STARTER_IDS.add(i);
    }

    // Helper: calculate rarity from base stat total
    function getRarity(p) {
        if (STARTER_IDS.has(p.id)) return 'inicial';
        const bst = (p.hp || 0) + (p.attack || 0) + (p.defense || 0) + (p.sp_atk || 0) + (p.sp_def || 0) + (p.speed || 0);
        if (bst >= 600) return 'legendary';
        if (bst >= 500) return 'rare';
        if (bst >= 400) return 'uncommon';
        return 'common';
    }
    const RARITY_WEIGHTS = { common: 50, uncommon: 30, rare: 15, legendary: 5, inicial: 5 };

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

    // 5.5) Delete ALL existing map_encounters to start fresh
    console.log('[Biomes] Clearing all existing encounters...');
    const { error: delErr } = await db.from('map_encounters').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (delErr) {
        console.error('[Biomes] Failed to delete existing encounters:', delErr);
        return;
    }
    existingSet.clear();
    console.log('[Biomes] All encounters cleared');

    // 6) For each region, create encounters for each biome map
    let totalInserted = 0;

    for (const region of regions) {
        const genRange = GENS[region.name];
        if (!genRange) {
            console.warn(`[Biomes] No gen range for "${region.name}", skipping`);
            continue;
        }
        const [minId, maxId] = genRange;

        // Get this region's maps
        const regionMaps = allMaps.filter(m => m.region_id === region.id);
        console.log(`[Biomes] ${region.name} (IDs ${minId}-${maxId}): ${regionMaps.length} maps`);

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
                .map(p => {
                    const rarity = getRarity(p);
                    return {
                        map_id: map.id,
                        pokemon_name: p.name,
                        pokemon_id: p.id,
                        weight: RARITY_WEIGHTS[rarity],
                        min_level: minLvl,
                        max_level: maxLvl,
                        is_shiny: false,
                        sprite_url: `${ANIMATED_URL}/${p.id}.gif`,
                        rarity: rarity
                    };
                });

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
