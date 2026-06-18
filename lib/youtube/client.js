import { getSiteUrl } from '../integrations/site.js'

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token'
const YOUTUBE_UPLOAD = 'https://www.googleapis.com/upload/youtube/v3/videos'
const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3'

export const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
].join(' ')

export function isYouTubeConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

export function getYouTubeAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${getSiteUrl()}/api/youtube/callback`,
    response_type: 'code',
    scope: YOUTUBE_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `${GOOGLE_AUTH}?${params}`
}

export async function exchangeYouTubeCode(code) {
  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${getSiteUrl()}/api/youtube/callback`,
      grant_type: 'authorization_code',
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.error || 'OAuth falló')
  return data
}

export async function refreshYouTubeToken(refreshToken) {
  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || 'No se pudo renovar token')
  return data
}

export async function getYouTubeChannel(accessToken) {
  const res = await fetch(`${YOUTUBE_API}/channels?part=snippet&mine=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Canal no encontrado')
  const ch = data.items?.[0]
  return ch ? { id: ch.id, title: ch.snippet?.title } : null
}

export async function uploadVideoToYouTube({ accessToken, title, description, videoBuffer, mimeType = 'video/mp4' }) {
  const metadata = {
    snippet: { title, description: description || '', categoryId: '22' },
    status: { privacyStatus: 'private', selfDeclaredMadeForKids: false },
  }

  const initRes = await fetch(
    `${YOUTUBE_UPLOAD}?uploadType=resumable&part=snippet,status`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': String(videoBuffer.byteLength),
      },
      body: JSON.stringify(metadata),
    },
  )

  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}))
    throw new Error(err.error?.message || 'No se pudo iniciar subida a YouTube')
  }

  const uploadUrl = initRes.headers.get('location')
  if (!uploadUrl) throw new Error('YouTube no devolvió URL de subida')

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': mimeType,
      'Content-Length': String(videoBuffer.byteLength),
    },
    body: videoBuffer,
  })

  if (!uploadRes.ok) {
    const err = await uploadRes.text().catch(() => '')
    throw new Error(err || 'Error al subir video a YouTube')
  }

  return uploadRes.json()
}
