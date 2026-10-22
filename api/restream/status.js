import { getUserFromAuthHeader } from '../../lib/supabase/auth.js'
import { getRestreamChannels, getRestreamIngest, isRestreamConfigured } from '../../lib/restream/client.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!isRestreamConfigured()) {
    res.status(200).json({ configured: false, channels: [] })
    return
  }

  const user = await getUserFromAuthHeader(req.headers.authorization)
  if (!user) {
    res.status(401).json({ error: 'Inicia sesión' })
    return
  }

  try {
    const [channels, ingest] = await Promise.all([
      getRestreamChannels(),
      getRestreamIngest(),
    ])
    res.status(200).json({
      configured: true,
      channels,
      ingest: {
        rtmpUrl: ingest.rtmpUrl,
        hasStreamKey: !!ingest.streamKey,
      },
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
