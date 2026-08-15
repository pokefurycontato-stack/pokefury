// ============================================================
// SpawnFilter — controla quais pokemons spawnam no mundo.
// Padrão: evoluções NUNCA spawnam (só a 1a forma).
// Evento de evolução (game_events.event_type='evo', status='active',
// config.biome) libera evoluções apenas no bioma configurado.
// ============================================================
(function () {
    const evolutionIds = new Set();
    let evolutionIdsLoaded = false;
    let evolutionIdsLoading = null;

    const evoBiomes = new Set();
    let evoBiomesTime = 0;
    const EVO_CACHE_TTL = 10000;

    async function getEvolutionIds() {
        if (evolutionIdsLoaded) return evolutionIds;
        if (evolutionIdsLoading) return evolutionIdsLoading;
        evolutionIdsLoading = (async () => {
            try {
                if (!window.db) return evolutionIds;
                const { data } = await window.db.from('pokemon_evolutions').select('to_pokemon_id');
                evolutionIds.clear();
                for (const r of data || []) {
                    if (r && r.to_pokemon_id != null) evolutionIds.add(String(r.to_pokemon_id));
                }
                evolutionIdsLoaded = true;
            } catch (e) {
                console.warn('[SpawnFilter] Falha ao carregar evolucoes:', e);
            }
            evolutionIdsLoading = null;
            return evolutionIds;
        })();
        return evolutionIdsLoading;
    }

    async function getEvoUnlockedBiomes() {
        const now = Date.now();
        if (evoBiomesTime === 0 || now - evoBiomesTime > EVO_CACHE_TTL) {
            try {
                if (!window.db) return evoBiomes;
                const { data } = await window.db
                    .from('game_events')
                    .select('config')
                    .eq('event_type', 'evo')
                    .eq('status', 'active');
                evoBiomes.clear();
                for (const e of data || []) {
                    const b = String(e.config?.biome || '').trim().toLowerCase();
                    if (b) evoBiomes.add(b);
                }
                evoBiomesTime = now;
            } catch (err) {
                console.warn('[SpawnFilter] Falha ao carregar eventos de evolucao:', err);
            }
        }
        return evoBiomes;
    }

    window.SpawnFilter = {
        async isEvolution(pokemonId) {
            if (pokemonId == null) return false;
            const ids = await getEvolutionIds();
            return ids.has(String(pokemonId));
        },
        async isBiomeUnlocked(biome) {
            if (!biome) return false;
            const unlocked = await getEvoUnlockedBiomes();
            return unlocked.has(String(biome).trim().toLowerCase());
        },
        async filterEncounters(encounters, biome) {
            if (!Array.isArray(encounters) || encounters.length === 0) return encounters;
            const unlocked = await this.isBiomeUnlocked(biome);
            if (unlocked) return encounters;
            const ids = await getEvolutionIds();
            if (ids.size === 0) return encounters;
            return encounters.filter(e => e && e.pokemon_id != null && !ids.has(String(e.pokemon_id)));
        },
        async filterPokemonList(list) {
            if (!Array.isArray(list) || list.length === 0) return list;
            const ids = await getEvolutionIds();
            if (ids.size === 0) return list;
            return list.filter(p => p && (p.id == null || !ids.has(String(p.id))));
        },
        invalidate() {
            evoBiomesTime = 0;
            evolutionIdsLoaded = false;
            evolutionIds.clear();
        }
    };
})();
