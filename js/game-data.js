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
            pokemon_id: pokemon.id || null
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
                slot: team.length + 1
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
    }
};

window.GameData = GameData;
