const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZXZ3bm5wenNvbHRicnJqZHRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MDE3NjEsImV4cCI6MjEwMDQ3Nzc2MX0.xlZ4LgzmQ-DZUz1kDk3oucmlvjCkty1TgzfN2IDxhoY';
const BASE = 'odevwnnpzsoltbrrjdts.supabase.co';
const BUCKET = 'sprites';
const FOLDER = 'city-assets';

const ASSETS_DIR = path.join(__dirname, 'assets', 'assetmap');

function supabaseGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE,
      path: `/storage/v1/object/list/${BUCKET}/${path}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function uploadFile(filePath, storagePath) {
  return new Promise((resolve, reject) => {
    const fileData = fs.readFileSync(filePath);
    const ext = path.extname(filePath).slice(1);
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/png';
    
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
          console.log(`  UPLOADED: ${storagePath}`);
          resolve(url);
        } else {
          console.error(`  FAIL (${res.statusCode}): ${storagePath} - ${body}`);
          reject(new Error(body));
        }
      });
    });
    req.on('error', reject);
    req.write(fileData);
    req.end();
  });
}

async function updateBuilderJS(newFiles) {
  if (newFiles.length === 0) return;
  const jsPath = path.join(__dirname, 'js', 'city-builder.js');
  let content = fs.readFileSync(jsPath, 'utf8');

  for (const file of newFiles) {
    const name = file.replace('.png', '').replace('.webp', '');
    const entry = `'${file}'`;
    if (content.includes(entry)) continue;

    const marker = "'cerca3.png'";
    const idx = content.indexOf(marker);
    if (idx === -1) continue;

    const endOfLine = content.indexOf('\n', idx);
    content = content.slice(0, endOfLine) + `, '${file}'` + content.slice(endOfLine);
    console.log(`  Added ${file} to city-builder.js`);
  }

  fs.writeFileSync(jsPath, content, 'utf8');
}

async function main() {
  console.log('Checking existing assets in Supabase...');
  let existing = [];
  try {
    const data = await supabaseGet(FOLDER);
    if (Array.isArray(data)) existing = data.map(f => f.name);
  } catch(e) {
    console.warn('Could not list existing files, will upload all:', e.message);
  }
  console.log(`  Found ${existing.length} existing files in storage\n`);

  const localFiles = fs.readdirSync(ASSETS_DIR).filter(f => f.endsWith('.png') || f.endsWith('.webp'));
  const toUpload = localFiles.filter(f => !existing.includes(f));
  const skipped = localFiles.filter(f => existing.includes(f));

  console.log(`Local files: ${localFiles.length}`);
  console.log(`Already in storage (skipping): ${skipped.length}`);
  console.log(`To upload: ${toUpload.length}\n`);

  let uploaded = 0;
  if (toUpload.length > 0) {
    for (const file of toUpload) {
      const filePath = path.join(ASSETS_DIR, file);
      const storagePath = `${FOLDER}/${file}`;
      try {
        await uploadFile(filePath, storagePath);
        uploaded++;
      } catch (e) {
        console.error(`  Error uploading ${file}:`, e.message);
      }
    }
    console.log(`\nUploaded ${uploaded}/${toUpload.length} new assets.`);
  } else {
    console.log('No new files to upload.');
  }

  console.log('\nChecking city-builder.js asset list...');
  await updateBuilderJS(toUpload);

  console.log('\nAll done!');
}

main().catch(console.error);
