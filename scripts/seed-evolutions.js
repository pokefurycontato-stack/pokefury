// ============================================================
// SEED POKEMON EVOLUTIONS FROM POKEAPI
// Run in browser console on PokeFury (logged in as admin)
// Creates the table if needed, then fetches evolution data
// ============================================================

(async () => {
    const db = window.db;
    if (!db) { console.error('window.db not found!'); return; }

    console.log('[Evo] Checking pokemon_evolutions table...');

    // Try to query the table first
    const { error: checkErr } = await db.from('pokemon_evolutions').select('id').limit(1);
    if (checkErr && checkErr.message.includes('does not exist')) {
        console.log('[Evo] Table does not exist. Creating via SQL...');
        // We can't create tables via JS client, need to run SQL
        console.error('[Evo] Please run this SQL in Supabase Dashboard first:');
        console.error(`
CREATE TABLE IF NOT EXISTS pokemon_evolutions (
    id SERIAL PRIMARY KEY,
    from_pokemon_id INTEGER REFERENCES pokemon(id),
    to_pokemon_id INTEGER REFERENCES pokemon(id),
    evolution_method TEXT,
    evolution_value TEXT,
    held_item TEXT,
    trade_pokemon BOOLEAN DEFAULT false,
    min_happiness INTEGER DEFAULT 0,
    min_level INTEGER DEFAULT 0,
    time_of_day TEXT
);
ALTER TABLE pokemon_evolutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evo_select" ON pokemon_evolutions FOR SELECT USING (true);
CREATE POLICY "evo_insert" ON pokemon_evolutions FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE INDEX IF NOT EXISTS idx_evo_from ON pokemon_evolutions(from_pokemon_id);
        `);
        return;
    }

    console.log('[Evo] Table exists. Fetching evolution chains from PokeAPI...');

    // Get all pokemon IDs from our DB
    const { data: allPokemon } = await db.from('pokemon').select('id').order('id');
    if (!allPokemon || allPokemon.length === 0) { console.error('No pokemon in DB!'); return; }
    console.log(`[Evo] Found ${allPokemon.length} pokemon in DB`);

    // Get existing evolutions to avoid duplicates
    const { data: existing } = await db.from('pokemon_evolutions').select('from_pokemon_id');
    const existingIds = new Set((existing || []).map(e => e.from_pokemon_id));
    console.log(`[Evo] ${existingIds.size} pokemon already have evolution data`);

    // Fetch evolution chains - get unique chain URLs from PokeAPI species endpoints
    // We'll process pokemon that don't have evolution data yet
    const toProcess = allPokemon.filter(p => !existingIds.has(p.id));
    console.log(`[Evo] Processing ${toProcess.length} pokemon...`);

    let inserted = 0;
    let errors = 0;
    const processedChains = new Set();

    // Process in batches to avoid rate limiting
    for (let i = 0; i < toProcess.length; i++) {
        const poke = toProcess[i];

        try {
            // Get species data to find evolution chain URL
            const resp = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${poke.id}`);
            if (!resp.ok) continue;
            const species = await resp.json();

            const chainUrl = species.evolution_chain?.url;
            if (!chainUrl) continue;

            // Extract chain ID from URL to deduplicate
            const chainId = chainUrl.split('/').filter(Boolean).pop();
            if (processedChains.has(chainId)) continue;
            processedChains.add(chainId);

            // Fetch the full evolution chain
            const chainResp = await fetch(chainUrl);
            if (!chainResp.ok) continue;
            const chainData = await chainResp.json();

            // Parse the chain recursively
            const evolutions = [];
            function parseChain(node) {
                if (!node) return;
                const speciesId = parseInt(node.species.url.split('/').filter(Boolean).pop());
                if (node.evolves_to && node.evolves_to.length > 0) {
                    for (const evo of node.evolves_to) {
                        const evoId = parseInt(evo.species.url.split('/').filter(Boolean).pop());
                        const details = evo.evolution_details[0] || {};
                        evolutions.push({
                            from_id: speciesId,
                            to_id: evoId,
                            method: details.trigger?.name || 'unknown',
                            value: details.min_level?.toString() || details.item?.name || details.held_item?.name || null,
                            held_item: details.held_item?.name || null,
                            trade: details.trigger?.name === 'trade',
                            min_happiness: details.min_happiness || 0,
                            min_level: details.min_level || 0,
                            time_of_day: details.time_of_day || null
                        });
                    }
                }
                for (const next of (node.evolves_to || [])) {
                    parseChain(next);
                }
            }
            parseChain(chainData.chain);

            // Insert evolutions for pokemon we have in our DB
            for (const evo of evolutions) {
                const fromExists = allPokemon.some(p => p.id === evo.from_id);
                const toExists = allPokemon.some(p => p.id === evo.to_id);
                if (!fromExists || !toExists) continue;

                const { error } = await db.from('pokemon_evolutions').insert({
                    from_pokemon_id: evo.from_id,
                    to_pokemon_id: evo.to_id,
                    evolution_method: evo.method,
                    evolution_value: evo.value,
                    held_item: evo.held_item,
                    trade_pokemon: evo.trade,
                    min_happiness: evo.min_happiness,
                    min_level: evo.min_level,
                    time_of_day: evo.time_of_day
                });

                if (!error) inserted++;
                else errors++;
            }

            if ((i + 1) % 50 === 0) console.log(`[Evo] Progress: ${i + 1}/${toProcess.length} species processed...`);

        } catch (e) {
            errors++;
        }

        // Rate limit: 50ms between requests
        await new Promise(r => setTimeout(r, 50));
    }

    console.log(`\n[DONE] ${inserted} evolutions inserted, ${errors} errors`);
    console.log(`[DONE] ${processedChains.size} unique evolution chains processed`);
})();
