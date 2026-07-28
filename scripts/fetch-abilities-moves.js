// ============================================================
// FETCH ABILITIES & MOVES FROM POKEAPI
// Run in browser console on the PokeFury page (logged in as admin)
// Uses batch inserts for speed
// ============================================================

window.fetchAbilitiesAndMoves = async function() {
    const db = window.db;
    const DELAY = 100;

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    async function fetchJSON(url) {
        const res = await fetch(url);
        if (!res.ok) return null;
        return res.json();
    }

    function chunk(arr, size) {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    }

    async function batchUpsert(table, rows, onConflict) {
        if (rows.length === 0) return;
        const chunks = chunk(rows, 500);
        for (const c of chunks) {
            const { error } = await db.from(table).upsert(c, { onConflict });
            if (error) console.error(`[Fetch] Upsert error on ${table}:`, error);
            await sleep(50);
        }
    }

    // 1) Get all pokemon IDs
    console.log('[Fetch] Loading pokemon from database...');
    const { data: allPokemon } = await db.from('pokemon').select('id');
    if (!allPokemon || allPokemon.length === 0) {
        console.error('[Fetch] No pokemon in database!');
        return;
    }
    console.log(`[Fetch] Found ${allPokemon.length} pokemon in database`);

    // 2) Fetch ALL abilities from PokeAPI
    console.log('[Fetch] Fetching all abilities from PokeAPI...');
    const abilityListRes = await fetchJSON('https://pokeapi.co/api/v2/ability?limit=1000');
    const abilityList = abilityListRes?.results || [];
    console.log(`[Fetch] Found ${abilityList.length} abilities in PokeAPI`);

    // Fetch all ability details in batches
    const abilityRows = [];
    for (let i = 0; i < abilityList.length; i += 20) {
        const batch = abilityList.slice(i, i + 20);
        const results = await Promise.all(batch.map(async ab => {
            const id = parseInt(ab.url.split('/').filter(Boolean).pop());
            const data = await fetchJSON(ab.url);
            if (!data) return null;
            const effectEntry = data.effect_entries?.find(e => e.language?.name === 'en');
            return {
                id: data.id,
                name: data.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                generation: data.generation?.url ? parseInt(data.generation.url.split('/').filter(Boolean).pop()) : null,
                effect: effectEntry?.short_effect || ''
            };
        }));
        abilityRows.push(...results.filter(Boolean));
        if ((i + 20) % 100 === 0) console.log(`[Fetch] Abilities fetched: ${Math.min(i + 20, abilityList.length)}/${abilityList.length}`);
        await sleep(100);
    }

    console.log(`[Fetch] Upserting ${abilityRows.length} abilities...`);
    await batchUpsert('abilities', abilityRows, 'id');
    console.log(`[Fetch] Done! ${abilityRows.length} abilities saved`);

    // 3) Build ability ID lookup from PokeAPI (name -> id)
    const abilityIdMap = {};
    for (const ab of abilityRows) {
        abilityIdMap[ab.name.toLowerCase().replace(/ /g, '-')] = ab.id;
    }

    // 4) Fetch abilities + moves for each pokemon in batches
    console.log('[Fetch] Fetching abilities and moves for each pokemon...');
    let processed = 0;
    const allAbilityRows = [];
    const allMoveRows = [];

    for (const poke of allPokemon) {
        const data = await fetchJSON(`https://pokeapi.co/api/v2/pokemon/${poke.id}`);
        if (!data) { processed++; continue; }

        for (const ab of (data.abilities || [])) {
            const abilityId = parseInt(ab.ability.url.split('/').filter(Boolean).pop());
            allAbilityRows.push({
                pokemon_id: poke.id,
                ability_id: abilityId,
                is_hidden: ab.is_hidden || false,
                slot: ab.slot || 1
            });
        }

        for (const m of (data.moves || [])) {
            const moveId = parseInt(m.move.url.split('/').filter(Boolean).pop());
            const details = m.version_group_details || [];
            let bestDetail = null;
            for (const d of details) {
                if (!bestDetail || d.version_group.name > bestDetail.version_group.name) {
                    bestDetail = d;
                }
            }
            if (bestDetail) {
                const method = bestDetail.move_learn_method.name;
                const level = bestDetail.level_learned_at;
                if (['level-up', 'machine', 'egg', 'tutor'].includes(method)) {
                    allMoveRows.push({
                        pokemon_id: poke.id,
                        move_id: moveId,
                        learn_method: method,
                        level_learned: level
                    });
                }
            }
        }

        processed++;
        if (processed % 50 === 0) console.log(`[Fetch] Pokemon: ${processed}/${allPokemon.length}`);
        await sleep(DELAY);
    }

    const dedupeMoves = [];
    const seenMoves = new Set();
    for (const r of allMoveRows) {
        const key = `${r.pokemon_id}|${r.move_id}|${r.learn_method}`;
        if (!seenMoves.has(key)) {
            seenMoves.add(key);
            dedupeMoves.push(r);
        }
    }
    console.log(`[Fetch] Deduped moves: ${allMoveRows.length} -> ${dedupeMoves.length}`);

    console.log(`[Fetch] Upserting ${allAbilityRows.length} pokemon abilities...`);
    await batchUpsert('pokemon_abilities', allAbilityRows, 'pokemon_id,ability_id');
    console.log(`[Fetch] Upserting ${dedupeMoves.length} pokemon moves...`);
    await batchUpsert('pokemon_moves_v2', dedupeMoves, 'pokemon_id,move_id,learn_method');

    console.log(`[Fetch] COMPLETE! ${processed} pokemon, ${abilityRows.length} abilities, ${allAbilityRows.length} pokemon abilities, ${dedupeMoves.length} moves`);
};
console.log('Script loaded. Execute: fetchAbilitiesAndMoves()');
