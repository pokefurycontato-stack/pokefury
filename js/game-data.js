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
        updates.last_seen = new Date().toISOString();
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
            const { data, error } = await window.db.rpc('safe_equip_item', {
                p_character_id: this.currentCharacterId,
                p_pokemon_id: pokemonId,
                p_item_id: itemId
            });
            if (error) {
                console.error('[GameData] equipItem error:', error.message, error.code);
                return { ok: false };
            }
            if (data && data.error) return { ok: false };
            return { ok: data?.success === true, swappedFrom: data?.swapped_from || null };
        } catch (e) {
            console.error('[GameData] equipItem exception:', e);
            return { ok: false };
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

        const payload = pokemonList
            .map((pokemon, i) => ({
                id: pokemon.dbId || null,
                current_hp: pokemon.currentHp,
                fainted: !!pokemon.fainted,
                status_effect: pokemon.statusEffect || null,
                moves: (pokemon.moves || []).map(m => ({ id: m.id, pp: m.currentPp })),
                held_item_id: pokemon.heldItemId || null,
                slot: i + 1
            }))
            .filter(p => p.id);

        const { error } = await window.db.rpc('secure_save_team', {
            p_character_id: this.currentCharacterId,
            p_team: payload
        });

        if (error) {
            if (window.SecurityWatchdog) window.SecurityWatchdog.onRpcError(error, 'secure_save_team');
            console.error('[GameData] secure_save_team error:', error);
            return false;
        }
        return true;
    },

    async addPokemonToTeam(pokemon) {
        if (window.SecurityWatchdog) window.SecurityWatchdog.check();
        const team = await this.getTeam();
        if (team.length >= 6) {
            const pcResult = await this.autoStorePokemonToPC(pokemon);
            return pcResult ? 'pc' : false;
        }

        const { data, error } = await window.db.rpc('secure_capture_pokemon', {
            p_character_id: this.currentCharacterId,
            p_pokemon_id: pokemon.id,
            p_level: pokemon.level,
            p_is_shiny: !!pokemon.isShiny,
            p_moves: (pokemon.moves || []).map(m => ({ id: m.id, pp: m.currentPp }))
        });

        if (error || !data || data.error) {
            if (window.SecurityWatchdog) window.SecurityWatchdog.onRpcError(error || data, 'secure_capture_pokemon');
            console.error('[AddToTeam] secure_capture_pokemon error:', error || data?.error);
            return false;
        }

        pokemon.dbId = data.id;
        pokemon.level = data.level;
        pokemon.ivs = {
            hp: data.iv_hp, attack: data.iv_attack, defense: data.iv_defense,
            spAtk: data.iv_sp_atk, spDef: data.iv_sp_def, speed: data.iv_speed
        };
        pokemon.nature = data.nature;
        pokemon.stats = {
            hp: data.stats_hp, attack: data.stats_attack, defense: data.stats_defense,
            spAtk: data.stats_sp_atk, spDef: data.stats_sp_def, speed: data.stats_speed
        };
        pokemon.currentHp = data.stats_hp;
        return 'team';
    },

    async grantExp(pokemonDbId, amount) {
        if (!this.currentCharacterId || !pokemonDbId) return null;
        if (window.SecurityWatchdog) window.SecurityWatchdog.check();
        const { data, error } = await window.db.rpc('secure_grant_exp', {
            p_character_id: this.currentCharacterId,
            p_pokemon_team_id: pokemonDbId,
            p_amount: amount
        });
        if (error) {
            if (window.SecurityWatchdog) window.SecurityWatchdog.onRpcError(error, 'secure_grant_exp');
            console.error('[GameData] secure_grant_exp error:', error);
            return null;
        }
        if (data && data.error && window.SecurityWatchdog) {
            window.SecurityWatchdog.onRpcError({ message: data.error }, 'secure_grant_exp');
        }
        return data;
    },

    async levelUp(pokemonDbId) {
        if (!this.currentCharacterId || !pokemonDbId) return null;
        const { data, error } = await window.db.rpc('secure_level_up', {
            p_character_id: this.currentCharacterId,
            p_pokemon_team_id: pokemonDbId
        });
        if (error) { console.error('[GameData] secure_level_up error:', error); return null; }
        return data;
    },

    async makeShiny(pokemonDbId) {
        if (!this.currentCharacterId || !pokemonDbId) return false;
        const { error } = await window.db.rpc('secure_make_shiny', {
            p_character_id: this.currentCharacterId,
            p_pokemon_team_id: pokemonDbId
        });
        return !error;
    },

    async evolve(pokemonDbId, toPokemonId) {
        if (!this.currentCharacterId || !pokemonDbId) return false;
        const { error } = await window.db.rpc('secure_evolve', {
            p_character_id: this.currentCharacterId,
            p_pokemon_team_id: pokemonDbId,
            p_to_pokemon_id: toPokemonId
        });
        return !error;
    },

    async megaEvolve(pokemonDbId, toPokemonId) {
        if (!this.currentCharacterId || !pokemonDbId) return false;
        const { error } = await window.db.rpc('secure_mega_evolve', {
            p_character_id: this.currentCharacterId,
            p_pokemon_team_id: pokemonDbId,
            p_to_pokemon_id: toPokemonId
        });
        return !error;
    },

    async gainTrainerExp(amount) {
        if (!this.currentCharacterId) return null;
        const { data, error } = await window.db.rpc('secure_gain_trainer_exp', {
            p_character_id: this.currentCharacterId,
            p_amount: amount
        });
        if (error) { console.error('[GameData] secure_gain_trainer_exp error:', error); return null; }
        return data;
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
            const { data, error } = await window.db.rpc('secure_withdraw_pc', {
                p_character_id: this.currentCharacterId,
                p_pokemon_pc_id: boxId
            });
            if (error || !data?.success) return null;
            return { id: data.id, species: data.pokemon_name };
        } catch (e) { return null; }
    },

    async removeFromTeam(pokemonDbId) {
        if (!this.currentCharacterId || !pokemonDbId) return false;
        const { error } = await window.db.rpc('secure_delete_team_pokemon', {
            p_character_id: this.currentCharacterId,
            p_pokemon_team_id: pokemonDbId
        });
        return !error;
    },

    async deleteBoxPokemon(boxId) {
        if (!this.currentCharacterId) return false;
        try {
            const { data, error } = await window.db.rpc('safe_delete_pc_pokemon', {
                p_character_id: this.currentCharacterId,
                p_pokemon_pc_id: boxId
            });
            if (error || !data || data.error) return false;
            return data.success === true;
        } catch (e) { return false; }
    },
};

window.GameData = GameData;
