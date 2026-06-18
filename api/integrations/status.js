import { isMuxConfigured } from '../../lib/mux/client.js'
import { isRestreamConfigured } from '../../lib/restream/client.js'
import { isLivepeerConfigured } from '../../lib/livepeer/client.js'
import { isYouTubeConfigured } from '../../lib/youtube/client.js'
import { isSupabaseAdminConfigured } from '../../lib/supabase/admin.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  res.status(200).json({
    mux: isMuxConfigured(),
    restream: isRestreamConfigured(),
    livepeer: isLivepeerConfigured(),
    youtube: isYouTubeConfigured(),
    supabaseSync: isSupabaseAdminConfigured(),
    liveWithoutObs: isLivepeerConfigured() && isRestreamConfigured(),
    autoUpload: isMuxConfigured(),
    autoPublish: isMuxConfigured() && isYouTubeConfigured(),
  })
}
