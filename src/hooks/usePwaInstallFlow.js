import { useCallback, useState } from 'react'
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
        for (const [pct, label] of [
          [72, 'Instalando PodcastStudio en tu dispositivo…'],
          [84, 'Configurando icono y acceso directo…'],
          [94, 'Finalizando instalación…'],
          [100, '¡Instalación completa!'],
        ]) {
          setProgress({ pct, label })
          await wait(320)
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
