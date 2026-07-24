const https = require('https');
const fs = require('fs');
const path = require('path');

const BACK_DIR = path.join(__dirname, 'assets/sprites/pokemon-animated-back');
const BACK_SHINY_DIR = path.join(__dirname, 'assets/sprites/pokemon-animated-back-shiny');

if (!fs.existsSync(BACK_DIR)) fs.mkdirSync(BACK_DIR, { recursive: true });
if (!fs.existsSync(BACK_SHINY_DIR)) fs.mkdirSync(BACK_SHINY_DIR, { recursive: true });

const SHOWDOWN_NAMES = {
  29:'nidoranf',32:'nidoranm',786:'tapukoko',787:'tapulele',788:'tapubulu',789:'tapufini',
  474:'porygonz',491:'darkrai',555:'darmanitan',658:'greninja',718:'zygarde',785:'tapukoko',
  849:'toxtricity',876:'indeedee',893:'zarude',954:'squawkabilly',1012:'dipplin',
  1013:'poltchageist',1014:'sinistcha',1016:'okidogi',1017:'munkidori',1018:'fezandipiti',
  1024:'ogerpon',1025:'terapagos'
};

function getShowdownName(id, name) {
  if (SHOWDOWN_NAMES[id]) return SHOWDOWN_NAMES[id];
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const MEGA_MAP = {
  10001:'venusaur-mega',10002:'charizard-megax',10003:'charizard-megay',
  10004:'blastoise-mega',10005:'alakazam-mega',10006:'gengar-mega',
  10007:'kangaskhan-mega',10008:'pinsir-mega',10009:'gyarados-mega',
  10010:'aerodactyl-mega',10011:'mewtwo-megax',10012:'mewtwo-megay',
  10013:'scizor-mega',10014:'heracross-mega',10015:'houndoom-mega',
  10016:'tyranitar-mega',10017:'blaziken-mega',10018:'gardevoir-mega',
  10019:'mawile-mega',10020:'aggron-mega',10021:'manectric-mega',
  10022:'garchomp-mega',10023:'lucario-mega',10024:'abomasnow-mega',
  10025:'beedrill-mega',10026:'pidgeot-mega',10027:'slowbro-mega',
  10028:'steelix-mega',10029:'sharpedo-mega',10030:'camerupt-mega',
  10031:'altaria-mega',10032:'salamence-mega',10033:'metagross-mega',
  10034:'latias-mega',10035:'latios-mega',10036:'rayquaza-mega',
  10037:'lopunny-mega',10038:'gallade-mega',10039:'audino-mega',
  10040:'diancie-mega',10041:'sceptile-mega',10042:'swampert-mega',
  10043:'banette-mega',10044:'absol-mega',10045:'sableye-mega',10046:'glalie-mega'
};

const GMAX_MAP = {
  11001:'charizard-gmax',11002:'butterfree-gmax',11003:'pikachu-gmax',
  11004:'meowth-gmax',11005:'machamp-gmax',11006:'gengar-gmax',
  11007:'kingler-gmax',11008:'lapras-gmax',11009:'eevee-gmax',
  11010:'snorlax-gmax',11011:'garbodor-gmax',11012:'melmetal-gmax',
  11013:'corviknight-gmax',11014:'orbeetle-gmax',11015:'drednaw-gmax',
  11016:'coalossal-gmax',11017:'flapple-gmax',11018:'appletun-gmax',
  11021:'centiskorch-gmax',11022:'hatterene-gmax',11023:'grimmsnarl-gmax',
  11024:'alcremie-gmax',11025:'copperajah-gmax',11026:'duraludon-gmax'
};

const REGIONAL_MAP = {
  12001:'vulpix-alola',12002:'ninetales-alola',12003:'sandshrew-alola',
  12004:'sandslash-alola',12005:'raichu-alola',12006:'geodude-alola',
  12007:'graveler-alola',12008:'golem-alola',12009:'grimer-alola',
  12010:'muk-alola',12011:'exeggutor-alola',12012:'marowak-alola',
  12013:'ponyta-galar',12014:'rapidash-galar',12015:'slowpoke-galar',
  12016:'slowbro-galar',12017:'weezing-galar',12018:'mrmime-galar',
  12019:'corsola-galar',12020:'zigzagoon-galar',12021:'linoone-galar',
  12022:'darumaka-galar',12024:'yamask-galar',12025:'stunfisk-galar',
  12026:'growlithe-hisui',12027:'arcanine-hisui',12028:'voltorb-hisui',
  12029:'electrode-hisui',12030:'typhlosion-hisui',12031:'qwilfish-hisui',
  12032:'sneasel-hisui',12033:'sliggoo-hisui',12034:'goodra-hisui',
  12035:'avalugg-hisui',12036:'braviary-hisui',12037:'wooper-paldea'
};

async function fetchPokemon() {
  const url = 'https://odevwnnpzsoltbrrjdts.supabase.co/rest/v1/pokemon?select=id,name&order=id';
  const headers = { 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZXZ3bm5wenNvbHRicnJqZHRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MDE3NjEsImV4cCI6MjEwMDQ3Nzc2MX0.xlZ4LgzmQ-DZUz1kDk3oucmlvjCkty1TgzfN2IDxhoY' };
  return new Promise((resolve) => {
    https.get(url, { headers }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
  });
}

function download(url, dest) {
  return new Promise((resolve) => {
    const req = https.get(url, (res) => {
      if (res.statusCode !== 200) { resolve(false); return; }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        fs.writeFileSync(dest, Buffer.concat(chunks));
        resolve(true);
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(10000, () => { req.destroy(); resolve(false); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getShowdownId(id) {
  if (MEGA_MAP[id]) return MEGA_MAP[id];
  if (GMAX_MAP[id]) return GMAX_MAP[id];
  if (REGIONAL_MAP[id]) return REGIONAL_MAP[id];
  return null;
}

async function main() {
  const allPokemon = await fetchPokemon();
  console.log(`Fetched ${allPokemon.length} Pokemon from Supabase`);

  const report = { ok: [], fail: [], skipped: [] };
  let done = 0;

  for (const p of allPokemon) {
    done++;
    const showdownName = getShowdownId(p.id) || getShowdownName(p.id, p.name);

    const backFile = path.join(BACK_DIR, p.id + '.gif');
    const backShinyFile = path.join(BACK_SHINY_DIR, p.id + '.gif');

    const normalUrl = `https://play.pokemonshowdown.com/sprites/ani-back/${showdownName}.gif`;
    const shinyUrl = `https://play.pokemonshowdown.com/sprites/ani-back-shiny/${showdownName}.gif`;

    let anyOk = false;

    if (!fs.existsSync(backFile)) {
      const ok = await download(normalUrl, backFile);
      if (ok) { anyOk = true; await sleep(150); }
    } else { anyOk = true; }

    if (!fs.existsSync(backShinyFile)) {
      const ok = await download(shinyUrl, backShinyFile);
      if (ok) { anyOk = true; await sleep(150); }
    }

    if (anyOk) report.ok.push(p.id);
    else report.fail.push({ id: p.id, name: p.name, show: showdownName });

    if (done % 100 === 0) console.log(`Progress: ${done}/${allPokemon.length}`);
  }

  const backCount = fs.readdirSync(BACK_DIR).filter(f => f.endsWith('.gif')).length;
  const backShinyCount = fs.readdirSync(BACK_SHINY_DIR).filter(f => f.endsWith('.gif')).length;

  console.log(`\n=== DONE ===`);
  console.log(`Back normal: ${backCount} files`);
  console.log(`Back shiny: ${backShinyCount} files`);
  console.log(`OK: ${report.ok.length}, Failed: ${report.fail.length}`);
  if (report.fail.length > 0) {
    console.log('Failed:', report.fail.map(f => `${f.id}:${f.show}`).join(', '));
  }

  fs.writeFileSync(path.join(__dirname, 'back-sprite-report.json'), JSON.stringify(report, null, 2));
}

main().catch(console.error);
