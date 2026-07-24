const PokeAPI = {
    BASE_URL: 'https://pokeapi.co/api/v2',
    CACHE_VERSION: 3,
    pokemonCache: {},
    moveCache: {},
    spriteCache: {},
    imageCache: {},
    totalPokemon: 1025,

    async init() {
        const version = localStorage.getItem('pokefury_cache_version');
        if (version !== String(this.CACHE_VERSION)) {
            localStorage.clear();
            localStorage.setItem('pokefury_cache_version', this.CACHE_VERSION);
        }
        const cached = localStorage.getItem('pokefury_pokemon_cache');
        if (cached) {
            this.pokemonCache = JSON.parse(cached);
        }
        const cachedMoves = localStorage.getItem('pokefury_move_cache');
        if (cachedMoves) {
            this.moveCache = JSON.parse(cachedMoves);
        }
        console.log('[PokeAPI] Cache initialized with', Object.keys(this.pokemonCache).length, 'pokemon and', Object.keys(this.moveCache).length, 'moves');
    },

    saveCache() {
        try {
            localStorage.setItem('pokefury_pokemon_cache', JSON.stringify(this.pokemonCache));
            localStorage.setItem('pokefury_move_cache', JSON.stringify(this.moveCache));
        } catch (e) {
            console.warn('[PokeAPI] Cache save failed, clearing old entries');
            this.pokemonCache = {};
            this.moveCache = {};
        }
    },

    async fetchJSON(url) {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
    },

    async ensurePokemon(idOrName) {
        const key = String(idOrName).toLowerCase();
        if (this.pokemonCache[key]) return this.pokemonCache[key];

        console.log('[PokeAPI] Fetching pokemon:', key);
        const raw = await this.fetchJSON(`${this.BASE_URL}/pokemon/${key}`);

        const data = this.transformPokemon(raw);
        this.pokemonCache[data.id] = data;
        if (data.name !== String(data.id)) {
            this.pokemonCache[data.name] = data;
        }
        this.saveCache();
        return data;
    },

    transformPokemon(raw) {
        const types = raw.types
            .sort((a, b) => a.slot - b.slot)
            .map(t => t.type.name);

        const stats = {};
        raw.stats.forEach(s => {
            const name = s.stat.name;
            if (name === 'hp') stats.hp = s.base_stat;
            else if (name === 'attack') stats.attack = s.base_stat;
            else if (name === 'defense') stats.defense = s.base_stat;
            else if (name === 'special-attack') stats.spAtk = s.base_stat;
            else if (name === 'special-defense') stats.spDef = s.base_stat;
            else if (name === 'speed') stats.speed = s.base_stat;
        });

        const moveNames = raw.moves.map(m => m.move.name);

        const sprites = {
            front: raw.sprites.front_default,
            official: raw.sprites.other?.['official-artwork']?.front_default || raw.sprites.front_default,
            home: raw.sprites.other?.home?.front_default || raw.sprites.other?.['official-artwork']?.front_default || raw.sprites.front_default
        };

        return {
            id: raw.id,
            name: this.capitalize(raw.name),
            species: raw.name,
            types,
            baseStats: stats,
            spriteUrls: sprites,
            moveNames: moveNames.slice(0, 20)
        };
    },

    async ensureMove(name) {
        const key = name.toLowerCase().replace(/\s+/g, '-');
        if (this.moveCache[key]) return this.moveCache[key];

        console.log('[PokeAPI] Fetching move:', key);
        const raw = await this.fetchJSON(`${this.BASE_URL}/move/${key}`);

        const data = {
            id: raw.id,
            name: this.capitalize(raw.name),
            type: raw.type.name,
            category: raw.damage_class.name,
            power: raw.power || 0,
            accuracy: raw.accuracy || 100,
            pp: raw.pp,
            effectChance: raw.effect_chance
        };

        this.moveCache[key] = data;
        this.saveCache();
        return data;
    },

    async ensureMoves(moveNames) {
        const results = [];
        for (const name of moveNames) {
            try {
                const move = await this.ensureMove(name);
                results.push(move);
            } catch (e) {
                console.warn('[PokeAPI] Failed to load move:', name);
            }
        }
        return results;
    },

    async ensurePokemonMoves(moveNames) {
        const results = [];
        const batchSize = 5;
        for (let i = 0; i < moveNames.length; i += batchSize) {
            const batch = moveNames.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(name => this.ensureMove(name).catch(() => null))
            );
            batchResults.forEach(m => { if (m) results.push(m); });
        }
        return results;
    },

    async getPokemon(id) {
        return this.ensurePokemon(id);
    },

    async getRandomPokemon(minLevel = 2, maxLevel = 8) {
        const id = Math.floor(Math.random() * this.totalPokemon) + 1;
        const pokemon = await this.ensurePokemon(id);
        const level = Math.floor(Math.random() * (maxLevel - minLevel + 1)) + minLevel;
        return { pokemon, level };
    },

    getStarters() {
        return [1, 4, 7];
    },

    preloadSprite(url) {
        return new Promise((resolve, reject) => {
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
        return Promise.all(urls.map(url => this.preloadSprite(url)));
    },

    getSprites(urls) {
        const imgs = {};
        for (const [key, url] of Object.entries(urls)) {
            imgs[key] = this.imageCache[url] || null;
        }
        return imgs;
    },

    capitalize(str) {
        return str.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    },

    getIdFromName(name) {
        const key = name.toLowerCase();
        const data = this.pokemonCache[key];
        return data ? data.id : null;
    }
};

window.PokeAPI = PokeAPI;
