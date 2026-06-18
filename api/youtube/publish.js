import { getUserFromAuthHeader } from '../../lib/supabase/auth.js'
import { getSupabaseAdmin } from '../../lib/supabase/admin.js'
import { refreshYouTubeToken, uploadVideoToYouTube } from '../../lib/youtube/client.js'
import { getMp4Url } from '../../lib/mux/client.js'
import { updateRecording } from '../../lib/integrations/recordings.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const user = await getUserFromAuthHeader(req.headers.authorization)
  if (!user) {
    res.status(401).json({ error: 'Inicia sesión' })
    return
  }

  const { recordingId } = req.body || {}
  if (!recordingId) {
    res.status(400).json({ error: 'Falta recordingId' })
    return
  }

  const db = getSupabaseAdmin()
  if (!db) {
    res.status(503).json({ error: 'Supabase no configurado' })
    return
  }

  const { data: recording } = await db.from('recordings')
    .select('*')
    .eq('id', recordingId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!recording?.mux_playback_id) {
    res.status(400).json({ error: 'La grabación aún no está lista en Mux' })
    return
  }

  const { data: conn } = await db.from('youtube_connections')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!conn?.refresh_token) {
    res.status(400).json({ error: 'Conecta tu canal de YouTube primero' })
    return
  }

  try {
    const tokens = await refreshYouTubeToken(conn.refresh_token)
    const mp4Res = await fetch(getMp4Url(recording.mux_playback_id))
    if (!mp4Res.ok) throw new Error('No se pudo obtener el video de Mux')
    const buffer = await mp4Res.arrayBuffer()

    const yt = await uploadVideoToYouTube({
      accessToken: tokens.access_token,
      title: recording.title || 'PodcastStudio',
      description: `Episodio grabado en PodcastStudio`,
      videoBuffer: buffer,
    })

    await updateRecording(recordingId, {
      youtube_video_id: yt.id,
      status: 'published',
    })

    res.status(200).json({ ok: true, videoId: yt.id, url: `https://youtube.com/watch?v=${yt.id}` })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
