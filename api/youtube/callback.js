import {
  exchangeYouTubeCode,
  getYouTubeChannel,
  isYouTubeConfigured,
} from '../../lib/youtube/client.js'
import { getSupabaseAdmin } from '../../lib/supabase/admin.js'
import { getSiteUrl } from '../../lib/integrations/site.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { code, state, error } = req.query || {}

  if (error) {
    res.redirect(`${getSiteUrl()}/studio?youtube=error`)
    return
  }

  if (!isYouTubeConfigured() || !code || !state) {
    res.redirect(`${getSiteUrl()}/studio?youtube=error`)
    return
  }

  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString())
    const tokens = await exchangeYouTubeCode(code)
    const channel = await getYouTubeChannel(tokens.access_token)

    const db = getSupabaseAdmin()
    if (!db) throw new Error('Supabase no configurado')

    await db.from('youtube_connections').upsert({
      user_id: parsed.userId,
      channel_id: channel?.id,
      channel_title: channel?.title,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })

    res.redirect(`${getSiteUrl()}/studio?youtube=connected`)
  } catch (e) {
    console.error('YouTube callback:', e)
    res.redirect(`${getSiteUrl()}/studio?youtube=error`)
  }
}
