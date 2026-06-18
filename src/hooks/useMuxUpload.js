import { useCallback } from 'react'
import { createMuxUpload, uploadBlobToMux } from '../lib/integrations.js'

export function useMuxUpload() {
  const uploadRecording = useCallback(async (rec, meta = {}) => {
    try {
      const { uploadUrl, recordingId } = await createMuxUpload({
        title: meta.title || 'Episodio',
        fileName: rec.name,
        durationSec: rec.duration,
      })
      await uploadBlobToMux(uploadUrl, rec.blob)
      return { ok: true, recordingId }
    } catch (e) {
      console.error('Mux upload:', e)
      return { ok: false, error: e.message }
    }
  }, [])

  return { uploadRecording }
}
