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

// Missing sprites - try alternative Showdown names and sources
const MISSING = [
  // Necrozma - Showdown uses "necrozma-dusk-mane" not "necrozma-dusk"
  {id:13008,alts:['necrozma-dusk-mane','necrozma_dusk_mane','necrozmadusk']},
  {id:13009,alts:['necrozma-dawn-wings','necrozma_dawn_wings','necrozmadawn']},
  // Terapagos - very new, try multiple
  {id:13035,alts:['terapagos-terastal','terapagos']},
  {id:13036,alts:['terapagos-stellar','terapagos']},
  // Ogerpon masks
  {id:13037,alts:['ogerpon-wellspring','ogerponwellspring']},
  {id:13038,alts:['ogerpon-hearthflame','ogerponhearthflame']},
  {id:13039,alts:['ogerpon-cornerstone','ogerponcornerstone']},
  // Urshifu
  {id:13040,alts:['urshifu-rapid-strike','urshifu']},
  {id:13041,alts:['urshifu-rapid-strike-gmax','urshifurapidstrikegmax']},
  {id:13042,alts:['urshifu-single-strike-gmax','urshifusinglestrikegmax']},
  // Toxtricity
  {id:13049,alts:['toxtricity-low-key','toxtricity']},
  {id:13050,alts:['toxtricity-amped-gmax','toxtricitygmax']},
  {id:13051,alts:['toxtricity-low-key-gmax','toxtricitylowkeygmax']},
  // Dudunsparce
  {id:13052,alts:['dudunsparce-three-segment','dudunsparce']},
  // Maushold
  {id:13054,alts:['maushold-family-of-three','maushold']},
  // Palkia/Dialga Origin (Legends Arceus)
  {id:13059,alts:['palkia-origin','palkia']},
  {id:13060,alts:['dialga-origin','dialga']},
  // Darmanitan Galar Zen
  {id:13061,alts:['darmanitan-galar-zen','darmanitan-galar']},
  // Oinkologne
  {id:13062,alts:['oinkologne-female','oinkologne']},
  // Basculegion
  {id:13063,alts:['basculegion-female','basculegion']},
];

const SHOWDOWN_FOLDERS = ['ani', 'ani-shiny', 'ani-back', 'ani-back-shiny'];
const DIR_KEYS = ['animFront', 'animFrontShiny', 'animBack', 'animBackShiny'];

async function main() {
  console.log(`Trying alternative sources for ${MISSING.length} forms...\n`);
  let found = 0, stillMissing = 0;

  for (const m of MISSING) {
    let allFound = true;

    for (let i = 0; i < 4; i++) {
      const fileName = m.id + '.gif';
      const localPath = path.join(DIRS[DIR_KEYS[i]], fileName);
      if (fs.existsSync(localPath)) continue;

      let ok = false;
      for (const alt of m.alts) {
        // Try multiple Showdown folders
        for (const folder of SHOWDOWN_FOLDERS) {
          const url = `https://play.pokemonshowdown.com/sprites/${folder}/${alt}.gif`;
          const buf = await download(url);
          if (buf && buf.length > 100) {
            fs.writeFileSync(localPath, buf);
            const storagePath = DIR_KEYS[i].replace('animFront','animated-front').replace('animFrontShiny','animated-front-shiny').replace('animBack','animated-back').replace('animBackShiny','animated-back-shiny') + '/' + fileName;
            await uploadBuffer(buf, storagePath, 'image/gif');
            ok = true;
            found++;
            break;
          }
          await sleep(50);
        }
        if (ok) break;
      }
      if (!ok) { allFound = false; stillMissing++; }
    }

    const status = allFound ? '✓' : '✗';
    console.log(`  ${status} ID ${m.id} (${m.alts[0]})`);
  }

  console.log(`\nFound: ${found}, Still missing: ${stillMissing}`);
}

main().catch(console.error);
