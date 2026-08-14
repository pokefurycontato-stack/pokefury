/* =============================================================
   raid-boss.js — Sistema de Raid Boss (portal + arena + ranking)
   ============================================================= */

export class RaidBossManager {
    constructor(game) {
        this.game = game;
        this.activeBoss = null;
        this._sub = null;
        this._poll = null;
        this.onBossSpawned = null;
        this.onBossDefeated = null;
    }

    init() {
        this.checkActiveBoss();
        this.subscribeRealtime();
        if (this._poll) clearInterval(this._poll);
        this._poll = setInterval(() => this.checkActiveBoss(), 10000);
    }

    subscribeRealtime() {
        if (this._sub) return;
        this._sub = window.db
            .channel('raid-boss-realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'raid_bosses' }, () => {
                this.checkActiveBoss();
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'raid_bosses' }, (payload) => {
                const b = payload.new;
                if (b && b.status === 'defeated' && this.activeBoss && this.activeBoss.id === b.id) {
                    if (this.onBossDefeated) this.onBossDefeated(b);
                }
                this.checkActiveBoss();
            })
            .subscribe();
    }

    async checkActiveBoss() {
        if (!window.db) return null;
        try {
            const { data } = await window.db.rpc('get_active_raid_boss');
            const boss = (data && data.length > 0) ? data[0] : null;
            const prev = this.activeBoss;
            this.activeBoss = boss;
            if (boss && (!prev || prev.id !== boss.id)) {
                if (this.onBossSpawned) this.onBossSpawned(boss);
            }
            return boss;
        } catch (e) { return null; }
    }

    bossSpriteUrl(id) {
        return `assets/bossraid-transparent/${id}.gif`;
    }

    portalSpriteUrl() {
        return `assets/ferramentas/portal.gif`;
    }

    async spawnBoss(pokemonId, name) {
        const { data, error } = await window.db.rpc('spawn_raid_boss', { p_pokemon_id: pokemonId, p_name: name });
        if (error || (data && data.error)) return data?.error || 'Erro';
        await this.checkActiveBoss();
        return null;
    }

    async cancelBoss() {
        const { data, error } = await window.db.rpc('cancel_raid_boss');
        if (error || (data && data.error)) return data?.error || 'Erro';
        this.activeBoss = null;
        return null;
    }

    async recordDamage(raidId, damage) {
        const charId = window.GameData?.currentCharacterId;
        if (!charId) return null;
        const { data } = await window.db.rpc('record_raid_damage', {
            p_raid_id: raidId,
            p_character_id: charId,
            p_character_name: this.game.playerName || 'Jogador',
            p_damage: damage
        });
        return data;
    }

    async getRanking(raidId) {
        const { data } = await window.db.rpc('get_raid_damage', { p_raid_id: raidId });
        return data || [];
    }

    async getPortalPosition() {
        try {
            const { data } = await window.db.from('city_raid_portal').select('*').limit(1).maybeSingle();
            return data || null;
        } catch (e) { return null; }
    }

    async getSpawnPosition() {
        try {
            const { data } = await window.db.from('city_raid_spawn').select('*').limit(1).maybeSingle();
            return data || null;
        } catch (e) { return null; }
    }

    async getRaidZones() {
        try {
            const { data } = await window.db.from('city_raid_zones').select('*');
            return data || [];
        } catch (e) { return []; }
    }
}
