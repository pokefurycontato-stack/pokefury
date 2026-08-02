const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://odevwnnpzsoltbrrjdts.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZXZ3bm5wenNvbHRicnJqZHRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MDE3NjEsImV4cCI6MjEwMDQ3Nzc2MX0.xlZ4LgzmQ-DZUz1kDk3oucmlvjCkty1TgzfN2IDxhoY';
const BUCKET = 'sprites';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const GYM_DIR = 'C:\\Users\\User\\Desktop\\teste htt\\pokefury\\assets\\gym-leaders';

const NAME_MAP = {
    'Brock': 'Brock',
    'Misty': 'Misty',
    'Lt._Surge': 'Lt. Surge',
    'Erika': 'Erika',
    'Koga': 'Koga',
    'Sabrina': 'Sabrina',
    'Blaine': 'Blaine',
    'Giovanni': 'Giovanni',
    'Falkner': 'Falkner',
    'Bugsy': 'Bugsy',
    'Whitney': 'Whitney',
    'Morty': 'Morty',
    'Chuck': 'Chuck',
    'Jasmine': 'Jasmine',
    'Pryce': 'Pryce',
    'Clair': 'Clair',
    'Roxanne': 'Roxanne',
    'Brawly': 'Brawly',
    'Wattson': 'Wattson',
    'Flannery': 'Flannery',
    'Norman': 'Norman',
    'Winona': 'Winona',
    'Wallace': 'Wallace',
    'Roark': 'Roark',
    'Gardenia': 'Gardenia',
    'Fantina': 'Fantina',
    'Maylene': 'Maylene',
    'Crasher_Wake': 'Crasher Wake',
    'Byron': 'Byron',
    'Candice': 'Candice',
    'Volkner': 'Volkner',
    'Cilan': 'Cilan',
    'Lenora': 'Lenora',
    'Burgh': 'Burgh',
    'Elesa': 'Elesa',
    'Clay': 'Clay',
    'Skyla': 'Skyla',
    'Brycen': 'Brycen',
    'Drayden': 'Drayden',
    'Viola': 'Viola',
    'Korrina': 'Korrina',
    'Ramos': 'Ramos',
    'Valerie': 'Valerie',
    'Olympia': 'Olympia',
    'Wulfric': 'Wulfric',
    'Hala': 'Hala',
    'Olivia': 'Olivia',
    'Nanu': 'Nanu',
    'Hapu': 'Hapu'
};

let uploaded = 0;
let failed = 0;

async function uploadFile(localPath, storagePath) {
    try {
        const buffer = fs.readFileSync(localPath);
        const { error } = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, buffer, {
                contentType: 'image/png',
                upsert: true
            });

        if (error) {
            console.log('FAIL: ' + path.basename(localPath) + ' - ' + error.message);
            failed++;
        } else {
            uploaded++;
        }
    } catch (e) {
        console.log('ERROR: ' + path.basename(localPath) + ' - ' + e.message);
        failed++;
    }
}

async function main() {
    console.log('=== Upload Gym Leader Sprites ===\n');

    const files = fs.readdirSync(GYM_DIR);
    
    for (const file of files) {
        if (!file.endsWith('.png')) continue;
        
        const localPath = path.join(GYM_DIR, file);
        const storagePath = 'gym-leaders/' + file;
        
        await uploadFile(localPath, storagePath);
        console.log('OK: ' + file);
    }

    console.log('\n=== Upload Done ===');
    console.log('Uploaded: ' + uploaded);
    console.log('Failed: ' + failed);

    console.log('\n=== Updating database ===');
    
    let updated = 0;
    for (const [fileName, leaderName] of Object.entries(NAME_MAP)) {
        const url = 'https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/gym-leaders/' + fileName + '.png';
        
        const { error } = await supabase
            .from('gym_leaders')
            .update({ sprite_url: url })
            .eq('name', leaderName);
        
        if (error) {
            console.log('DB FAIL: ' + leaderName + ' - ' + error.message);
        } else {
            updated++;
        }
    }
    
    console.log('Updated: ' + updated + ' leaders in database');
}

main().catch(console.error);
