// ============================================================
// INSERT-INFINITE-TOWER.js
// Inserta os 1000 andares determinísticos da Torre Infinita no Supabase
// usando a API REST (sen browser). Executa:  `node insert-infinite-tower.js`
//
// Usa all-pokemon-list.json (xa no repo) para ids/nomes e constrúe a lista
// determinística. Regras:
//   - Andar 1 = nv5, 2 = nv6, ... (súbe 1 por 1; pode pasar de nv100)
//   - Andares múltiplos de 10 => LENDARIO
//   - Só variant normal (nunca megas/gigantamax; sempre teñen GIF)
// ============================================================
const { SUPABASE_URL, SUPABASE_KEY } = (() => {
  try { return require('./env.safelist'); } catch (e) {}
  try { return require('./db-keys'); } catch (e2) {}
  return {};
})() || {};
const API_KEY_RAW = (SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZXZ3bm5wenNvbHRicnJqZHRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MDE3NjEsImV4cCI6MjEwMDQ3Nzc2MX0.xlZ4LgzmQ-DZUz1kDk3oucmlvjCkty1TgzfN2IDxhoY').trim();
const API_KEY = API_KEY_RAW;
const BASE = (SUPABASE_URL || 'odevwnnpzsoltbrrjdts.supabase.co')
  .replace('https://', '').replace('/', '').trim();
const fs = require('fs');

if (!API_KEY || !BASE) {
  console.error('Falta SUPABASE_URL / SUPABASE_KEY');
  process.exit(1);
}

const https = require('https');
function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const headers = {
      'apikey': API_KEY,
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    };
    if (data) headers['Content-Length'] = data.byteLength;
    const req = https.request({ hostname: BASE, path, method, headers }, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const LEGENDARY_IDS = [
  144,145,146,150,151,243,244,245,249,250,251,377,378,379,380,381,382,383,384,385,386,
  480,481,482,483,484,485,486,488,490,491,492,493,638,639,640,641,642,643,644,645,646,647,648,649,
  716,717,718,719,720,721,785,786,787,788,789,790,791,792,793,794,795,796,797,798,799,800,801,802,807,808,809,
  891,892,893,894,895,896,897,898,905,1000,1001,1002,1003,1007,1008,1009,1010,1024
];
const LEG = new Set(LEGENDARY_IDS);

(async () => {
  const all = JSON.parse(fs.readFileSync('all-pokemon-list.json', 'utf8'));
  const normal = all.filter(p => (p.variant || 'normal') === 'normal').sort((a, b) => a.id - b.id);
  const legendary = normal.filter(p => LEG.has(p.id)).sort((a, b) => a.id - b.id);
  const normalPool = normal.filter(p => !LEG.has(p.id)).sort((a, b) => a.id - b.id);

  console.log(`[Torre] Lendários=${legendary.length} Normales=${normalPool.length}`);

  // ---- Regras fixas de progresión por andar (sempre as mesmas) ----
  // Andar 1: 1 pokemon nv5 ; +1 nv por andar ata nv100 (andar 96).
  // Andar 97: engádese un 2º nv50 que sube ata nv100 ; ao chegar (147)
  // engádese un 3º nv50 ... ata 6 pokemons nv100 (351). Logo ata 10 (555).
  const floorSlotCount = (floor) => {
    let count = 1;
    if (floor > 96) count += 1 + Math.floor((floor - 97) / 51);
    return Math.min(10, Math.max(1, count));
  };
  const slotIntroducedAt = (slot) => (slot === 0) ? 1 : 97 + (slot - 1) * 51;
  const slotLevel = (floor, slot) => (slot === 0)
    ? Math.min(100, 4 + floor)
    : Math.min(100, 50 + (floor - slotIntroducedAt(slot)));

  const rows = [];
  for (let floor = 1; floor <= 1000; floor++) {
    const count = floorSlotCount(floor);
    const isLegHead = floor % 10 === 0;
    for (let slot = 0; slot < count; slot++) {
      let poke;
      if (slot === 0) {
        if (isLegHead) {
          const li = (Math.floor(floor / 10) - 1) % legendary.length;
          poke = legendary[((li % legendary.length) + legendary.length) % legendary.length];
        } else {
          poke = normalPool[((floor - 1 - Math.floor(floor / 10)) % normalPool.length + normalPool.length) % normalPool.length];
        }
      } else {
        poke = normalPool[((floor + slot * 37) % normalPool.length + normalPool.length) % normalPool.length];
      }
      rows.push({
        floor_number: floor,
        slot_index: slot,
        pokemon_id: poke.id,
        pokemon_name: poke.name,
        pokemon_level: slotLevel(floor, slot),
        is_legendary: slot === 0 && isLegHead,
        sprite_url: `${SUPABASE_URL}/storage/v1/object/public/sprites/animated-front/${poke.id}.gif`
      });
    }
  }

  // Limpar antigos
  await request('DELETE', `/rest/v1/infinite_tower_floor_teams?floor_number=lte.100000`);
  // Inserir a lote
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const r = await request('POST', '/rest/v1/infinite_tower_floor_teams', batch);
    if (r.status < 200 || r.status >= 300) {
      console.error(`[Torre] Falha lote ${i}:`, r.status, r.body.slice(0, 300));
      process.exit(1);
    }
  }
  const sample = [];
  [1, 96, 97, 147, 148, 351, 556].forEach(f => {
    sample.push(`A${f}(x${floorSlotCount(f)}): ` + rows.filter(r => r.floor_number === f).map(r => `${r.pokemon_name} nv${r.pokemon_level}`).join(', '));
  });
  console.log(`[Torre] OK: ${rows.length} filas do equipo (1000 andares, ata 10 pokemons).`);
  console.log('[Torre] Exemplos:', sample.join(' | '));
})();