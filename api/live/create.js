import { getUserFromAuthHeader } from '../../lib/supabase/auth.js'
import {
  createLiveStream,
  isLivepeerConfigured,
} from '../../lib/livepeer/client.js'
import { getSupabaseAdmin } from '../../lib/supabase/admin.js'

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

  if (!isLivepeerConfigured()) {
    res.status(503).json({ error: 'Añade LIVEPEER_API_KEY en Vercel para transmitir sin OBS' })
    return
  }

  const { title } = req.body || {}

  try {
    const stream = await createLiveStream({
      title: title || 'PodcastStudio Live',
      multistreamToRestream: true,
    })

    const db = getSupabaseAdmin()
    let sessionId = null
    if (db) {
      const { data } = await db.from('live_sessions').insert({
        user_id: user.id,
        livepeer_stream_id: stream.streamId,
        title: title || 'PodcastStudio Live',
        status: 'active',
      }).select('id').single()
      sessionId = data?.id
    }

    res.status(200).json({
      streamId: stream.streamId,
      streamKey: stream.streamKey,
      playbackId: stream.playbackId,
      sessionId,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
