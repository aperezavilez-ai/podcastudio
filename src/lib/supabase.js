import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

/** localStorage seguro en Safari iOS (modo privado puede lanzar excepción). */
const safeStorage = {
  getItem: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  setItem: (k, v) => { try { localStorage.setItem(k, v) } catch { /* noop */ } },
  removeItem: (k) => { try { localStorage.removeItem(k) } catch { /* noop */ } },
}

export const supabase = url && key
  ? createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: safeStorage,
    },
  })
  : null
export const isSupabaseConfigured = !!supabase

export function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

/** Comprueba si el proyecto Supabase responde (útil en móvil con red lenta). */
export async function checkSupabaseHealth(timeoutMs = 6000) {
  if (!url) return { ok: false, reason: 'not_configured' }
  try {
    const res = await withTimeout(
      fetch(`${url.replace(/\/$/, '')}/auth/v1/health`, { method: 'GET' }),
      timeoutMs,
      null,
    )
    if (!res) return { ok: false, reason: 'timeout' }
    // Supabase responde 401 en /health sin apikey; el servicio sigue activo.
    const reachable = res.status > 0 && res.status < 500
    return { ok: reachable, reason: reachable ? null : `http_${res.status}` }
  } catch {
    return { ok: false, reason: 'unreachable' }
  }
}

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
