// ============================================================
// SEED MEGA EVOLUTIONS TABLE
// Run in browser console on PokeFury (logged in as admin)
// Maps base pokemon -> mega form + required mega stone item
// ============================================================

(async () => {
    const db = window.db;
    if (!db) { console.error('window.db not found!'); return; }

    // Mega stone item IDs from items-data.js (IDs 1001-1046)
    const MEGA_STONES = {
        3: {stone:'Venusaurite',megaId:10001},
        6: {stones:[{stone:'Charizardite X',megaId:10002},{stone:'Charizardite Y',megaId:10003}]},
        9: {stone:'Blastoisinite',megaId:10004},
        65: {stone:'Alakazite',megaId:10005},
        94: {stone:'Gengarite',megaId:10006},
        115: {stone:'Kangaskhanite',megaId:10007},
        127: {stone:'Pinsirite',megaId:10008},
        130: {stone:'Gyaradosite',megaId:10009},
        142: {stone:'Aerodactylite',megaId:10010},
        150: {stones:[{stone:'Mewtwonite X',megaId:10011},{stone:'Mewtwonite Y',megaId:10012}]},
        212: {stone:'Scizorite',megaId:10013},
        214: {stone:'Heracronite',megaId:10014},
        229: {stone:'Houndoominite',megaId:10015},
        248: {stone:'Tyranitarite',megaId:10016},
        257: {stone:'Blazikenite',megaId:10017},
        282: {stone:'Gardevoirite',megaId:10018},
        303: {stone:'Mawilite',megaId:10019},
        306: {stone:'Aggronite',megaId:10020},
        310: {stone:'Manectite',megaId:10021},
        445: {stone:'Garchompite',megaId:10022},
        448: {stone:'Lucarionite',megaId:10023},
        460: {stone:'Abomasite',megaId:10024},
        15: {stone:'Beedrillite',megaId:10025},
        18: {stone:'Pidgeotite',megaId:10026},
        80: {stone:'Slowbronite',megaId:10027},
        208: {stone:'Steelixite',megaId:10028},
        319: {stone:'Sharpedonite',megaId:10029},
        323: {stone:'Cameruptite',megaId:10030},
        334: {stone:'Altarianite',megaId:10031},
        373: {stone:'Salamencite',megaId:10032},
        376: {stone:'Metagrossite',megaId:10033},
        380: {stone:'Latiasite',megaId:10034},
        381: {stone:'Latiosite',megaId:10035},
        384: {stone:'Rayquazite',megaId:10036},
        428: {stone:'Lopunnite',megaId:10037},
        475: {stone:'Galladite',megaId:10038},
        531: {stone:'Audinite',megaId:10039},
        719: {stone:'Diancite',megaId:10040},
        254: {stone:'Sceptilite',megaId:10041},
        260: {stone:'Swampertite',megaId:10042},
        354: {stone:'Banettite',megaId:10043},
        359: {stone:'Absolite',megaId:10044},
        302: {stone:'Sablenite',megaId:10045},
        362: {stone:'Glalitite',megaId:10046}
    };

    console.log('[MegaEvo] Seeding mega_evolutions...');

    // Check existing
    const { data: existing } = await db.from('mega_evolutions').select('base_pokemon_id');
    const existingIds = new Set((existing || []).map(e => e.base_pokemon_id));
    console.log(`[MegaEvo] ${existingIds.size} already in DB`);

    let inserted = 0;
    for (const [baseId, data] of Object.entries(MEGA_STONES)) {
        const baseIdNum = parseInt(baseId);
        if (existingIds.has(baseIdNum)) continue;

        if (data.stones) {
            for (const s of data.stones) {
                const { error } = await db.from('mega_evolutions').insert({
                    base_pokemon_id: baseIdNum,
                    mega_pokemon_id: s.megaId,
                    mega_stone_item: s.stone,
                    required_level: 0
                });
                if (!error) { inserted++; console.log(`  ${baseIdNum} -> ${s.megaId} (${s.stone}) ✓`); }
            }
        } else {
            const { error } = await db.from('mega_evolutions').insert({
                base_pokemon_id: baseIdNum,
                mega_pokemon_id: data.megaId,
                mega_stone_item: data.stone,
                required_level: 0
            });
            if (!error) { inserted++; console.log(`  ${baseIdNum} -> ${data.megaId} (${data.stone}) ✓`); }
        }
    }

    console.log(`\n[DONE] ${inserted} mega evolutions inserted`);
})();
