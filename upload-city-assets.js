const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZXZ3bm5wenNvbHRicnJqZHRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MDE3NjEsImV4cCI6MjEwMDQ3Nzc2MX0.xlZ4LgzmQ-DZUz1kDk3oucmlvjCkty1TgzfN2IDxhoY';
const BASE = 'odevwnnpzsoltbrrjdts.supabase.co';
const BUCKET = 'sprites';

const ASSETS_DIR = path.join(__dirname, 'assets', 'assetmap');

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
          console.log(`  OK: ${storagePath} -> ${url}`);
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

async function main() {
  const files = fs.readdirSync(ASSETS_DIR).filter(f => f.endsWith('.png') || f.endsWith('.webp'));
  console.log(`Uploading ${files.length} city assets...\n`);
  
  const results = [];
  for (const file of files) {
    const filePath = path.join(ASSETS_DIR, file);
    const storagePath = `city-assets/${file}`;
    try {
      const url = await uploadFile(filePath, storagePath);
      results.push({ file, url });
    } catch (e) {
      console.error(`  Error uploading ${file}:`, e.message);
    }
  }
  
  console.log(`\nDone! ${results.length}/${files.length} uploaded.`);
  console.log('\nAsset URLs for city_layout table:');
  results.forEach(r => console.log(`  ${r.file}: ${r.url}`));
}

main().catch(console.error);
