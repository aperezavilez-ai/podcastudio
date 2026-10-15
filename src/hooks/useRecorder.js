import { useState, useRef, useCallback, useEffect } from 'react'
import {
  startVaultSession,
  appendVaultChunk,
  finalizeVaultSession,
  assembleVaultRecording,
  checkUnfinishedRecovery,
  purgeVaultSession,
} from '../utils/recordingStorage.js'

function isMp4Recording(mimeType) {
  return mimeType?.includes('mp4')
}

export function useRecorder() {
  const [recording, setRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [recordings, setRecordings] = useState([])
  const [converting, setConverting] = useState(false)
  const [convertProgress, setConvertProgress] = useState(0)
  const [recoveredSession, setRecoveredSession] = useState(null)

  const mediaRecorderRef = useRef(null)
  const voiceRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const voiceChunksRef = useRef([])
  const timerRef = useRef(null)
  const mimeTypeRef = useRef('video/webm')
  const durationRef = useRef(0)
  const onCompleteRef = useRef(null)
  const sessionIdRef = useRef(null)
  const chunkIndexRef = useRef(0)

  // Verificación de sesiones no finalizadas para auto-recuperación
  useEffect(() => {
    let mounted = true
    checkUnfinishedRecovery().then((pending) => {
      if (mounted && pending) {
        setRecoveredSession(pending)
      }
    })
    return () => { mounted = false }
  }, [])

  const restoreRecoveredSession = useCallback(async () => {
    if (!recoveredSession) return
    try {
      const restored = await assembleVaultRecording(recoveredSession.sessionId)
      if (restored) {
        setRecordings(prev => [restored, ...prev])
      }
      setRecoveredSession(null)
    } catch (err) {
      console.error('Error al restaurar sesión previa:', err)
    }
  }, [recoveredSession])

  const dismissRecoveredSession = useCallback(async () => {
    if (!recoveredSession) return
    try {
      await purgeVaultSession(recoveredSession.sessionId)
    } catch {}
    setRecoveredSession(null)
  }, [recoveredSession])

  const pickMimeType = () => {
    const types = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ]
    return types.find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm'
  }

  const startRecording = useCallback((stream, options = {}) => {
    if (!stream) return
    chunksRef.current = []
    voiceChunksRef.current = []
    chunkIndexRef.current = 0
    const sessionId = 'rec_' + Date.now()
    sessionIdRef.current = sessionId

    const mimeType = pickMimeType()
    mimeTypeRef.current = mimeType
    const ext = isMp4Recording(mimeType) ? 'mp4' : 'webm'
    const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
    const recName = `episodio-${ts}.${ext}`

    const quality = options.quality || '1080p'
    const videoBitsPerSecond = quality === '4k' ? 35000000 : quality === '720p' ? 6000000 : 12000000

    // Inicializar sesión protegida en base de datos local
    startVaultSession(sessionId, { mimeType, ext, name: recName, quality })

    // Iniciar grabador de voz limpia aislado si se proporciona micStream
    const cleanVoiceStream = options.cleanVoiceStream
    if (cleanVoiceStream && cleanVoiceStream.getAudioTracks().length > 0) {
      try {
        const audioMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : ''
        const vr = audioMime ? new MediaRecorder(cleanVoiceStream, { mimeType: audioMime }) : new MediaRecorder(cleanVoiceStream)
        vr.ondataavailable = e => {
          if (e.data && e.data.size > 0) voiceChunksRef.current.push(e.data)
        }
        vr.start(1000)
        voiceRecorderRef.current = vr
      } catch (err) {
        console.warn('No se pudo inicializar grabador de voz limpia:', err)
      }
    }

    try {
      const mr = new MediaRecorder(stream, { mimeType, videoBitsPerSecond, audioBitsPerSecond: 320000 })
      
      mr.ondataavailable = e => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data)
          // Blindaje incremental: guarda en IndexedDB
          appendVaultChunk(sessionId, chunkIndexRef.current++, e.data)
        }
      }

      mr.onstop = () => {
        finalizeVaultSession(sessionId, durationRef.current)
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const url = URL.createObjectURL(blob)

        let cleanVoiceBlob = null
        let cleanVoiceUrl = null
        if (voiceChunksRef.current && voiceChunksRef.current.length > 0) {
          cleanVoiceBlob = new Blob(voiceChunksRef.current, { type: 'audio/webm' })
          cleanVoiceUrl = URL.createObjectURL(cleanVoiceBlob)
        }

        const rec = {
          sessionId,
          url,
          name: recName,
          size: blob.size,
          blob,
          mimeType,
          ext,
          quality,
          duration: durationRef.current,
          cleanVoiceBlob,
          cleanVoiceUrl,
          hasCleanVoice: Boolean(cleanVoiceBlob),
        }
        setRecordings(prev => [...prev, rec])
        onCompleteRef.current?.(rec)
        onCompleteRef.current = null
      }

      mr.start(1000)
      mediaRecorderRef.current = mr
      setRecording(true)
      setDuration(0)
      durationRef.current = 0
      timerRef.current = setInterval(() => {
        durationRef.current += 1
        setDuration(d => d + 1)
      }, 1000)
    } catch (e) {
      console.error('MediaRecorder error:', e)
    }
  }, [])

  const stopRecording = useCallback((onComplete) => {
    if (typeof onComplete === 'function') onCompleteRef.current = onComplete
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (voiceRecorderRef.current && voiceRecorderRef.current.state !== 'inactive') {
      voiceRecorderRef.current.stop()
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

  const downloadCleanVoice = useCallback((rec) => {
    if (!rec?.cleanVoiceUrl) return
    const a = document.createElement('a')
    a.href = rec.cleanVoiceUrl
    a.download = rec.name.replace(/\.(mp4|webm)$/i, '-VOZ-LIMPIA.webm')
    a.click()
  }, [])

  return {
    recording,
    duration,
    recordings,
    converting,
    convertProgress,
    recoveredSession,
    restoreRecoveredSession,
    dismissRecoveredSession,
    startRecording,
    stopRecording,
    downloadRecording,
    downloadRecordingMp4,
    downloadCleanVoice,
    formatDuration,
  }
}
