// ============================================================
// SYNC POKEMON MOVES WITH LATEST GENERATION DATA FROM POKEAPI
// Run in browser console on the PokeFury page (logged in as admin)
// Fetches ALL moves and their learn methods for all 1025 pokemon
// Uses batch upserts for performance
// ============================================================

window.syncMovesLatestGen = async function() {
    const db = window.db;
    const DELAY = 100; // Delay between API calls to avoid rate limiting
    const POKEMON_TOTAL = 1025; // Total number of pokemon to process

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    async function fetchJSON(url) {
        try {
            const res = await fetch(url);
            if (!res.ok) {
                console.warn(`[Sync] HTTP ${res.status} for ${url}`);
                return null;
            }
            return await res.json();
        } catch (err) {
            console.error(`[Sync] Fetch error for ${url}:`, err.message);
            return null;
        }
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
            if (error) console.error(`[Sync] Upsert error on ${table}:`, error);
            await sleep(50);
        }
    }

    // ============================================================
    // PHASE 1: FETCH ALL MOVES FROM POKEAPI
    // ============================================================
    console.log('[Sync] Phase 1: Fetching all moves from PokeAPI...');
    const moveListRes = await fetchJSON('https://pokeapi.co/api/v2/move?limit=1000');
    const moveList = moveListRes?.results || [];
    console.log(`[Sync] Found ${moveList.length} moves in PokeAPI`);

    // Fetch all move details in batches
    const moveRows = [];
    for (let i = 0; i < moveList.length; i += 20) {
        const batch = moveList.slice(i, i + 20);
        const results = await Promise.all(batch.map(async m => {
            const data = await fetchJSON(m.url);
            if (!data) return null;

            // Extract type name (e.g., "fire", "water")
            const typeName = data.type?.name || null;

            // Extract category from damage_class (physical, special, status)
            const category = data.damage_class?.name || null;

            // Extract power, accuracy, pp
            const power = data.power || 0;
            const accuracy = data.accuracy || 0;
            const pp = data.pp || 0;

            return {
                id: data.id,
                name: data.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                type: typeName,
                category: category,
                power: power,
                accuracy: accuracy,
                pp: pp
            };
        }));
        moveRows.push(...results.filter(Boolean));

        if ((i + 20) % 100 === 0) {
            console.log(`[Sync] Moves fetched: ${Math.min(i + 20, moveList.length)}/${moveList.length}`);
        }
        await sleep(100);
    }

    console.log(`[Sync] Upserting ${moveRows.length} moves into database...`);
    await batchUpsert('moves', moveRows, 'id');
    console.log(`[Sync] Phase 1 complete: ${moveRows.length} moves saved`);

    // ============================================================
    // PHASE 2: FETCH MOVE LEARN DATA FOR ALL POKEMON
    // ============================================================
    console.log('[Sync] Phase 2: Fetching move learn data for all pokemon...');
    const VG_ORDER = [
        'red-blue','yellow','gold-silver','crystal',
        'ruby-sapphire','emerald','firered-leafgreen',
        'diamond-pearl','platinum','heartgold-soulsilver',
        'black-white','black-2-white-2',
        'x-y','omega-ruby-alpha-sapphire',
        'sun-moon','ultra-sun-ultra-moon',
        'lets-go-pikachu-lets-go-eevee',
        'sword-shield','the-isle-of-armor','the-crown-tundra',
        'brilliant-diamond-shining-pearl','legends-arceus',
        'scarlet-violet','the-teal-mask','the-indigo-disk'
    ];
    function vgIndex(name) { const i = VG_ORDER.indexOf(name); return i >= 0 ? i : -1; }

    const allMoveRows = [];
    let processed = 0;

    for (let pokemonId = 1; pokemonId <= POKEMON_TOTAL; pokemonId++) {
        const data = await fetchJSON(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
        if (!data) {
            processed++;
            if (processed % 50 === 0) {
                console.log(`[Sync] Pokemon progress: ${processed}/${POKEMON_TOTAL}`);
            }
            continue;
        }

        for (const m of (data.moves || [])) {
            const moveId = parseInt(m.move.url.split('/').filter(Boolean).pop());
            const details = m.version_group_details || [];

            let bestDetail = null;
            for (const d of details) {
                if (!bestDetail || vgIndex(d.version_group.name) > vgIndex(bestDetail.version_group.name)) {
                    bestDetail = d;
                }
            }

            if (bestDetail) {
                const method = bestDetail.move_learn_method.name;
                const level = bestDetail.level_learned_at;

                // Only include valid learn methods
                if (['level-up', 'machine', 'egg', 'tutor'].includes(method)) {
                    allMoveRows.push({
                        pokemon_id: pokemonId,
                        move_id: moveId,
                        learn_method: method,
                        level_learned: level
                    });
                }
            }
        }

        processed++;
        if (processed % 50 === 0) {
            console.log(`[Sync] Pokemon progress: ${processed}/${POKEMON_TOTAL} (${allMoveRows.length} moves collected)`);
        }
        await sleep(DELAY);
    }

    // ============================================================
    // PHASE 3: DEDUPLICATE AND UPSERT POKEMON MOVES
    // ============================================================
    console.log('[Sync] Phase 3: Deduplicating and upserting pokemon moves...');

    // Deduplicate: same pokemon + move + learn_method should only appear once
    const dedupeMoves = [];
    const seenMoves = new Set();
    for (const r of allMoveRows) {
        const key = `${r.pokemon_id}|${r.move_id}|${r.learn_method}`;
        if (!seenMoves.has(key)) {
            seenMoves.add(key);
            dedupeMoves.push(r);
        }
    }
    console.log(`[Sync] Deduped moves: ${allMoveRows.length} -> ${dedupeMoves.length}`);

    // Upsert in batches
    await batchUpsert('pokemon_moves_v2', dedupeMoves, 'pokemon_id,move_id,learn_method');

    // ============================================================
    // SUMMARY
    // ============================================================
    console.log('='.repeat(50));
    console.log('[Sync] COMPLETE!');
    console.log(`[Sync] Total moves synced: ${moveRows.length}`);
    console.log(`[Sync] Total pokemon processed: ${processed}`);
    console.log(`[Sync] Total pokemon moves saved: ${dedupeMoves.length}`);
    console.log('='.repeat(50));
};

console.log('Script loaded. Execute: syncMovesLatestGen()');
