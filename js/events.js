export class EventManager {
    constructor(game) {
        this.game = game;
        this.activeEvent = null;
        this.alphaState = null;
        this.raidState = null;
        this.raidBossEl = null;
        this.raidBossHpBar = null;
        this.raidPollInterval = null;
        this.alphaOverlay = null;
        this._pollInterval = null;
    }

    async init() {
        await this.checkActiveEvents();
        this._pollInterval = setInterval(() => this.checkActiveEvents(), 15000);
    }

    destroy() {
        if (this._pollInterval) clearInterval(this._pollInterval);
        if (this.raidPollInterval) clearInterval(this.raidPollInterval);
        this.removeAlphaOverlay();
        this.removeRaidBoss();
    }

    // ============================================================
    // ADMIN: Start/Stop Events
    // ============================================================

    async startAlphaEvent() {
        if (!window.isAdmin) return;
        const { data, error } = await window.db.from('game_events').insert({
            event_type: 'alpha',
            status: 'active',
            started_by: (await window.db.auth.getUser()).data.user.id,
            started_at: new Date().toISOString()
        }).select().single();
        if (error) { console.error('[Events] Failed to start alpha:', error); return null; }
        this.activeEvent = data;
        return data;
    }

    async startRaidEvent() {
        if (!window.isAdmin) return;
        const pokemonPool = [6, 150, 248, 382, 383, 384, 483, 484, 487, 644, 645, 646, 718, 800, 888, 889, 890, 1007, 1008, 1010];
        const bossId = pokemonPool[Math.floor(Math.random() * pokemonPool.length)];
        const bossData = await window.PokeAPI.ensurePokemon(bossId);
        const bossLevel = 100;
        const bossHp = 50000;

        const { data: eventData, error: evErr } = await window.db.from('game_events').insert({
            event_type: 'raid',
            status: 'active',
            started_by: (await window.db.auth.getUser()).data.user.id,
            started_at: new Date().toISOString()
        }).select().single();
        if (evErr) { console.error('[Events] Failed to start raid event:', evErr); return null; }

        const { error: bossErr } = await window.db.from('raid_events').insert({
            event_id: eventData.id,
            boss_pokemon_id: bossId,
            boss_name: bossData.name,
            boss_level: bossLevel,
            boss_max_hp: bossHp,
            boss_current_hp: bossHp
        });
        if (bossErr) { console.error('[Events] Failed to insert raid boss:', bossErr); }

        this.activeEvent = eventData;
        return eventData;
    }

    async endEvent() {
        if (!this.activeEvent) return;
        await window.db.from('game_events').update({
            status: 'ended',
            ended_at: new Date().toISOString()
        }).eq('id', this.activeEvent.id);
        this.activeEvent = null;
        this.removeAlphaOverlay();
        this.removeRaidBoss();
        if (this.raidPollInterval) { clearInterval(this.raidPollInterval); this.raidPollInterval = null; }
    }

    // ============================================================
    // POLLING: Check for active events
    // ============================================================

    async checkActiveEvents() {
        if (!window.db) return;
        try {
            const { data } = await window.db.from('game_events')
                .select('*').eq('status', 'active').order('started_at', { ascending: false }).limit(1);

            if (data && data.length > 0) {
                const event = data[0];
                if (!this.activeEvent || this.activeEvent.id !== event.id) {
                    this.activeEvent = event;
                    if (event.event_type === 'raid') {
                        this.joinRaid();
                    }
                }
            } else {
                if (this.activeEvent) {
                    this.activeEvent = null;
                    this.removeAlphaOverlay();
                    this.removeRaidBoss();
                }
            }
        } catch (e) {}
    }

    // ============================================================
    // ALPHA EVENT
    // ============================================================

    async tryStartAlpha() {
        if (this.activeEvent && this.activeEvent.event_type === 'alpha') return false;
        if (Math.random() > 0.005) return false;
        return this.startAlphaForPlayer();
    }

    async startAlphaForPlayer() {
        const user = (await window.db.auth.getUser()).data.user;
        const charId = this.game.currentCharacterId;

        const { data: existing } = await window.db.from('alpha_events')
            .select('*').eq('user_id', user.id).eq('character_id', charId)
            .eq('defeated', false).limit(1);
        if (existing && existing.length > 0) return false;

        const encounters = await this.game.regionManager.loadMapEncounters(this.game.currentMap?.id);
        if (!encounters || encounters.length === 0) return false;

        const enc = encounters[Math.floor(Math.random() * encounters.length)];
        const highestLevel = this.game.playerTeam.reduce((max, p) => Math.max(max, p.level || 1), 1);
        const alphaLevel = Math.min(highestLevel + 40, 140);

        const alphaData = await window.PokeAPI.ensurePokemon(enc.pokemon_id || enc.pokemon_name);

        const { data: alphaEvent } = await window.db.from('alpha_events').insert({
            user_id: user.id,
            character_id: charId,
            event_id: null,
            pokemon_id: alphaData.id,
            pokemon_name: alphaData.name,
            pokemon_level: alphaLevel,
            defeated: false
        }).select().single();

        this.alphaState = {
            eventId: alphaEvent?.id,
            pokemonId: alphaData.id,
            pokemonName: alphaData.name,
            level: alphaLevel,
            isLegendary: alphaData.types?.includes('dragon') || [144,145,146,150,151,243,244,245,249,250,251,377,378,379,380,381,382,383,384,385,386,480,481,482,483,484,485,486,487,488,489,490,491,492,493,494,638,639,640,641,642,643,644,645,646,647,648,649,716,717,718,719,720,721,785,786,787,788,789,790,791,792,800,888,889,890,891,892,893,894,895,896,897,898,905,1007,1008,1010].includes(alphaData.id)
        };

        this.showAlphaOverlay();
        return true;
    }

    showAlphaOverlay() {
        this.removeAlphaOverlay();
        const overlay = document.createElement('div');
        overlay.id = 'alpha-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.85);z-index:999;pointer-events:none;animation:alphaDarken 3s ease-in forwards;display:flex;align-items:center;justify-content:center;flex-direction:column;';
        overlay.innerHTML = `
            <div style="font-size:28px;font-weight:900;color:#e94560;text-shadow:0 0 30px rgba(233,69,96,0.8);animation:alphaPulse 2s ease-in-out infinite;letter-spacing:4px;">O ALPHA CHEGOU</div>
            <div style="font-size:14px;color:rgba(255,255,255,0.6);margin-top:12px;font-weight:600;">Um pokemon poderoso apareceu no mapa!</div>
        `;
        document.body.appendChild(overlay);
        this.alphaOverlay = overlay;
        setTimeout(() => { if (overlay.parentElement) overlay.style.opacity = '0.3'; }, 4000);
    }

    removeAlphaOverlay() {
        if (this.alphaOverlay) { this.alphaOverlay.remove(); this.alphaOverlay = null; }
        const old = document.getElementById('alpha-overlay');
        if (old) old.remove();
    }

    getAlphaPokemon() {
        if (!this.alphaState) return null;
        const a = this.alphaState;
        return {
            id: a.pokemonId, name: a.pokemonName, level: a.level,
            isAlpha: true, isShiny: false, isMega: false, variant: 'normal',
            height: 30, weight: 999,
            types: [], currentAbility: null, currentAbilityName: null,
            statusEffect: null, heldItemId: null, experience: 0, happiness: 70,
            fainted: false, _statStages: { attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0 },
            ivs: { hp: 31, attack: 31, defense: 31, spAtk: 31, spDef: 31, speed: 31 },
            evs: { hp: 252, attack: 252, defense: 252, spAtk: 252, spDef: 252, speed: 252 },
            nature: 'hardy', moves: [], spriteUrls: {}, shinySpriteUrls: {},
            stats: { hp: 999, attack: 999, defense: 999, spAtk: 999, spDef: 999, speed: 999 },
            baseStats: { hp: 999, attack: 999, defense: 999, spAtk: 999, spDef: 999, speed: 999 },
            species: a.pokemonName?.toLowerCase()
        };
    }

    async onAlphaDefeated() {
        if (!this.alphaState) return;
        const user = (await window.db.auth.getUser()).data.user;
        const charId = this.game.currentCharacterId;
        const a = this.alphaState;

        await window.db.from('alpha_events').update({ defeated: true }).eq('id', a.eventId);

        const silverAmount = 5000 + (a.level * 100);
        await window.GameData.updateCurrencies({ 'c-silver': (await window.GameData.getCurrencies())['c-silver'] + silverAmount });

        await window.GameData.addItem(6, 5);

        const tmPool = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,3001,3002,3003,3004,3005];
        const tmId = tmPool[Math.floor(Math.random() * tmPool.length)];
        await window.GameData.addItem(tmId, 1);

        if (a.isLegendary) {
            const megaStones = [1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,1012,1013,1014,1015,1016,1017,1018,1019,1020];
            const stoneId = megaStones[Math.floor(Math.random() * megaStones.length)];
            await window.GameData.addItem(stoneId, 1);
        }

        this.alphaState = null;
        this.removeAlphaOverlay();
        return { silver: silverAmount, tm: tmId, rareCandy: 5, megaStone: a.isLegendary };
    }

    canCaptureAlpha() { return false; }

    // ============================================================
    // GLOBAL RAID EVENT
    // ============================================================

    async joinRaid() {
        if (!this.activeEvent || this.activeEvent.event_type !== 'raid') return;
        this.startRaidBossDisplay();
        this.startRaidPolling();
    }

    startRaidBossDisplay() {
        this.removeRaidBoss();
        const container = document.createElement('div');
        container.id = 'raid-boss-display';
        container.style.cssText = 'position:fixed;top:16px;right:16px;z-index:998;background:rgba(10,10,20,0.95);border:2px solid #e94560;border-radius:12px;padding:12px 16px;min-width:220px;box-shadow:0 0 20px rgba(233,69,96,0.4);';
        container.innerHTML = `
            <div style="color:#e94560;font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">RAID GLOBAL</div>
            <div id="raid-boss-name" style="color:#fff;font-size:14px;font-weight:700;margin-bottom:4px;">Carregando...</div>
            <div style="width:100%;height:10px;background:rgba(255,255,255,0.1);border-radius:5px;overflow:hidden;margin-bottom:4px;">
                <div id="raid-boss-hp-bar" style="height:100%;background:linear-gradient(90deg,#e94560,#ff6b6b);border-radius:5px;transition:width 0.5s;width:100%;"></div>
            </div>
            <div id="raid-boss-hp-text" style="color:rgba(255,255,255,0.6);font-size:11px;font-weight:600;">???</div>
            <button id="raid-attack-btn" style="width:100%;margin-top:8px;padding:8px;background:linear-gradient(135deg,#e94560,#c23152);border:none;border-radius:8px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;transition:transform 0.15s;">ATACAR</button>
        `;
        document.body.appendChild(container);
        this.raidBossEl = container;
        this.raidBossHpBar = container.querySelector('#raid-boss-hp-bar');

        container.querySelector('#raid-attack-btn').onclick = () => this.attackRaidBoss();
    }

    removeRaidBoss() {
        if (this.raidBossEl) { this.raidBossEl.remove(); this.raidBossEl = null; }
        const old = document.getElementById('raid-boss-display');
        if (old) old.remove();
    }

    startRaidPolling() {
        if (this.raidPollInterval) clearInterval(this.raidPollInterval);
        this.raidPollInterval = setInterval(() => this.updateRaidDisplay(), 5000);
        this.updateRaidDisplay();
    }

    async updateRaidDisplay() {
        if (!this.activeEvent || this.activeEvent.event_type !== 'raid') return;
        try {
            const { data } = await window.db.from('raid_events')
                .select('*').eq('event_id', this.activeEvent.id).limit(1);
            if (!data || data.length === 0) return;
            const raid = data[0];
            this.raidState = raid;

            const nameEl = document.querySelector('#raid-boss-name');
            const hpText = document.querySelector('#raid-boss-hp-text');
            if (nameEl) nameEl.textContent = `${raid.boss_name} (Lv.${raid.boss_level})`;
            if (hpText) hpText.textContent = `${raid.boss_current_hp.toLocaleString()} / ${raid.boss_max_hp.toLocaleString()} HP`;
            if (this.raidBossHpBar) {
                this.raidBossHpBar.style.width = Math.max(0, (raid.boss_current_hp / raid.boss_max_hp * 100)) + '%';
            }
            if (raid.boss_current_hp <= 0) {
                this.removeRaidBoss();
                if (this.raidPollInterval) { clearInterval(this.raidPollInterval); this.raidPollInterval = null; }
            }
        } catch (e) {}
    }

    async attackRaidBoss() {
        if (!this.raidState || this.raidState.boss_current_hp <= 0) return;
        const attacker = this.game.playerTeam.find(p => !p.fainted) || this.game.playerTeam[0];
        if (!attacker) return;

        const damage = Math.floor(attacker.stats.attack * (1 + Math.random() * 0.5) * 10);
        const user = (await window.db.auth.getUser()).data.user;
        const charId = this.game.currentCharacterId;

        const newHp = Math.max(0, this.raidState.boss_current_hp - damage);
        await window.db.from('raid_events').update({ boss_current_hp: newHp }).eq('id', this.raidState.id);

        const { data: existing } = await window.db.from('raid_participants')
            .select('*').eq('raid_id', this.raidState.id).eq('character_id', charId).limit(1);

        if (existing && existing.length > 0) {
            await window.db.from('raid_participants').update({
                total_damage: existing[0].total_damage + damage,
                attacks_count: existing[0].attacks_count + 1,
                last_attack_at: new Date().toISOString()
            }).eq('id', existing[0].id);
        } else {
            await window.db.from('raid_participants').insert({
                raid_id: this.raidState.id,
                user_id: user.id,
                character_id: charId,
                character_name: this.game.playerName || 'Jogador',
                total_damage: damage,
                attacks_count: 1,
                last_attack_at: new Date().toISOString()
            });
        }

        this.raidState.boss_current_hp = newHp;
        this.updateRaidDisplay();

        if (newHp <= 0) {
            await this.onRaidDefeated();
        }
    }

    async onRaidDefeated() {
        this.removeRaidBoss();
        if (this.raidPollInterval) { clearInterval(this.raidPollInterval); this.raidPollInterval = null; }
    }

    async getRaidRanking() {
        if (!this.raidState) return [];
        const { data } = await window.db.from('raid_participants')
            .select('*').eq('raid_id', this.raidState.id).order('total_damage', { ascending: false }).limit(50);
        return data || [];
    }

    async claimRaidRewards() {
        if (!this.raidState) return null;
        const user = (await window.db.auth.getUser()).data.user;
        const charId = this.game.currentCharacterId;

        const { data: existing } = await window.db.from('event_rewards')
            .select('*').eq('user_id', user.id).eq('character_id', charId)
            .eq('event_id', this.activeEvent?.id).eq('claimed', true).limit(1);
        if (existing && existing.length > 0) return null;

        const ranking = await this.getRaidRanking();
        const myRank = ranking.findIndex(r => r.character_id === charId) + 1;

        let silver = 1000;
        let rareCandy = 3;
        let tmId = null;

        if (myRank === 1) { silver = 20000; rareCandy = 20; tmId = 3001; }
        else if (myRank === 2) { silver = 15000; rareCandy = 15; tmId = 3002; }
        else if (myRank === 3) { silver = 10000; rareCandy = 10; tmId = 3003; }
        else if (myRank > 0) { silver = 5000; rareCandy = 5; }

        const currencies = await window.GameData.getCurrencies();
        await window.GameData.updateCurrencies({ 'c-silver': (currencies['c-silver'] || 0) + silver });
        await window.GameData.addItem(6, rareCandy);
        if (tmId) await window.GameData.addItem(tmId, 1);

        await window.db.from('event_rewards').insert({
            user_id: user.id, character_id: charId,
            event_id: this.activeEvent?.id, event_type: 'raid',
            reward_type: myRank <= 3 ? 'raid_ranking' : 'raid_participation',
            reward_data: { rank: myRank, silver, rareCandy, tmId },
            claimed: true
        });

        return { rank: myRank, silver, rareCandy, tmId };
    }

    // ============================================================
    // Raid ranking popup
    // ============================================================

    async showRaidRankingPopup() {
        const ranking = await this.getRaidRanking();
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.8);z-index:1000;display:flex;align-items:center;justify-content:center;';

        let rows = ranking.map((r, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
            const myChar = r.character_id === this.game.currentCharacterId;
            const bg = myChar ? 'rgba(233,69,96,0.2)' : 'transparent';
            return `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:${bg};border-radius:6px;">
                <span style="min-width:30px;font-size:16px;text-align:center;">${medal}</span>
                <span style="flex:1;color:#fff;font-size:13px;font-weight:600;">${r.character_name || 'Jogador'}</span>
                <span style="color:#e94560;font-size:13px;font-weight:700;">${r.total_damage.toLocaleString()} dmg</span>
                <span style="color:rgba(255,255,255,0.4);font-size:11px;">${r.attacks_count}x</span>
            </div>`;
        }).join('');

        if (ranking.length === 0) rows = '<div style="color:rgba(255,255,255,0.4);text-align:center;padding:20px;">Nenhum participante ainda</div>';

        overlay.innerHTML = `
            <div style="background:rgba(15,20,35,0.98);border:1px solid rgba(233,69,96,0.3);border-radius:16px;padding:24px;max-width:420px;width:90%;max-height:70vh;overflow-y:auto;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                    <div style="color:#e94560;font-size:16px;font-weight:800;">RANKING RAID GLOBAL</div>
                    <button onclick="this.closest('div[style*=fixed]').remove()" style="background:none;border:none;color:rgba(255,255,255,0.5);font-size:20px;cursor:pointer;">✕</button>
                </div>
                ${rows}
                <button onclick="window.pokefury.eventManager.claimRaidRewards().then(r => { if(r) alert('Recompensas: '+r.silver+' Prata, '+r.rareCandy+' Rare Candy'); this.closest('div[style*=fixed]').remove(); })" style="width:100%;margin-top:12px;padding:10px;background:linear-gradient(135deg,#e94560,#c23152);border:none;border-radius:8px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;">RECEBER RECOMPENSAS</button>
            </div>
        `;
        document.body.appendChild(overlay);
    }
}
