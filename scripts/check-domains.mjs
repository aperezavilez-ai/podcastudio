const email = process.env.ADMIN_EMAIL || 'alfonsoavilery@icloud.com'
const password = process.env.ADMIN_PASSWORD || ''

async function checkDomain(base) {
  console.log(`\n=== ${base} ===`)
  try {
    const html = await fetch(`${base}/`).then((r) => r.text())
    const jsPath = html.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1]
    if (!jsPath) {
      console.log('no bundle')
      return
    }
    const code = await fetch(`${base}${jsPath}`).then((r) => r.text())
    const url = code.match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0]
    const keys = [...code.matchAll(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)].map((m) => m[0])
    const anon = keys[0]
    console.log('supabase', url)
    if (anon) {
      const p = JSON.parse(Buffer.from(anon.split('.')[1], 'base64url').toString())
      console.log('anon ref', p.ref)
    }
    if (!url || !anon || !password) return
    const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anon, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }))
    console.log('login', login.status, login.body.error_description || login.body.user?.email || 'ok')
  } catch (e) {
    console.log('error', e.message)
  }
}

await checkDomain('https://podcaststudio.mx')
