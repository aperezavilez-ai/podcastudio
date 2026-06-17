import { useEffect } from 'react'

export function useAutoSwitcher({
  enabled,
  intervalSec = 8,
  streams,
  activeCamera,
  setActiveCamera,
  onlyWhileRecording = false,
  recording = false,
}) {
  useEffect(() => {
    if (!enabled) return
    if (onlyWhileRecording && !recording) return

    const slots = [0, 1, 2].filter(i => streams[i])
    if (slots.length < 2) return

    const id = setInterval(() => {
      setActiveCamera(prev => {
        const current = prev ?? slots[0]
        const idx = slots.indexOf(current)
        const nextIdx = idx === -1 ? 0 : (idx + 1) % slots.length
        return slots[nextIdx]
      })
    }, intervalSec * 1000)

    return () => clearInterval(id)
  }, [enabled, intervalSec, streams, setActiveCamera, onlyWhileRecording, recording])
}
