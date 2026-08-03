/* =============================================================
   pvp-battle.js — Batalha PVP em tempo real
   ============================================================= */

export class PVPBattle {
    constructor(game, challenge, myTeam, enemyTeam) {
        this.game = game;
        this.challenge = challenge;
        this.myTeam = myTeam;
        this.enemyTeam = enemyTeam;
        this.myIndex = 0;
        this.enemyIndex = 0;
        this.myTurn = false;
        this.isFinished = false;
        this.subscription = null;
        this.onStateUpdate = null;
        this.onBattleEnd = null;
    }

    get myActivePokemon() {
        return this.myTeam[this.myIndex] || null;
    }

    get enemyActivePokemon() {
        return this.enemyTeam[this.enemyIndex] || null;
    }

    get isMyTurn() {
        return this.myTurn;
    }

    getEffectiveSpeed(pokemon) {
        let speed = pokemon.stats?.speed || 100;
        const stages = pokemon._statStages?.speed || 0;
        if (stages > 0) speed = Math.floor(speed * (1 + stages * 0.5));
        else if (stages < 0) speed = Math.floor(speed / (1 + Math.abs(stages) * 0.5));
        return speed;
    }

    determineFirstAttacker() {
        const mySpeed = this.getEffectiveSpeed(this.myActivePokemon);
        const enemySpeed = this.getEffectiveSpeed(this.enemyActivePokemon);
        return mySpeed >= enemySpeed;
    }

    async start() {
        await this.syncInitialState();
        this.subscribeToEnemyActions();
    }

    async syncInitialState() {
        const myState = {
            team: this.myTeam.map(p => ({
                name: p.name, level: p.level, currentHp: p.currentHp,
                maxHp: p.stats.hp, types: p.types, spriteUrl: p.spriteUrls?.front || '',
                moves: p.moves.map(m => ({ id: m.id, name: m.name, type: m.type, power: m.power, category: m.category, currentPp: m.currentPp, pp: m.pp }))
            })),
            activeIndex: this.myIndex
        };

        const enemyState = {
            team: this.enemyTeam.map(p => ({
                name: p.name, level: p.level, currentHp: p.currentHp,
                maxHp: p.stats.hp, types: p.types, spriteUrl: p.spriteUrls?.front || '',
                moves: p.moves.map(m => ({ id: m.id, name: m.name, type: m.type, power: m.power, category: m.category, currentPp: m.currentPp, pp: m.pp }))
            })),
            activeIndex: this.enemyIndex
        };

        await window.db.from('pvp_battle_state').upsert({
            challenge_id: this.challenge.id,
            player_id: this.game.currentCharacterId,
            player_team: myState,
            current_pokemon_index: this.myIndex,
            is_ready: true,
            updated_at: new Date().toISOString()
        }, { onConflict: 'challenge_id,player_id' });

        this.myTurn = this.determineFirstAttacker();
        if (this.onStateUpdate) this.onStateUpdate();
    }

    subscribeToEnemyActions() {
        if (this.subscription) this.subscription.unsubscribe();

        this.subscription = window.db
            .channel(`pvp-battle-${this.challenge.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'pvp_battle_state',
                filter: `challenge_id=eq.${this.challenge.id}`
            }, payload => {
                this.handleEnemyUpdate(payload.new);
            })
            .subscribe();
    }

    handleEnemyUpdate(state) {
        if (state.player_id === this.game.currentCharacterId) return;
        if (this.isFinished) return;

        if (state.last_action === 'attack' && state.last_action_data) {
            const atkData = state.last_action_data;
            if (atkData.target === 'me') {
                const target = this.myActivePokemon;
                if (target) {
                    target.currentHp = Math.max(0, target.currentHp - atkData.damage);
                    if (target.currentHp <= 0) {
                        this.nextMyPokemon();
                    }
                }
            }
        } else if (state.last_action === 'switch' && state.last_action_data) {
            this.enemyIndex = state.last_action_data.newIndex || 0;
        } else if (state.last_action === 'forfeit') {
            this.endBattle('my_win');
            return;
        }

        this.myTurn = this.determineFirstAttacker();
        if (this.onStateUpdate) this.onStateUpdate();

        if (this.myTeam.every(p => p.currentHp <= 0)) {
            this.endBattle('enemy_win');
        } else if (this.enemyTeam.every(p => p.currentHp <= 0)) {
            this.endBattle('my_win');
        }
    }

    async executeMyTurn(action, data) {
        if (!this.myTurn || this.isFinished) return;
        this.myTurn = false;

        let lastAction = action;
        let lastActionData = data;

        if (action === 'attack') {
            const attacker = this.myActivePokemon;
            const defender = this.enemyActivePokemon;
            const move = attacker.moves.find(m => m.id === data.moveId);
            if (!move || move.currentPp <= 0) { this.myTurn = true; return; }

            const damage = this.calculateDamage(attacker, defender, move);
            defender.currentHp = Math.max(0, defender.currentHp - damage);
            move.currentPp = Math.max(0, move.currentPp - 1);

            lastActionData = { moveId: move.id, moveName: move.name, damage, target: 'enemy' };

            if (defender.currentHp <= 0) {
                this.nextEnemyPokemon();
            }
        } else if (action === 'switch') {
            this.myIndex = data.newIndex;
            lastActionData = { newIndex: data.newIndex };
        } else if (action === 'forfeit') {
            lastAction = 'forfeit';
            lastActionData = {};
        }

        await window.db.from('pvp_battle_state').update({
            player_team: {
                team: this.myTeam.map(p => ({
                    name: p.name, level: p.level, currentHp: p.currentHp,
                    maxHp: p.stats.hp, types: p.types, spriteUrl: p.spriteUrls?.front || '',
                    moves: p.moves.map(m => ({ id: m.id, name: m.name, type: m.type, power: m.power, category: m.category, currentPp: m.currentPp, pp: m.pp }))
                })),
                activeIndex: this.myIndex
            },
            current_pokemon_index: this.myIndex,
            last_action: lastAction,
            last_action_data: lastActionData,
            updated_at: new Date().toISOString()
        }).eq('challenge_id', this.challenge.id).eq('player_id', this.game.currentCharacterId);

        if (action === 'forfeit') {
            this.endBattle('enemy_win');
            return;
        }

        if (this.enemyTeam.every(p => p.currentHp <= 0)) {
            this.endBattle('my_win');
        } else if (this.myTeam.every(p => p.currentHp <= 0)) {
            this.endBattle('enemy_win');
        }

        if (this.onStateUpdate) this.onStateUpdate();
    }

    calculateDamage(attacker, defender, move) {
        if (!move.power) return 0;
        const level = attacker.level;
        const attack = attacker.stats.attack;
        const defense = defender.stats.defense;
        const stab = (move.type === attacker.types?.[0]) ? 1.5 : 1;
        const baseDamage = ((2 * level / 5 + 2) * move.power * attack / defense) / 50 + 2;
        const random = (Math.random() * 0.15) + 0.85;
        return Math.max(1, Math.floor(baseDamage * stab * random));
    }

    nextMyPokemon() {
        for (let i = this.myIndex + 1; i < this.myTeam.length; i++) {
            if (this.myTeam[i].currentHp > 0) {
                this.myIndex = i;
                return;
            }
        }
        for (let i = 0; i < this.myIndex; i++) {
            if (this.myTeam[i].currentHp > 0) {
                this.myIndex = i;
                return;
            }
        }
    }

    nextEnemyPokemon() {
        for (let i = this.enemyIndex + 1; i < this.enemyTeam.length; i++) {
            if (this.enemyTeam[i].currentHp > 0) {
                this.enemyIndex = i;
                return;
            }
        }
        for (let i = 0; i < this.enemyIndex; i++) {
            if (this.enemyTeam[i].currentHp > 0) {
                this.enemyIndex = i;
                return;
            }
        }
    }

    async endBattle(result) {
        if (this.isFinished) return;
        this.isFinished = true;

        if (this.subscription) {
            this.subscription.unsubscribe();
            this.subscription = null;
        }

        await window.db.from('pvp_challenges').update({
            status: 'finished',
            result: result === 'my_win' ? 'challenger_won' : 'challenged_won'
        }).eq('id', this.challenge.id);

        if (this.challenge.bet_silver > 0 || this.challenge.bet_gold > 0 || this.challenge.bet_diamonds > 0) {
            const winnerId = result === 'my_win' ? this.challenge.challenger_id : this.challenge.challenged_id;
            const loserId = result === 'my_win' ? this.challenge.challenged_id : this.challenge.challenger_id;

            if (this.challenge.bet_silver > 0) {
                await window.db.rpc('add_currency', { p_character_id: loserId, p_currency_type: 'silver', p_amount: -this.challenge.bet_silver, p_action: 'pvp_bet_loss', p_description: 'Perdeu aposta PVP' });
                await window.db.rpc('add_currency', { p_character_id: winnerId, p_currency_type: 'silver', p_amount: this.challenge.bet_silver, p_action: 'pvp_bet_win', p_description: 'Venceu aposta PVP' });
            }
            if (this.challenge.bet_gold > 0) {
                await window.db.rpc('add_currency', { p_character_id: loserId, p_currency_type: 'gold', p_amount: -this.challenge.bet_gold, p_action: 'pvp_bet_loss', p_description: 'Perdeu aposta PVP' });
                await window.db.rpc('add_currency', { p_character_id: winnerId, p_currency_type: 'gold', p_amount: this.challenge.bet_gold, p_action: 'pvp_bet_win', p_description: 'Venceu aposta PVP' });
            }
            if (this.challenge.bet_diamonds > 0) {
                await window.db.rpc('add_currency', { p_character_id: loserId, p_currency_type: 'diamonds', p_amount: -this.challenge.bet_diamonds, p_action: 'pvp_bet_loss', p_description: 'Perdeu aposta PVP' });
                await window.db.rpc('add_currency', { p_character_id: winnerId, p_currency_type: 'diamonds', p_amount: this.challenge.bet_diamonds, p_action: 'pvp_bet_win', p_description: 'Venceu aposta PVP' });
            }
        }

        if (this.onBattleEnd) this.onBattleEnd(result);
    }

    forfeit() {
        this.executeMyTurn('forfeit', {});
    }
}
