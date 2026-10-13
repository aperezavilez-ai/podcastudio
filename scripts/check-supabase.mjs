const url = process.env.VITE_SUPABASE_URL

if (!url) {
  console.log('VITE_SUPABASE_URL no definido')
  process.exit(1)
}

fetch(url + '/auth/v1/health', { method: 'GET' })
  .then(r => {
    console.log('HEALTH STATUS:', r.status)
    console.log('OK:', r.status > 0 && r.status < 500)
  })
  .catch(e => console.log('HEALTH ERROR:', e.message))