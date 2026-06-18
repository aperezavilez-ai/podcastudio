import React, { createContext, useContext, useEffect, useState } from 'react'
import { usePwaInstallFlow } from '../hooks/usePwaInstallFlow.js'
import styles from './PwaInstall.module.css'

const DISMISS_KEY = 'podcastudio_pwa_dismiss'
const PwaContext = createContext(null)

export function PwaInstallProvider({ children }) {
  const flow = usePwaInstallFlow()
  return (
    <PwaContext.Provider value={flow}>
      {children}
      <PwaInstallProgress />
    </PwaContext.Provider>
  )
}

function usePwa() {
  const ctx = useContext(PwaContext)
  if (!ctx) throw new Error('PwaInstallProvider required')
  return ctx
}

export function PwaInstallProgress() {
  const { installing, progress } = usePwa()
  if (!installing || !progress) return null

  return (
    <div className={styles.progressWrap} role="status" aria-live="polite" aria-label="Progreso de instalación">
      <div className={styles.progressCard}>
        <div className={styles.progressHeader}>
          <i className="ti ti-download" />
          <span>{progress.label}</span>
          <strong>{progress.pct}%</strong>
        </div>
        <div className={styles.progressTrack}>
          <div
            className={styles.progressFill}
            style={{ width: `${progress.pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export function PwaInstallBanner() {
  const { canInstall, installed, showIosHint, installing, runInstall } = usePwa()
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1')

  useEffect(() => {
    if (installed) localStorage.removeItem(DISMISS_KEY)
  }, [installed])

  if (installed || dismissed || installing) return null
  if (!canInstall && !showIosHint) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  const handleInstall = () => {
    runInstall({ onSuccess: dismiss })
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
            <button type="button" className={styles.installBtn} onClick={handleInstall}>
              Instalar
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
  const { canInstall, installed, showIosHint, installing, runInstall } = usePwa()

  if (installed || installing || (!canInstall && !showIosHint)) return null

  return (
    <button type="button" className={styles.navBtn} onClick={() => runInstall()}>
      <i className="ti ti-download" />
      Instalar app
    </button>
  )
}
