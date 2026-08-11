const GameData = {
    userId: localStorage.getItem('pokefury_userId') || null,
    currentCharacterId: localStorage.getItem('pokefury_characterId') || null,
    _saveQueue: Promise.resolve(),

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
            console.error('[GameData] createCharacter error:', JSON.stringify(error, null, 2));
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

    async equipItem(pokemonId, itemId) {
        try {
            const { data, error } = await window.db
                .from('pokemon_team')
                .update({ held_item_id: itemId })
                .eq('id', pokemonId)
                .select();
            if (error) {
                console.error('[GameData] equipItem error:', error.message, error.code);
                if (error.message.includes('held_item_id') || error.code === '42703') {
                    console.warn('[GameData] Column held_item_id missing, adding it...');
                    await window.db.rpc('exec_sql', { sql: 'ALTER TABLE pokemon_team ADD COLUMN IF NOT EXISTS held_item_id INTEGER' }).catch(() => {});
                    const { error: retryError } = await window.db
                        .from('pokemon_team')
                        .update({ held_item_id: itemId })
                        .eq('id', pokemonId);
                    return !retryError;
                }
                return false;
            }
            return true;
        } catch (e) {
            console.error('[GameData] equipItem exception:', e);
            return false;
        }
    },

    async saveTeam(pokemonList) {
        if (!this.currentCharacterId || !this.userId) return;
        this._saveQueue = this._saveQueue.then(() => this._doSaveTeam(pokemonList));
        return this._saveQueue;
    },

    async _doSaveTeam(pokemonList) {
        if (!pokemonList || pokemonList.length === 0) {
            console.warn('[GameData] Refusing to replace team with an empty list');
            return false;
        }

        const inserts = pokemonList.map((pokemon, i) => {
            const insert = {
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
            };
            if (pokemon.dbId) insert.id = pokemon.dbId;
            return insert;
        });

        const { data: saved, error } = await window.db
            .from('pokemon_team')
            .upsert(inserts, { onConflict: 'id' })
            .select();

        if (error || !saved || saved.length !== inserts.length) {
            console.error('[GameData] Team save failed; existing rows were preserved:', error || 'incomplete response');
            return false;
        }

        const savedIds = saved.map(row => row.id).filter(Boolean);
        if (savedIds.length > 0) {
            const { error: cleanupError } = await window.db.from('pokemon_team').delete()
                .eq('character_id', this.currentCharacterId)
                .not('id', 'in', `(${savedIds.join(',')})`);
            if (cleanupError) console.error('[GameData] Old team cleanup failed:', cleanupError);
        }

        if (saved) {
            for (let i = 0; i < pokemonList.length && i < saved.length; i++) {
                if (saved[i] && !pokemonList[i].dbId) {
                    pokemonList[i].dbId = saved[i].id;
                }
            }
        }

        return true;
    },

    async addPokemonToTeam(pokemon) {
        const team = await this.getTeam();
        if (team.length >= 6) {
            const pcResult = await this.autoStorePokemonToPC(pokemon);
            return pcResult ? 'pc' : false;
        }

        const insertData = {
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
        };
        const { data, error } = await window.db
            .from('pokemon_team')
            .insert(insertData)
            .select();
        if (error) { console.error('[AddToTeam] INSERT ERROR:', error); return false; }
        return 'team';
    },

    async autoStorePokemonToPC(pokemon) {
        if (!this.currentCharacterId || !this.userId) return false;
        try {
            const { data, error } = await window.db.rpc('safe_store_pc_pokemon', {
                p_character_id: this.currentCharacterId,
                p_pokemon_id: pokemon.id || pokemon.pokemonId || null,
                p_species: pokemon.species || pokemon.name,
                p_nickname: pokemon.nickname || null,
                p_level: pokemon.level,
                p_current_hp: pokemon.currentHp,
                p_max_hp: pokemon.stats?.hp || pokemon.maxHp || 0,
                p_experience: pokemon.experience || 0,
                p_moves: pokemon.moves || [],
                p_iv_hp: pokemon.ivs?.hp ?? 15, p_iv_attack: pokemon.ivs?.attack ?? 15, p_iv_defense: pokemon.ivs?.defense ?? 15,
                p_iv_sp_atk: pokemon.ivs?.spAtk ?? 15, p_iv_sp_def: pokemon.ivs?.spDef ?? 15, p_iv_speed: pokemon.ivs?.speed ?? 15,
                p_ev_hp: pokemon.evs?.hp ?? 0, p_ev_attack: pokemon.evs?.attack ?? 0, p_ev_defense: pokemon.evs?.defense ?? 0,
                p_ev_sp_atk: pokemon.evs?.spAtk ?? 0, p_ev_sp_def: pokemon.evs?.spDef ?? 0, p_ev_speed: pokemon.evs?.speed ?? 0,
                p_nature: pokemon.nature || 'hardy',
                p_status_effect: pokemon.statusEffect || null,
                p_happiness: pokemon.happiness ?? 70,
                p_is_shiny: pokemon.isShiny || false,
                p_held_item_id: pokemon.heldItemId || null
            });
            if (error) return false;
            return data?.success ? { box: data.box, slot: data.slot } : false;
        } catch (e) { return false; }
    },

    async autoStoreRawPokemonToPC(insertData, characterId) {
        if (!characterId || !this.userId) return false;
        try {
            const { data, error } = await window.db.rpc('safe_store_pc_pokemon', {
                p_character_id: characterId,
                p_pokemon_id: insertData.pokemon_id || null,
                p_species: insertData.species,
                p_level: insertData.level || 5,
                p_current_hp: insertData.current_hp || 0,
                p_max_hp: insertData.max_hp || 0,
                p_experience: insertData.experience || 0,
                p_moves: insertData.moves || [],
                p_iv_hp: insertData.iv_hp || 15, p_iv_attack: insertData.iv_attack || 15, p_iv_defense: insertData.iv_defense || 15,
                p_iv_sp_atk: insertData.iv_sp_atk || 15, p_iv_sp_def: insertData.iv_sp_def || 15, p_iv_speed: insertData.iv_speed || 15,
                p_ev_hp: insertData.ev_hp || 0, p_ev_attack: insertData.ev_attack || 0, p_ev_defense: insertData.ev_defense || 0,
                p_ev_sp_atk: insertData.ev_sp_atk || 0, p_ev_sp_def: insertData.ev_sp_def || 0, p_ev_speed: insertData.ev_speed || 0,
                p_nature: insertData.nature || 'hardy',
                p_status_effect: insertData.status_effect || null,
                p_happiness: insertData.happiness ?? 70,
                p_is_shiny: insertData.is_shiny || false,
                p_held_item_id: insertData.held_item_id || null
            });
            return !error && data?.success === true;
        } catch (e) { return false; }
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
        if (!this.currentCharacterId) return [];
        const { data, error } = await window.db
            .from('player_inventory')
            .select('item_id, quantity, items(*)')
            .eq('character_id', this.currentCharacterId);
        if (error) { console.error('[Inv] Query error:', error); return []; }
        return data || [];
    },

    async addItem(itemId, quantity = 1) {
        if (!this.currentCharacterId || !this.userId) return false;
        try {
            const { data, error } = await window.db.rpc('safe_add_item', {
                p_character_id: this.currentCharacterId,
                p_item_id: itemId,
                p_quantity: quantity
            });
            if (error) { console.error('[Inv] addItem RPC error:', error); return false; }
            return data?.success === true;
        } catch (e) {
            console.error('[Inv] addItem exception:', e);
            return false;
        }
    },

    async removeItem(itemId, quantity = 1) {
        if (!this.currentCharacterId) return false;
        try {
            const { data, error } = await window.db.rpc('safe_remove_item', {
                p_character_id: this.currentCharacterId,
                p_item_id: itemId,
                p_quantity: quantity
            });
            if (error) { console.error('[Inv] removeItem RPC error:', error); return false; }
            return data?.success === true;
        } catch (e) {
            console.error('[Inv] removeItem exception:', e);
            return false;
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
        try {
            const { data, error } = await window.db.rpc('get_currency_balance', {
                p_character_id: this.currentCharacterId
            });
            if (error || !data) return { diamonds: 0, gold: 0, silver: 0 };
            return {
                diamonds: data.diamonds || 0,
                gold: data.gold || 0,
                silver: data.silver || 0
            };
        } catch (e) {
            return { diamonds: 0, gold: 0, silver: 0 };
        }
    },

    async updateCurrencies(currencies) {
        // Deprecated - use add_currency or spend_currency RPCs directly
        console.warn('[GameData] updateCurrencies is deprecated, use RPC functions');
        return false;
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
        try {
            const { error } = await window.db.rpc('safe_store_pc_slot', {
                p_character_id: this.currentCharacterId,
                p_box_number: boxNumber,
                p_slot_index: slotIndex,
                p_pokemon_id: pokemon.id || null,
                p_species: pokemon.species || pokemon.name,
                p_nickname: pokemon.nickname || null,
                p_level: pokemon.level,
                p_current_hp: pokemon.currentHp,
                p_max_hp: pokemon.stats?.hp || 0,
                p_experience: pokemon.experience || 0,
                p_moves: pokemon.moves || [],
                p_iv_hp: pokemon.ivs?.hp ?? 15, p_iv_attack: pokemon.ivs?.attack ?? 15, p_iv_defense: pokemon.ivs?.defense ?? 15,
                p_iv_sp_atk: pokemon.ivs?.spAtk ?? 15, p_iv_sp_def: pokemon.ivs?.spDef ?? 15, p_iv_speed: pokemon.ivs?.speed ?? 15,
                p_ev_hp: pokemon.evs?.hp ?? 0, p_ev_attack: pokemon.evs?.attack ?? 0, p_ev_defense: pokemon.evs?.defense ?? 0,
                p_ev_sp_atk: pokemon.evs?.spAtk ?? 0, p_ev_sp_def: pokemon.evs?.spDef ?? 0, p_ev_speed: pokemon.evs?.speed ?? 0,
                p_nature: pokemon.nature || 'hardy',
                p_status_effect: pokemon.statusEffect || null,
                p_happiness: pokemon.happiness ?? 70,
                p_is_shiny: pokemon.isShiny || false,
                p_is_mega: pokemon.isMega || false,
                p_held_item_id: pokemon.heldItemId || null
            });
            return !error;
        } catch (e) { return false; }
    },

    async withdrawPokemon(boxId) {
        if (!this.currentCharacterId) return null;
        try {
            const { data, error } = await window.db.rpc('safe_retrieve_pc_pokemon', {
                p_character_id: this.currentCharacterId,
                p_pokemon_pc_id: boxId
            });
            if (error || !data?.success) return null;
            return { id: data.id, species: data.pokemon_name };
        } catch (e) { return null; }
    },

    async deleteBoxPokemon(boxId) {
        if (!this.currentCharacterId) return false;
        try {
            const { error } = await window.db.rpc('safe_delete_pc_pokemon', {
                p_character_id: this.currentCharacterId,
                p_pokemon_pc_id: boxId
            });
            return !error;
        } catch (e) { return false; }
    },
};

window.GameData = GameData;
