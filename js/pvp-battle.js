/* Real-time simultaneous-action PVP battle. */
export class PVPBattle {
    constructor(game, challenge, myTeam, enemyTeam) {
        this.game = game;
        this.challenge = challenge;
        this.myTeam = myTeam;
        this.enemyTeam = enemyTeam;
        this.myIndex = 0;
        this.enemyIndex = 0;
        this.round = 1;
        this.pendingAction = null;
        this.isFinished = false;
        this.subscription = null;
        this.onStateUpdate = null;
        this.onBattleEnd = null;
    }

    get myActivePokemon() { return this.myTeam[this.myIndex] || null; }
    get enemyActivePokemon() { return this.enemyTeam[this.enemyIndex] || null; }
    get isMyTurn() { return !this.pendingAction && !this.isFinished; }

    getEffectiveSpeed(pokemon) {
        if (!pokemon) return 0;
        const stages = pokemon._statStages?.speed || 0;
        let multiplier = stages >= 0 ? (2 + stages) / 2 : 2 / (2 - stages);
        return Math.max(1, Math.floor((pokemon.stats?.speed || 1) * multiplier));
    }

    serializeTeam(team) {
        return team.map(p => ({
            name: p.name, species: p.species, level: p.level,
            currentHp: p.currentHp, maxHp: p.stats?.hp || 1,
            stats: p.stats, types: p.types, spriteUrl: p.spriteUrls?.front || '',
            statStages: p._statStages || {},
            moves: (p.moves || []).map(m => ({
                id: m.id, name: m.name, type: m.type, power: m.power,
                category: m.category, currentPp: m.currentPp, pp: m.pp
            }))
        }));
    }

    async start() {
        await this.syncInitialState();
        this.subscribeToEnemyActions();
        this.onStateUpdate?.();
    }

    async syncInitialState() {
        await window.db.from('pvp_battle_state').delete()
            .eq('challenge_id', this.challenge.id)
            .eq('player_id', this.game.currentCharacterId);

        const { error } = await window.db.from('pvp_battle_state').insert({
            challenge_id: this.challenge.id,
            player_id: this.game.currentCharacterId,
            player_team: { team: this.serializeTeam(this.myTeam), activeIndex: this.myIndex },
            current_pokemon_index: this.myIndex,
            pending_action: null,
            round_number: 1,
            resolved_round: 0,
            is_ready: true,
            updated_at: new Date().toISOString()
        });
        if (error) throw error;
    }

    subscribeToEnemyActions() {
        this.subscription = window.db.channel(`pvp-battle-${this.challenge.id}`)
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'pvp_battle_state',
                filter: `challenge_id=eq.${this.challenge.id}`
            }, payload => this.handleStateUpdate(payload.new))
            .subscribe();
    }

    async handleStateUpdate(state) {
        if (!state || state.player_id === this.game.currentCharacterId || this.isFinished) return;

        if (state.last_action === 'resolved' && state.last_action_data) {
            this.applyResolution(state.last_action_data);
            return;
        }

        if (state.player_team?.team) {
            this.enemyTeam = this.applySnapshot(this.enemyTeam, state.player_team.team);
            this.enemyIndex = state.current_pokemon_index || 0;
        }
        await this.tryResolveRound();
        this.onStateUpdate?.();
    }

    applySnapshot(localTeam, snapshots) {
        return localTeam.map((p, i) => {
            const s = snapshots[i];
            if (!s) return p;
            p.currentHp = s.currentHp;
            p.stats = s.stats || p.stats;
            p.types = s.types || p.types;
            p._statStages = s.statStages || p._statStages;
            if (s.moves) p.moves = p.moves.map(m => {
                const saved = s.moves.find(x => String(x.id) === String(m.id));
                return saved ? { ...m, currentPp: saved.currentPp } : m;
            });
            return p;
        });
    }

    async executeMyTurn(action, data) {
        if (!this.isMyTurn) return;
        if (action === 'attack' && (!this.myActivePokemon || this.myActivePokemon.currentHp <= 0)) return;
        this.pendingAction = { action, ...data };

        const { error } = await window.db.from('pvp_battle_state').update({
            pending_action: this.pendingAction,
            last_action: 'pending',
            last_action_data: this.pendingAction,
            round_number: this.round,
            updated_at: new Date().toISOString()
        }).eq('challenge_id', this.challenge.id)
            .eq('player_id', this.game.currentCharacterId);
        if (error) {
            this.pendingAction = null;
            throw error;
        }
        this.onStateUpdate?.();
        await this.tryResolveRound();
    }

    async tryResolveRound() {
        if (this.isFinished || this.challenge.challenger_id !== this.game.currentCharacterId) return;

        const { data: states } = await window.db.from('pvp_battle_state')
            .select('*').eq('challenge_id', this.challenge.id);
        if (!states || states.length < 2) return;

        const challengerState = states.find(s => s.player_id === this.challenge.challenger_id);
        const challengedState = states.find(s => s.player_id === this.challenge.challenged_id);
        const a = challengerState?.pending_action;
        const b = challengedState?.pending_action;
        if (!a || !b || challengerState.round_number !== this.round || challengedState.round_number !== this.round) return;

        const result = this.resolveActions(a, b);
        const payload = {
            round: this.round,
            challengerTeam: this.serializeTeam(this.myTeam),
            challengedTeam: this.serializeTeam(this.enemyTeam),
            challengerIndex: this.myIndex,
            challengedIndex: this.enemyIndex,
            result
        };

        await window.db.from('pvp_battle_state').update({
            last_action: 'resolved', last_action_data: payload,
            pending_action: null, resolved_round: this.round,
            player_team: { team: this.serializeTeam(this.myTeam), activeIndex: this.myIndex },
            current_pokemon_index: this.myIndex,
            updated_at: new Date().toISOString()
        }).eq('challenge_id', this.challenge.id)
            .eq('player_id', this.game.currentCharacterId);

        this.applyResolution(payload);
    }

    resolveActions(challengerAction, challengedAction) {
        if (challengerAction.action === 'forfeit') return { winner: 'challenged' };
        if (challengedAction.action === 'forfeit') return { winner: 'challenger' };

        const challengerSpeed = this.getEffectiveSpeed(this.myActivePokemon);
        const challengedSpeed = this.getEffectiveSpeed(this.enemyActivePokemon);
        const priority = action => action.action === 'switch' ? 2 : 1;
        const challengerFirst = priority(challengerAction) !== priority(challengedAction)
            ? priority(challengerAction) > priority(challengedAction)
            : challengerSpeed >= challengedSpeed;

        const order = challengerFirst ? [
            ['challenger', challengerAction], ['challenged', challengedAction]
        ] : [
            ['challenged', challengedAction], ['challenger', challengerAction]
        ];
        const result = { order: order.map(x => x[0]), winner: null, damage: [] };

        for (const [side, action] of order) {
            const isChallenger = side === 'challenger';
            const attacker = isChallenger ? this.myActivePokemon : this.enemyActivePokemon;
            const defender = isChallenger ? this.enemyActivePokemon : this.myActivePokemon;
            if (!attacker || attacker.currentHp <= 0) continue;

            if (action.action === 'switch') {
                if (isChallenger) this.myIndex = action.newIndex;
                else this.enemyIndex = action.newIndex;
                continue;
            }
            if (action.action !== 'attack' || defender.currentHp <= 0) continue;

            const move = attacker.moves.find(m => String(m.id) === String(action.moveId));
            if (!move || move.currentPp <= 0) continue;
            const damage = this.calculateDamage(attacker, defender, move);
            defender.currentHp = Math.max(0, defender.currentHp - damage);
            move.currentPp = Math.max(0, move.currentPp - 1);
            result.damage.push({ side, name: attacker.name, move: move.name, damage });
        }

        if (this.enemyTeam.every(p => p.currentHp <= 0)) result.winner = 'challenger';
        if (this.myTeam.every(p => p.currentHp <= 0)) result.winner = 'challenged';
        return result;
    }

    applyResolution(payload) {
        if (!payload || payload.round !== this.round) return;
        const isChallenger = this.game.currentCharacterId === this.challenge.challenger_id;
        const mySnapshot = isChallenger ? payload.challengerTeam : payload.challengedTeam;
        const enemySnapshot = isChallenger ? payload.challengedTeam : payload.challengerTeam;
        this.myTeam = this.applySnapshot(this.myTeam, mySnapshot);
        this.enemyTeam = this.applySnapshot(this.enemyTeam, enemySnapshot);
        this.myIndex = isChallenger ? payload.challengerIndex : payload.challengedIndex;
        this.enemyIndex = isChallenger ? payload.challengedIndex : payload.challengerIndex;
        this.pendingAction = null;
        this.round++;
        this.onStateUpdate?.();
        this.persistReadyState();

        if (payload.result?.winner === 'challenger') this.endBattle(isChallenger ? 'my_win' : 'enemy_win');
        else if (payload.result?.winner === 'challenged') this.endBattle(isChallenger ? 'enemy_win' : 'my_win');
    }

    async persistReadyState() {
        if (this.isFinished) return;
        await window.db.from('pvp_battle_state').update({
            pending_action: null,
            last_action: 'ready',
            last_action_data: null,
            round_number: this.round,
            resolved_round: this.round - 1,
            player_team: { team: this.serializeTeam(this.myTeam), activeIndex: this.myIndex },
            current_pokemon_index: this.myIndex,
            updated_at: new Date().toISOString()
        }).eq('challenge_id', this.challenge.id)
            .eq('player_id', this.game.currentCharacterId);
    }

    calculateDamage(attacker, defender, move) {
        if (!move.power) return 0;
        const attack = move.category === 'special' ? attacker.stats.spAtk : attacker.stats.attack;
        const defense = move.category === 'special' ? defender.stats.spDef : defender.stats.defense;
        const stab = attacker.types?.includes(move.type) ? 1.5 : 1;
        const base = ((2 * attacker.level / 5 + 2) * move.power * attack / Math.max(1, defense)) / 50 + 2;
        return Math.max(1, Math.floor(base * stab * (0.85 + Math.random() * 0.15)));
    }

    async endBattle(result) {
        if (this.isFinished) return;
        this.isFinished = true;
        this.subscription?.unsubscribe();

        const { data: finishedChallenge } = await window.db.from('pvp_challenges').update({
            status: 'finished',
            result: result === 'my_win' ? 'challenger_won' : 'challenged_won'
        }).eq('id', this.challenge.id).eq('status', 'accepted').select('id');
        if (!finishedChallenge?.length) {
            this.onBattleEnd?.(result);
            return;
        }

        const bets = [
            ['silver', this.challenge.bet_silver],
            ['gold', this.challenge.bet_gold],
            ['diamonds', this.challenge.bet_diamonds]
        ];
        const winnerId = result === 'my_win' ? this.challenge.challenger_id : this.challenge.challenged_id;
        const loserId = result === 'my_win' ? this.challenge.challenged_id : this.challenge.challenger_id;
        for (const [currency, amount] of bets) {
            if (!amount) continue;
            await window.db.rpc('add_currency', {
                p_character_id: loserId, p_currency_type: currency, p_amount: -amount,
                p_action: 'pvp_bet_loss', p_description: 'Perdeu aposta PVP'
            });
            await window.db.rpc('add_currency', {
                p_character_id: winnerId, p_currency_type: currency, p_amount: amount,
                p_action: 'pvp_bet_win', p_description: 'Venceu aposta PVP'
            });
        }
        if (this.onBattleEnd) this.onBattleEnd(result);
    }

    async forfeit() {
        if (!this.isFinished) {
            await this.executeMyTurn('forfeit', {});
        }
    }
}
