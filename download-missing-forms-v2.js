const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZXZ3bm5wenNvbHRicnJqZHRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MDE3NjEsImV4cCI6MjEwMDQ3Nzc2MX0.xlZ4LgzmQ-DZUz1kDk3oucmlvjCkty1TgzfN2IDxhoY';
const BASE = 'odevwnnpzsoltbrrjdts.supabase.co';

const DIRS = {
  animFront: path.join(__dirname, 'assets/sprites/pokemon-animated'),
  animFrontShiny: path.join(__dirname, 'assets/sprites/pokemon-animated-shiny'),
  animBack: path.join(__dirname, 'assets/sprites/pokemon-animated-back'),
  animBackShiny: path.join(__dirname, 'assets/sprites/pokemon-animated-back-shiny'),
};

function download(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) { resolve(null); return; }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', () => resolve(null));
  });
}

function uploadBuffer(buffer, storagePath, contentType) {
  return new Promise((resolve) => {
    const req = https.request({
      method: 'POST', hostname: BASE,
      path: `/storage/v1/object/sprites/${storagePath}`,
      headers: { 'apikey': API_KEY, 'Authorization': 'Bearer ' + API_KEY, 'Content-Type': contentType, 'x-upsert': 'true', 'Content-Length': buffer.length }
    }, (res) => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(res.statusCode===200||res.statusCode===201)); });
    req.on('error', () => resolve(false));
    req.write(buffer);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Still missing after first pass
const STILL_MISSING = [
  // Necrozma - try "necrozma" as base and specific forms
  {id:13008,alts:['necrozma-dusk-mane','necrozma_dusk_mane','necrozma-mega-dusk','necrozmadusk']},
  {id:13009,alts:['necrozma-dawn-wings','necrozma_dawn_wings','necrozma-mega-dawn','necrozmadawn']},
  // Terapagos
  {id:13035,alts:['terapagos-terastal','terapagos']},
  {id:13036,alts:['terapagos-stellar','terapagos']},
  // Ogerpon
  {id:13037,alts:['ogerpon-wellspring','ogerponwellspring','ogerpon-wellspring-mask']},
  {id:13038,alts:['ogerpon-hearthflame','ogerponhearthflame','ogerpon-hearthflame-mask']},
  {id:13039,alts:['ogerpon-cornerstone','ogerponcornerstone','ogerpon-cornerstone-mask']},
  // GMax forms
  {id:13041,alts:['urshifu-rapid-strike-gmax','urshifu-rapidstrikegmax','urshifurapidstrikegmax']},
  {id:13042,alts:['urshifu-single-strike-gmax','urshifu-singlestrikegmax','urshifusinglestrikegmax']},
  {id:13050,alts:['toxtricity-amped-gmax','toxtricitygmax','toxtricity-gmax']},
  {id:13051,alts:['toxtricity-low-key-gmax','toxtricitylowkeygmax','toxtricity-lowkeygmax']},
];

// Try every possible Showdown folder + GitHub raw
const SHOWDOWN_FOLDERS = [
  'ani', 'ani-shiny', 'ani-back', 'ani-back-shiny',
  'gen5ani', 'gen5ani-shiny', 'gen5back', 'gen5back-shiny',
  'xyani', 'xyani-shiny', 'xyani-back', 'xyani-back-shiny',
  'bw', 'bw-shiny', 'bw-back', 'bw-back-shiny',
  'gen5', 'gen5-shiny', 'gen5-back', 'gen5-back-shiny',
];
const DIR_KEYS = ['animFront', 'animFrontShiny', 'animBack', 'animBackShiny'];
const STORAGE_NAMES = ['animated-front', 'animated-front-shiny', 'animated-back', 'animated-back-shiny'];

// Also try GitHub raw URLs for Showdown sprites
const GITHUB_REPOS = [
  'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/sprites/ani',
  'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/sprites/ani-shiny',
  'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/sprites/ani-back',
  'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/sprites/ani-back-shiny',
  'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/sprites/gen5ani',
  'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/sprites/gen5ani-shiny',
  'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/sprites/gen5back',
  'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/sprites/gen5back-shiny',
];

async function main() {
  console.log(`Trying exhaustive sources for ${STILL_MISSING.length} forms...\n`);
  let found = 0, stillMissing = 0;

  for (const m of STILL_MISSING) {
    let allFound = true;

    for (let i = 0; i < 4; i++) {
      const fileName = m.id + '.gif';
      const localPath = path.join(DIRS[DIR_KEYS[i]], fileName);
      if (fs.existsSync(localPath)) continue;

      let ok = false;

      // Try all Showdown folders
      for (const alt of m.alts) {
        for (const folder of SHOWDOWN_FOLDERS) {
          const url = `https://play.pokemonshowdown.com/sprites/${folder}/${alt}.gif`;
          const buf = await download(url);
          if (buf && buf.length > 100) {
            fs.writeFileSync(localPath, buf);
            const sp = `${STORAGE_NAMES[i]}/${fileName}`;
            await uploadBuffer(buf, sp, 'image/gif');
            ok = true; found++;
            break;
          }
          await sleep(30);
        }
        if (ok) break;
      }

      // Try GitHub raw
      if (!ok) {
        for (const alt of m.alts) {
          const githubIdx = i; // map to github repo index
          if (GITHUB_REPOS[githubIdx]) {
            const url = `${GITHUB_REPOS[githubIdx]}/${alt}.gif`;
            const buf = await download(url);
            if (buf && buf.length > 100) {
              fs.writeFileSync(localPath, buf);
              const sp = `${STORAGE_NAMES[i]}/${fileName}`;
              await uploadBuffer(buf, sp, 'image/gif');
              ok = true; found++;
              break;
            }
            await sleep(30);
          }
        }
      }

      if (!ok) { allFound = false; stillMissing++; }
    }

    console.log(`  ${allFound ? '✓' : '✗'} ID ${m.id} (${m.alts[0]})`);
  }

  console.log(`\nFound: ${found}, Still missing: ${stillMissing}`);

  // Check final state
  console.log('\n--- Final check ---');
  const forms = [
    {id:13008,name:'Necrozma Dusk'},{id:13009,name:'Necrozma Dawn'},
    {id:13035,name:'Terapagos Terastal'},{id:13036,name:'Terapagos Stellar'},
    {id:13037,name:'Ogerpon Wellspring'},{id:13038,name:'Ogerpon Hearthflame'},{id:13039,name:'Ogerpon Cornerstone'},
    {id:13041,name:'Urshifu RS Gmax'},{id:13042,name:'Urshifu SS Gmax'},
    {id:13050,name:'Toxtricity Amped Gmax'},{id:13051,name:'Toxtricity LK Gmax'},
  ];
  for (const f of forms) {
    const front = fs.existsSync(path.join(DIRS.animFront, f.id+'.gif'));
    const frontS = fs.existsSync(path.join(DIRS.animFrontShiny, f.id+'.gif'));
    const back = fs.existsSync(path.join(DIRS.animBack, f.id+'.gif'));
    const backS = fs.existsSync(path.join(DIRS.animBackShiny, f.id+'.gif'));
    const any = front || frontS || back || backS;
    console.log(`  ${any ? '○' : '✗'} ${f.name} (id:${f.id}) front:${front} frontS:${frontS} back:${back} backS:${backS}`);
  }
}

main().catch(console.error);
