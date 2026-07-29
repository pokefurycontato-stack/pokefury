const https = require('https');
const fs = require('fs');

function fetch(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'Accept': 'application/json' } }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
                try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
            });
            res.on('error', reject);
        }).on('error', reject);
    });
}

const FORMS = [
    {id:13001,name:'Calyrex (Ice Rider)',pokeapi:'calyrex-ice',baseId:898},
    {id:13002,name:'Calyrex (Shadow Rider)',pokeapi:'calyrex-shadow',baseId:898},
    {id:13003,name:'Eternatus (Eternamax)',pokeapi:'eternatus-eternamax',baseId:890},
    {id:13004,name:'Zacian (Crowned Sword)',pokeapi:'zacian-crowned',baseId:888},
    {id:13005,name:'Zamazenta (Crowned Shield)',pokeapi:'zamazenta-crowned',baseId:889},
    {id:13006,name:'Kyurem (White)',pokeapi:'kyurem-white',baseId:646},
    {id:13007,name:'Kyurem (Black)',pokeapi:'kyurem-black',baseId:646},
    {id:13008,name:'Necrozma (Dusk Mane)',pokeapi:'necrozma-dusk',baseId:800},
    {id:13009,name:'Necrozma (Dawn Wings)',pokeapi:'necrozma-dawn',baseId:800},
    {id:13010,name:'Necrozma (Ultra)',pokeapi:'necrozma-ultra',baseId:800},
    {id:13011,name:'Zygarde (10%)',pokeapi:'zygarde-10',baseId:718},
    {id:13012,name:'Zygarde (Complete)',pokeapi:'zygarde-complete',baseId:718},
    {id:13013,name:'Deoxys (Attack)',pokeapi:'deoxys-attack',baseId:386},
    {id:13014,name:'Deoxys (Defense)',pokeapi:'deoxys-defense',baseId:386},
    {id:13015,name:'Deoxys (Speed)',pokeapi:'deoxys-speed',baseId:386},
    {id:13016,name:'Giratina (Origin)',pokeapi:'giratina-origin',baseId:487},
    {id:13017,name:'Shaymin (Sky)',pokeapi:'shaymin-sky',baseId:492},
    {id:13018,name:'Rotom (Heat)',pokeapi:'rotom-heat',baseId:479},
    {id:13019,name:'Rotom (Wash)',pokeapi:'rotom-wash',baseId:479},
    {id:13020,name:'Rotom (Frost)',pokeapi:'rotom-frost',baseId:479},
    {id:13021,name:'Rotom (Fan)',pokeapi:'rotom-fan',baseId:479},
    {id:13022,name:'Rotom (Mow)',pokeapi:'rotom-mow',baseId:479},
    {id:13023,name:'Castform (Sunny)',pokeapi:'castform-sunny',baseId:351},
    {id:13024,name:'Castform (Rainy)',pokeapi:'castform-rainy',baseId:351},
    {id:13025,name:'Castform (Snowy)',pokeapi:'castform-snowy',baseId:351},
    {id:13026,name:'Cherrim (Sunshine)',pokeapi:'cherrim-sunshine',baseId:421},
    {id:13027,name:'Aegislash (Blade)',pokeapi:'aegislash-blade',baseId:681},
    {id:13028,name:'Wishiwashi (School)',pokeapi:'wishiwashi-school',baseId:746},
    {id:13029,name:'Mimikyu (Busted)',pokeapi:'mimikyu-busted',baseId:778},
    {id:13030,name:'Minior (Meteor)',pokeapi:'minior-orange-meteor',baseId:774},
    {id:13031,name:'Morpeko (Hangry)',pokeapi:'morpeko-hangry',baseId:877},
    {id:13032,name:'Cramorant (Gorging)',pokeapi:'cramorant-gorging',baseId:845},
    {id:13033,name:'Eiscue (Noice Face)',pokeapi:'eiscue-noice',baseId:875},
    {id:13034,name:'Zarude (Dada)',pokeapi:'zarude-dada',baseId:893},
    {id:13035,name:'Terapagos (Terastal)',pokeapi:'terapagos-terastal',baseId:1024},
    {id:13036,name:'Terapagos (Stellar)',pokeapi:'terapagos-stellar',baseId:1024},
    {id:13037,name:'Ogerpon (Wellspring)',pokeapi:'ogerpon-wellspring-mask',baseId:1017},
    {id:13038,name:'Ogerpon (Hearthflame)',pokeapi:'ogerpon-hearthflame-mask',baseId:1017},
    {id:13039,name:'Ogerpon (Cornerstone)',pokeapi:'ogerpon-cornerstone-mask',baseId:1017},
    {id:13040,name:'Urshifu (Rapid Strike)',pokeapi:'urshifu-rapid-strike',baseId:892},
    {id:13041,name:'Urshifu (Single Strike G-Max)',pokeapi:'urshifu-single-strike-gmax',baseId:892},
    {id:13042,name:'Urshifu (Rapid Strike G-Max)',pokeapi:'urshifu-rapid-strike-gmax',baseId:892},
    {id:13043,name:'Enamorus (Therian)',pokeapi:'enamorus-therian',baseId:905},
    {id:13044,name:'Tornadus (Therian)',pokeapi:'tornadus-therian',baseId:641},
    {id:13045,name:'Thundurus (Therian)',pokeapi:'thundurus-therian',baseId:642},
    {id:13046,name:'Landorus (Therian)',pokeapi:'landorus-therian',baseId:645},
    {id:13047,name:'Meloetta (Pirouette)',pokeapi:'meloetta-pirouette',baseId:648},
    {id:13048,name:'Hoopa (Unbound)',pokeapi:'hoopa-unbound',baseId:720},
    {id:13049,name:'Toxtricity (Low Key)',pokeapi:'toxtricity-low-key',baseId:849},
    {id:13050,name:'Toxtricity (Amped G-Max)',pokeapi:'toxtricity-amped-gmax',baseId:849},
    {id:13051,name:'Toxtricity (Low Key G-Max)',pokeapi:'toxtricity-low-key-gmax',baseId:849},
    {id:13052,name:'Dudunsparce (3 Segment)',pokeapi:'dudunsparce-three-segment',baseId:982},
    {id:13053,name:'Palafin (Hero)',pokeapi:'palafin-hero',baseId:964},
    {id:13054,name:'Maushold (Family 3)',pokeapi:'maushold-family-of-three',baseId:925},
    {id:13055,name:'Sinistea (Antique)',pokeapi:'sinistea-antique',baseId:854},
    {id:13056,name:'Polteageist (Antique)',pokeapi:'polteageist-antique',baseId:855},
    {id:13057,name:'Gimmighoul (Roaming)',pokeapi:'gimmighoul-roaming',baseId:999},
    {id:13058,name:'Ursaluna (Bloodmoon)',pokeapi:'ursaluna-bloodmoon',baseId:901},
    {id:13059,name:'Palkia (Origin)',pokeapi:'palkia-origin',baseId:484},
    {id:13060,name:'Dialga (Origin)',pokeapi:'dialga-origin',baseId:483},
    {id:13061,name:'Darmanitan (Galar Zen)',pokeapi:'darmanitan-galar-zen',baseId:555},
    {id:13062,name:'Oinkologne (Female)',pokeapi:'oinkologne-female',baseId:916},
    {id:13063,name:'Revavroom (Schedar)',pokeapi:'revavroom-schedar',baseId:966},
    {id:13064,name:'Revavroom (Navi)',pokeapi:'revavroom-navi',baseId:966},
    {id:13065,name:'Revavroom (Ruchbah)',pokeapi:'revavroom-ruchbah',baseId:966},
    {id:13066,name:'Revavroom (Caph)',pokeapi:'revavroom-caph',baseId:966},
    {id:13067,name:'Basculegion (Female)',pokeapi:'basculegion-female',baseId:902},
    {id:13068,name:'Venusaur (G-Max)',pokeapi:'venusaur-gmax',baseId:3},
    {id:13069,name:'Blastoise (G-Max)',pokeapi:'blastoise-gmax',baseId:9},
];

async function main() {
    console.log(`Fetching ${FORMS.length} special forms...`);
    let sql = '-- Special Forms (auto-generated)\n';
    sql += '-- Run in Supabase Dashboard > SQL Editor\n';
    sql += 'INSERT INTO pokemon (id, name, types, hp, attack, defense, sp_atk, sp_def, speed, variant, base_pokemon_id)\nVALUES\n';

    const rows = [];
    let ok = 0, fail = 0;

    for (const form of FORMS) {
        try {
            const data = await fetch(`https://pokeapi.co/api/v2/pokemon/${form.pokeapi}`);
            const types = data.types.map(t => t.type.name);
            const stats = {};
            data.stats.forEach(s => {
                const k = s.stat.name.replace('special-attack','sp_atk').replace('special-defense','sp_def');
                stats[k] = s.base_stat;
            });
            const name = form.name.replace(/'/g, "''");
            rows.push(`(${form.id}, '${name}', '{${types.join(',')}}', ${stats.hp||0}, ${stats.attack||0}, ${stats.defense||0}, ${stats.sp_atk||0}, ${stats.sp_def||0}, ${stats.speed||0}, 'form', ${form.baseId})`);
            ok++;
            console.log(`  ✓ ${form.pokeapi} → ID ${form.id}`);
            await new Promise(r => setTimeout(r, 50));
        } catch (e) { fail++; console.log(`  ✗ ${form.pokeapi}: ${e.message}`); }
    }

    sql += rows.join(',\n') + '\nON CONFLICT (id) DO NOTHING;\n';
    fs.writeFileSync('supabase-insert-special-forms.sql', sql);
    console.log(`\nDone: ${ok} forms inserted, ${fail} failed`);
}

main().catch(console.error);
