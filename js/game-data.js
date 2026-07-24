const GameData = {
    userId: null,

    setUserId(id) {
        this.userId = id;
    },

    async getSave() {
        if (!this.userId) return null;
        const { data, error } = await window.db
            .from('game_saves')
            .select('*')
            .eq('user_id', this.userId)
            .single();
        if (error) return null;
        return data;
    },

    async updateSave(updates) {
        if (!this.userId) return;
        updates.updated_at = new Date().toISOString();
        const { error } = await window.db
            .from('game_saves')
            .update(updates)
            .eq('user_id', this.userId);
        return !error;
    },

    async setStarterPokemon(species) {
        return this.updateSave({ starter_pokemon: species });
    },

    async getTeam() {
        if (!this.userId) return [];
        const { data, error } = await window.db
            .from('pokemon_team')
            .select('*')
            .eq('user_id', this.userId)
            .order('slot', { ascending: true });
        if (error) return [];
        return data || [];
    },

    async saveTeam(pokemonList) {
        if (!this.userId) return;

        await window.db
            .from('pokemon_team')
            .delete()
            .eq('user_id', this.userId);

        const inserts = pokemonList.map((pokemon, i) => ({
            user_id: this.userId,
            species: pokemon.species,
            nickname: pokemon.nickname || pokemon.name,
            level: pokemon.level,
            current_hp: pokemon.currentHp,
            max_hp: pokemon.stats.hp,
            moves: pokemon.moves.map(m => ({ id: m.id, pp: m.currentPp })),
            is_active: i === 0,
            slot: i + 1,
            pokemon_id: pokemon.id || null,
            iv_hp: pokemon.ivs?.hp ?? 15,
            iv_attack: pokemon.ivs?.attack ?? 15,
            iv_defense: pokemon.ivs?.defense ?? 15,
            iv_sp_atk: pokemon.ivs?.spAtk ?? 15,
            iv_sp_def: pokemon.ivs?.spDef ?? 15,
            iv_speed: pokemon.ivs?.speed ?? 15,
            ev_hp: pokemon.evs?.hp ?? 0,
            ev_attack: pokemon.evs?.attack ?? 0,
            ev_defense: pokemon.evs?.defense ?? 0,
            ev_sp_atk: pokemon.evs?.spAtk ?? 0,
            ev_sp_def: pokemon.evs?.spDef ?? 0,
            ev_speed: pokemon.evs?.speed ?? 0,
            nature: pokemon.nature || 'hardy',
            happiness: pokemon.happiness ?? 70,
            is_shiny: pokemon.isShiny || false,
            is_mega: pokemon.isMega || false,
            held_item_id: pokemon.heldItemId || null
        }));

        const { error } = await window.db
            .from('pokemon_team')
            .insert(inserts);
        return !error;
    },

    async addPokemonToTeam(pokemon) {
        const team = await this.getTeam();
        if (team.length >= 6) return false;

        const { error } = await window.db
            .from('pokemon_team')
            .insert({
                user_id: this.userId,
                species: pokemon.species,
                nickname: pokemon.nickname || pokemon.name,
                level: pokemon.level,
                current_hp: pokemon.currentHp,
                max_hp: pokemon.stats.hp,
                moves: pokemon.moves.map(m => ({ id: m.id, pp: m.currentPp })),
                is_active: false,
                slot: team.length + 1,
                pokemon_id: pokemon.id || null,
                iv_hp: pokemon.ivs?.hp ?? 15,
                iv_attack: pokemon.ivs?.attack ?? 15,
                iv_defense: pokemon.ivs?.defense ?? 15,
                iv_sp_atk: pokemon.ivs?.spAtk ?? 15,
                iv_sp_def: pokemon.ivs?.spDef ?? 15,
                iv_speed: pokemon.ivs?.speed ?? 15,
                ev_hp: pokemon.evs?.hp ?? 0,
                ev_attack: pokemon.evs?.attack ?? 0,
                ev_defense: pokemon.evs?.defense ?? 0,
                ev_sp_atk: pokemon.evs?.spAtk ?? 0,
                ev_sp_def: pokemon.evs?.spDef ?? 0,
                ev_speed: pokemon.evs?.speed ?? 0,
                nature: pokemon.nature || 'hardy',
                happiness: pokemon.happiness ?? 70,
                is_shiny: pokemon.isShiny || false,
                is_mega: pokemon.isMega || false,
                held_item_id: pokemon.heldItemId || null
            });
        return !error;
    },

    async recordBattle(battleData) {
        if (!this.userId) return;
        const { error } = await window.db
            .from('battle_history')
            .insert({
                user_id: this.userId,
                opponent_name: battleData.opponentName,
                opponent_team: battleData.opponentTeam,
                result: battleData.result,
                xp_gained: battleData.xpGained || 0,
                battle_log: battleData.battleLog || [],
                duration_seconds: battleData.duration || 0
            });
        return !error;
    },

    async getBattleHistory(limit = 20) {
        if (!this.userId) return [];
        const { data, error } = await window.db
            .from('battle_history')
            .select('*')
            .eq('user_id', this.userId)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) return [];
        return data || [];
    },

    async getStats() {
        if (!this.userId) return null;
        const { data: battles, error } = await window.db
            .from('battle_history')
            .select('result')
            .eq('user_id', this.userId);
        if (error) return null;

        const wins = battles.filter(b => b.result === 'win').length;
        const losses = battles.filter(b => b.result === 'lose').length;
        const total = battles.length;

        return { wins, losses, total, winRate: total > 0 ? ((wins / total) * 100).toFixed(1) : 0 };
    },

    async getInventory() {
        if (!this.userId) return [];
        const { data, error } = await window.db
            .from('player_inventory')
            .select('item_id, quantity, items(*)')
            .eq('user_id', this.userId);
        if (error) return [];
        return data || [];
    },

    async addItem(itemId, quantity = 1) {
        if (!this.userId) return false;
        const { data: existing } = await window.db
            .from('player_inventory')
            .select('quantity')
            .eq('user_id', this.userId)
            .eq('item_id', itemId)
            .single();

        if (existing) {
            const { error } = await window.db
                .from('player_inventory')
                .update({ quantity: existing.quantity + quantity })
                .eq('user_id', this.userId)
                .eq('item_id', itemId);
            return !error;
        } else {
            const { error } = await window.db
                .from('player_inventory')
                .insert({ user_id: this.userId, item_id: itemId, quantity });
            return !error;
        }
    },

    async removeItem(itemId, quantity = 1) {
        if (!this.userId) return false;
        const { data: existing } = await window.db
            .from('player_inventory')
            .select('quantity')
            .eq('user_id', this.userId)
            .eq('item_id', itemId)
            .single();

        if (!existing) return false;

        const newQty = existing.quantity - quantity;
        if (newQty <= 0) {
            const { error } = await window.db
                .from('player_inventory')
                .delete()
                .eq('user_id', this.userId)
                .eq('item_id', itemId);
            return !error;
        } else {
            const { error } = await window.db
                .from('player_inventory')
                .update({ quantity: newQty })
                .eq('user_id', this.userId)
                .eq('item_id', itemId);
            return !error;
        }
    },

    async getItem(itemId) {
        if (!this.userId) return null;
        const { data, error } = await window.db
            .from('player_inventory')
            .select('quantity')
            .eq('user_id', this.userId)
            .eq('item_id', itemId)
            .single();
        if (error) return null;
        return data;
    }
};

window.GameData = GameData;
