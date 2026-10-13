const { createClient } = require('@supabase/supabase-js')

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Falta SUPABASE_URL / VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

supabase.auth.admin.listUsers().then(r => {
  if (r.error) { console.error('ERROR:', r.error.message); process.exit(1) }
  console.log('Total usuarios:', r.data.users.length)
  r.data.users.forEach(u => console.log(' -', u.email, '| rol:', u.app_metadata?.role || u.user_metadata?.role || 'user'))
})