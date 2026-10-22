import { stopLiveStream } from '../../lib/livepeer/client.js'
import { getUserFromAuthHeader } from '../../lib/supabase/auth.js'
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

  const { streamId, sessionId } = req.body || {}

  try {
    if (streamId) await stopLiveStream(streamId)
    const db = getSupabaseAdmin()
    if (db && sessionId) {
      await db.from('live_sessions').update({ status: 'ended' }).eq('id', sessionId)
    }
    res.status(200).json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
