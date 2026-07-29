// ============================================================
// SEED VARIANT POKEMON (Mega, Gmax, Regional)
// Run in browser console on PokeFury (logged in as admin)
// Fetches from PokeAPI and inserts into pokemon table
// ============================================================

(async () => {
    const db = window.db;
    if (!db) { console.error('window.db not found!'); return; }

    // Custom IDs matching our sprite files in Supabase Storage
    const VARIANTS = [
        // === MEGA EVOLUTIONS (custom IDs 10001-10046) ===
        {id:10001,name:'venusaur-mega',base:'venusaur',variant:'mega',baseId:3},
        {id:10002,name:'charizard-mega-x',base:'charizard',variant:'mega',baseId:6},
        {id:10003,name:'charizard-mega-y',base:'charizard',variant:'mega',baseId:6},
        {id:10004,name:'blastoise-mega',base:'blastoise',variant:'mega',baseId:9},
        {id:10005,name:'alakazam-mega',base:'alakazam',variant:'mega',baseId:65},
        {id:10006,name:'gengar-mega',base:'gengar',variant:'mega',baseId:94},
        {id:10007,name:'kangaskhan-mega',base:'kangaskhan',variant:'mega',baseId:115},
        {id:10008,name:'pinsir-mega',base:'pinsir',variant:'mega',baseId:127},
        {id:10009,name:'gyarados-mega',base:'gyarados',variant:'mega',baseId:130},
        {id:10010,name:'aerodactyl-mega',base:'aerodactyl',variant:'mega',baseId:142},
        {id:10011,name:'mewtwo-mega-x',base:'mewtwo',variant:'mega',baseId:150},
        {id:10012,name:'mewtwo-mega-y',base:'mewtwo',variant:'mega',baseId:150},
        {id:10013,name:'scizor-mega',base:'scizor',variant:'mega',baseId:212},
        {id:10014,name:'heracross-mega',base:'heracross',variant:'mega',baseId:214},
        {id:10015,name:'houndoom-mega',base:'houndoom',variant:'mega',baseId:229},
        {id:10016,name:'tyranitar-mega',base:'tyranitar',variant:'mega',baseId:248},
        {id:10017,name:'blaziken-mega',base:'blaziken',variant:'mega',baseId:257},
        {id:10018,name:'gardevoir-mega',base:'gardevoir',variant:'mega',baseId:282},
        {id:10019,name:'mawile-mega',base:'mawile',variant:'mega',baseId:303},
        {id:10020,name:'aggron-mega',base:'aggron',variant:'mega',baseId:306},
        {id:10021,name:'manectric-mega',base:'manectric',variant:'mega',baseId:310},
        {id:10022,name:'garchomp-mega',base:'garchomp',variant:'mega',baseId:445},
        {id:10023,name:'lucario-mega',base:'lucario',variant:'mega',baseId:448},
        {id:10024,name:'abomasnow-mega',base:'abomasnow',variant:'mega',baseId:460},
        {id:10025,name:'beedrill-mega',base:'beedrill',variant:'mega',baseId:15},
        {id:10026,name:'pidgeot-mega',base:'pidgeot',variant:'mega',baseId:18},
        {id:10027,name:'slowbro-mega',base:'slowbro',variant:'mega',baseId:80},
        {id:10028,name:'steelix-mega',base:'steelix',variant:'mega',baseId:208},
        {id:10029,name:'sharpedo-mega',base:'sharpedo',variant:'mega',baseId:319},
        {id:10030,name:'camerupt-mega',base:'camerupt',variant:'mega',baseId:323},
        {id:10031,name:'altaria-mega',base:'altaria',variant:'mega',baseId:334},
        {id:10032,name:'salamence-mega',base:'salamence',variant:'mega',baseId:373},
        {id:10033,name:'metagross-mega',base:'metagross',variant:'mega',baseId:376},
        {id:10034,name:'latias-mega',base:'latias',variant:'mega',baseId:380},
        {id:10035,name:'latios-mega',base:'latios',variant:'mega',baseId:381},
        {id:10036,name:'rayquaza-mega',base:'rayquaza',variant:'mega',baseId:384},
        {id:10037,name:'lopunny-mega',base:'lopunny',variant:'mega',baseId:428},
        {id:10038,name:'gallade-mega',base:'gallade',variant:'mega',baseId:475},
        {id:10039,name:'audino-mega',base:'audino',variant:'mega',baseId:531},
        {id:10040,name:'diancie-mega',base:'diancie',variant:'mega',baseId:719},
        {id:10041,name:'sceptile-mega',base:'sceptile',variant:'mega',baseId:254},
        {id:10042,name:'swampert-mega',base:'swampert',variant:'mega',baseId:260},
        {id:10043,name:'banette-mega',base:'banette',variant:'mega',baseId:354},
        {id:10044,name:'absol-mega',base:'absol',variant:'mega',baseId:359},
        {id:10045,name:'sableye-mega',base:'sableye',variant:'mega',baseId:302},
        {id:10046,name:'glalie-mega',base:'glalie',variant:'mega',baseId:362},

        // === GIGANTAMAX (custom IDs 11001-11026) ===
        {id:11001,name:'charizard-gmax',base:'charizard',variant:'gmax',baseId:6},
        {id:11002,name:'butterfree-gmax',base:'butterfree',variant:'gmax',baseId:12},
        {id:11003,name:'pikachu-gmax',base:'pikachu',variant:'gmax',baseId:25},
        {id:11004,name:'meowth-gmax',base:'meowth',variant:'gmax',baseId:52},
        {id:11005,name:'machamp-gmax',base:'machamp',variant:'gmax',baseId:68},
        {id:11006,name:'gengar-gmax',base:'gengar',variant:'gmax',baseId:94},
        {id:11007,name:'kingler-gmax',base:'kingler',variant:'gmax',baseId:99},
        {id:11008,name:'lapras-gmax',base:'lapras',variant:'gmax',baseId:131},
        {id:11009,name:'eevee-gmax',base:'eevee',variant:'gmax',baseId:133},
        {id:11010,name:'snorlax-gmax',base:'snorlax',variant:'gmax',baseId:143},
        {id:11011,name:'garbodor-gmax',base:'garbodor',variant:'gmax',baseId:569},
        {id:11012,name:'melmetal-gmax',base:'melmetal',variant:'gmax',baseId:809},
        {id:11013,name:'corviknight-gmax',base:'corviknight',variant:'gmax',baseId:823},
        {id:11014,name:'orbeetle-gmax',base:'orbeetle',variant:'gmax',baseId:826},
        {id:11015,name:'drednaw-gmax',base:'drednaw',variant:'gmax',baseId:834},
        {id:11016,name:'coalossal-gmax',base:'coalossal',variant:'gmax',baseId:839},
        {id:11017,name:'flapple-gmax',base:'flapple',variant:'gmax',baseId:841},
        {id:11018,name:'appletun-gmax',base:'appletun',variant:'gmax',baseId:842},
        {id:11021,name:'centiskorch-gmax',base:'centiskorch',variant:'gmax',baseId:849},
        {id:11022,name:'hatterene-gmax',base:'hatterene',variant:'gmax',baseId:858},
        {id:11023,name:'grimmsnarl-gmax',base:'grimmsnarl',variant:'gmax',baseId:861},
        {id:11024,name:'alcremie-gmax',base:'alcremie',variant:'gmax',baseId:868},
        {id:11025,name:'copperajah-gmax',base:'copperajah',variant:'gmax',baseId:879},
        {id:11026,name:'duraludon-gmax',base:'duraludon',variant:'gmax',baseId:884},

        // === ALOLAN (custom IDs 12001-12012) ===
        {id:12001,name:'vulpix-alola',base:'vulpix',variant:'alola',baseId:37},
        {id:12002,name:'ninetales-alola',base:'ninetales',variant:'alola',baseId:38},
        {id:12003,name:'sandshrew-alola',base:'sandshrew',variant:'alola',baseId:27},
        {id:12004,name:'sandslash-alola',base:'sandslash',variant:'alola',baseId:28},
        {id:12005,name:'raichu-alola',base:'raichu',variant:'alola',baseId:26},
        {id:12006,name:'geodude-alola',base:'geodude',variant:'alola',baseId:74},
        {id:12007,name:'graveler-alola',base:'graveler',variant:'alola',baseId:75},
        {id:12008,name:'golem-alola',base:'golem',variant:'alola',baseId:76},
        {id:12009,name:'grimer-alola',base:'grimer',variant:'alola',baseId:88},
        {id:12010,name:'muk-alola',base:'muk',variant:'alola',baseId:89},
        {id:12011,name:'exeggutor-alola',base:'exeggutor',variant:'alola',baseId:103},
        {id:12012,name:'marowak-alola',base:'marowak',variant:'alola',baseId:105},

        // === GALARIAN (custom IDs 12013-12025) ===
        {id:12013,name:'ponyta-galar',base:'ponyta',variant:'galar',baseId:77},
        {id:12014,name:'rapidash-galar',base:'rapidash',variant:'galar',baseId:78},
        {id:12015,name:'slowpoke-galar',base:'slowpoke',variant:'galar',baseId:79},
        {id:12016,name:'slowbro-galar',base:'slowbro',variant:'galar',baseId:80},
        {id:12017,name:'weezing-galar',base:'weezing',variant:'galar',baseId:110},
        {id:12018,name:'mr-mime-galar',base:'mr. mime',variant:'galar',baseId:122},
        {id:12019,name:'corsola-galar',base:'corsola',variant:'galar',baseId:222},
        {id:12020,name:'zigzagoon-galar',base:'zigzagoon',variant:'galar',baseId:263},
        {id:12021,name:'linoone-galar',base:'linoone',variant:'galar',baseId:264},
        {id:12022,name:'darumaka-galar',base:'darumaka',variant:'galar',baseId:554},
        {id:12024,name:'yamask-galar',base:'yamask',variant:'galar',baseId:562},
        {id:12025,name:'stunfisk-galar',base:'stunfisk',variant:'galar',baseId:618},

        // === HISUIAN (custom IDs 12026-12036) ===
        {id:12026,name:'growlithe-hisui',base:'growlithe',variant:'hisui',baseId:58},
        {id:12027,name:'arcanine-hisui',base:'arcanine',variant:'hisui',baseId:59},
        {id:12028,name:'voltorb-hisui',base:'voltorb',variant:'hisui',baseId:100},
        {id:12029,name:'electrode-hisui',base:'electrode',variant:'hisui',baseId:101},
        {id:12030,name:'typhlosion-hisui',base:'typhlosion',variant:'hisui',baseId:157},
        {id:12031,name:'qwilfish-hisui',base:'qwilfish',variant:'hisui',baseId:211},
        {id:12032,name:'sneasel-hisui',base:'sneasel',variant:'hisui',baseId:215},
        {id:12033,name:'sliggoo-hisui',base:'sliggoo',variant:'hisui',baseId:705},
        {id:12034,name:'goodra-hisui',base:'goodra',variant:'hisui',baseId:706},
        {id:12035,name:'avalugg-hisui',base:'avalugg',variant:'hisui',baseId:713},
        {id:12036,name:'braviary-hisui',base:'braviary',variant:'hisui',baseId:628},

        // === PALDEAN (custom ID 12037) ===
        {id:12037,name:'wooper-paldea',base:'wooper',variant:'paldea',baseId:194}
    ];

    console.log(`[Variant] Processing ${VARIANTS.length} variants...`);

    // Check which already exist
    const { data: existing } = await db.from('pokemon').select('id');
    const existingIds = new Set((existing || []).map(p => p.id));
    const toInsert = VARIANTS.filter(v => !existingIds.has(v.id));
    console.log(`[Variant] ${existingIds.size} already in DB, ${toInsert.length} to insert`);

    let inserted = 0;
    let errors = 0;

    for (const v of toInsert) {
        try {
            const resp = await fetch(`https://pokeapi.co/api/v2/pokemon/${v.name}`);
            if (!resp.ok) { console.warn(`  ${v.name} not found on PokeAPI`); errors++; continue; }
            const data = await resp.json();

            const types = data.types.map(t => t.type.name);
            const stats = {};
            data.stats.forEach(s => {
                const key = s.stat.name.replace('special-attack', 'sp_atk').replace('special-defense', 'sp_def').replace('hp', 'hp').replace('attack', 'attack').replace('defense', 'defense').replace('speed', 'speed');
                stats[key] = s.base_stat;
            });

            const spriteFront = data.sprites.front_default || '';
            const spriteBack = data.sprites.back_default || '';
            const spriteOfficial = data.sprites.other?.['official-artwork']?.front_default || '';
            const spriteHome = data.sprites.other?.home?.front_default || '';

            const { error } = await db.from('pokemon').upsert({
                id: v.id,
                name: v.base.charAt(0).toUpperCase() + v.base.slice(1) + ` (${v.variant.charAt(0).toUpperCase() + v.variant.slice(1)})`,
                types,
                hp: stats.hp || 0,
                attack: stats.attack || 0,
                defense: stats.defense || 0,
                sp_atk: stats.sp_atk || 0,
                sp_def: stats.sp_def || 0,
                speed: stats.speed || 0,
                sprite_front: spriteFront,
                sprite_back: spriteBack,
                sprite_official: spriteOfficial,
                sprite_home: spriteHome,
                variant: v.variant,
                base_pokemon_id: v.baseId
            }, { onConflict: 'id' });

            if (!error) { inserted++; console.log(`  ${v.name} ✓ (${types.join('/')})`); }
            else { errors++; console.error(`  ${v.name} ERROR:`, error.message); }

            await new Promise(r => setTimeout(r, 100));
        } catch (e) { errors++; console.error(`  ${v.name} EXCEPTION:`, e.message); }
    }

    console.log(`\n[DONE] ${inserted} variants inserted, ${errors} errors`);
    console.log('[DONE] Refresh the Pokedex to see them.');
})();
