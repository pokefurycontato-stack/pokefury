// ============================================================
// INFINITE TOWER FLOOR SEEDER
// Xera os 1000 andares determinísticos da Torre Infinita e gárdaos no banco
// (NON aleatorio: a mesma lista sempre, a mesma orde).
// Executa isto na consola do browser na páxina de PokeFury (logado como admin).
//
// Regras (FIXAS para todos):
//  - Cada andar ten de 1 a 10 pokemons en secuencia.
//  - Andar 1: 1 pokemon nv5 ; sobe 1 nv por andar ata nv100 (andar 96).
//  - Andar 97: engádese un 2º nv50 que sobe 1 nv por andar ata nv100 (147).
//  - Ao chegar nv100 engádese o seguinte a nv50 ... ata 6 nv100 (351),
//    e logo ata 10 pokemons por andar (555). Dende a 556: 10 a nv100.
//  - A cabeza (slot 0) dos andares múltiplos de 10 é LENDARIO.
//  - Nunca se usan megas nin gigantamax (só variant='normal').
//  - Todos usan sprite frontal animado (GIF) para o spawn.
// ============================================================

(async () => {
    const db = window.db;
    if (!db) { console.error('window.db not found. Are you on the PokeFury page?'); return; }

    // Non redeclaramos SUPABASE_URL (xa existe global na páxina).
    // Usamos window.SUPABASE_URL directamente para evitar conflitos ao pegar na consola.
    const animatedUrl = (id) => `${window.SUPABASE_URL}/storage/v1/object/public/sprites/animated-front/${id}.gif`;

    // ID lendarios
    const LEGENDARY_IDS = [
        144, 145, 146, 150, 151,
        243, 244, 245, 249, 250, 251,
        377, 378, 379, 380, 381, 382, 383, 384, 385, 386,
        480, 481, 482, 483, 484, 485, 486, 488, 490, 491, 492, 493,
        638, 639, 640, 641, 642, 643, 644, 645, 646, 647, 648, 649,
        716, 717, 718, 719, 720, 721,
        785, 786, 787, 788, 789, 790, 791, 792, 793, 794, 795, 796, 797, 798, 799, 800, 801, 802, 807, 808, 809,
        891, 892, 893, 894, 895, 896, 897, 898, 905,
        1000, 1001, 1002, 1003, 1007, 1008, 1009, 1010, 1024
    ];
    const LEG_SET = new Set(LEGENDARY_IDS);

    // Cargamos todos os Pokemon de variante 'normal'
    const { data: allPokemon, error } = await db.from('pokemon')
        .select('id, name, variant, base_pokemon_id')
        .eq('variant', 'normal')
        .order('id');
    if (error) { console.error('Error cargando pokemon:', error); return; }

    const legendaryPool = allPokemon.filter(p => LEG_SET.has(p.id)).sort((a, b) => a.id - b.id);
    const normalPool = allPokemon.filter(p => !LEG_SET.has(p.id)).sort((a, b) => a.id - b.id);

    if (legendaryPool.length === 0) { console.error('[Torre] Non hai lendarios na lista'); return; }
    if (normalPool.length === 0) { console.error('[Torre] Non hai pokemon normais na lista'); return; }
    console.log(`[Torre] Lendários: ${legendaryPool.length}, Normais: ${normalPool.length}`);

    // Regras fixas de progresión por andar
    const floorSlotCount = (fl) => {
        let count = 1;
        if (fl > 96) count += 1 + Math.floor((fl - 97) / 51);
        return Math.min(10, Math.max(1, count));
    };
    const slotIntroducedAt = (slot) => (slot === 0) ? 1 : 97 + (slot - 1) * 51;
    const slotLevel = (fl, slot) => (slot === 0)
        ? Math.min(100, 4 + fl)
        : Math.min(100, 50 + (fl - slotIntroducedAt(slot)));

    // Limpamos antigos (seed idempotente)
    await db.from('infinite_tower_floor_teams').delete().gte('floor_number', 0).lte('floor_number', 100000);

    const rows = [];
    for (let floor = 1; floor <= 1000; floor++) {
        const count = floorSlotCount(floor);
        const isLegHead = (floor % 10) === 0;
        for (let slot = 0; slot < count; slot++) {
            let poke;
            if (slot === 0) {
                if (isLegHead) {
                    const li = (Math.floor(floor / 10) - 1) % legendaryPool.length;
                    poke = legendaryPool[((li % legendaryPool.length) + legendaryPool.length) % legendaryPool.length];
                } else {
                    const offset = (floor - 1 - Math.floor(floor / 10)) % normalPool.length;
                    poke = normalPool[((offset % normalPool.length) + normalPool.length) % normalPool.length];
                }
            } else {
                poke = normalPool[(((floor + slot * 37)) % normalPool.length + normalPool.length) % normalPool.length];
            }
            rows.push({
                floor_number: floor,
                slot_index: slot,
                pokemon_id: poke.id,
                pokemon_name: poke.name,
                pokemon_level: slotLevel(floor, slot),
                is_legendary: slot === 0 && isLegHead,
                sprite_url: animatedUrl(poke.id)
            });
        }
    }

    console.log(`[Torre] Ensaio de ${rows.length} filas. Insertando...`);
    const BATCH = 100;
    for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const { data, error: insErr } = await db.from('infinite_tower_floor_teams').upsert(batch, {
            onConflict: 'floor_number,slot_index'
        });
        if (insErr) { console.error('[Torre] Error insertando lote', i, insErr); return; }
    }
    const sample = [];
    [1, 96, 97, 147, 148, 351, 556].forEach(f => {
        sample.push(`A${f}(x${floorSlotCount(f)}): ` + rows.filter(r => r.floor_number === f).map(r => `${r.pokemon_name} nv${r.pokemon_level}`).join(', '));
    });
    console.log(`[Torre] ✓ ${rows.length} filas creadas no banco (1000 andares, ata 10 pokemons).`);
    console.log('[Torre] Exemplos:', sample.join(' | '));
})();