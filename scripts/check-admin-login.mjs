const email = process.env.ADMIN_EMAIL || 'alfonsoavilery@icloud.com'
const password = process.env.ADMIN_PASSWORD || ''

const localUrl = process.env.VITE_SUPABASE_URL
const localAnon = process.env.VITE_SUPABASE_ANON_KEY

async function checkSupabase(url, anon, label) {
  if (!url || !anon) {
    console.log(`${label}: no configurado`)
    return
  }
  try {
    const health = await fetch(`${url}/auth/v1/health`)
    console.log(`${label} health:`, health.status)
    if (!password) {
      console.log(`${label}: sin ADMIN_PASSWORD, solo health`)
      return
    }
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anon, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const body = await res.json().catch(() => ({}))
    if (res.ok) {
      console.log(`${label} LOGIN OK:`, body.user?.email)
      console.log(`${label} role:`, body.user?.app_metadata?.role || body.user?.user_metadata?.role || 'user')
    } else {
      console.log(`${label} LOGIN FAIL:`, res.status, body.error_description || body.msg || body.error)
    }
  } catch (e) {
    console.log(`${label} ERROR:`, e.cause?.code || e.message)
  }
}

async function checkProduction() {
  try {
    const html = await fetch('https://podcastudio-three.vercel.app/').then((r) => r.text())
    const jsPath = html.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1]
    if (!jsPath) {
      console.log('prod: no JS bundle found')
      return
    }
    const code = await fetch(`https://podcastudio-three.vercel.app${jsPath}`).then((r) => r.text())
    const urls = [...new Set([...code.matchAll(/https:\/\/[a-z0-9]+\.supabase\.co/g)].map((m) => m[0]))]
    const keys = [...code.matchAll(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)].map((m) => m[0])
    const anon = keys[0]
    console.log('prod supabase:', urls[0] || 'none')
    keys.forEach((k, i) => {
      try {
        const payload = JSON.parse(Buffer.from(k.split('.')[1], 'base64url').toString())
        console.log(`prod key${i} role=${payload.role} ref=${payload.ref}`)
      } catch { /* noop */ }
    })
    if (urls[0] && anon) await checkSupabase(urls[0], anon, 'prod')
  } catch (e) {
    console.log('prod ERROR:', e.message)
  }
}

await checkSupabase(localUrl, localAnon, 'local')
await checkProduction()
