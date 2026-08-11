const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://odevwnnpzsoltbrrjdts.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZXZ3bm5wenNvbHRicnJqZHRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MDE3NjEsImV4cCI6MjEwMDQ3Nzc2MX0.xlZ4LgzmQ-DZUz1kDk3oucmlvjCkty1TgzfN2IDxhoY';
const BUCKET = 'sprites';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ROOT = 'C:\\Users\\User\\Downloads\\Pokemon Tiles\\Pokemon Tiles';

const UPLOAD_MAP = {
    '_Complete Areas\\_Complete Routes': 'maps/routes',
    '_Complete Areas\\_Complete Towns': 'maps/towns',
    '_Complete Areas\\_Complete Dungeons': 'maps/dungeons',
    '_Complete Areas\\_Complete Interiors': 'maps/interiors',
    '_Complete Areas\\_Complete Region Maps': 'maps/region-maps',
    'Pokemon\\Sprites (Overworld)': 'overworld',
    'People': 'npcs',
};

let uploaded = 0;
let failed = 0;
let skipped = 0;

async function uploadFile(localPath, storagePath) {
    try {
        const stat = fs.statSync(localPath);
        if (stat.size > 10 * 1024 * 1024) {
            console.log(`  SKIP (too large ${ (stat.size/1024/1024).toFixed(1) }MB): ${path.basename(localPath)}`);
            skipped++;
            return;
        }

        const buffer = fs.readFileSync(localPath);
        const ext = path.extname(localPath).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream';

        const { error } = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, buffer, {
                contentType: mime,
                upsert: true
            });

        if (error) {
            console.log(`  FAIL: ${path.basename(localPath)} - ${error.message}`);
            failed++;
        } else {
            uploaded++;
            if (uploaded % 10 === 0) console.log(`  ... ${uploaded} uploaded so far`);
        }
    } catch (e) {
        console.log(`  ERROR: ${path.basename(localPath)} - ${e.message}`);
        failed++;
    }
}

async function uploadDirectory(localDir, storagePrefix) {
    if (!fs.existsSync(localDir)) {
        console.log(`DIR NOT FOUND: ${localDir}`);
        return;
    }

    const entries = fs.readdirSync(localDir, { withFileTypes: true });
    const batch = [];

    for (const entry of entries) {
        if (entry.name === 'Thumbs.db' || entry.name.startsWith('.')) continue;
        if (entry.name === '_Unneeded') continue;

        const localPath = path.join(localDir, entry.name);

        if (entry.isDirectory()) {
            const subPrefix = `${storagePrefix}/${entry.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
            await uploadDirectory(localPath, subPrefix);
        } else if (/\.(png|jpg|jpeg|gif)$/i.test(entry.name)) {
            const safeName = entry.name.toLowerCase()
                .replace(/[^a-z0-9._-]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            const storagePath = `${storagePrefix}/${safeName}`;
            batch.push(uploadFile(localPath, storagePath));
            
            if (batch.length >= 5) {
                await Promise.all(batch);
                batch.length = 0;
            }
        }
    }

    if (batch.length > 0) await Promise.all(batch);
}

async function main() {
    console.log('=== PokeFury Asset Upload ===');
    console.log(`Source: ${ROOT}`);
    console.log('');

    for (const [srcDir, storagePrefix] of Object.entries(UPLOAD_MAP)) {
        const localDir = path.join(ROOT, srcDir);
        console.log(`\nUploading ${srcDir} -> ${storagePrefix}/`);
        await uploadDirectory(localDir, storagePrefix);
    }

    console.log(`\n=== DONE ===`);
    console.log(`Uploaded: ${uploaded}`);
    console.log(`Failed: ${failed}`);
    console.log(`Skipped: ${skipped}`);
}

main().catch(console.error);
