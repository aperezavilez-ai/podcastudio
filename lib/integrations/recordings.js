import { getSupabaseAdmin } from '../supabase/admin.js'

export async function createRecordingRow({ userId, title, fileName, durationSec, muxUploadId }) {
  const db = getSupabaseAdmin()
  if (!db) throw new Error('Supabase admin no configurado')

  const { data, error } = await db.from('recordings').insert({
    user_id: userId,
    title: title || 'Episodio',
    file_name: fileName,
    duration_sec: durationSec,
    mux_upload_id: muxUploadId,
    status: 'uploading',
  }).select().single()

  if (error) throw error
  return data
}

export async function updateRecording(id, patch) {
  const db = getSupabaseAdmin()
  if (!db) throw new Error('Supabase admin no configurado')

  const { data, error } = await db.from('recordings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getRecordingByMuxUpload(muxUploadId) {
  const db = getSupabaseAdmin()
  if (!db) return null
  const { data } = await db.from('recordings').select('*').eq('mux_upload_id', muxUploadId).maybeSingle()
  return data
}

export async function getRecordingByMuxAsset(muxAssetId) {
  const db = getSupabaseAdmin()
  if (!db) return null
  const { data } = await db.from('recordings').select('*').eq('mux_asset_id', muxAssetId).maybeSingle()
  return data
}

export async function listUserRecordings(userId) {
  const db = getSupabaseAdmin()
  if (!db) return []
  const { data } = await db.from('recordings')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  return data || []
}
