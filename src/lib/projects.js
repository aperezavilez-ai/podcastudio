import { supabase, isSupabaseConfigured } from './supabase.js'
import { normalizeLoginEmail } from './adminEmail.js'

export { isSupabaseConfigured }

const LOCAL_KEY = 'podcastudio_project'

function stripFiles(project) {
  const { logoFile, ...rest } = project
  return rest
}

export async function saveProject(userId, project) {
  const data = stripFiles(project)
  if (!isSupabaseConfigured || !userId) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data))
    return { ok: true, local: true }
  }
  const { error } = await supabase.from('projects').upsert(
    { user_id: userId, data, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  )
  if (error) throw error
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data))
  return { ok: true }
}

export async function loadProject(userId) {
  const local = localStorage.getItem(LOCAL_KEY)
  const localProject = local ? JSON.parse(local) : null

  if (!isSupabaseConfigured || !userId) return localProject

  const { data, error } = await supabase
    .from('projects')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data?.data || localProject
}

export async function signIn(email, password) {
  if (!supabase) throw new Error('Supabase no está configurado')

  const loginEmail = normalizeLoginEmail(email)

  async function persistSession(accessToken, refreshToken) {
    const { data, error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (sessionError) throw sessionError
    return data
  }

  // 1) API servidor (env Vercel — más fiable que el bundle del navegador)
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginEmail, password }),
    })
    const body = await res.json().catch(() => ({}))
    if (res.ok && body.access_token) {
      const sessionData = await persistSession(body.access_token, body.refresh_token)
      const user = sessionData?.user || body.user
      if (!user) throw new Error('No se pudo guardar la sesión')
      return { user, session: sessionData?.session || { access_token: body.access_token, refresh_token: body.refresh_token } }
    }
    if (res.status === 401) {
      throw new Error('Correo o contraseña incorrectos.')
    }
  } catch (apiErr) {
    if (apiErr?.message?.includes('incorrectos')) throw apiErr
    // Si la API falla por red, intentar directo abajo
  }

  // 2) Fallback directo al cliente Supabase
  const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password })
  if (error) throw error
  if (!data?.user) throw new Error('No se pudo iniciar sesión')
  return data
}

export async function signUp(email, password, name) {
  if (!supabase) return { demo: true }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  })
  if (error) throw error
  return data
}

export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}

export async function getSession() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session
}
