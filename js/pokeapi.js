const PokeAPI = {
    pokemonCache: {},
    moveCache: {},
    imageCache: {},
    megaEvoCache: null,

    get supabaseStorageUrl() {
        return `${window.SUPABASE_URL}/storage/v1/object/public/sprites`;
    },

    getAnimatedFrontUrl(pokemonId) {
        return `${this.supabaseStorageUrl}/animated-front/${pokemonId}.gif`;
    },

    getBestSpriteUrl(pokemonData) {
        if (pokemonData.sprite_front) return pokemonData.sprite_front;
        if (pokemonData.id) return this.getAnimatedFrontUrl(pokemonData.id);
        return null;
    },

    async init() {
        console.log('[PokeAPI] Initialized with Supabase backend');
    },

    async ensurePokemon(idOrName) {
        const key = String(idOrName).toLowerCase();
        if (this.pokemonCache[key]) return this.pokemonCache[key];

        console.log('[PokeAPI] Fetching pokemon from Supabase:', key);

        let data = null;
        let error = null;

        if (typeof idOrName === 'number' || /^\d+$/.test(String(idOrName))) {
            const result = await window.db
                .from('pokemon')
                .select('*')
                .eq('id', Number(idOrName))
                .single();
            data = result.data;
            error = result.error;
        } else {
            const result = await window.db
                .from('pokemon')
                .select('*')
                .ilike('name', key)
                .single();
            data = result.data;
            error = result.error;
        }

        if (error || !data) {
            console.warn('[PokeAPI] Pokemon not found:', key, error);
            return this.getFallbackPokemon(idOrName);
        }

        const pokemonData = this.transformPokemon(data);
        this.pokemonCache[pokemonData.id] = pokemonData;
        this.pokemonCache[pokemonData.name.toLowerCase()] = pokemonData;
        this.pokemonCache[pokemonData.species] = pokemonData;

        return pokemonData;
    },

    transformPokemon(row) {
        return {
            id: row.id,
            name: row.name,
            species: row.name.toLowerCase(),
            types: row.types,
            baseStats: {
                hp: row.hp,
                attack: row.attack,
                defense: row.defense,
                spAtk: row.sp_atk,
                spDef: row.sp_def,
                speed: row.speed
            },
            spriteUrls: {
                front: row.sprite_front,
                back: row.sprite_back,
                official: row.sprite_official,
                home: row.sprite_home
            },
            shinySpriteUrls: {
                front: row.sprite_front_shiny,
                back: row.sprite_back_shiny,
                official: row.sprite_official_shiny,
                home: row.sprite_home_shiny
            },
            model3d: row.model_3d || null,
            model3dShiny: row.model_3d_shiny || null,
            variant: row.variant || 'normal',
            basePokemonId: row.base_pokemon_id || null,
            megaStone: row.mega_stone || null,
            moveNames: []
        };
    },

    async ensurePokemonMoves(pokemonId) {
        const { data, error } = await window.db
            .from('pokemon_moves')
            .select('move_id')
            .eq('pokemon_id', pokemonId);

        if (error || !data || data.length === 0) return [];

        const moveIds = data.map(r => r.move_id);
        const results = [];

        for (const moveId of moveIds) {
            const move = await this.ensureMoveById(moveId);
            if (move && move.power > 0) results.push(move);
        }

        return results.slice(0, 15);
    },

    async ensureMoveById(id) {
        const key = 'id_' + id;
        if (this.moveCache[key]) return this.moveCache[key];

        const { data, error } = await window.db
            .from('moves')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) return null;

        const moveData = {
            id: data.id,
            name: data.name,
            type: data.type,
            category: data.category,
            power: data.power,
            accuracy: data.accuracy,
            pp: data.pp
        };

        this.moveCache[key] = moveData;
        this.moveCache[data.name.toLowerCase().replace(/\s+/g, '-')] = moveData;
        return moveData;
    },

    async ensureMove(name) {
        const key = name.toLowerCase().replace(/\s+/g, '-');
        if (this.moveCache[key]) return this.moveCache[key];

        const { data, error } = await window.db
            .from('moves')
            .select('*')
            .ilike('name', name)
            .single();

        if (error || !data) return null;

        const moveData = {
            id: data.id,
            name: data.name,
            type: data.type,
            category: data.category,
            power: data.power,
            accuracy: data.accuracy,
            pp: data.pp
        };

        this.moveCache[key] = moveData;
        this.moveCache['id_' + data.id] = moveData;
        return moveData;
    },

    async getRandomPokemon(minLevel = 2, maxLevel = 8) {
        const randomId = Math.floor(Math.random() * 1025) + 1;
        const pokemon = await this.ensurePokemon(randomId);
        const level = Math.floor(Math.random() * (maxLevel - minLevel + 1)) + minLevel;
        return { pokemon, level };
    },

    async getRandomWildPokemon(minLevel = 2, maxLevel = 8, includeVariants = false) {
        let pool = [];
        if (includeVariants) {
            const { data } = await window.db
                .from('pokemon')
                .select('id')
                .or('variant.eq.normal,variant.eq.alola,variant.eq.galar,variant.eq.hisui,variant.eq.paldea');
            pool = data || [];
        } else {
            const { data } = await window.db
                .from('pokemon')
                .select('id')
                .eq('variant', 'normal');
            pool = data || [];
        }

        if (pool.length === 0) {
            return this.getRandomPokemon(minLevel, maxLevel);
        }

        const pick = pool[Math.floor(Math.random() * pool.length)];
        const pokemon = await this.ensurePokemon(pick.id);
        const level = Math.floor(Math.random() * (maxLevel - minLevel + 1)) + minLevel;
        return { pokemon, level };
    },

    async getMegaEvolution(basePokemonId) {
        if (!this.megaEvoCache) {
            const { data } = await window.db
                .from('mega_evolutions')
                .select('*');
            this.megaEvoCache = {};
            if (data) {
                for (const row of data) {
                    if (!this.megaEvoCache[row.base_pokemon_id]) {
                        this.megaEvoCache[row.base_pokemon_id] = [];
                    }
                    this.megaEvoCache[row.base_pokemon_id].push(row);
                }
            }
        }
        return this.megaEvoCache[basePokemonId] || [];
    },

    async canMegaEvolve(pokemon, heldItemId) {
        if (pokemon.variant !== 'normal') return null;
        const megas = await this.getMegaEvolution(pokemon.id);
        if (megas.length === 0) return null;

        for (const mega of megas) {
            if (mega.mega_stone_item) {
                const { data: item } = await window.db
                    .from('items')
                    .select('name')
                    .eq('id', heldItemId)
                    .single();
                if (item && item.name === mega.mega_stone_item) {
                    return mega.mega_pokemon_id;
                }
            }
        }
        return null;
    },

    async performMegaEvolution(pokemon) {
        const megas = await this.getMegaEvolution(pokemon.id);
        if (megas.length === 0) return pokemon;

        const megaId = megas[0].mega_pokemon_id;
        const megaData = await this.ensurePokemon(megaId);
        return {
            ...pokemon,
            id: megaData.id,
            name: megaData.name,
            species: megaData.species,
            types: megaData.types,
            baseStats: megaData.baseStats,
            spriteUrls: megaData.spriteUrls,
            shinySpriteUrls: megaData.shinySpriteUrls,
            model3d: megaData.model3d,
            model3dShiny: megaData.model3dShiny,
            variant: 'mega',
            isMega: true
        };
    },

    getStarters() {
        return [1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393, 495, 498, 501, 650, 653, 656, 722, 725, 728, 810, 813, 816, 906, 909, 912];
    },

    async ensurePokemonBatch(ids) {
        const uncached = ids.filter(id => !this.pokemonCache[String(id)]);
        if (uncached.length > 0) {
            const { data } = await window.db
                .from('pokemon')
                .select('*')
                .in('id', uncached);
            if (data) {
                for (const row of data) {
                    const pokemonData = this.transformPokemon(row);
                    this.pokemonCache[pokemonData.id] = pokemonData;
                    this.pokemonCache[pokemonData.name.toLowerCase()] = pokemonData;
                    this.pokemonCache[pokemonData.species] = pokemonData;
                }
            }
        }
        return ids.map(id => this.pokemonCache[String(id)]).filter(Boolean);
    },

    preloadSprite(url) {
        if (!url) return Promise.resolve(null);
        return new Promise((resolve) => {
            if (this.imageCache[url]) {
                resolve(this.imageCache[url]);
                return;
            }
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                this.imageCache[url] = img;
                resolve(img);
            };
            img.onerror = () => {
                this.imageCache[url] = null;
                resolve(null);
            };
            img.src = url;
        });
    },

    async preloadSprites(urls) {
        return Promise.all(urls.filter(Boolean).map(url => this.preloadSprite(url)));
    },

    getSpriteUrl(pokemon, shiny = false) {
        const urls = shiny ? (pokemon.shinySpriteUrls || pokemon.spriteUrls) : pokemon.spriteUrls;
        return urls?.front || urls?.home || urls?.official || null;
    },

    getModel3dUrl(pokemon, shiny = false) {
        if (shiny) return pokemon.model3dShiny || pokemon.model3d || null;
        return pokemon.model3d || null;
    },

    getFallbackPokemon(idOrName) {
        return {
            id: typeof idOrName === 'number' ? idOrName : 0,
            name: String(idOrName),
            species: String(idOrName).toLowerCase(),
            types: ['normal'],
            baseStats: { hp: 50, attack: 50, defense: 50, spAtk: 50, spDef: 50, speed: 50 },
            spriteUrls: { front: null, official: null, home: null },
            shinySpriteUrls: { front: null, official: null, home: null },
            model3d: null,
            model3dShiny: null,
            variant: 'normal',
            basePokemonId: null,
            megaStone: null,
            moveNames: []
        };
    }
};

window.PokeAPI = PokeAPI;
