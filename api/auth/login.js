import { serverSignIn } from '../../lib/supabase/serverLogin.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const { email, password } = req.body || {}
    if (!email || !password) {
      res.status(400).json({ error: 'Correo y contraseña requeridos' })
      return
    }

    const data = await serverSignIn(email, password)
    res.status(200).json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: data.user,
    })
  } catch (e) {
    const msg = (e?.message || '').toLowerCase()
    if (msg.includes('invalid login') || msg.includes('invalid_credentials')) {
      res.status(401).json({ error: 'Correo o contraseña incorrectos.' })
      return
    }
    res.status(500).json({ error: e?.message || 'Error al iniciar sesión' })
  }
}
