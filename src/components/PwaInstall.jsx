import React, { createContext, useContext, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
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

export function usePwaInstallContext() {
  const ctx = useContext(PwaContext)
  if (!ctx) throw new Error('PwaInstallProvider required')
  return ctx
}

function usePwa() {
  return usePwaInstallContext()
}

export function PwaInstallProgress() {
  const location = useLocation()
  const { installing, progress } = usePwa()
  if (location.pathname === '/' || !installing || !progress) return null

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

/** Tarjeta de instalación en la landing (estilo TrackPro). Oculta dentro de la PWA. */
export function PwaLandingInstall() {
  const { canInstall, installed, showIosHint, installing, progress, runInstall } = usePwa()

  if (installed) return null

  const idleHint = showIosHint && !canInstall
    ? 'En Safari: pulsa Compartir → Añadir a pantalla de inicio'
    : canInstall
      ? 'Acceso rápido desde escritorio, tablet o móvil sin abrir el navegador'
      : 'En Chrome o Edge: menú ⋮ → Instalar aplicación'

  const statusLabel = installing && progress
    ? progress.label
    : idleHint

  const statusPct = installing && progress ? progress.pct : 0

  return (
    <section className={styles.landingInstall} aria-label="Instalar aplicación">
      <div className={styles.landingInstallHead}>
        <div className={styles.landingInstallLogo}>
          <i className="ti ti-microphone" />
        </div>
        <div>
          <strong>PodcastStudio</strong>
          <span>Instalación de la aplicación</span>
        </div>
      </div>

      <div className={styles.landingInstallCard}>
        <div className={styles.landingInstallStatus}>
          <div className={styles.landingInstallIcon}>
            <i className="ti ti-download" />
          </div>
          <div className={styles.landingInstallStatusText}>
            <em>Estado</em>
            <p>{statusLabel}</p>
          </div>
          {installing && progress && (
            <strong className={styles.landingInstallPct}>{progress.pct}%</strong>
          )}
        </div>

        {(installing || statusPct > 0) && (
          <div className={styles.landingInstallTrack}>
            <div
              className={styles.landingInstallFill}
              style={{ width: `${Math.max(statusPct, installing ? 4 : 0)}%` }}
            />
          </div>
        )}

        <button
          type="button"
          className={styles.landingInstallBtn}
          disabled={installing}
          onClick={() => runInstall()}
        >
          <i className="ti ti-device-mobile" />
          {installing ? 'Instalando…' : 'Instalar en este dispositivo'}
        </button>
      </div>

      <p className={styles.landingInstallFoot}>
        Al completar la instalación podrás iniciar sesión, configurar tu estudio y grabar desde la app.
      </p>
    </section>
  )
}

export function PwaInstallBanner() {
  const location = useLocation()
  const { canInstall, installed, showIosHint, installing, runInstall } = usePwa()
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1')

  useEffect(() => {
    if (installed) localStorage.removeItem(DISMISS_KEY)
  }, [installed])

  if (location.pathname === '/' || installed || dismissed || installing) return null
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
  const location = useLocation()
  const { canInstall, installed, showIosHint, installing, runInstall } = usePwa()

  if (location.pathname === '/' || installed || installing || (!canInstall && !showIosHint)) return null

  return (
    <button type="button" className={styles.navBtn} onClick={() => runInstall()}>
      <i className="ti ti-download" />
      Instalar app
    </button>
  )
}
