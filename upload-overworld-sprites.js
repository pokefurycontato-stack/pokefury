const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZXZ3bm5wenNvbHRicnJqZHRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MDE3NjEsImV4cCI6MjEwMDQ3Nzc2MX0.xlZ4LgzmQ-DZUz1kDk3oucmlvjCkty1TgzfN2IDxhoY';
const BASE = 'odevwnnpzsoltbrrjdts.supabase.co';
const BUCKET = 'sprites';

const FOLDERS = [
  { local: 'assets/overworld-sheets', storage: 'overworld' },
  { local: 'assets/overworld-sheets-shiny', storage: 'overworld-shiny' },
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
      res.on('end', () => resolve(res.statusCode === 200 || res.statusCode === 201));
    });
    req.on('error', () => resolve(false));
    req.write(fileData);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  let totalOk = 0, totalFail = 0;

  for (const folder of FOLDERS) {
    const localDir = path.join(__dirname, folder.local);
    if (!fs.existsSync(localDir)) {
      console.log(`[SKIP] ${folder.local} not found`);
      continue;
    }

    const files = fs.readdirSync(localDir).filter(f => f.endsWith('.png'));
    console.log(`\n[${folder.storage}] Uploading ${files.length} files...`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const localPath = path.join(localDir, file);
      const storagePath = `${folder.storage}/${file}`;
      const ok = await uploadFile(localPath, storagePath);
      if (ok) totalOk++; else totalFail++;

      if ((i + 1) % 50 === 0 || i === files.length - 1) {
        console.log(`  ${i + 1}/${files.length} (${totalOk} ok, ${totalFail} fail)`);
      }
      await sleep(15);
    }
  }

  console.log(`\nDone! ${totalOk} uploaded, ${totalFail} failed`);
}

main();
