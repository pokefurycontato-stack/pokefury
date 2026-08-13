// Re-upload dos GIFs animados com cache permanente (resolve o no-cache)
const https = require('https');
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZXZ3bm5wenNvbHRicnJqZHRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MDE3NjEsImV4cCI6MjEwMDQ3Nzc2MX0.xlZ4LgzmQ-DZUz1kDk3oucmlvjCkty1TgzfN2IDxhoY';
const BASE = 'odevwnnpzsoltbrrjdts.supabase.co';
const BUCKET = 'sprites';
const MAX_ID = 1025;

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', () => resolve(null));
  });
}

function uploadWithCache(path, buf) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE,
      path: `/storage/v1/object/${BUCKET}/${path}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'image/gif',
        'x-upsert': 'true',
        'Cache-Control': 'max-age=31536000, immutable'
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(true);
        else { console.error(`  Fail ${path}: ${res.statusCode} ${body}`); resolve(false); }
      });
    });
    req.on('error', () => resolve(false));
    req.write(buf);
    req.end();
  });
}

async function main() {
  let ok = 0, skip = 0, fail = 0;
  const startId = parseInt(process.argv[2] || '1');
  for (let id = startId; id <= MAX_ID; id++) {
    const url = `https://${BASE}/storage/v1/object/public/${BUCKET}/animated-front/${id}.gif`;
    const buf = await fetchBuffer(url);
    if (!buf) { skip++; continue; }
    const result = await uploadWithCache(`animated-front/${id}.gif`, buf);
    if (result) { ok++; } else { fail++; }
    if (id % 50 === 0) console.log(`  Progresso: ${id}/${MAX_ID} (ok=${ok}, skip=${skip}, fail=${fail})`);
    await new Promise(r => setTimeout(r, 5));
  }
  console.log(`\nConcluído: ${ok} reenviados, ${skip} sem GIF, ${fail} falharam`);
}

main().catch(e => { console.error(e); process.exit(1); });
