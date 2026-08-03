/* =============================================================
   pvp-system.js — Sistema de PVP
   ============================================================= */

class PVPSystem {
    constructor(game) {
        this.game = game;
        this.myTeams = [];
        this.selectedTeamIndex = 0;
        this._subscription = null;
    }

    // ========================
    //  TEAMS
    // ========================

    async loadTeams() {
        const charId = this.game.currentCharacterId;
        if (!charId) return;
        const { data } = await window.db.from('pvp_teams')
            .select('*')
            .eq('character_id', charId)
            .order('created_at');
        this.myTeams = data || [];
    }

    async saveTeam(teamIndex, teamName, pokemonIds) {
        const charId = this.game.currentCharacterId;
        if (!charId) return false;
        const slots = {};
        for (let i = 0; i < 6; i++) {
            slots[`slot_${i + 1}`] = pokemonIds[i] || null;
        }
        const existing = this.myTeams[teamIndex];
        if (existing) {
            const { error } = await window.db.from('pvp_teams')
                .update({ team_name: teamName, ...slots, updated_at: new Date().toISOString() })
                .eq('id', existing.id);
            return !error;
        } else {
            const { data, error } = await window.db.from('pvp_teams')
                .insert({ character_id: charId, team_name: teamName, ...slots })
                .select()
                .single();
            if (!error && data) {
                this.myTeams.push(data);
            }
            return !error;
        }
    }

    async deleteTeam(teamId) {
        await window.db.from('pvp_teams').delete().eq('id', teamId);
        this.myTeams = this.myTeams.filter(t => t.id !== teamId);
    }

    // ========================
    //  CHALLENGES
    // ========================

    async searchPlayers(query) {
        if (!query || query.length < 2) return [];
        const { data: chars } = await window.db.from('characters')
            .select('id, player_name, user_id')
            .ilike('player_name', `%${query}%`)
            .limit(10);
        if (!chars || chars.length === 0) return [];

        const userIds = [...new Set(chars.map(c => c.user_id))];
        const { data: profiles } = await window.db.from('profiles')
            .select('id, username')
            .in('id', userIds);

        return chars.map(c => {
            const profile = profiles?.find(p => p.id === c.user_id);
            return { ...c, username: profile?.username || '' };
        });
    }

    async sendChallenge(targetPlayerId, targetName, teamId, betSilver, betGold, betDiamonds) {
        const charId = this.game.currentCharacterId;
        const charName = this.game.playerName;
        if (!charId) return { error: 'No character' };

        if (betSilver > 0 || betGold > 0 || betDiamonds > 0) {
            const { data: currencies } = await window.db.from('character_currencies')
                .select('silver, gold, diamonds')
                .eq('character_id', charId)
                .single();
            if (!currencies) return { error: 'Não foi possível verificar suas moedas.' };
            if (betSilver > (currencies.silver || 0)) return { error: `Prata insuficiente! Você tem ${currencies.silver || 0}.` };
            if (betGold > (currencies.gold || 0)) return { error: `Ouro insuficiente! Você tem ${currencies.gold || 0}.` };
            if (betDiamonds > (currencies.diamonds || 0)) return { error: `Diamantes insuficientes! Você tem ${currencies.diamonds || 0}.` };
        }

        const { data, error } = await window.db.from('pvp_challenges').insert({
            challenger_id: charId,
            challenger_name: charName,
            challenged_id: targetPlayerId,
            challenged_name: targetName,
            pvp_team_id: teamId,
            bet_silver: betSilver || 0,
            bet_gold: betGold || 0,
            bet_diamonds: betDiamonds || 0,
            status: 'pending'
        }).select().single();

        if (error) return { error: error.message };
        return { data };
    }

    async respondToChallenge(challengeId, accept) {
        if (accept) {
            const { data: challenge } = await window.db.from('pvp_challenges')
                .select('*')
                .eq('id', challengeId)
                .single();

            if (challenge && (challenge.bet_silver > 0 || challenge.bet_gold > 0 || challenge.bet_diamonds > 0)) {
                const charId = this.game.currentCharacterId;
                const { data: currencies } = await window.db.from('character_currencies')
                    .select('silver, gold, diamonds')
                    .eq('character_id', charId)
                    .single();
                if (!currencies) return { error: 'Não foi possível verificar suas moedas.' };
                if ((challenge.bet_silver || 0) > (currencies.silver || 0)) return { error: `Prata insuficiente! Necessário: ${challenge.bet_silver}.` };
                if ((challenge.bet_gold || 0) > (currencies.gold || 0)) return { error: `Ouro insuficiente! Necessário: ${challenge.bet_gold}.` };
                if ((challenge.bet_diamonds || 0) > (currencies.diamonds || 0)) return { error: `Diamantes insuficientes! Necessário: ${challenge.bet_diamonds}.` };
            }

            await window.db.from('pvp_challenges')
                .update({ status: 'accepted', responded_at: new Date().toISOString() })
                .eq('id', challengeId);
            return { data: challenge };
        } else {
            await window.db.from('pvp_challenges')
                .update({ status: 'declined', responded_at: new Date().toISOString() })
                .eq('id', challengeId);
            return { data: null };
        }
    }

    async getPendingChallenges() {
        const charId = this.game.currentCharacterId;
        if (!charId) return [];
        const { data } = await window.db.from('pvp_challenges')
            .select('*')
            .eq('challenged_id', charId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        return data || [];
    }

    subscribeToChallenges(callback) {
        if (this._subscription) this._subscription.unsubscribe();
        this._subscription = window.db
            .channel('pvp-challenges')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pvp_challenges', filter: `challenged_id=eq.${this.game.currentCharacterId}` }, payload => {
                callback(payload.new);
            })
            .subscribe();
    }

    unsubscribe() {
        if (this._subscription) {
            this._subscription.unsubscribe();
            this._subscription = null;
        }
    }

    // ========================
    //  PVP BATTLE
    // ========================

    async initPVPBattle(challenge) {
        const teamData = await this.loadTeamPokemon(challenge.pvp_team_id);
        if (!teamData || teamData.length === 0) return null;

        const myTeam = [];
        for (const p of teamData) {
            const pokemonData = await PokeAPI.ensurePokemon(p.pokemon_id || p.species);
            if (!pokemonData) continue;
            const pokemon = await createPokemon(pokemonData, p.level, {
                hp: p.iv_hp, attack: p.iv_attack, defense: p.iv_defense,
                spAtk: p.iv_sp_atk, spDef: p.iv_sp_def, speed: p.iv_speed
            }, {
                hp: p.ev_hp, attack: p.ev_attack, defense: p.ev_defense,
                spAtk: p.ev_sp_atk, spDef: p.ev_sp_def, speed: p.ev_speed
            }, p.nature, p.is_shiny);
            pokemon.currentHp = p.current_hp || pokemon.stats.hp;
            if (p.moves && Array.isArray(p.moves)) {
                const moveIds = p.moves.map(m => Number(m.id)).filter(Boolean);
                if (moveIds.length > 0) {
                    const { data: moveDetails } = await window.db.from('moves')
                        .select('id, name, type, category, power, accuracy, pp')
                        .in('id', moveIds);
                    if (moveDetails) {
                        const moveMap = {};
                        moveDetails.forEach(m => { moveMap[m.id] = m; });
                        pokemon.moves = p.moves.map(sm => {
                            const full = moveMap[Number(sm.id)];
                            if (!full) return null;
                            return { id: full.id, name: full.name, type: full.type, category: full.category || 'physical', power: full.power || 0, accuracy: full.accuracy || 100, pp: full.pp || 35, currentPp: sm.pp ?? full.pp ?? 35 };
                        }).filter(Boolean);
                    }
                }
            }
            myTeam.push(pokemon);
        }

        return myTeam;
    }

    async loadTeamPokemon(teamId) {
        if (!teamId) return [];
        const { data: team } = await window.db.from('pvp_teams').select('*').eq('id', teamId).single();
        if (!team) return [];
        const pokemonIds = [team.slot_1, team.slot_2, team.slot_3, team.slot_4, team.slot_5, team.slot_6].filter(Boolean);
        if (pokemonIds.length === 0) return [];
        const { data } = await window.db.from('pokemon_team').select('*').in('id', pokemonIds);
        return data || [];
    }
}

window.PVPSystem = PVPSystem;
