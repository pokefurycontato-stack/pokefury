window.checkMaps = async function() {
    const url = 'https://odevwnnpzsoltbrrjdts.supabase.co';
    const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZXZ3bm5wenNvbHRicnJqZHRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MDE3NjEsImV4cCI6MjEwMDQ3Nzc2MX0.xlZ4LgzmQ-DZUz1kDk3oucmlvjCkty1TgzfN2IDxhoY';
    const h = { apikey: key, Authorization: `Bearer ${key}` };

    const regions = await (await fetch(`${url}/rest/v1/regions?select=id,name`, { headers: h })).json();

    for (const region of regions) {
        const maps = await (await fetch(`${url}/rest/v1/region_maps?region_id=eq.${region.id}&select=name,player_spawn_x`, { headers: h })).json();
        const withSpawn = maps.filter(m => m.player_spawn_x != null).length;
        console.log(`${region.name}: ${maps.length} mapas, ${withSpawn} com spawn`);
        maps.forEach(m => console.log(`  ${m.name} ${m.player_spawn_x != null ? '✓' : ''}`));
    }
};
console.log('Execute: checkMaps()');
