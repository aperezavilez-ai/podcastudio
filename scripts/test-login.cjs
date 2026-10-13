const { createClient } = require('@supabase/supabase-js')

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Falta SUPABASE_URL / VITE_SUPABASE_URL o SUPABASE_ANON_KEY en el entorno')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const email = process.env.ADMIN_EMAIL || 'alfonsoavilez@icloud.com'
const password = process.env.ADMIN_PASSWORD || 'Calurore1028@'

supabase.auth.signInWithPassword({ email, password }).then(r => {
  if (r.error) {
    console.error('LOGIN ERROR:', r.error.message)
    process.exit(1)
  }
  console.log('LOGIN OK')
  console.log('User:', r.data.user.email)
  console.log('Role:', r.data.user.app_metadata?.role || r.data.user.user_metadata?.role)
})