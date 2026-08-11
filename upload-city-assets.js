const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZXZ3bm5wenNvbHRicnJqZHRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MDE3NjEsImV4cCI6MjEwMDQ3Nzc2MX0.xlZ4LgzmQ-DZUz1kDk3oucmlvjCkty1TgzfN2IDxhoY';
const BASE = 'odevwnnpzsoltbrrjdts.supabase.co';
const BUCKET = 'sprites';
const FOLDER = 'city-assets';

const ASSETS_DIR = path.join(__dirname, 'assets', 'assetmap');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Função genérica de request com suporte a body.
function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// Lista os arquivos existentes no bucket via POST (a API de storage ignora o caminho no GET).
async function listExisting() {
  const payload = JSON.stringify({ prefix: FOLDER, limit: 1000, offset: 0, search: '' });
  const { status, body } = await request({
    hostname: BASE,
    path: `/storage/v1/object/list/${BUCKET}`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, payload);

  if (status < 200 || status >= 300) {
    console.warn(`  Storage list failed (${status}), assuming nothing is uploaded.`);
    return new Set();
  }
  try {
    const data = JSON.parse(body);
    return Array.isArray(data) ? new Set(data.map((f) => f.name)) : new Set();
  } catch (e) {
    console.warn('  Could not parse storage list:', e.message);
    return new Set();
  }
}

function uploadFile(filePath, storagePath) {
  return new Promise((resolve, reject) => {
    const fileData = fs.readFileSync(filePath);
    const fileSize = fileData.length;
    const ext = path.extname(filePath).slice(1);
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/png';

    // For large files (>5MB), use chunked upload
    if (fileSize > 5 * 1024 * 1024) {
      return uploadChunked(fileData, fileSize, mime, storagePath).then(resolve).catch(reject);
    }

    const options = {
      hostname: BASE,
      path: `/storage/v1/object/${BUCKET}/${storagePath}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': mime,
        'Content-Length': fileSize,
        'x-upsert': 'true'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(`https://${BASE}/storage/v1/object/public/${BUCKET}/${storagePath}`);
        } else {
          reject(new Error(body || `HTTP ${res.statusCode}`));
        }
      });
    });
    req.on('error', reject);
    req.write(fileData);
    req.end();
  });
}

// Chunked upload for files >5MB
function uploadChunked(fileData, fileSize, mime, storagePath) {
  return new Promise((resolve, reject) => {
    const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunks
    let uploaded = 0;

    function uploadNextChunk() {
      const start = uploaded;
      const end = Math.min(start + CHUNK_SIZE, fileSize);
      const chunk = fileData.slice(start, end);
      const isLast = end >= fileSize;

      const headers = {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': isLast ? mime : 'application/octet-stream',
        'Content-Length': chunk.length,
        'Content-Range': `bytes ${start}-${end - 1}/${fileSize}`,
        'x-upsert': isLast ? 'true' : 'false'
      };

      const options = {
        hostname: BASE,
        path: `/storage/v1/object/${BUCKET}/${storagePath}`,
        method: isLast ? 'POST' : 'PUT',
        headers
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (c) => body += c);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            if (isLast) {
              resolve(`https://${BASE}/storage/v1/object/public/${BUCKET}/${storagePath}`);
            } else {
              uploaded = end;
              uploadNextChunk();
            }
          } else {
            reject(new Error(`Chunk ${start}-${end - 1} failed: ${body || res.statusCode}`));
          }
        });
      });
      req.on('error', reject);
      req.write(chunk);
      req.end();
    }

    uploadNextChunk();
  });
}

// Faz upload de UM arquivo, tentando varias vezes (image-by-image, nunca para no meio).
async function uploadWithRetry(filePath, storagePath, attempts = 3) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      const url = await uploadFile(filePath, storagePath);
      console.log(`  UPLOADED: ${storagePath}`);
      return url;
    } catch (e) {
      lastErr = e;
      console.error(`  Tentativa ${i}/${attempts} falhou para ${path.basename(filePath)}: ${e.message}`);
      if (i < attempts) await sleep(1200 * i);
    }
  }
  throw lastErr;
}

// Garante que TODOS os arquivos locais de assetmap aparecam na lista de assets
// do "criar cidade" (mesmo os que ja foram enviados em uma execucao anterior).
async function updateBuilderJS(localFiles) {
  const jsPath = path.join(__dirname, 'js', 'city-builder.js');
  let content = fs.readFileSync(jsPath, 'utf8');

  let added = 0;
  for (const file of localFiles) {
    const entry = `'${file}'`;
    if (content.includes(entry)) continue;

    const marker = "'cerca3.png'";
    const idx = content.indexOf(marker);
    if (idx === -1) continue;

    const endOfLine = content.indexOf('\n', idx);
    const line = content.slice(idx, endOfLine);
    const trimmed = line.trimEnd();
    const needsComma = !trimmed.endsWith(',');
    content = content.slice(0, endOfLine) + (needsComma ? ', ' : ' ') + `'${file}',` + content.slice(endOfLine);
    added++;
    console.log(`  Registrado ${file} na lista de assets`);
  }

  if (added > 0) fs.writeFileSync(jsPath, content, 'utf8');
  return added;
}

async function main() {
  const localFiles = fs.readdirSync(ASSETS_DIR)
    .filter((f) => /\.(png|webp)$/i.test(f))
    .sort();

  console.log(`Local files: ${localFiles.length}`);

  console.log('Verificando assets ja existentes no Supabase...');
  const existing = await listExisting();
  console.log(`  Ja no storage: ${[...existing].filter((n) => localFiles.includes(n)).length}`);

  const toUpload = localFiles.filter((f) => !existing.has(f));
  console.log(`  Para enviar: ${toUpload.length}\n`);

  let uploaded = 0;
  let failed = 0;
  for (const file of toUpload) {
    const filePath = path.join(ASSETS_DIR, file);
    try {
      await uploadWithRetry(filePath, `${FOLDER}/${file}`);
      uploaded++;
    } catch (e) {
      failed++;
      console.error(`  Erro final em ${file}: ${e.message}`);
    }
  }
  console.log(`\nEnviados ${uploaded}/${toUpload.length} novos assets.${failed ? ` (${failed} falharam)` : ''}`);

  console.log('\nSincronizando a lista de assets do criar cidade...');
  const added = await updateBuilderJS(localFiles);
  console.log(added > 0 ? `  ${added} assets registrados na lista.` : '  Lista de assets ja esta completa.');

  console.log('\nPronto! As novas imagens estao disponiveis no criar cidade.');

  if (uploaded > 0 || added > 0) {
    console.log('\nFazendo commit e push...');
    const { execSync } = require('child_process');
    try {
      execSync('git add -A', { cwd: __dirname, stdio: 'pipe' });
      const status = execSync('git diff --cached --name-only', { cwd: __dirname, stdio: 'pipe' }).toString().trim();
      if (status) {
        const names = status.split('\n').join(', ');
        execSync(`git commit -m "Upload new assets: ${names}"`, { cwd: __dirname, stdio: 'pipe' });
        execSync('git push', { cwd: __dirname, stdio: 'pipe' });
        console.log('Push concluido!');
      } else {
        console.log('Nada para commitar.');
      }
    } catch (e) {
      console.error('Erro no git:', e.stderr ? e.stderr.toString() : e.message);
    }
  }
}

main().catch(console.error);
