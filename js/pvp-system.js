/* =============================================================
   pvp-system.js — Sistema de PVP
   ============================================================= */

class PVPSystem {
    constructor(game) {
        this.game = game;
        this._subscription = null;
    }

    // ========================
    //  CURRENT TEAM (time atual do jogador)
    // ========================

    async getCurrentTeamPokemon(characterId) {
        if (!characterId) return [];
        const { data, error } = await window.db.from('pokemon_team')
            .select('*')
            .eq('character_id', characterId)
            .order('slot', { ascending: true });
        if (error) return [];
        return data || [];
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

    async sendChallenge(targetPlayerId, targetName, betSilver, betGold, betDiamonds) {
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

            if (!challenge) return { error: 'Desafio não encontrado.' };

            const charId = this.game.currentCharacterId;
            const { data: myTeam } = await window.db.from('pokemon_team')
                .select('id')
                .eq('character_id', charId);
            const hasTeam = myTeam && myTeam.length > 0;

            if (!hasTeam) {
                await window.db.from('pvp_challenges')
                    .update({ status: 'declined', responded_at: new Date().toISOString() })
                    .eq('id', challengeId);
                return { error: 'Você precisa ter um time com pelo menos 1 pokémon antes de aceitar duelos!', noTeam: true };
            }

            if ((challenge.bet_silver || 0) > 0 || (challenge.bet_gold || 0) > 0 || (challenge.bet_diamonds || 0) > 0) {
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
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pvp_challenges' }, payload => {
                const d = payload.new;
                if (d && (d.challenged_id === this.game.currentCharacterId || d.challenger_id === this.game.currentCharacterId)) {
                    callback(d);
                }
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
}

window.PVPSystem = PVPSystem;
