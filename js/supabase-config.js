const SUPABASE_URL = 'https://odevwnnpzsoltbrrjdts.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZXZ3bm5wenNvbHRicnJqZHRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MDE3NjEsImV4cCI6MjEwMDQ3Nzc2MX0.xlZ4LgzmQ-DZUz1kDk3oucmlvjCkty1TgzfN2IDxhoY';

try {
    if (window.supabase && window.supabase.createClient) {
        const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        window.db = supabase;
        window.SUPABASE_URL = SUPABASE_URL;
    } else {
        console.error('[PokeFury] Supabase CDN não carregou. window.supabase:', window.supabase);
        window.db = null;
    }
} catch (err) {
    console.error('[PokeFury] Erro ao criar cliente Supabase:', err);
    window.db = null;
}
