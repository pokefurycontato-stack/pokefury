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
  homeFront: path.join(__dirname, 'assets/sprites/pokemon-home'),
  homeFrontShiny: path.join(__dirname, 'assets/sprites/pokemon-home-shiny'),
};

Object.values(DIRS).forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const FORMS = [
  {id:13001,show:'calyrex-ice',pokeapi:898},
  {id:13002,show:'calyrex-shadow',pokeapi:898},
  {id:13003,show:'eternatus-eternamax',pokeapi:890},
  {id:13004,show:'zacian-crowned',pokeapi:888},
  {id:13005,show:'zamazenta-crowned',pokeapi:889},
  {id:13006,show:'kyurem-white',pokeapi:646},
  {id:13007,show:'kyurem-black',pokeapi:646},
  {id:13008,show:'necrozma-dusk',pokeapi:800},
  {id:13009,show:'necrozma-dawn',pokeapi:800},
  {id:13010,show:'necrozma-ultra',pokeapi:800},
  {id:13011,show:'zygarde-10',pokeapi:718},
  {id:13012,show:'zygarde-complete',pokeapi:718},
  {id:13013,show:'deoxys-attack',pokeapi:386},
  {id:13014,show:'deoxys-defense',pokeapi:386},
  {id:13015,show:'deoxys-speed',pokeapi:386},
  {id:13016,show:'giratina-origin',pokeapi:487},
  {id:13017,show:'shaymin-sky',pokeapi:492},
  {id:13018,show:'rotom-heat',pokeapi:479},
  {id:13019,show:'rotom-wash',pokeapi:479},
  {id:13020,show:'rotom-frost',pokeapi:479},
  {id:13021,show:'rotom-fan',pokeapi:479},
  {id:13022,show:'rotom-mow',pokeapi:479},
  {id:13023,show:'castform-sunny',pokeapi:351},
  {id:13024,show:'castform-rainy',pokeapi:351},
  {id:13025,show:'castform-snowy',pokeapi:351},
  {id:13026,show:'cherrim-sunshine',pokeapi:421},
  {id:13027,show:'aegislash-blade',pokeapi:681},
  {id:13028,show:'wishiwashi-school',pokeapi:746},
  {id:13029,show:'mimikyu-busted',pokeapi:778},
  {id:13030,show:'minior-meteor',pokeapi:774},
  {id:13031,show:'morpeko-hangry',pokeapi:877},
  {id:13032,show:'cramorant-gorging',pokeapi:845},
  {id:13033,show:'eiscue-noice',pokeapi:875},
  {id:13034,show:'zarude-dada',pokeapi:893},
  {id:13035,show:'terapagos-terastal',pokeapi:1024},
  {id:13036,show:'terapagos-stellar',pokeapi:1024},
  {id:13037,show:'ogerpon-wellspring',pokeapi:1017},
  {id:13038,show:'ogerpon-hearthflame',pokeapi:1017},
  {id:13039,show:'ogerpon-cornerstone',pokeapi:1017},
  {id:13040,show:'urshifu-rapid-strike',pokeapi:892},
  {id:13041,show:'urshifu-rapid-strike-gmax',pokeapi:892},
  {id:13042,show:'urshifu-single-strike-gmax',pokeapi:892},
  {id:13043,show:'enamorus-therian',pokeapi:905},
  {id:13044,show:'tornadus-therian',pokeapi:641},
  {id:13045,show:'thundurus-therian',pokeapi:642},
  {id:13046,show:'landorus-therian',pokeapi:645},
  {id:13047,show:'meloetta-pirouette',pokeapi:648},
  {id:13048,show:'hoopa-unbound',pokeapi:720},
  {id:13049,show:'toxtricity-low-key',pokeapi:849},
  {id:13050,show:'toxtricity-amped-gmax',pokeapi:849},
  {id:13051,show:'toxtricity-low-key-gmax',pokeapi:849},
  {id:13052,show:'dudunsparce-three-segment',pokeapi:982},
  {id:13053,show:'palafin-hero',pokeapi:964},
  {id:13054,show:'maushold-family-of-three',pokeapi:925},
  {id:13055,show:'sinistea',pokeapi:854},
  {id:13056,show:'polteageist',pokeapi:855},
  {id:13057,show:'gimmighoul-roaming',pokeapi:999},
  {id:13058,show:'ursaluna-bloodmoon',pokeapi:901},
  {id:13059,show:'palkia-origin',pokeapi:484},
  {id:13060,show:'dialga-origin',pokeapi:483},
  {id:13061,show:'darmanitan-galar-zen',pokeapi:555},
  {id:13062,show:'oinkologne-female',pokeapi:916},
  {id:13063,show:'basculegion-female',pokeapi:902},
];

function download(url, dest) {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode !== 200) { file.close(); if (fs.existsSync(dest)) fs.unlinkSync(dest); resolve(false); return; }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(true); });
    }).on('error', () => { file.close(); if (fs.existsSync(dest)) fs.unlinkSync(dest); resolve(false); });
  });
}

function uploadFile(filePath, storagePath) {
  return new Promise((resolve) => {
    const fileData = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === '.gif' ? 'image/gif' : 'image/png';
    const req = https.request({
      method: 'POST', hostname: BASE,
      path: `/storage/v1/object/sprites/${storagePath}`,
      headers: { 'apikey': API_KEY, 'Authorization': 'Bearer ' + API_KEY, 'Content-Type': contentType, 'x-upsert': 'true', 'Content-Length': fileData.length }
    }, (res) => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(res.statusCode===200||res.statusCode===201)); });
    req.on('error', () => resolve(false));
    req.write(fileData);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const STORAGE_MAP = {
  animFront: 'animated-front',
  animFrontShiny: 'animated-front-shiny',
  animBack: 'animated-back',
  animBackShiny: 'animated-back-shiny',
  homeFront: 'home-front',
  homeFrontShiny: 'home-front-shiny',
};

async function main() {
  console.log(`Processing ${FORMS.length} special forms (download + upload)...\n`);

  const report = { ok: [], fail: [] };
  let downloaded = 0, uploaded = 0, failedDl = 0, failedUp = 0;

  for (const form of FORMS) {
    const showName = form.show;
    const ext = '.gif';

    const sources = [
      { dir: DIRS.animFront, storage: STORAGE_MAP.animFront, url: `https://play.pokemonshowdown.com/sprites/ani/${showName}.gif` },
      { dir: DIRS.animFrontShiny, storage: STORAGE_MAP.animFrontShiny, url: `https://play.pokemonshowdown.com/sprites/ani-shiny/${showName}.gif` },
      { dir: DIRS.animBack, storage: STORAGE_MAP.animBack, url: `https://play.pokemonshowdown.com/sprites/ani-back/${showName}.gif` },
      { dir: DIRS.animBackShiny, storage: STORAGE_MAP.animBackShiny, url: `https://play.pokemonshowdown.com/sprites/ani-back-shiny/${showName}.gif` },
      { dir: DIRS.homeFront, storage: STORAGE_MAP.homeFront, url: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${form.pokeapi}.png`, ext: '.png' },
      { dir: DIRS.homeFrontShiny, storage: STORAGE_MAP.homeFrontShiny, url: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/shiny/${form.pokeapi}.png`, ext: '.png' },
    ];

    for (const src of sources) {
      const fileExt = src.ext || ext;
      const fileName = form.id + fileExt;
      const localPath = path.join(src.dir, fileName);
      const storagePath = src.storage + '/' + fileName;

      if (!fs.existsSync(localPath)) {
        const ok = await download(src.url, localPath);
        if (ok) { downloaded++; await sleep(100); }
        else { failedDl++; }
      } else { downloaded++; }

      if (fs.existsSync(localPath)) {
        const ok = await uploadFile(localPath, storagePath);
        if (ok) uploaded++;
        else failedUp++;
      }
    }

    report.ok.push(form.id);
    console.log(`  ✓ ${showName} → ID ${form.id} (dl:${downloaded} up:${uploaded})`);
  }

  console.log(`\n=== DONE ===`);
  console.log(`Downloaded: ${downloaded}, Failed: ${failedDl}`);
  console.log(`Uploaded: ${uploaded}, Failed: ${failedUp}`);

  fs.writeFileSync(path.join(__dirname, 'special-forms-sprite-report.json'), JSON.stringify(report, null, 2));
  console.log('Report saved to special-forms-sprite-report.json');
}

main().catch(console.error);
