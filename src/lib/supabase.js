import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('[supabase] VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY son requeridos. Revisa tu .env.');
}

export const supabase = url && key ? createClient(url, key) : null;
