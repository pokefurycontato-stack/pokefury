const GameData = {
    userId: localStorage.getItem('pokefury_userId') || null,
    currentCharacterId: localStorage.getItem('pokefury_characterId') || null,

    setUserId(id) {
        this.userId = id;
        if (id) localStorage.setItem('pokefury_userId', id);
        else localStorage.removeItem('pokefury_userId');
    },

    setCurrentCharacter(characterId) {
        this.currentCharacterId = characterId;
        if (characterId) localStorage.setItem('pokefury_characterId', characterId);
        else localStorage.removeItem('pokefury_characterId');
    },

    async getCharacters() {
        if (!this.userId) return [];
        const { data, error } = await window.db
            .from('game_saves')
            .select('*')
            .eq('user_id', this.userId)
            .order('updated_at', { ascending: false });
        if (error) return [];
        return data || [];
    },

    async createCharacter(characterData) {
        if (!this.userId) return null;
        const { data, error } = await window.db
            .from('game_saves')
            .insert({
                user_id: this.userId,
                player_name: characterData.playerName,
                starter_pokemon: characterData.starterPokemon,
                player_gender: characterData.playerGender || 'male',
                avatar_url: characterData.avatarUrl || null
            })
            .select()
            .single();
        if (error) {
            console.error('[GameData] createCharacter error:', error);
            return null;
        }
        return data;
    },

    async deleteCharacter(characterId) {
        if (!this.userId) return false;
        const { error } = await window.db
            .from('game_saves')
            .delete()
            .eq('id', characterId)
            .eq('user_id', this.userId);
        return !error;
    },

    async getSave() {
        if (!this.currentCharacterId) return null;
        const { data, error } = await window.db
            .from('game_saves')
            .select('*')
            .eq('id', this.currentCharacterId)
            .single();
        if (error) return null;
        return data;
    },

    async updateSave(updates) {
        if (!this.currentCharacterId) return;
        updates.updated_at = new Date().toISOString();
        const { error } = await window.db
            .from('game_saves')
            .update(updates)
            .eq('id', this.currentCharacterId);
        return !error;
    },

    async setStarterPokemon(species) {
        return this.updateSave({ starter_pokemon: species });
    },

    async getTeam() {
        if (!this.currentCharacterId) return [];
        const { data, error } = await window.db
            .from('pokemon_team')
            .select('*')
            .eq('character_id', this.currentCharacterId)
            .order('slot', { ascending: true });
        if (error) return [];
        return data || [];
    },

    async saveTeam(pokemonList) {
        if (!this.currentCharacterId || !this.userId) return;

        await window.db
            .from('pokemon_team')
            .delete()
            .eq('character_id', this.currentCharacterId);

        const inserts = pokemonList.map((pokemon, i) => ({
            user_id: this.userId,
            character_id: this.currentCharacterId,
            species: pokemon.species,
            nickname: pokemon.nickname || pokemon.name,
            level: pokemon.level,
            current_hp: pokemon.currentHp,
            max_hp: pokemon.stats.hp,
            experience: pokemon.experience || 0,
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
        if (team.length >= 6) {
            const pcResult = await this.autoStorePokemonToPC(pokemon);
            return pcResult ? 'pc' : false;
        }

        const { error } = await window.db
            .from('pokemon_team')
            .insert({
                user_id: this.userId,
                character_id: this.currentCharacterId,
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
                status_effect: pokemon.statusEffect || null,
                happiness: pokemon.happiness ?? 70,
                is_shiny: pokemon.isShiny || false,
                is_mega: pokemon.isMega || false,
                held_item_id: pokemon.heldItemId || null
            });
        return !error ? 'team' : false;
    },

    async autoStorePokemonToPC(pokemon) {
        if (!this.currentCharacterId || !this.userId) return false;
        for (let box = 1; box <= 20; box++) {
            const boxPokemon = await this.getBoxPokemon(box);
            for (let slot = 0; slot < 30; slot++) {
                if (!boxPokemon.find(p => p.slot_index === slot)) {
                    const { error } = await window.db
                        .from('pokemon_pc')
                        .insert({
                            user_id: this.userId,
                            character_id: this.currentCharacterId,
                            box_number: box,
                            slot_index: slot,
                            species: pokemon.species,
                            nickname: pokemon.nickname || pokemon.name,
                            level: pokemon.level,
                            current_hp: pokemon.currentHp,
                            max_hp: pokemon.stats.hp,
                            moves: pokemon.moves.map(m => ({ id: String(m.id), pp: m.currentPp })),
                            pokemon_id: pokemon.id || null,
                            iv_hp: pokemon.ivs?.hp ?? 15, iv_attack: pokemon.ivs?.attack ?? 15, iv_defense: pokemon.ivs?.defense ?? 15,
                            iv_sp_atk: pokemon.ivs?.spAtk ?? 15, iv_sp_def: pokemon.ivs?.spDef ?? 15, iv_speed: pokemon.ivs?.speed ?? 15,
                            ev_hp: pokemon.evs?.hp ?? 0, ev_attack: pokemon.evs?.attack ?? 0, ev_defense: pokemon.evs?.defense ?? 0,
                            ev_sp_atk: pokemon.evs?.spAtk ?? 0, ev_sp_def: pokemon.evs?.spDef ?? 0, ev_speed: pokemon.evs?.speed ?? 0,
                            nature: pokemon.nature || 'hardy',
                            status_effect: pokemon.statusEffect || null,
                            happiness: pokemon.happiness ?? 70,
                            is_shiny: pokemon.isShiny || false,
                            is_mega: pokemon.isMega || false,
                            held_item_id: pokemon.heldItemId || null
                        });
                    if (!error) return { box, slot };
                    return false;
                }
            }
        }
        return false;
    },

    async autoStoreRawPokemonToPC(insertData, characterId) {
        if (!characterId || !this.userId) return false;
        for (let box = 1; box <= 20; box++) {
            const boxPokemon = await this.getBoxPokemon(box);
            for (let slot = 0; slot < 30; slot++) {
                if (!boxPokemon.find(p => p.slot_index === slot)) {
                    const { error } = await window.db
                        .from('pokemon_pc')
                        .insert({ ...insertData, user_id: this.userId, character_id: characterId, box_number: box, slot_index: slot });
                    if (!error) return true;
                    return false;
                }
            }
        }
        return false;
    },

    async recordBattle(battleData) {
        if (!this.currentCharacterId || !this.userId) return;
        const { error } = await window.db
            .from('battle_history')
            .insert({
                user_id: this.userId,
                character_id: this.currentCharacterId,
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
        if (!this.currentCharacterId) return [];
        const { data, error } = await window.db
            .from('battle_history')
            .select('*')
            .eq('character_id', this.currentCharacterId)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) return [];
        return data || [];
    },

    async getStats() {
        if (!this.currentCharacterId) return null;
        const { data: battles, error } = await window.db
            .from('battle_history')
            .select('result')
            .eq('character_id', this.currentCharacterId);
        if (error) return null;

        const wins = battles.filter(b => b.result === 'win').length;
        const losses = battles.filter(b => b.result === 'lose').length;
        const total = battles.length;

        return { wins, losses, total, winRate: total > 0 ? ((wins / total) * 100).toFixed(1) : 0 };
    },

    async getInventory() {
        if (!this.currentCharacterId) { console.log('[Inv] No characterId'); return []; }
        console.log('[Inv] Querying inventory for character:', this.currentCharacterId);
        const { data, error } = await window.db
            .from('player_inventory')
            .select('item_id, quantity, items(*)')
            .eq('character_id', this.currentCharacterId);
        if (error) { console.error('[Inv] Query error:', error); return []; }
        console.log('[Inv] Raw rows:', data?.length, JSON.stringify(data));
        if (!data) return [];
        const POKEBALL_LOCAL = {
            10: { id: 10, name: 'Poké Ball', category: 'pokeball', effect: 'catch_1x', effect_value: 1, sprite: 'assets/sprites/items/poke-ball.png' },
            11: { id: 11, name: 'Great Ball', category: 'pokeball', effect: 'catch_1.5x', effect_value: 1.5, sprite: 'assets/sprites/items/great-ball.png' },
            12: { id: 12, name: 'Ultra Ball', category: 'pokeball', effect: 'catch_2x', effect_value: 2, sprite: 'assets/sprites/items/ultra-ball.png' },
            13: { id: 13, name: 'Master Ball', category: 'pokeball', effect: 'catch_100x', effect_value: 100, sprite: 'assets/sprites/items/master-ball.png' }
        };
        return data.map(row => {
            if (!row.items && POKEBALL_LOCAL[row.item_id]) {
                console.log('[Inv] Patching item_id', row.item_id, 'with local data');
                row.items = POKEBALL_LOCAL[row.item_id];
            }
            return row;
        });
    },

    async addItem(itemId, quantity = 1) {
        if (!this.currentCharacterId || !this.userId) return false;

        const { data: existing } = await window.db
            .from('player_inventory')
            .select('quantity')
            .eq('character_id', this.currentCharacterId)
            .eq('item_id', itemId)
            .maybeSingle();

        if (existing) {
            const { error } = await window.db
                .from('player_inventory')
                .update({ quantity: existing.quantity + quantity })
                .eq('character_id', this.currentCharacterId)
                .eq('item_id', itemId);
            return !error;
        } else {
            const { error: insertErr } = await window.db
                .from('player_inventory')
                .insert({
                    user_id: this.userId,
                    character_id: this.currentCharacterId,
                    item_id: itemId,
                    quantity
                });
            if (insertErr) {
                const { data: retryExisting } = await window.db
                    .from('player_inventory')
                    .select('quantity')
                    .eq('character_id', this.currentCharacterId)
                    .eq('item_id', itemId)
                    .maybeSingle();
                if (retryExisting) {
                    const { error } = await window.db
                        .from('player_inventory')
                        .update({ quantity: retryExisting.quantity + quantity })
                        .eq('character_id', this.currentCharacterId)
                        .eq('item_id', itemId);
                    return !error;
                }
            }
            return !insertErr;
        }
    },

    async removeItem(itemId, quantity = 1) {
        if (!this.currentCharacterId) return false;
        const { data: existing } = await window.db
            .from('player_inventory')
            .select('quantity')
            .eq('character_id', this.currentCharacterId)
            .eq('item_id', itemId)
            .maybeSingle();

        if (!existing) return false;

        const newQty = existing.quantity - quantity;
        if (newQty <= 0) {
            const { error } = await window.db
                .from('player_inventory')
                .delete()
                .eq('character_id', this.currentCharacterId)
                .eq('item_id', itemId);
            return !error;
        } else {
            const { error } = await window.db
                .from('player_inventory')
                .update({ quantity: newQty })
                .eq('character_id', this.currentCharacterId)
                .eq('item_id', itemId);
            return !error;
        }
    },

    async getItem(itemId) {
        if (!this.currentCharacterId) return null;
        const { data, error } = await window.db
            .from('player_inventory')
            .select('quantity')
            .eq('character_id', this.currentCharacterId)
            .eq('item_id', itemId)
            .maybeSingle();
        if (error) return null;
        return data;
    },

    async getCurrencies() {
        if (!this.currentCharacterId) return { diamonds: 0, gold: 0, silver: 0 };
        const { data, error } = await window.db
            .from('character_currencies')
            .select('*')
            .eq('character_id', this.currentCharacterId)
            .maybeSingle();
        if (error || !data) return { diamonds: 0, gold: 0, silver: 0 };
        return { diamonds: data.diamonds, gold: data.gold, silver: data.silver };
    },

    async updateCurrencies(currencies) {
        if (!this.currentCharacterId) return false;
        const { data: existing } = await window.db
            .from('character_currencies')
            .select('character_id')
            .eq('character_id', this.currentCharacterId)
            .maybeSingle();

        const updates = {
            ...currencies,
            updated_at: new Date().toISOString()
        };

        if (existing) {
            const { error } = await window.db
                .from('character_currencies')
                .update(updates)
                .eq('character_id', this.currentCharacterId);
            return !error;
        } else {
            const { error } = await window.db
                .from('character_currencies')
                .insert({
                    character_id: this.currentCharacterId,
                    diamonds: currencies.diamonds || 0,
                    gold: currencies.gold || 0,
                    silver: currencies.silver || 0
                });
            return !error;
        }
    },

    async getBoxPokemon(boxNumber) {
        if (!this.currentCharacterId) return [];
        const { data, error } = await window.db
            .from('pokemon_pc')
            .select('*')
            .eq('character_id', this.currentCharacterId)
            .eq('box_number', boxNumber)
            .order('slot_index');
        if (error || !data) return [];
        return data;
    },

    async storePokemon(pokemon, boxNumber, slotIndex) {
        if (!this.currentCharacterId || !this.userId) return false;
        const { error } = await window.db
            .from('pokemon_pc')
            .upsert({
                user_id: this.userId,
                character_id: this.currentCharacterId,
                box_number: boxNumber,
                slot_index: slotIndex,
                species: pokemon.species,
                nickname: pokemon.nickname || pokemon.name,
                level: pokemon.level,
                current_hp: pokemon.currentHp,
                max_hp: pokemon.stats.hp,
                experience: pokemon.experience || 0,
                moves: pokemon.moves.map(m => ({ id: String(m.id), pp: m.currentPp })),
                pokemon_id: pokemon.id || null,
                iv_hp: pokemon.ivs?.hp ?? 15, iv_attack: pokemon.ivs?.attack ?? 15, iv_defense: pokemon.ivs?.defense ?? 15,
                iv_sp_atk: pokemon.ivs?.spAtk ?? 15, iv_sp_def: pokemon.ivs?.spDef ?? 15, iv_speed: pokemon.ivs?.speed ?? 15,
                ev_hp: pokemon.evs?.hp ?? 0, ev_attack: pokemon.evs?.attack ?? 0, ev_defense: pokemon.evs?.defense ?? 0,
                ev_sp_atk: pokemon.evs?.spAtk ?? 0, ev_sp_def: pokemon.evs?.spDef ?? 0, ev_speed: pokemon.evs?.speed ?? 0,
                nature: pokemon.nature || 'hardy',
                happiness: pokemon.happiness ?? 70,
                is_shiny: pokemon.isShiny || false,
                is_mega: pokemon.isMega || false,
                held_item_id: pokemon.heldItemId || null,
                status_effect: pokemon.statusEffect || null
            }, { onConflict: 'character_id,box_number,slot_index' });
        return !error;
    },

    async withdrawPokemon(boxId) {
        if (!this.currentCharacterId) return null;
        const { data, error } = await window.db
            .from('pokemon_pc')
            .delete()
            .eq('id', boxId)
            .select()
            .single();
        if (error || !data) return null;
        return data;
    },

    async deleteBoxPokemon(boxId) {
        if (!this.currentCharacterId) return false;
        const { error } = await window.db
            .from('pokemon_pc')
            .delete()
            .eq('id', boxId);
        return !error;
    }
};

window.GameData = GameData;
