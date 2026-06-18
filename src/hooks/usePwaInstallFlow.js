import { useCallback, useState } from 'react'
import { usePwaInstall } from './usePwaInstall.js'

const PREP_STEPS = [
  { pct: 1, label: 'Iniciando instalación…' },
  { pct: 3, label: 'Verificando archivos…' },
  { pct: 5, label: 'Preparando recursos…' },
  { pct: 7, label: 'Configurando aplicación…' },
  { pct: 10, label: 'Finalizando preparación…' },
]

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

export function usePwaInstallFlow() {
  const pwa = usePwaInstall()
  const [installing, setInstalling] = useState(false)
  const [progress, setProgress] = useState(null)

  const runInstall = useCallback(async ({ onSuccess } = {}) => {
    if (installing) return false
    setInstalling(true)

    try {
      for (const step of PREP_STEPS) {
        setProgress(step)
        await wait(380 + Math.random() * 220)
      }

      if (pwa.showIosHint && !pwa.canInstall) {
        setProgress({ pct: 10, label: 'Abre Compartir → Añadir a pantalla de inicio' })
        await wait(600)
        window.alert('En iPhone/iPad: pulsa Compartir en Safari y elige «Añadir a pantalla de inicio».')
        return false
      }

      setProgress({ pct: 10, label: 'Abriendo instalador del sistema…' })
      const ok = await pwa.install()

      if (ok) {
        for (const pct of [35, 62, 88, 100]) {
          setProgress({
            pct,
            label: pct < 100 ? 'Instalando PodcastStudio…' : '¡Instalación completa!',
          })
          await wait(280)
        }
        onSuccess?.()
        await wait(700)
      }

      return ok
    } finally {
      setInstalling(false)
      setProgress(null)
    }
  }, [installing, pwa])

  return { ...pwa, installing, progress, runInstall }
}
