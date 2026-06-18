import React, { createContext, useContext, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getBrowserLabel, getReadyHint } from '../lib/pwaBrowser.js'
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

/** Tarjeta de instalación en la landing. Oculta dentro de la PWA instalada. */
export function PwaLandingInstall() {
  const {
    canInstall, canShowInstall, installed, browser,
    installing, progress, installGuide, runInstall, clearGuide,
  } = usePwa()

  if (!canShowInstall) return null

  const idleHint = getReadyHint(browser, canInstall)
  const statusLabel = installing && progress ? progress.label : idleHint
  const statusPct = installing && progress ? progress.pct : (installGuide ? 100 : 0)

  return (
    <section className={styles.landingInstall} aria-label="Instalar aplicación">
      <div className={styles.landingInstallHead}>
        <div className={styles.landingInstallLogo}>
          <i className="ti ti-microphone" />
        </div>
        <div>
          <strong>PodcastStudio</strong>
          <span>Instalación en {getBrowserLabel(browser)}</span>
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
          {(installing || installGuide) && progress && (
            <strong className={styles.landingInstallPct}>{progress.pct}%</strong>
          )}
        </div>

        {(installing || installGuide || statusPct > 0) && (
          <div className={styles.landingInstallTrack}>
            <div
              className={styles.landingInstallFill}
              style={{ width: `${Math.max(statusPct, installing ? 4 : 0)}%` }}
            />
          </div>
        )}

        {installGuide && (
          <ol className={styles.landingInstallSteps}>
            {installGuide.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        )}

        <button
          type="button"
          className={styles.landingInstallBtn}
          disabled={installing}
          onClick={() => (installGuide ? clearGuide() : runInstall())}
        >
          <i className={installGuide ? 'ti ti-refresh' : 'ti ti-download'} />
          {installing
            ? 'Instalando…'
            : installGuide
              ? 'Intentar de nuevo'
              : 'Instalar en este dispositivo'}
        </button>
      </div>

      <p className={styles.landingInstallFoot}>
        Compatible con Chrome, Edge, Brave, Firefox, Safari y Samsung Internet.
        Al completar la instalación podrás iniciar sesión y usar el estudio desde la app.
      </p>
    </section>
  )
}

export function PwaInstallBanner() {
  const location = useLocation()
  const { canShowInstall, browser, canInstall, installed, installing, runInstall } = usePwa()
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1')

  useEffect(() => {
    if (installed) localStorage.removeItem(DISMISS_KEY)
  }, [installed])

  if (location.pathname === '/' || !canShowInstall || dismissed || installing) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className={styles.wrap} role="dialog" aria-label="Instalar aplicación">
      <div className={styles.card}>
        <div className={styles.icon}><i className="ti ti-download" /></div>
        <div className={styles.text}>
          <strong>Instalar PodcastStudio</strong>
          <span>{getReadyHint(browser, canInstall)}</span>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.installBtn} onClick={() => runInstall({ onSuccess: dismiss })}>
            Instalar
          </button>
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
  const { canShowInstall, installed, installing, runInstall } = usePwa()

  if (location.pathname === '/' || !canShowInstall || installed || installing) return null

  return (
    <button type="button" className={styles.navBtn} onClick={() => runInstall()}>
      <i className="ti ti-download" />
      Instalar app
    </button>
  )
}
