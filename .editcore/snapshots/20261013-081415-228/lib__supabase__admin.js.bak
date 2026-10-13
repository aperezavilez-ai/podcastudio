import { createClient } from '@supabase/supabase-js'

function getSupabaseUrl() {
  return process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
}

export function isSupabaseAdminConfigured() {
  return !!getSupabaseUrl() && !!process.env.SUPABASE_SERVICE_ROLE_KEY
}

export function getSupabaseAdmin() {
  const url = getSupabaseUrl()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
