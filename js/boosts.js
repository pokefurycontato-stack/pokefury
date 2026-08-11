/* =============================================================
   boosts.js — Character Boosts (VIP + time-limited)
   ============================================================= */

class BoostsManager {
    constructor() {
        this.boosts = {};
        this.charId = null;
    }

    async load(characterId) {
        this.charId = characterId;
        this.boosts = {};
        if (!characterId || !window.db) return;

        try {
            const { data, error } = await window.db
                .from('character_boosts')
                .select('*')
                .eq('character_id', characterId);
            if (error) throw error;

            const now = Date.now();
            const valid = [];
            for (const b of (data || [])) {
                if (new Date(b.expires_at).getTime() > now) {
                    this.boosts[b.boost_type] = b;
                    valid.push(b);
                }
            }

            // Remove expired
            const expired = (data || []).filter(b => new Date(b.expires_at).getTime() <= now);
            if (expired.length) {
                for (const b of expired) {
                    await window.db.from('character_boosts').delete().eq('id', b.id);
                }
            }
        } catch (e) {
            console.error('[BoostsManager] load error:', e);
        }
    }

    isActive(type) {
        if (!this.boosts[type]) return false;
        return new Date(this.boosts[type].expires_at).getTime() > Date.now();
    }

    getRemainingMs(type) {
        if (!this.boosts[type]) return 0;
        return Math.max(0, new Date(this.boosts[type].expires_at).getTime() - Date.now());
    }

    getRemainingText(type) {
        const ms = this.getRemainingMs(type);
        if (ms <= 0) return 'Expirado';
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.floor((ms % 3600000) / 60000);
        if (hours >= 24) {
            const days = Math.floor(hours / 24);
            const h = hours % 24;
            return `${days}d ${h}h`;
        }
        return `${hours}h ${minutes}m`;
    }

    async purchase(characterId, boostType, durationMs) {
        try {
            const { data, error } = await window.db.rpc('safe_purchase_boost', {
                p_character_id: characterId,
                p_boost_type: boostType,
                p_duration_ms: durationMs
            });
            if (error) throw error;
            if (data && data.error) throw new Error(data.error);

            this.boosts[boostType] = {
                character_id: characterId,
                boost_type: boostType,
                expires_at: data.expires_at
            };
            return true;
        } catch (e) {
            console.error('[BoostsManager] purchase error:', e);
            return false;
        }
    }
}

window.boostsManager = new BoostsManager();
