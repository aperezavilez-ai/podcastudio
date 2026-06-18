import { exchangeWebRtcOffer } from '../../lib/livepeer/client.js'
import { getUserFromAuthHeader } from '../../lib/supabase/auth.js'

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

  const { streamId, sdp } = req.body || {}
  if (!streamId || !sdp) {
    res.status(400).json({ error: 'Faltan streamId y sdp' })
    return
  }

  try {
    const answerSdp = await exchangeWebRtcOffer(streamId, sdp)
    res.status(200).json({ sdp: answerSdp })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
