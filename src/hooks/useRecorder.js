import { useState, useRef, useCallback } from 'react'

export function useRecorder() {
  const [recording, setRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [recordings, setRecordings] = useState([])
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)

  const startRecording = useCallback((stream) => {
    if (!stream) return
    chunksRef.current = []
    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9',
      'video/webm',
      'video/mp4',
    ]
    const mimeType = mimeTypes.find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm'
    try {
      const mr = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000 })
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const url = URL.createObjectURL(blob)
        const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
        setRecordings(prev => [...prev, { url, name: `episodio-${ts}.webm`, size: blob.size, blob }])
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
    a.href = rec.url; a.download = rec.name; a.click()
  }, [])

  const formatDuration = (secs) => {
    const h = String(Math.floor(secs / 3600)).padStart(2, '0')
    const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0')
    const s = String(secs % 60).padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  return { recording, duration, recordings, startRecording, stopRecording, downloadRecording, formatDuration }
}
