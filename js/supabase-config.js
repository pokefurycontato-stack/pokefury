const SUPABASE_URL = 'https://odevwnnpzsoltbrrjdts.supabase.co';
const SUPABASE_KEY = 'sb_publishable_RZpdwCglTWYBJO8Ss20fUQ_3tYIXSYY';

try {
    if (window.supabase && window.supabase.createClient) {
        const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        window.db = supabase;
        console.log('[PokeFury] Supabase conectado com sucesso');
    } else {
        console.error('[PokeFury] Supabase CDN não carregou. window.supabase:', window.supabase);
        window.db = null;
    }
} catch (err) {
    console.error('[PokeFury] Erro ao criar cliente Supabase:', err);
    window.db = null;
}
