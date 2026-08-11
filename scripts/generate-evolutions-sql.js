// Generate evolutions SQL file from PokeAPI
// Run: node scripts/generate-evolutions-sql.js
// Then paste the output SQL into Supabase Dashboard SQL Editor

const https = require('https');

function fetch(url) {
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

async function main() {
    console.error('Fetching all pokemon species from PokeAPI...');

    // Get all pokemon species (up to gen 9 = 1025)
    const speciesList = [];
    for (let id = 1; id <= 1025; id++) {
        speciesList.push(id);
    }

    const chainsProcessed = new Set();
    const evolutions = [];

    for (const id of speciesList) {
        try {
            const species = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
            const chainUrl = species.evolution_chain?.url;
            if (!chainUrl) continue;

            const chainId = chainUrl.split('/').filter(Boolean).pop();
            if (chainsProcessed.has(chainId)) continue;
            chainsProcessed.add(chainId);

            const chain = await fetch(chainUrl);

            function parseChain(node) {
                if (!node) return;
                const fromId = parseInt(node.species.url.split('/').filter(Boolean).pop());

                for (const evo of (node.evolves_to || [])) {
                    const toId = parseInt(evo.species.url.split('/').filter(Boolean).pop());
                    const details = evo.evolution_details[0] || {};

                    evolutions.push({
                        from_id: fromId,
                        to_id: toId,
                        method: details.trigger?.name || 'unknown',
                        value: details.min_level?.toString() || details.item?.name || details.held_item?.name || null,
                        held_item: details.held_item?.name || null,
                        trade: details.trigger?.name === 'trade',
                        min_happiness: details.min_happiness || 0,
                        min_level: details.min_level || 0,
                        time_of_day: details.time_of_day || null
                    });

                    parseChain(evo);
                }
            }

            parseChain(chain.chain);

            if (id % 100 === 0) console.error(`Progress: ${id}/1025 species...`);
            await new Promise(r => setTimeout(r, 30));
        } catch (e) {
            // skip errors
        }
    }

    console.error(`Found ${evolutions.length} evolution relationships`);

    // Filter to only pokemon that exist in our DB (1-1025 + variants 10001-12037)
    // We'll include all of them since the SQL will use ON CONFLICT DO NOTHING
    let sql = '-- Pokemon Evolutions (auto-generated from PokeAPI)\n';
    sql += '-- Run in Supabase Dashboard > SQL Editor\n';
    sql += '-- Uses ON CONFLICT DO NOTHING so safe to re-run\n\n';
    sql += 'INSERT INTO pokemon_evolutions (from_pokemon_id, to_pokemon_id, evolution_method, evolution_value, held_item, trade_pokemon, min_happiness, min_level, time_of_day)\n';
    sql += 'VALUES\n';

    const rows = evolutions.map(e => {
        const from = `(${e.from_id}`;
        const to = `${e.to_id}`;
        const method = `'${(e.method || 'unknown').replace(/'/g, "''")}'`;
        const value = e.value ? `'${e.value.replace(/'/g, "''")}'` : 'NULL';
        const held = e.held_item ? `'${e.held_item.replace(/'/g, "''")}'` : 'NULL';
        const trade = e.trade ? 'TRUE' : 'FALSE';
        const happy = e.min_happiness || 0;
        const level = e.min_level || 0;
        const tod = e.time_of_day ? `'${e.time_of_day}'` : 'NULL';
        return `(${e.from_id}, ${e.to_id}, ${method}, ${value}, ${held}, ${trade}, ${happy}, ${level}, ${tod})`;
    });

    sql += rows.join(',\n');
    sql += '\nON CONFLICT DO NOTHING;\n';

    // Write to file
    const fs = require('fs');
    fs.writeFileSync('supabase-insert-evolutions.sql', sql);
    console.error(`Wrote supabase-insert-evolutions.sql (${rows.length} rows)`);
}

main().catch(console.error);
