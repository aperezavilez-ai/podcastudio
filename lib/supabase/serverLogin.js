import { createClient } from '@supabase/supabase-js'

function getSupabaseAuthClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !anon) return null
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

const ADMIN_EMAIL = 'aperezavilez@gmail.com'

const TYPO_MAP = {
  'alfonsoevilery@icloud.com': ADMIN_EMAIL,
  'alfonsovillery@icloud.com': ADMIN_EMAIL,
  'alfonsoavilery@icloud.com': ADMIN_EMAIL,
  'alfonsoaviler@icloud.com': ADMIN_EMAIL,
}

function normalizeEmail(email) {
  const e = (email || '').trim().toLowerCase()
  return TYPO_MAP[e] || e
}

/** Login con variables de servidor (Vercel). */
export async function serverSignIn(email, password) {
  const supabase = getSupabaseAuthClient()
  if (!supabase) throw new Error('Supabase no configurado en servidor')
  const loginEmail = normalizeEmail(email)
  const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password })
  if (error) throw error
  if (!data?.session?.user) throw new Error('No se pudo iniciar sesión')
  return data
}

export function getSupabaseProjectRef() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const match = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)
  return match?.[1] || null
}
