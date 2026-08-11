const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZXZ3bm5wenNvbHRicnJqZHRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MDE3NjEsImV4cCI6MjEwMDQ3Nzc2MX0.xlZ4LgzmQ-DZUz1kDk3oucmlvjCkty1TgzfN2IDxhoY';
const BASE = 'odevwnnpzsoltbrrjdts.supabase.co';
const BUCKET = 'sprites';

const SKINS = [
  { file: 'spritevermelhomasc.png', name: 'Vermelho Masculino', target_id: 'male', gender: 'male' },
  { file: 'spritevermelhofem.png',  name: 'Vermelho Feminino',  target_id: 'female', gender: 'female' },
  { file: 'spriteamarelomasc.png',  name: 'Amarelo Masculino',  target_id: 'male', gender: 'male' },
  { file: 'spriteamarelofem.png',   name: 'Amarelo Feminino',   target_id: 'female', gender: 'female' },
  { file: 'spriteverdemasc.png',    name: 'Verde Masculino',    target_id: 'male', gender: 'male' },
  { file: 'spriteverdefem.png',     name: 'Verde Feminino',     target_id: 'female', gender: 'female' },
  { file: 'motomascmoreno.png',     name: 'Moto Moreno',        target_id: 'male', gender: 'male' },
  { file: 'motomascloiro.png',      name: 'Moto Loiro',         target_id: 'male', gender: 'male' },
  { file: 'motofemmorena.png',      name: 'Moto Morena',        target_id: 'female', gender: 'female' },
  { file: 'motofemloira.png',       name: 'Moto Loira',         target_id: 'female', gender: 'female' },
];

function uploadFile(filePath, storagePath) {
  return new Promise((resolve) => {
    const fileData = fs.readFileSync(filePath);
    const req = https.request({
      method: 'POST',
      hostname: BASE,
      path: `/storage/v1/object/${BUCKET}/${storagePath}`,
      headers: {
        'apikey': API_KEY,
        'Authorization': 'Bearer ' + API_KEY,
        'Content-Type': 'image/png',
        'x-upsert': 'true',
        'Content-Length': fileData.length
      }
    }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          const { data } = JSON.parse(d);
          resolve({ ok: true, url: `${BASE}/storage/v1/object/public/${BUCKET}/${storagePath}` });
        } else {
          console.error(`  Upload failed (${res.statusCode}):`, d.slice(0, 200));
          resolve({ ok: false });
        }
      });
    });
    req.on('error', (e) => { console.error('  Request error:', e.message); resolve({ ok: false }); });
    req.write(fileData);
    req.end();
  });
}

function supabaseQuery(method, table, data) {
  return new Promise((resolve) => {
    const body = JSON.stringify(data);
    const req = https.request({
      method,
      hostname: BASE,
      path: `/rest/v1/${table}`,
      headers: {
        'apikey': API_KEY,
        'Authorization': 'Bearer ' + API_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch (e) { resolve({ error: d }); }
      });
    });
    req.on('error', (e) => resolve({ error: e.message }));
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('Uploading skin images...\n');

  const results = [];

  for (const skin of SKINS) {
    const localPath = path.join(__dirname, 'assets', 'novossprit', skin.file);
    if (!fs.existsSync(localPath)) {
      console.log(`  File not found: ${skin.file}, skipping`);
      continue;
    }

    const storagePath = `store-products/skins/${skin.file}`;
    console.log(`Uploading ${skin.file}...`);
    const upload = await uploadFile(localPath, storagePath);

    if (!upload.ok) {
      console.log(`  Failed to upload ${skin.file}`);
      continue;
    }

    console.log(`  Uploaded: ${upload.url}`);
    results.push({ ...skin, image_url: upload.url });
  }

  console.log(`\nUploaded ${results.length}/${SKINS.length} images. Creating products...\n`);

  for (const skin of results) {
    const product = {
      name: skin.name,
      description: `Skin de personagem - ${skin.name}`,
      skin_type: 'player_skin',
      target_id: skin.target_id,
      price_diamonds: 50,
      image_url: skin.image_url,
      sprite_url: skin.image_url,
      active: true,
      sort_order: SKINS.indexOf(skin)
    };

    console.log(`Creating product: ${skin.name}...`);
    const result = await supabaseQuery('POST', 'skin_products', product);
    if (result.error) {
      console.error(`  Error:`, result.error);
    } else {
      console.log(`  Created: ${result[0]?.id || 'OK'}`);
    }
  }

  console.log('\nDone!');
}

main();
