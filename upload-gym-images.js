const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://odevwnnpzsoltbrrjdts.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZXZ3bm5wenNvbHRicnJqZHRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MDE3NjEsImV4cCI6MjEwMDQ3Nzc2MX0.xlZ4LgzmQ-DZUz1kDk3oucmlvjCkty1TgzfN2IDxhoY';
const BUCKET = 'sprites';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const GYM_DIR = 'C:\\Users\\User\\Desktop\\teste htt\\pokefury\\assets\\gyn';

const TYPE_MAP = {
    'agua.png': 'Water',
    'fogo.png': 'Fire',
    'grama.png': 'Grass',
    'eletrico.png': 'Electric',
    'pedra.png': 'Rock',
    'venenoso.png': 'Poison',
    'terra.png': 'Ground',
    'voador.png': 'Flying',
    'psiquico.png': 'Psychic',
    'inseto.png': 'Bug',
    'fantasma.png': 'Ghost',
    'dragao.png': 'Dragon',
    'dark.png': 'Dark',
    'metal.png': 'Steel',
    'gelo.png': 'Ice',
    'lutador.png': 'Fighting',
    'fada.png': 'Fairy',
    'normal.png': 'Normal'
};

let uploaded = 0;
let failed = 0;

async function uploadFile(localPath, storagePath) {
    try {
        const buffer = fs.readFileSync(localPath);
        const ext = path.extname(localPath).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : 'image/jpeg';

        const { error } = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, buffer, {
                contentType: mime,
                upsert: true
            });

        if (error) {
            console.log(`FAIL: ${path.basename(localPath)} - ${error.message}`);
            failed++;
        } else {
            console.log(`OK: ${storagePath}`);
            uploaded++;
        }
    } catch (e) {
        console.log(`ERROR: ${path.basename(localPath)} - ${e.message}`);
        failed++;
    }
}

async function main() {
    console.log('=== Upload Gym Background Images ===\n');

    const files = fs.readdirSync(GYM_DIR);
    
    for (const file of files) {
        if (!file.endsWith('.png')) continue;
        
        const storagePath = `gym-bg/${file}`;
        const localPath = path.join(GYM_DIR, file);
        
        await uploadFile(localPath, storagePath);
    }

    console.log(`\n=== DONE ===`);
    console.log(`Uploaded: ${uploaded}`);
    console.log(`Failed: ${failed}`);
    
    console.log('\nNow run supabase-gym-type-images.sql to update the database.');
}

main().catch(console.error);
