import { supabase } from './supabase.js'

async function authHeaders() {
  if (!supabase) return {}
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return {}
  return { Authorization: `Bearer ${session.access_token}` }
}

export async function fetchIntegrationStatus() {
  const res = await fetch('/api/integrations/status')
  return res.json().catch(() => ({}))
}

export async function createMuxUpload({ title, fileName, durationSec }) {
  const res = await fetch('/api/mux/upload/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ title, fileName, durationSec }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Error al crear subida')
  return data
}

export async function uploadBlobToMux(uploadUrl, blob) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': blob.type || 'video/webm' },
  })
  if (!res.ok) throw new Error('Error al subir video a Mux')
}

export async function fetchCloudRecordings() {
  const res = await fetch('/api/mux/recordings', { headers: await authHeaders() })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Error al cargar grabaciones')
  return data.recordings || []
}

export async function fetchRestreamStatus() {
  const res = await fetch('/api/restream/status', { headers: await authHeaders() })
  return res.json().catch(() => ({}))
}

export async function createLiveSession(title) {
  const res = await fetch('/api/live/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ title }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'No se pudo iniciar transmisión')
  return data
}

export async function sendLiveOffer(streamId, sdp) {
  const res = await fetch('/api/live/offer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ streamId, sdp }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Error WebRTC')
  return data.sdp
}

export async function stopLiveSession(streamId, sessionId) {
  const res = await fetch('/api/live/stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ streamId, sessionId }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Error al detener')
  return data
}

export async function getYouTubeAuthUrl() {
  const res = await fetch('/api/youtube/auth', { headers: await authHeaders() })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'YouTube no configurado')
  return data.url
}

export async function fetchYouTubeStatus() {
  const res = await fetch('/api/youtube/status', { headers: await authHeaders() })
  return res.json().catch(() => ({}))
}

export async function publishToYouTube(recordingId) {
  const res = await fetch('/api/youtube/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ recordingId }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'No se pudo publicar')
  return data
}
