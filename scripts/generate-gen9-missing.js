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

function escapeSQL(str) {
    return str.replace(/'/g, "''");
}

async function main() {
    const START = 1001;
    const END = 1025;
    const count = END - START + 1;
    console.log(`Fetching ${count} pokemon (IDs ${START}-${END})...`);

    let sql = '-- Gen 9 Missing Pokemon (auto-generated)\n';
    sql += '-- IDs 1001-1025 from PokeAPI\n';
    sql += 'INSERT INTO pokemon (id, name, types, hp, attack, defense, sp_atk, sp_def, speed, sprite_official, sprite_home, variant, base_pokemon_id)\nVALUES\n';

    const rows = [];
    let ok = 0, fail = 0;

    for (let id = START; id <= END; id++) {
        try {
            const data = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
            const name = escapeSQL(data.name);
            const types = data.types.map(t => t.type.name);
            const stats = {};
            data.stats.forEach(s => {
                const k = s.stat.name
                    .replace('special-attack', 'sp_atk')
                    .replace('special-defense', 'sp_def');
                stats[k] = s.base_stat;
            });

            const officialArt = data.sprites.other['official-artwork'].front_default || '';
            const homeSprite = data.sprites.other.home.front_default || '';

            rows.push(
                `(${id}, '${name}', '{${types.join(',')}}', ${stats.hp || 0}, ${stats.attack || 0}, ${stats.defense || 0}, ${stats.sp_atk || 0}, ${stats.sp_def || 0}, ${stats.speed || 0}, '${officialArt}', '${homeSprite}', 'normal', NULL)`
            );
            ok++;
            console.log(`  ✓ ${id} ${data.name}`);
            await new Promise(r => setTimeout(r, 50));
        } catch (e) {
            fail++;
            console.log(`  ✗ ${id}: ${e.message}`);
        }
    }

    sql += rows.join(',\n') + '\nON CONFLICT (id) DO NOTHING;\n';
    fs.writeFileSync('supabase-insert-gen9-missing.sql', sql);
    console.log(`\nDone: ${ok} pokemon inserted, ${fail} failed`);
    console.log('Output: supabase-insert-gen9-missing.sql');
}

main().catch(console.error);
