const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://odevwnnpzsoltbrrjdts.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZXZ3bm5wenNvbHRicnJqZHRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MDE3NjEsImV4cCI6MjEwMDQ3Nzc2MX0.xlZ4LgzmQ-DZUz1kDk3oucmlvjCkty1TgzfN2IDxhoY';

const BASE_DIR = path.join(__dirname, 'assets', 'sprites');
const ANIMATED_DIR = path.join(BASE_DIR, 'pokemon-animated');
const SHINY_DIR = path.join(BASE_DIR, 'pokemon-animated-shiny');

const SHOWDOWN_BASE = 'https://play.pokemonshowdown.com/sprites/';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetch(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const proto = url.startsWith('https') ? https : http;
        const req = proto.get(url, { timeout: 20000, headers }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetch(res.headers.location).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) { res.resume(); return resolve(null); }
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
    });
}

async function downloadFile(url, filepath) {
    if (fs.existsSync(filepath) && fs.statSync(filepath).size > 100) return 'skip';
    const data = await fetch(url);
    if (!data || data.length < 100) return 'fail';
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, data);
    return 'ok';
}

async function fetchDirListing(dirUrl) {
    const html = await fetch(dirUrl);
    if (!html) return [];
    const text = html.toString();
    const files = [];
    const regex = /href="\.\/([^"]+\.gif)"/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        files.push(match[1]);
    }
    return files;
}

function toShowdownName(name) {
    let n = name.toLowerCase()
        .replace(/['']/g, '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\./g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9\-]/g, '');

    const renames = {
        'jangmo-o': 'jangmoo',
        'hakamo-o': 'hakamoo',
        'kommo-o': 'commoo',
        'ho-oh': 'hooh',
        'mr-mime': 'mrmime',
        'mr-rime': 'mrrime',
        'type-null': 'typenull',
        'tapu-koko': 'tapukoko',
        'tapu-lele': 'tapulele',
        'tapu-bulu': 'tapubulu',
        'tapu-fini': 'tapufini',
        'flabebe': 'flabebe',
        'nidoran-f': 'nidoranf',
        'nidoran-m': 'nidoranm',
    };
    if (renames[n]) return renames[n];

    return n;
}

const DEFAULT_FORMS = {
    'deoxys-normal': 'deoxys',
    'wormadam-plant': 'wormadam',
    'giratina-altered': 'giratina',
    'shaymin-land': 'shaymin',
    'basculin-red-striped': 'basculin',
    'darmanitan-standard': 'darmanitan',
    'frillish-male': 'frillish',
    'jellicent-male': 'jellicent',
    'tornadus-incarnate': 'tornadus',
    'thundurus-incarnate': 'thundurus',
    'landorus-incarnate': 'landorus',
    'keldeo-ordinary': 'keldeo',
    'meloetta-aria': 'meloetta',
    'pyroar-male': 'pyroar',
    'meowstic-male': 'meowstic',
    'aegislash-shield': 'aegislash',
    'pumpkaboo-average': 'pumpkaboo',
    'gourgeist-average': 'gourgeist',
    'zygarde-50': 'zygarde',
    'oricorio-baile': 'oricorio',
    'lycanroc-midday': 'lycanroc',
    'wishiwashi-solo': 'wishiwashi',
    'minior-red-meteor': 'minior',
    'mimikyu-disguised': 'mimikyu',
    'toxtricity-amped': 'toxtricity',
    'eiscue-ice': 'eiscue',
    'indeedee-male': 'indeedee',
    'morpeko-full-belly': 'morpeko',
    'urshifu-single-strike': 'urshifu',
    'basculegion-male': 'basculegion',
    'enamorus-incarnate': 'enamorus',
    'oinkologne-male': 'oinkologne',
    'maushold-family-of-four': 'maushold',
    'squawkabilly-green-plumage': 'squawkabilly',
    'palafin-zero': 'palafin',
    'tatsugiri-curly': 'tatsugiri',
    'dudunsparce-two-segment': 'dudunsparce',
    'mime-jr': 'mimejr',
    'great-tusk': 'greattusk',
    'scream-tail': 'screamtail',
    'brute-bonnet': 'brutebonnet',
    'flutter-mane': 'fluttermane',
    'slither-wing': 'slitherwing',
    'sandy-shocks': 'sandyshocks',
    'iron-treads': 'irontreads',
    'iron-bundle': 'ironbundle',
    'iron-hands': 'ironhands',
    'iron-jugulis': 'ironjugulis',
    'iron-moth': 'ironmoth',
    'iron-thorns': 'ironthorns',
    'iron-treads': 'irontreads',
    'iron-bundle': 'ironbundle',
    'iron-hands': 'ironhands',
    'iron-jugulis': 'ironjugulis',
};

function buildVariantSuffixes(variant) {
    if (!variant || variant === 'normal') return [''];
    if (variant === 'mega') return ['-mega'];
    if (variant === 'alola') return ['-alola'];
    if (variant === 'galar') return ['-galar'];
    if (variant === 'hisui') return ['-hisui'];
    if (variant === 'paldea') return ['-paldea'];
    if (variant === 'gmax') return ['-gmax'];
    return [''];
}

async function main() {
    console.log('Fetching Pokemon from Supabase...');
    const dbHeaders = { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + SUPABASE_ANON };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/pokemon?select=id,name,variant,base_pokemon_id&order=id.asc`, dbHeaders);
    if (!res) { console.error('Failed to fetch Pokemon'); process.exit(1); }
    const pokemon = JSON.parse(res.toString());
    console.log(`Found ${pokemon.length} Pokemon`);

    console.log('Fetching Showdown ani/ file listing...');
    const aniFiles = await fetchDirListing(SHOWDOWN_BASE + 'ani/');
    console.log(`Found ${aniFiles.length} files in ani/`);

    console.log('Fetching Showdown ani-shiny/ file listing...');
    const aniShinyFiles = await fetchDirListing(SHOWDOWN_BASE + 'ani-shiny/');
    console.log(`Found ${aniShinyFiles.length} files in ani-shiny/`);

    const aniSet = new Set(aniFiles.map(f => f.replace('.gif', '')));
    const aniShinySet = new Set(aniShinyFiles.map(f => f.replace('.gif', '')));

    // Debug: show some sample names
    console.log('Sample ani names:', [...aniSet].slice(0, 15));
    console.log('Sample pokemon to convert:', pokemon.slice(0, 10).map(p => `${p.name} -> ${toShowdownName(p.name)} (${p.variant})`));

    fs.mkdirSync(ANIMATED_DIR, { recursive: true });
    fs.mkdirSync(SHINY_DIR, { recursive: true });

    let downloadedNormal = 0;
    let downloadedShiny = 0;
    let skippedNormal = 0;
    let skippedShiny = 0;
    let missingNormal = [];
    let missingShiny = [];

    const batchSize = 5;
    const total = pokemon.length;

    for (let i = 0; i < total; i += batchSize) {
        const batch = pokemon.slice(i, i + batchSize);

        await Promise.all(batch.map(async (p) => {
            const baseName = toShowdownName(p.name);
            const suffixes = buildVariantSuffixes(p.variant);
            const id = p.id;

            for (const suffix of suffixes) {
                const sdName = baseName + suffix;
                const targetNormal = path.join(ANIMATED_DIR, id + '.gif');
                const targetShiny = path.join(SHINY_DIR, id + '.gif');

                // Try default form name first for base pokemon
                const defaultForm = DEFAULT_FORMS[sdName];
                let finalName = sdName;
                if (defaultForm && aniSet.has(defaultForm)) {
                    finalName = defaultForm;
                }

                // Download normal animated sprite
                if (aniSet.has(finalName)) {
                    const result = await downloadFile(SHOWDOWN_BASE + 'ani/' + finalName + '.gif', targetNormal);
                    if (result === 'ok') downloadedNormal++;
                    else if (result === 'skip') skippedNormal++;
                } else {
                    missingNormal.push({ id, name: p.name, variant: p.variant, sdName: finalName });
                }

                // Download shiny animated sprite
                let shinyName = finalName;
                if (defaultForm && aniShinySet.has(defaultForm)) {
                    shinyName = defaultForm;
                }
                if (aniShinySet.has(shinyName)) {
                    const result = await downloadFile(SHOWDOWN_BASE + 'ani-shiny/' + shinyName + '.gif', targetShiny);
                    if (result === 'ok') downloadedShiny++;
                    else if (result === 'skip') skippedShiny++;
                } else {
                    missingShiny.push({ id, name: p.name, variant: p.variant, sdName: shinyName });
                }
            }
        }));

        const pct = Math.min(100, Math.round(((i + batchSize) / total) * 100));
        if ((i + batchSize) % 25 === 0 || i + batchSize >= total) {
            console.log(`[${pct}%] Normal: ${downloadedNormal} new / ${skippedNormal} cached / ${missingNormal.length} missing`);
            console.log(`        Shiny: ${downloadedShiny} new / ${skippedShiny} cached / ${missingShiny.length} missing`);
        }

        await sleep(100);
    }

    console.log('\n=== DOWNLOAD COMPLETE ===');
    console.log(`Normal: ${downloadedNormal} downloaded, ${skippedNormal} skipped, ${missingNormal.length} missing`);
    console.log(`Shiny:  ${downloadedShiny} downloaded, ${skippedShiny} skipped, ${missingShiny.length} missing`);

    if (missingNormal.length > 0) {
        console.log('\nMissing normal sprites:');
        missingNormal.forEach(m => console.log(`  ID ${m.id}: ${m.name} (${m.variant}) -> ${m.sdName}`));
    }

    fs.writeFileSync(path.join(__dirname, 'sprite-report.json'), JSON.stringify({
        downloadedNormal, downloadedShiny, skippedNormal, skippedShiny,
        missingNormal, missingShiny,
        timestamp: new Date().toISOString()
    }, null, 2));

    console.log('\nReport saved to sprite-report.json');
}

main().catch(console.error);
