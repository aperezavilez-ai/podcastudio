import Mux from '@mux/mux-node'
import { getSiteUrl } from '../integrations/site.js'

let muxClient = null

export function isMuxConfigured() {
  return !!(process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET)
}

export function getMux() {
  if (!isMuxConfigured()) return null
  if (!muxClient) {
    muxClient = new Mux({
      tokenId: process.env.MUX_TOKEN_ID,
      tokenSecret: process.env.MUX_TOKEN_SECRET,
    })
  }
  return muxClient
}

export async function createDirectUpload({ userId, title, corsOrigin }) {
  const mux = getMux()
  if (!mux) throw new Error('Mux no configurado')

  const upload = await mux.video.uploads.create({
    cors_origin: corsOrigin || getSiteUrl(),
    new_asset_settings: {
      playback_policy: ['public'],
      passthrough: JSON.stringify({ userId, title }),
    },
  })

  return {
    uploadId: upload.id,
    uploadUrl: upload.url,
  }
}

export async function getUpload(uploadId) {
  const mux = getMux()
  if (!mux) throw new Error('Mux no configurado')
  return mux.video.uploads.retrieve(uploadId)
}

export async function getAsset(assetId) {
  const mux = getMux()
  if (!mux) throw new Error('Mux no configurado')
  return mux.video.assets.retrieve(assetId)
}

export function getMp4Url(playbackId) {
  return `https://stream.mux.com/${playbackId}/high.mp4`
}
