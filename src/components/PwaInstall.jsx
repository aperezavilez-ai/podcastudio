import React, { useEffect, useState } from 'react'
import { usePwaInstall } from '../hooks/usePwaInstall.js'
import styles from './PwaInstall.module.css'

const DISMISS_KEY = 'podcastudio_pwa_dismiss'

export function PwaInstallBanner() {
  const { canInstall, installed, showIosHint, install } = usePwaInstall()
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (installed) localStorage.removeItem(DISMISS_KEY)
  }, [installed])

  if (installed || dismissed) return null
  if (!canInstall && !showIosHint) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  const handleInstall = async () => {
    setLoading(true)
    try {
      const ok = await install()
      if (ok) dismiss()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.wrap} role="dialog" aria-label="Instalar aplicación">
      <div className={styles.card}>
        <div className={styles.icon}><i className="ti ti-download" /></div>
        <div className={styles.text}>
          <strong>Instalar PodcastStudio</strong>
          <span>
            {showIosHint && !canInstall
              ? 'En Safari: Compartir → Añadir a pantalla de inicio'
              : 'Acceso rápido desde tu escritorio, tablet o móvil'}
          </span>
        </div>
        <div className={styles.actions}>
          {canInstall && (
            <button type="button" className={styles.installBtn} disabled={loading} onClick={handleInstall}>
              {loading ? '...' : 'Instalar'}
            </button>
          )}
          <button type="button" className={styles.dismissBtn} onClick={dismiss} aria-label="Cerrar">
            <i className="ti ti-x" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function PwaInstallNavButton() {
  const { canInstall, installed, showIosHint, install } = usePwaInstall()
  const [loading, setLoading] = useState(false)

  if (installed || (!canInstall && !showIosHint)) return null

  const handleClick = async () => {
    if (showIosHint && !canInstall) {
      window.alert('En iPhone/iPad: pulsa Compartir en Safari y elige «Añadir a pantalla de inicio».')
      return
    }
    setLoading(true)
    try {
      await install()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button type="button" className={styles.navBtn} onClick={handleClick} disabled={loading}>
      <i className="ti ti-download" />
      {loading ? '...' : 'Instalar app'}
    </button>
  )
}
