import { useCallback, useState } from 'react'
import { getManualInstallSteps } from '../lib/pwaBrowser.js'
import { usePwaInstall } from './usePwaInstall.js'

const PREP_STEPS = [
  { pct: 5, label: 'Iniciando instalación…' },
  { pct: 12, label: 'Verificando archivos del estudio…' },
  { pct: 22, label: 'Preparando cámaras y grabación HD…' },
  { pct: 34, label: 'Configurando transmisión en vivo…' },
  { pct: 46, label: 'Activando cintillos y recursos de IA…' },
  { pct: 58, label: 'Sincronizando panel de control…' },
  { pct: 63, label: 'Preparando acceso sin conexión…' },
]

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

export function usePwaInstallFlow() {
  const pwa = usePwaInstall()
  const [installing, setInstalling] = useState(false)
  const [progress, setProgress] = useState(null)
  const [installGuide, setInstallGuide] = useState(null)

  const runInstall = useCallback(async ({ onSuccess } = {}) => {
    if (installing) return false
    setInstalling(true)
    setInstallGuide(null)

    try {
      for (const step of PREP_STEPS) {
        setProgress(step)
        await wait(380 + Math.random() * 220)
      }

      setProgress({ pct: 68, label: 'Abriendo instalador de tu navegador…' })
      const ok = await pwa.install()

      if (ok) {
        for (const [pct, label] of [
          [82, 'Instalando PodcastStudio en tu dispositivo…'],
          [92, 'Configurando icono y acceso directo…'],
          [100, '¡Instalación completa!'],
        ]) {
          setProgress({ pct, label })
          await wait(320)
        }
        onSuccess?.()
        await wait(700)
        setProgress(null)
        return true
      }

      setProgress({ pct: 100, label: 'Sigue estos pasos en tu navegador:' })
      setInstallGuide(getManualInstallSteps(pwa.browser))
      return false
    } finally {
      setInstalling(false)
    }
  }, [installing, pwa])

  const clearGuide = useCallback(() => {
    setInstallGuide(null)
    setProgress(null)
  }, [])

  return { ...pwa, installing, progress, installGuide, runInstall, clearGuide }
}
