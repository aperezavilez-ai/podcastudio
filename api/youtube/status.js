import { getUserFromAuthHeader } from '../../lib/supabase/auth.js'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../../lib/supabase/admin.js'
import { isYouTubeConfigured } from '../../lib/youtube/client.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const user = await getUserFromAuthHeader(req.headers.authorization)
  if (!user) {
    res.status(401).json({ connected: false })
    return
  }

  if (!isYouTubeConfigured()) {
    res.status(200).json({ configured: false, connected: false })
    return
  }

  if (!isSupabaseAdminConfigured()) {
    res.status(200).json({ configured: true, connected: false })
    return
  }

  const db = getSupabaseAdmin()
  const { data } = await db.from('youtube_connections')
    .select('channel_id, channel_title, updated_at')
    .eq('user_id', user.id)
    .maybeSingle()

  res.status(200).json({
    configured: true,
    connected: !!data?.refresh_token,
    channelId: data?.channel_id,
    channelTitle: data?.channel_title,
  })
}
