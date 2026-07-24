const SUPABASE_URL = 'https://odevwnnpzsoltbrrjdts.supabase.co';
const SUPABASE_KEY = 'sb_publishable_RZpdwCglTWYBJO8Ss20fUQ_3tYIXSYY';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

window.db = supabase;
