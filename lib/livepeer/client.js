import { Livepeer } from 'livepeer'
import { getRestreamIngest } from '../restream/client.js'

let livepeerClient = null

export function isLivepeerConfigured() {
  return !!process.env.LIVEPEER_API_KEY
}

export function getLivepeer() {
  if (!isLivepeerConfigured()) return null
  if (!livepeerClient) {
    livepeerClient = new Livepeer({ apiKey: process.env.LIVEPEER_API_KEY })
  }
  return livepeerClient
}

export async function createLiveStream({ title, multistreamToRestream = true }) {
  const lp = getLivepeer()
  if (!lp) throw new Error('Livepeer no configurado')

  const body = { name: title || 'PodcastStudio Live' }

  if (multistreamToRestream && process.env.RESTREAM_API_TOKEN) {
    try {
      const ingest = await getRestreamIngest()
      body.multistream = {
        targets: [{
          profile: 'source',
          spec: {
            name: 'Restream',
            url: ingest.fullRtmpUrl,
          },
        }],
      }
    } catch (e) {
      console.warn('Restream multistream:', e.message)
    }
  }

  const stream = await lp.stream.create(body)
  return {
    streamId: stream.id,
    streamKey: stream.streamKey,
    playbackId: stream.playbackId,
  }
}

export async function stopLiveStream(streamId) {
  const lp = getLivepeer()
  if (!lp || !streamId) return
  try {
    await lp.stream.delete(streamId)
  } catch { /* noop */ }
}

export async function exchangeWebRtcOffer(streamId, sdp) {
  const apiKey = process.env.LIVEPEER_API_KEY
  if (!apiKey) throw new Error('Livepeer no configurado')

  const res = await fetch(`https://livepeer.studio/api/stream/${streamId}/offer`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sdp }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(err || `Livepeer offer ${res.status}`)
  }

  const data = await res.json()
  return data.sdp || data.answer?.sdp
}
