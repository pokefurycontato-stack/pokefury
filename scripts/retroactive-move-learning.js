// ============================================================
// RETROACTIVE MOVE LEARNING FOR EXISTING POKEMON
// Run in browser console on the PokeFury page (logged in as admin)
// Teaches moves that pokemon should have learned at their current level
// based on the latest generation data
// ============================================================

window.retroactiveMoveLearning = async function() {
    const db = window.db;
    const DELAY = 50;

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    console.log('='.repeat(50));
    console.log('[Retro] Starting retroactive move learning...');
    console.log('='.repeat(50));

    // 1) Get all pokemon from pokemon_team table
    console.log('[Retro] Fetching all pokemon from database...');
    const { data: allPokemon, error } = await db
        .from('pokemon_team')
        .select('id, pokemon_id, level, moves, character_id');

    if (error) {
        console.error('[Retro] Error fetching pokemon:', error);
        return;
    }

    console.log(`[Retro] Found ${allPokemon.length} pokemon to check`);

    let totalMovesLearned = 0;
    let pokemonUpdated = 0;

    // 2) For each pokemon, check what moves they should know
    for (const pokemon of allPokemon) {
        const speciesId = pokemon.pokemon_id;
        const currentLevel = pokemon.level;
        const currentMoves = pokemon.moves || [];

        if (!speciesId || !currentLevel) {
            await sleep(DELAY);
            continue;
        }

        // Get all level-up moves this pokemon should know at its current level
        const { data: shouldKnowMoves, error: moveError } = await db
            .from('pokemon_moves_v2')
            .select('move_id, level_learned')
            .eq('pokemon_id', speciesId)
            .eq('learn_method', 'level-up')
            .lte('level_learned', currentLevel)
            .order('level_learned');

        if (moveError || !shouldKnowMoves || shouldKnowMoves.length === 0) {
            await sleep(DELAY);
            continue;
        }

        // Get move details for moves it should know
        const moveIds = shouldKnowMoves.map(m => m.move_id);
        const { data: moveDetails } = await db
            .from('moves')
            .select('id, name, type, category, power, accuracy, pp')
            .in('id', moveIds);

        if (!moveDetails || moveDetails.length === 0) {
            await sleep(DELAY);
            continue;
        }

        // Find moves it doesn't know yet
        // currentMoves format: [{id: 1, pp: 10}, {id: 2, pp: 15}]
        const movesToLearn = [];
        for (const move of moveDetails) {
            const alreadyKnows = currentMoves.some(m => Number(m.id) === move.id);
            if (!alreadyKnows) {
                movesToLearn.push({
                    id: move.id,
                    name: move.name,
                    type: move.type,
                    category: move.category || 'physical',
                    power: move.power || 0,
                    accuracy: move.accuracy || 100,
                    pp: move.pp || 35
                });
            }
        }

        // Teach missing moves (add to beginning of move list, keep max 4)
        if (movesToLearn.length > 0) {
            // Create new moves array: new moves first, then existing, max 4
            const newMovesForDb = movesToLearn.map(m => ({ id: m.id, pp: m.pp || 35 }));
            const allMoves = [...newMovesForDb, ...currentMoves].slice(0, 4);

            const { error: updateError } = await db
                .from('pokemon_team')
                .update({ moves: allMoves })
                .eq('id', pokemon.id);

            if (!updateError) {
                totalMovesLearned += movesToLearn.length;
                pokemonUpdated++;
                console.log(`[Retro] Pokemon #${speciesId} (Lv.${currentLevel}) learned ${movesToLearn.length} moves: ${movesToLearn.map(m => m.name).join(', ')}`);
            } else {
                console.error(`[Retro] Error updating pokemon ${pokemon.id}:`, updateError);
            }
        }

        await sleep(DELAY);
    }

    console.log('='.repeat(50));
    console.log('[Retro] COMPLETE!');
    console.log(`[Retro] Pokemon checked: ${allPokemon.length}`);
    console.log(`[Retro] Pokemon updated: ${pokemonUpdated}`);
    console.log(`[Retro] Total moves learned: ${totalMovesLearned}`);
    console.log('='.repeat(50));
};

console.log('Script loaded. Execute: retroactiveMoveLearning()');
