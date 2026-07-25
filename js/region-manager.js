export class RegionManager {
    constructor() {
        this.regions = [];
        this.selectedRegion = null;
        this.selectedMap = null;
        this.availableMaps = [];
        this.encounters = [];
    }

    get db() { return window.db; }
    get storageUrl() { return `${window.SUPABASE_URL}/storage/v1/object/public/sprites`; }

    async loadRegions() {
        const { data, error } = await this.db.from('regions').select('*').order('sort_order');
        if (error) throw error;
        this.regions = data || [];
        return this.regions;
    }

    async loadRegionMaps(regionId) {
        const { data, error } = await this.db.from('region_maps')
            .select('*').eq('region_id', regionId).order('sort_order');
        if (error) throw error;
        return data || [];
    }

    async loadMapEncounters(mapId) {
        const { data, error } = await this.db.from('map_encounters')
            .select('*').eq('map_id', mapId).order('weight', { ascending: false });
        if (error) throw error;
        this.encounters = data || [];
        return this.encounters;
    }

    async listMapImages() {
        try {
            const { data, error } = await this.db.storage.from('sprites').list('maps');
            if (error) throw error;
            this.availableMaps = (data || []).filter(f =>
                /\.(png|jpg|jpeg|gif|webp)$/i.test(f.name)
            );
            return this.availableMaps;
        } catch (e) {
            console.warn('[RegionManager] Could not list maps:', e);
            this.availableMaps = [];
            return this.availableMaps;
        }
    }

    getMapImageUrl(fileName) {
        return `${this.storageUrl}/maps/${fileName}`;
    }

    async createRegion(name, description = '') {
        const sortOrder = this.regions.length;
        const { data, error } = await this.db.from('regions')
            .insert({ name, description, sort_order: sortOrder })
            .select().single();
        if (error) throw error;
        this.regions.push(data);
        return data;
    }

    async updateRegion(id, updates) {
        const { error } = await this.db.from('regions').update(updates).eq('id', id);
        if (error) throw error;
        const idx = this.regions.findIndex(r => r.id === id);
        if (idx >= 0) Object.assign(this.regions[idx], updates);
    }

    async deleteRegion(id) {
        const { error } = await this.db.from('regions').delete().eq('id', id);
        if (error) throw error;
        this.regions = this.regions.filter(r => r.id !== id);
    }

    async addMapToRegion(regionId, name, imageUrl) {
        const existing = await this.loadRegionMaps(regionId);
        const sortOrder = existing.length;
        const { data, error } = await this.db.from('region_maps')
            .insert({
                region_id: regionId,
                name,
                image_url: imageUrl,
                sort_order: sortOrder,
                encounter_rate: 15,
                min_level: 2,
                max_level: 8
            })
            .select().single();
        if (error) throw error;
        return data;
    }

    async updateMap(mapId, updates) {
        const { error } = await this.db.from('region_maps').update(updates).eq('id', mapId);
        if (error) throw error;
    }

    async deleteMap(mapId) {
        const { error } = await this.db.from('region_maps').delete().eq('id', mapId);
        if (error) throw error;
    }

    async reorderMaps(regionId, mapIds) {
        const updates = mapIds.map((id, idx) =>
            this.db.from('region_maps').update({ sort_order: idx }).eq('id', id)
        );
        await Promise.all(updates);
    }

    async addEncounter(mapId, pokemonName, pokemonId, weight = 50, spriteUrl = '') {
        const { data, error } = await this.db.from('map_encounters')
            .insert({
                map_id: mapId,
                pokemon_name: pokemonName,
                pokemon_id: pokemonId,
                weight,
                sprite_url: spriteUrl
            })
            .select().single();
        if (error) throw error;
        return data;
    }

    async deleteEncounter(id) {
        const { error } = await this.db.from('map_encounters').delete().eq('id', id);
        if (error) throw error;
    }

    async getPlayerProgress(characterId) {
        const { data } = await this.db.from('player_progress')
            .select('*').eq('character_id', characterId).maybeSingle();
        return data;
    }

    async initPlayerProgress(characterId, regionId, mapId, userId) {
        const { data, error } = await this.db.from('player_progress')
            .upsert({
                user_id: userId,
                character_id: characterId,
                current_region_id: regionId,
                current_map_id: mapId,
                map_index: 0
            }, { onConflict: 'character_id' })
            .select().single();
        if (error) throw error;
        return data;
    }

    async advanceToNextMap(characterId) {
        const progress = await this.getPlayerProgress(characterId);
        if (!progress) return null;

        const maps = await this.loadRegionMaps(progress.current_region_id);
        const currentIdx = maps.findIndex(m => m.id === progress.current_map_id);

        if (currentIdx < maps.length - 1) {
            const nextMap = maps[currentIdx + 1];
            await this.db.from('player_progress')
                .update({ current_map_id: nextMap.id, map_index: currentIdx + 1 })
                .eq('character_id', characterId);
            return { type: 'next_map', map: nextMap, region: this.regions.find(r => r.id === progress.current_region_id) };
        } else {
            const regionIdx = this.regions.findIndex(r => r.id === progress.current_region_id);
            if (regionIdx < this.regions.length - 1) {
                const nextRegion = this.regions[regionIdx + 1];
                const nextMaps = await this.loadRegionMaps(nextRegion.id);
                if (nextMaps.length > 0) {
                    await this.db.from('player_progress')
                        .update({
                            current_region_id: nextRegion.id,
                            current_map_id: nextMaps[0].id,
                            map_index: 0
                        })
                        .eq('character_id', characterId);
                    return { type: 'next_region', map: nextMaps[0], region: nextRegion };
                }
            }
            return { type: 'end', message: 'Parabens! Voce completou todas as regioes!' };
        }
    }
}
