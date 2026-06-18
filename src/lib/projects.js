import { supabase, isSupabaseConfigured } from './supabase.js'

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

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (!error && data?.user) return data

  // Fallback: login vía API con env de servidor (Vercel puede tener Supabase distinto al bundle)
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw error || new Error(body.error || 'Error al iniciar sesión')

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: body.access_token,
      refresh_token: body.refresh_token,
    })
    if (sessionError) throw sessionError
    if (!body.user) throw new Error('No se pudo guardar la sesión')

    return { user: body.user, session: { access_token: body.access_token, refresh_token: body.refresh_token } }
  } catch (fallbackErr) {
    if (error) throw error
    throw fallbackErr
  }
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
