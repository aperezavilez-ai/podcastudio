import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Falta SUPABASE_URL / VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const { data, error } = await supabase.auth.admin.listUsers()
if (error) { console.error('ERROR:', error.message); process.exit(1) }
console.log('Total usuarios:', data.users.length)
data.users.forEach(u => console.log(' -', u.email, '| rol:', u.app_metadata?.role || u.user_metadata?.role || 'user'))