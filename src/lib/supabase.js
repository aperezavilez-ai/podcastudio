import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && key ? createClient(url, key) : null
export const isSupabaseConfigured = !!supabase

export async function getAccessToken() {
  if (!supabase) return null
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

export function mapSupabaseUser(user) {
  if (!user) return null
  const role = user.app_metadata?.role || user.user_metadata?.role || 'user'
  return {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario',
    role,
    isAdmin: role === 'admin',
  }
}
