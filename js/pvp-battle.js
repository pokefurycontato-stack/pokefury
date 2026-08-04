/* Real-time simultaneous-action PVP battle. */
import { executeTurn, getEffectivenessText } from './battle.js';
import { getEffectiveMovePriority, activateTerastal, canPokemonAct, processEndOfTurn, initFieldEffects } from './battle-mechanics.js';
export class PVPBattle {
    constructor(game, challenge, myTeam, enemyTeam) {
        this.game = game;
        this.challenge = challenge;
        this.myTeam = myTeam;
        this.enemyTeam = enemyTeam;
        this.myIndex = 0;
        this.enemyIndex = 0;
        this.round = 1;
        this.phase = 'action';
        this.teraUsed = false;
        this.enemyTeraUsed = false;
        this.teraSelected = false;
        this.myFieldEffects = {};
        this.enemyFieldEffects = {};
        initFieldEffects(this.myFieldEffects);
        initFieldEffects(this.enemyFieldEffects);
        this.myTeam.forEach(p => { p._teamEffects = this.myFieldEffects; });
        this.enemyTeam.forEach(p => { p._teamEffects = this.enemyFieldEffects; });
        this.pendingAction = null;
        this.pendingSwitchIndex = null;
        this.isFinished = false;
        this.battleState = { weather: null, terrain: null, weatherTurns: 0, terrainTurns: 0, turn: 0 };
        this.subscription = null;
        this.onStateUpdate = null;
        this.onBattleEnd = null;
    }

    get myActivePokemon() { return this.myTeam[this.myIndex] || null; }
    get enemyActivePokemon() { return this.enemyTeam[this.enemyIndex] || null; }
    get visibleMyActivePokemon() { return this.myActivePokemon; }
    get isMyTurn() { return !this.pendingAction && !this.isFinished; }
    get needsForcedSwitch() { return this.myActivePokemon?.currentHp <= 0; }

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
            statStages: p._statStages || {}, statusEffect: p.statusEffect || null,
            fainted: p.currentHp <= 0,
            teraType: p.teraType || p.types?.[0] || 'normal',
            isTerastallized: !!p.isTerastallized,
            currentAbility: p.currentAbility || null,
            currentAbilityName: p.currentAbilityName || null,
            heldItemId: p.heldItemId || null,
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
            player_team: { team: this.serializeTeam(this.myTeam), activeIndex: this.myIndex, phase: this.phase, teraUsed: this.teraUsed, battleState: this.battleState, fieldEffects: this.myFieldEffects },
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
            await this.applyResolution(state.last_action_data);
            return;
        }

        if (state.player_team?.team) {
            this.enemyTeam = this.applySnapshot(this.enemyTeam, state.player_team.team);
            this.enemyIndex = state.current_pokemon_index || 0;
            this.phase = state.player_team.phase || this.phase;
            this.enemyTeraUsed = !!state.player_team.teraUsed;
            if (state.player_team.battleState) this.battleState = { ...this.battleState, ...state.player_team.battleState };
            if (state.player_team.fieldEffects) this.enemyFieldEffects = { ...this.enemyFieldEffects, ...state.player_team.fieldEffects };
            this.enemyTeam.forEach(p => { p._teamEffects = this.enemyFieldEffects; });
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
            p.statusEffect = s.statusEffect || null;
            p.fainted = p.currentHp <= 0;
            p.teraType = s.teraType || p.teraType;
            p.isTerastallized = !!s.isTerastallized;
            p.currentAbility = s.currentAbility || p.currentAbility;
            p.currentAbilityName = s.currentAbilityName || p.currentAbilityName;
            p.heldItemId = s.heldItemId || p.heldItemId;
            if (s.moves) p.moves = p.moves.map(m => {
                const saved = s.moves.find(x => String(x.id) === String(m.id));
                return saved ? { ...m, currentPp: saved.currentPp } : m;
            });
            return p;
        });
    }

    async executeMyTurn(action, data) {
        if (!this.isMyTurn) {
            console.warn('[PVP] Action ignored because the round is not ready:', action, this.round, this.pendingAction);
            return false;
        }
        if (this.phase === 'switch') {
            if (action === 'switch_ready' && this.needsForcedSwitch) return false;
            if (action === 'switch' && !this.needsForcedSwitch) return false;
        } else if (action === 'attack' && (!this.myActivePokemon || this.myActivePokemon.currentHp <= 0)) return false;
        if (action === 'switch') {
            const next = this.myTeam[data.newIndex];
            if (!next || data.newIndex === this.myIndex || next.currentHp <= 0) return false;
        }
        if (action === 'attack' && data.tera && this.teraUsed) return false;
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
            console.error('[PVP] Failed to submit action:', error);
            throw error;
        }
        this.onStateUpdate?.();
        await this.tryResolveRound();
        return true;
    }

    async tryResolveRound() {
        if (this.isFinished || this.challenge.challenger_id !== this.game.currentCharacterId) return;

        const { data: states, error: statesError } = await window.db.from('pvp_battle_state')
            .select('*').eq('challenge_id', this.challenge.id);
        if (statesError) {
            console.error('[PVP] Failed to read round state:', statesError);
            return;
        }
        if (!states || states.length < 2) return;

        const challengerState = states.find(s => s.player_id === this.challenge.challenger_id);
        const challengedState = states.find(s => s.player_id === this.challenge.challenged_id);
        const a = challengerState?.pending_action;
        const b = challengedState?.pending_action;
        if (!a || !b || challengerState.round_number !== this.round || challengedState.round_number !== this.round) return;

        const previousChallengerIndex = this.myIndex;
        const previousChallengedIndex = this.enemyIndex;
        const result = this.phase === 'switch'
            ? this.resolveSwitchActions(a, b)
            : await this.resolveActions(a, b);
        const nextPhase = this.phase === 'switch'
            ? 'action'
            : (this.myActivePokemon?.currentHp <= 0 || this.enemyActivePokemon?.currentHp <= 0 ? 'switch' : 'action');
        const payload = {
            round: this.round,
            phase: nextPhase,
            previousChallengerIndex,
            previousChallengedIndex,
            challengerTeam: this.serializeTeam(this.myTeam),
            challengedTeam: this.serializeTeam(this.enemyTeam),
            challengerTeraUsed: this.teraUsed,
            challengedTeraUsed: this.enemyTeraUsed,
            battleState: this.battleState,
            challengerFieldEffects: this.myFieldEffects,
            challengedFieldEffects: this.enemyFieldEffects,
            challengerIndex: this.myIndex,
            challengedIndex: this.enemyIndex,
            result
        };

        const { error: resolutionError } = await window.db.from('pvp_battle_state').update({
            last_action: 'resolved', last_action_data: payload,
            pending_action: null, resolved_round: this.round,
            player_team: { team: this.serializeTeam(this.myTeam), activeIndex: this.myIndex, phase: nextPhase, teraUsed: this.teraUsed, battleState: this.battleState, fieldEffects: this.myFieldEffects },
            current_pokemon_index: this.myIndex,
            updated_at: new Date().toISOString()
        }).eq('challenge_id', this.challenge.id)
            .eq('player_id', this.game.currentCharacterId);
        if (resolutionError) {
            console.error('[PVP] Failed to publish round resolution:', resolutionError);
            return;
        }

        await this.applyResolution(payload);
    }

    async resolveActions(challengerAction, challengedAction) {
        if (challengerAction.action === 'forfeit') return { winner: 'challenged' };
        if (challengedAction.action === 'forfeit') return { winner: 'challenger' };

        if (challengerAction.action === 'attack' && challengerAction.tera && !this.teraUsed) {
            if (activateTerastal(this.myActivePokemon)) this.teraUsed = true;
        }
        if (challengedAction.action === 'attack' && challengedAction.tera && !this.enemyTeraUsed) {
            if (activateTerastal(this.enemyActivePokemon)) this.enemyTeraUsed = true;
        }

        const challengerMove = this.myActivePokemon?.moves.find(m => String(m.id) === String(challengerAction.moveId));
        const challengedMove = this.enemyActivePokemon?.moves.find(m => String(m.id) === String(challengedAction.moveId));
        const challengerSpeed = this.getEffectiveSpeed(this.myActivePokemon);
        const challengedSpeed = this.getEffectiveSpeed(this.enemyActivePokemon);
        const priority = (action, move, pokemon) => action.action === 'switch' ? 6 : 1 + getEffectiveMovePriority(move, pokemon, this.battleState);
        const challengerPriority = priority(challengerAction, challengerMove, this.myActivePokemon);
        const challengedPriority = priority(challengedAction, challengedMove, this.enemyActivePokemon);
        const challengerFirst = challengerPriority !== challengedPriority
            ? challengerPriority > challengedPriority
            : challengerSpeed >= challengedSpeed;

        const order = challengerFirst ? [
            ['challenger', challengerAction], ['challenged', challengedAction]
        ] : [
            ['challenged', challengedAction], ['challenger', challengerAction]
        ];
        this.battleState.turn = this.round;
        const result = { order: order.map(x => x[0]), winner: null, damage: [], logs: [], effects: [], faintedSides: [] };
        if (challengerAction.tera && this.myActivePokemon?.isTerastallized) result.logs.push(`${this.myActivePokemon.name} Terastalizou!`);
        if (challengedAction.tera && this.enemyActivePokemon?.isTerastallized) result.logs.push(`${this.enemyActivePokemon.name} Terastalizou!`);

        for (const [side, action] of order) {
            const isChallenger = side === 'challenger';
            const attacker = isChallenger ? this.myActivePokemon : this.enemyActivePokemon;
            const defender = isChallenger ? this.enemyActivePokemon : this.myActivePokemon;
            const sideName = isChallenger ? this.challenge.challenger_name : this.challenge.challenged_name;
            if (!attacker || attacker.currentHp <= 0) {
                if (action.action === 'attack') result.logs.push(`${sideName} não pode agir porque seu Pokémon está fora de combate.`);
                continue;
            }

            if (action.action === 'switch') {
                if (isChallenger) this.myIndex = action.newIndex;
                else this.enemyIndex = action.newIndex;
                result.logs.push(`${sideName} enviou ${isChallenger ? this.myActivePokemon.name : this.enemyActivePokemon.name}!`);
                continue;
            }
            if (action.action !== 'attack' || defender.currentHp <= 0) continue;

            const canAct = canPokemonAct(attacker);
            if (!canAct.canAct) {
                if (canAct.message) result.logs.push(canAct.message);
                continue;
            }

            const move = attacker.moves.find(m => String(m.id) === String(action.moveId));
            if (!move || move.currentPp <= 0) continue;
            result.logs.push(`${attacker.name} usou ${move.name}!`);
            const turnResult = await executeTurn(attacker, defender, move, this.battleState);
            move.currentPp = Math.max(0, (move.currentPp || 0) - 1);
            result.effects.push({
                type: move.type || 'normal', category: move.category || 'physical',
                attackerSide: isChallenger ? 'challenger' : 'challenged',
                targetSide: isChallenger ? 'challenged' : 'challenger',
                power: move.power || 50
            });
            const effectText = getEffectivenessText(turnResult.effectiveness);
            if (turnResult.missed) result.logs.push(`${attacker.name} errou!`);
            if (turnResult.protected) result.logs.push(`${defender.name} se protegeu!`);
            if (turnResult.damage > 0) result.logs.push(`${defender.name} perdeu ${turnResult.damage} HP.`);
            if (effectText) result.logs.push(effectText);
            if (turnResult.critical) result.logs.push('Golpe crítico!');
            if (turnResult.hits > 1) result.logs.push(`Acertou ${turnResult.hits} vezes!`);
            result.logs.push(...(turnResult.messages || turnResult.statusMessages || []));
            result.damage.push({ side, name: attacker.name, move: move.name, damage: turnResult.damage || 0 });
            if (turnResult.fainted || defender.currentHp <= 0) {
                defender.fainted = true;
                result.faintedSides.push(isChallenger ? 'challenged' : 'challenger');
                result.logs.push(`${defender.name} desmaiou!`);
            }
        }

        for (const pokemon of [this.myActivePokemon, this.enemyActivePokemon]) {
            result.logs.push(...processEndOfTurn(pokemon, this.battleState));
        }
        for (const field of ['weatherTurns', 'terrainTurns']) {
            if (this.battleState[field] > 0) this.battleState[field]--;
        }
        if (this.battleState.weatherTurns === 0 && this.battleState.weather) {
            result.logs.push('O clima terminou.');
            this.battleState.weather = null;
        }
        if (this.battleState.terrainTurns === 0 && this.battleState.terrain) {
            result.logs.push('O terreno terminou.');
            this.battleState.terrain = null;
        }

        if (this.enemyTeam.every(p => p.currentHp <= 0)) result.winner = 'challenger';
        if (this.myTeam.every(p => p.currentHp <= 0)) result.winner = 'challenged';
        return result;
    }

    resolveSwitchActions(challengerAction, challengedAction) {
        const result = { order: ['challenger', 'challenged'], winner: null, damage: [], logs: [], switchedSides: [] };
        const actions = [
            ['challenger', challengerAction],
            ['challenged', challengedAction]
        ];
        for (const [side, action] of actions) {
            const isChallenger = side === 'challenger';
            const team = isChallenger ? this.myTeam : this.enemyTeam;
            const currentIndex = isChallenger ? this.myIndex : this.enemyIndex;
            const name = isChallenger ? this.challenge.challenger_name : this.challenge.challenged_name;
            if (action.action === 'switch') {
                const next = team[action.newIndex];
                if (next && next.currentHp > 0 && action.newIndex !== currentIndex) {
                    if (isChallenger) this.myIndex = action.newIndex;
                    else this.enemyIndex = action.newIndex;
                    result.switchedSides.push(side);
                    result.logs.push(`${name} enviou ${next.name}!`);
                }
            } else {
                result.logs.push(`${name} está pronto para o próximo turno.`);
            }
        }
        return result;
    }

    async applyResolution(payload) {
        if (!payload || payload.round !== this.round) return;
        const isChallenger = this.game.currentCharacterId === this.challenge.challenger_id;
        const previousMyIndex = isChallenger
            ? (payload.previousChallengerIndex ?? this.myIndex)
            : (payload.previousChallengedIndex ?? this.myIndex);
        const previousEnemyIndex = isChallenger
            ? (payload.previousChallengedIndex ?? this.enemyIndex)
            : (payload.previousChallengerIndex ?? this.enemyIndex);
        const previousMyPokemon = this.myTeam[previousMyIndex] || this.myActivePokemon;
        const previousEnemyPokemon = this.enemyTeam[previousEnemyIndex] || this.enemyActivePokemon;
        const previousPhase = this.phase;
        const previousMyHp = previousMyPokemon?.currentHp ?? 0;
        const previousEnemyHp = previousEnemyPokemon?.currentHp ?? 0;
        const mySide = isChallenger ? 'challenger' : 'challenged';
        const enemySide = isChallenger ? 'challenged' : 'challenger';
        const faintedSides = payload.result?.faintedSides || [];
        const myWasDefeated = faintedSides.includes(mySide);
        const enemyWasDefeated = faintedSides.includes(enemySide);
        const mySnapshot = isChallenger ? payload.challengerTeam : payload.challengedTeam;
        const enemySnapshot = isChallenger ? payload.challengedTeam : payload.challengerTeam;
        this.myTeam = this.applySnapshot(this.myTeam, mySnapshot);
        this.enemyTeam = this.applySnapshot(this.enemyTeam, enemySnapshot);
        this.myIndex = isChallenger ? payload.challengerIndex : payload.challengedIndex;
        this.enemyIndex = isChallenger ? payload.challengedIndex : payload.challengerIndex;
        this.teraUsed = isChallenger ? !!payload.challengerTeraUsed : !!payload.challengedTeraUsed;
        this.enemyTeraUsed = isChallenger ? !!payload.challengedTeraUsed : !!payload.challengerTeraUsed;
        this.battleState = { ...this.battleState, ...(payload.battleState || {}) };
        const myFieldEffects = isChallenger ? payload.challengerFieldEffects : payload.challengedFieldEffects;
        const enemyFieldEffects = isChallenger ? payload.challengedFieldEffects : payload.challengerFieldEffects;
        if (myFieldEffects) this.myFieldEffects = { ...this.myFieldEffects, ...myFieldEffects };
        if (enemyFieldEffects) this.enemyFieldEffects = { ...this.enemyFieldEffects, ...enemyFieldEffects };
        this.myTeam.forEach(p => { p._teamEffects = this.myFieldEffects; });
        this.enemyTeam.forEach(p => { p._teamEffects = this.enemyFieldEffects; });
        this.pendingAction = null;
        this.pendingSwitchIndex = null;
        this.phase = payload.phase === 'switch' ? 'switch' : 'action';
        this.round++;
        await this.persistReadyState();
        this.game.addPVPBattleLog?.(payload.result?.logs || []);
        this.onStateUpdate?.();
        if (myWasDefeated || (previousMyHp > 0 && this.myTeam[previousMyIndex]?.currentHp <= 0)) {
            this.game.playPVPExit?.('player', previousMyPokemon);
        }
        if (enemyWasDefeated || (previousEnemyHp > 0 && this.enemyTeam[previousEnemyIndex]?.currentHp <= 0)) {
            this.game.playPVPExit?.('enemy', previousEnemyPokemon);
        }
        const switchedSides = payload.result?.switchedSides || [];
        if (previousMyIndex !== this.myIndex || switchedSides.includes(mySide)) {
            if (previousPhase === 'switch' || myWasDefeated || previousMyHp <= 0) setTimeout(() => this.game.playPVPEntrance?.('player', this.visibleMyActivePokemon), 850);
            else this.game.playPVPReplacementAnimation?.('player', previousMyPokemon, this.visibleMyActivePokemon);
        }
        if (previousEnemyIndex !== this.enemyIndex || switchedSides.includes(enemySide)) {
            if (previousPhase === 'switch' || enemyWasDefeated || previousEnemyHp <= 0) setTimeout(() => this.game.playPVPEntrance?.('enemy', this.enemyActivePokemon), 850);
            else this.game.playPVPReplacementAnimation?.('enemy', previousEnemyPokemon, this.enemyActivePokemon);
        }
        this.game.playPVPActionEffects?.(payload.result?.effects || [], isChallenger);
        if (this.needsForcedSwitch) this.game.openPVPSwitchSelector?.(true);
        else if (this.phase === 'switch') this.executeMyTurn('switch_ready', {});

        if (payload.result?.winner === 'challenger') this.endBattle(isChallenger ? 'my_win' : 'enemy_win');
        else if (payload.result?.winner === 'challenged') this.endBattle(isChallenger ? 'enemy_win' : 'my_win');
    }

    async persistReadyState() {
        if (this.isFinished) return;
        const { error } = await window.db.from('pvp_battle_state').update({
            pending_action: null,
            last_action: 'ready',
            last_action_data: null,
            round_number: this.round,
            resolved_round: this.round - 1,
            player_team: { team: this.serializeTeam(this.myTeam), activeIndex: this.myIndex, phase: this.phase, teraUsed: this.teraUsed, battleState: this.battleState, fieldEffects: this.myFieldEffects },
            current_pokemon_index: this.myIndex,
            updated_at: new Date().toISOString()
        }).eq('challenge_id', this.challenge.id)
            .eq('player_id', this.game.currentCharacterId);
        if (error) console.error('[PVP] Failed to reset round state:', error);
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
