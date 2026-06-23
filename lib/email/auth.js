import { createClient } from '@supabase/supabase-js'

export async function verifyEmailRecipient(authHeader, to) {
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, error: 'Autenticación requerida' }
  }

  const token = authHeader.slice(7)
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!url || !key) {
    return { ok: false, error: 'Supabase no configurado en el servidor' }
  }

  const supabase = createClient(url, key)
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) {
    return { ok: false, error: 'Sesión inválida' }
  }

  const userEmail = data.user.email?.toLowerCase()
  if (userEmail && userEmail !== to?.toLowerCase()) {
    return { ok: false, error: 'Solo puedes enviar notificaciones a tu correo' }
  }

  return { ok: true, user: data.user }
}
