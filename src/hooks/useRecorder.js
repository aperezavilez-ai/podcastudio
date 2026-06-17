import { useState, useRef, useCallback } from 'react'

function isMp4Recording(mimeType) {
  return mimeType?.includes('mp4')
}

export function useRecorder() {
  const [recording, setRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [recordings, setRecordings] = useState([])
  const [converting, setConverting] = useState(false)
  const [convertProgress, setConvertProgress] = useState(0)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const mimeTypeRef = useRef('video/webm')

  const pickMimeType = () => {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9',
      'video/webm',
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4',
    ]
    return types.find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm'
  }

  const startRecording = useCallback((stream) => {
    if (!stream) return
    chunksRef.current = []
    const mimeType = pickMimeType()
    mimeTypeRef.current = mimeType
    const ext = isMp4Recording(mimeType) ? 'mp4' : 'webm'
    try {
      const mr = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000, audioBitsPerSecond: 192000 })
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const url = URL.createObjectURL(blob)
        const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
        setRecordings(prev => [...prev, {
          url, name: `episodio-${ts}.${ext}`, size: blob.size, blob, mimeType, ext,
        }])
      }
      mr.start(1000)
      mediaRecorderRef.current = mr
      setRecording(true)
      setDuration(0)
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    } catch (e) {
      console.error('MediaRecorder error:', e)
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    clearInterval(timerRef.current)
    setRecording(false)
  }, [])

  const downloadRecording = useCallback((rec) => {
    const a = document.createElement('a')
    a.href = rec.url
    a.download = rec.name
    a.click()
  }, [])

  const downloadRecordingMp4 = useCallback(async (rec) => {
    if (rec.ext === 'mp4' || isMp4Recording(rec.mimeType)) {
      downloadRecording({ ...rec, name: rec.name.replace(/\.webm$/i, '.mp4') })
      return
    }
    setConverting(true)
    setConvertProgress(0)
    try {
      const { convertWebmToMp4 } = await import('../utils/exportVideo.js')
      const mp4Blob = await convertWebmToMp4(rec.blob, setConvertProgress)
      const url = URL.createObjectURL(mp4Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = rec.name.replace(/\.webm$/i, '.mp4')
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('MP4 conversion error:', e)
      alert('No se pudo convertir a MP4. Descarga el archivo WebM.')
    } finally {
      setConverting(false)
      setConvertProgress(0)
    }
  }, [downloadRecording])

  const formatDuration = (secs) => {
    const h = String(Math.floor(secs / 3600)).padStart(2, '0')
    const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0')
    const s = String(secs % 60).padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  return {
    recording, duration, recordings, converting, convertProgress,
    startRecording, stopRecording, downloadRecording, downloadRecordingMp4, formatDuration,
  }
}
