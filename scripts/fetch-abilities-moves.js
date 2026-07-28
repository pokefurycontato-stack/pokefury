// ============================================================
// FETCH ABILITIES & MOVES FROM POKEAPI
// Run in browser console on the PokeFury page (logged in as admin)
// Fetches abilities and moves for ALL pokemon in the database
// ============================================================

window.fetchAbilitiesAndMoves = async function() {
    const db = window.db;
    const DELAY = 200;

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    async function fetchJSON(url) {
        const res = await fetch(url);
        if (!res.ok) return null;
        return res.json();
    }

    // 1) Get all pokemon IDs from our database
    console.log('[Fetch] Loading pokemon from database...');
    const { data: allPokemon } = await db.from('pokemon').select('id, name');
    if (!allPokemon || allPokemon.length === 0) {
        console.error('[Fetch] No pokemon in database!');
        return;
    }
    console.log(`[Fetch] Found ${allPokemon.length} pokemon in database`);

    // 2) Fetch ALL abilities from PokeAPI (there are ~360)
    console.log('[Fetch] Fetching all abilities from PokeAPI...');
    const abilityListRes = await fetchJSON('https://pokeapi.co/api/v2/ability?limit=1000');
    const abilityList = abilityListRes?.results || [];
    console.log(`[Fetch] Found ${abilityList.length} abilities in PokeAPI`);

    const abilityMap = {};
    let abilityCount = 0;

    for (const ab of abilityList) {
        const id = parseInt(ab.url.split('/').filter(Boolean).pop());
        const data = await fetchJSON(ab.url);
        if (!data) continue;

        const effectEntry = data.effect_entries?.find(e => e.language?.name === 'en');
        abilityMap[ab.name] = {
            id: data.id,
            name: data.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            effect: effectEntry?.short_effect || ''
        };

        // Upsert ability
        await db.from('abilities').upsert({
            id: data.id,
            name: abilityMap[ab.name].name,
            generation: data.generation?.url ? parseInt(data.generation.url.split('/').filter(Boolean).pop()) : null,
            effect: abilityMap[ab.name].effect
        }, { onConflict: 'id' });

        abilityCount++;
        if (abilityCount % 50 === 0) console.log(`[Fetch] Abilities: ${abilityCount}/${abilityList.length}`);
        await sleep(50);
    }
    console.log(`[Fetch] Done! ${abilityCount} abilities saved`);

    // 3) Fetch abilities + moves for each pokemon
    console.log('[Fetch] Fetching abilities and moves for each pokemon...');
    let processed = 0;
    let abilitiesInserted = 0;
    let movesInserted = 0;

    for (const poke of allPokemon) {
        const data = await fetchJSON(`https://pokeapi.co/api/v2/pokemon/${poke.id}`);
        if (!data) { processed++; continue; }

        // Abilities
        for (const ab of (data.abilities || [])) {
            const abilityId = parseInt(ab.ability.url.split('/').filter(Boolean).pop());
            await db.from('pokemon_abilities').upsert({
                pokemon_id: poke.id,
                ability_id: abilityId,
                is_hidden: ab.is_hidden || false,
                slot: ab.slot || 1
            }, { onConflict: 'pokemon_id,ability_id' });
            abilitiesInserted++;
        }

        // Moves - get latest version group
        const moveVersions = {};
        for (const m of (data.moves || [])) {
            const moveId = parseInt(m.move.url.split('/').filter(Boolean).pop());
            const details = m.version_group_details || [];

            // Pick the latest version group
            let bestDetail = null;
            for (const d of details) {
                if (!bestDetail || d.version_group.name > bestDetail.version_group.name) {
                    bestDetail = d;
                }
            }

            if (bestDetail) {
                const method = bestDetail.move_learn_method.name;
                const level = bestDetail.level_learned_at;

                // Only keep: level-up, machine, egg, tutor
                if (['level-up', 'machine', 'egg', 'tutor'].includes(method)) {
                    await db.from('pokemon_moves_v2').upsert({
                        pokemon_id: poke.id,
                        move_id: moveId,
                        learn_method: method,
                        level_learned: level
                    }, { onConflict: 'pokemon_id,move_id,learn_method' });
                    movesInserted++;
                }
            }
        }

        processed++;
        if (processed % 10 === 0) console.log(`[Fetch] Pokemon: ${processed}/${allPokemon.length} (abilities: ${abilitiesInserted}, moves: ${movesInserted})`);
        await sleep(DELAY);
    }

    console.log(`[Fetch] COMPLETE! ${processed} pokemon processed, ${abilitiesInserted} abilities, ${movesInserted} moves`);
};
console.log('Script loaded. Execute: fetchAbilitiesAndMoves()');
