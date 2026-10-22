import { createHmac, timingSafeEqual } from 'crypto'
import { getUpload, getAsset } from '../../lib/mux/client.js'
import { getRecordingByMuxUpload, updateRecording } from '../../lib/integrations/recordings.js'
import { getSupabaseAdmin } from '../../lib/supabase/admin.js'
import {
  refreshYouTubeToken,
  uploadVideoToYouTube,
  isYouTubeConfigured,
} from '../../lib/youtube/client.js'
import { getMp4Url } from '../../lib/mux/client.js'

function verifyMuxSignature(rawBody, signature) {
  const secret = process.env.MUX_WEBHOOK_SECRET
  if (!secret || !signature) return !secret

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const sig = signature.replace(/^v1=/, '').trim()
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
  } catch {
    return false
  }
}

async function tryPublishYouTube(recording) {
  if (!isYouTubeConfigured() || !recording.mux_playback_id) return null

  const db = getSupabaseAdmin()
  if (!db) return null

  const { data: conn } = await db.from('youtube_connections')
    .select('*')
    .eq('user_id', recording.user_id)
    .maybeSingle()

  if (!conn?.refresh_token) return null

  const tokens = await refreshYouTubeToken(conn.refresh_token)
  const accessToken = tokens.access_token

  const mp4Url = getMp4Url(recording.mux_playback_id)
  const videoRes = await fetch(mp4Url)
  if (!videoRes.ok) throw new Error('No se pudo descargar video de Mux')
  const buffer = await videoRes.arrayBuffer()

  const yt = await uploadVideoToYouTube({
    accessToken,
    title: recording.title || 'PodcastStudio',
    description: `Publicado desde PodcastStudio\n${recording.file_name || ''}`,
    videoBuffer: buffer,
  })

  return yt.id
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {})
  const signature = req.headers['mux-signature'] || req.headers['Mux-Signature']

  if (process.env.MUX_WEBHOOK_SECRET && !verifyMuxSignature(rawBody, signature)) {
    res.status(401).json({ error: 'Firma inválida' })
    return
  }

  const event = typeof req.body === 'object' ? req.body : JSON.parse(rawBody || '{}')
  const type = event.type
  const data = event.data

  try {
    if (type === 'video.upload.asset_created') {
      const uploadId = data.id
      const assetId = data.asset_id
      const rec = await getRecordingByMuxUpload(uploadId)
      if (rec) {
        await updateRecording(rec.id, { mux_asset_id: assetId, status: 'processing' })
      }
    }

    if (type === 'video.asset.ready') {
      const assetId = data.id
      const playbackId = data.playback_ids?.[0]?.id
      const db = getSupabaseAdmin()
      let rec = null

      if (db) {
        const { data: rows } = await db.from('recordings').select('*').eq('mux_asset_id', assetId).limit(1)
        rec = rows?.[0]
      }

      if (rec) {
        await updateRecording(rec.id, {
          mux_playback_id: playbackId,
          status: 'ready',
        })

        try {
          const youtubeId = await tryPublishYouTube({ ...rec, mux_playback_id: playbackId })
          if (youtubeId) {
            await updateRecording(rec.id, { youtube_video_id: youtubeId, status: 'published' })
          }
        } catch (e) {
          console.error('YouTube auto-publish:', e.message)
          await updateRecording(rec.id, { error_message: `YouTube: ${e.message}` })
        }
      }
    }

    res.status(200).json({ received: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

export const config = {
  api: { bodyParser: true },
}
