import { getSession } from './projects.js'

async function authHeaders() {
  const session = await getSession()
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` }
  }
  return {}
}

export async function sendNotification(type, to, data = {}) {
  if (!to || to.includes('demo@') || to.includes('@ps.com')) return { skipped: true }

  try {
    const res = await fetch('/api/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await authHeaders()),
      },
      body: JSON.stringify({ type, to, data }),
    })

    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.warn('Notification:', body.error || res.status)
      return { ok: false, error: body.error }
    }
    return { ok: true, id: body.id }
  } catch (e) {
    console.warn('Notification error:', e.message)
    return { ok: false, error: e.message }
  }
}

export async function checkEmailStatus() {
  try {
    const res = await fetch('/api/email/status')
    return await res.json()
  } catch {
    return { configured: false }
  }
}

export function notifyWelcome(user) {
  return sendNotification('welcome', user.email, { name: user.name })
}

export function notifyProjectReady(user, project) {
  return sendNotification('project_ready', user.email, {
    name: user.name,
    podcastName: project.name,
    episodeTitle: project.episodeTitle,
  })
}

export function notifyRecordingReady(user, { podcastName, episodeTitle, duration, fileName }) {
  return sendNotification('recording_ready', user.email, {
    name: user.name,
    podcastName,
    episodeTitle,
    duration,
    fileName,
  })
}

export function notifyLiveStarted(user, { podcastName, platforms }) {
  return sendNotification('live_started', user.email, {
    name: user.name,
    podcastName,
    platforms,
  })
}
