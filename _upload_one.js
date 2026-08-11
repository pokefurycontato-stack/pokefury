// Upload de um único arquivo de assets/assetmap para o Supabase (bucket sprites / city-assets)
const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZXZ3bm5wenNvbHRicnJqZHRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MDE3NjEsImV4cCI6MjEwMDQ3Nzc2MX0.xlZ4LgzmQ-DZUz1kDk3oucmlvjCkty1TgzfN2IDxhoY';
const BASE = 'odevwnnpzsoltbrrjdts.supabase.co';
const BUCKET = 'sprites';
const FOLDER = 'city-assets';

function uploadFile(filePath) {
  return new Promise((resolve, reject) => {
    const fileData = fs.readFileSync(filePath);
    const ext = path.extname(filePath).slice(1);
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/png';
    const name = path.basename(filePath);
    const storagePath = `${FOLDER}/${name}`;
    const options = {
      hostname: BASE,
      path: `/storage/v1/object/${BUCKET}/${storagePath}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': mime,
        'x-upsert': 'true'
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const url = `https://${BASE}/storage/v1/object/public/${BUCKET}/${storagePath}`;
          console.log(`UPLOADED: ${name} -> ${url}`);
          resolve(url);
        } else {
          console.error(`FAIL (${res.statusCode}): ${name} - ${body}`);
          reject(new Error(body));
        }
      });
    });
    req.on('error', reject);
    req.write(fileData);
    req.end();
  });
}

const file = process.argv[2];
if (!file) { console.error('Usage: node _upload_one.js <filename>'); process.exit(1); }
const filePath = path.join(__dirname, 'assets', 'assetmap', file);
if (!fs.existsSync(filePath)) { console.error('Not found: ' + filePath); process.exit(1); }

// Registra o arquivo na lista de assets do "criar cidade" (city-builder.js).
function registerInBuilder(fileName) {
  const jsPath = path.join(__dirname, 'js', 'city-builder.js');
  const content = fs.readFileSync(jsPath, 'utf8');
  const entry = `'${fileName}'`;
  if (content.includes(entry)) {
    console.log(`Ja registrado na lista: ${fileName}`);
    return;
  }
  const marker = "'cerca3.png'";
  const idx = content.indexOf(marker);
  if (idx === -1) { console.warn('Marcador cerca3.png nao encontrado, favor adicionar manualmente.'); return; }
  const endOfLine = content.indexOf('\n', idx);
  fs.writeFileSync(jsPath, content.slice(0, endOfLine) + `, '${fileName}'` + content.slice(endOfLine), 'utf8');
  console.log(`Registrado ${fileName} na lista de assets.`);
}

uploadFile(filePath)
  .then((url) => { registerInBuilder(file); process.exit(0); })
  .catch((e) => { console.error(e.message); process.exit(1); });