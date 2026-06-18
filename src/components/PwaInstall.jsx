import React, { createContext, useContext, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getBrowserLabel, getReadyHint } from '../lib/pwaBrowser.js'
import { PWA_DISMISS_KEY } from '../lib/pwaStorage.js'
import { usePwaInstallFlow } from '../hooks/usePwaInstallFlow.js'
import styles from './PwaInstall.module.css'

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

/** Tarjeta en landing: instalar solo si no está instalada; actualizar si hay nueva versión. */
export function PwaLandingInstall() {
  const {
    showInstallUi, showUpdateUi, installedOnDevice, isStandalone, browser,
    installing, progress, installGuide, runInstall, runUpdate, clearGuide,
  } = usePwa()

  if (isStandalone && !showUpdateUi) return null
  if (installedOnDevice && !showUpdateUi && !showInstallUi) return null

  const isUpdate = showUpdateUi
  const idleHint = isUpdate
    ? 'Hay una nueva versión de PodcastStudio disponible.'
    : getReadyHint(browser, showInstallUi)
  const statusLabel = installing && progress ? progress.label : idleHint
  const statusPct = installing && progress ? progress.pct : (installGuide ? 100 : 0)

  return (
    <section className={styles.landingInstall} aria-label={isUpdate ? 'Actualizar aplicación' : 'Instalar aplicación'}>
      <div className={styles.landingInstallHead}>
        <div className={styles.landingInstallLogo}>
          <i className={isUpdate ? 'ti ti-refresh' : 'ti ti-microphone'} />
        </div>
        <div>
          <strong>PodcastStudio</strong>
          <span>
            {isUpdate
              ? 'Actualización disponible'
              : installedOnDevice
                ? 'App instalada en tu dispositivo'
                : `Instalación en ${getBrowserLabel(browser)}`}
          </span>
        </div>
      </div>

      <div className={styles.landingInstallCard}>
        <div className={styles.landingInstallStatus}>
          <div className={styles.landingInstallIcon}>
            <i className={isUpdate ? 'ti ti-refresh' : 'ti ti-download'} />
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

        {isUpdate && (
          <button
            type="button"
            className={styles.landingInstallBtn}
            disabled={installing}
            onClick={() => runUpdate()}
          >
            <i className="ti ti-refresh" />
            {installing ? 'Actualizando…' : 'Instalar actualización'}
          </button>
        )}

        {showInstallUi && !isUpdate && (
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
        )}

        {installedOnDevice && !isUpdate && !showInstallUi && (
          <p className={styles.landingInstalledNote}>
            <i className="ti ti-circle-check" /> Ya tienes la app instalada. Ábrela desde tu pantalla de inicio.
          </p>
        )}
      </div>

      {!installedOnDevice && (
        <p className={styles.landingInstallFoot}>
          Compatible con Chrome, Edge, Brave, Firefox y Safari. Solo se instala una vez por dispositivo.
        </p>
      )}
    </section>
  )
}

/** Banner flotante: solo actualizaciones o primera instalación (no en landing ni si ya instalada). */
export function PwaInstallBanner() {
  const location = useLocation()
  const {
    showInstallUi, showUpdateUi, installedOnDevice, isStandalone,
    browser, installing, runInstall, runUpdate,
  } = usePwa()
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(PWA_DISMISS_KEY) === '1')

  useEffect(() => {
    if (installedOnDevice || isStandalone) localStorage.removeItem(PWA_DISMISS_KEY)
  }, [installedOnDevice, isStandalone])

  if (location.pathname === '/' || location.pathname === '/auth' || installing) return null
  if (isStandalone && !showUpdateUi) return null
  if (installedOnDevice && !showUpdateUi) return null
  if (!showInstallUi && !showUpdateUi) return null
  if (!showUpdateUi && dismissed) return null

  const isUpdate = showUpdateUi

  const dismiss = () => {
    if (!isUpdate) localStorage.setItem(PWA_DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className={styles.wrap} role="dialog" aria-label={isUpdate ? 'Actualizar aplicación' : 'Instalar aplicación'}>
      <div className={styles.card}>
        <div className={styles.icon}>
          <i className={isUpdate ? 'ti ti-refresh' : 'ti ti-download'} />
        </div>
        <div className={styles.text}>
          <strong>{isUpdate ? 'Actualización disponible' : 'Instalar PodcastStudio'}</strong>
          <span>
            {isUpdate
              ? 'Hay una nueva versión lista. No necesitas volver a instalar la app.'
              : getReadyHint(browser, showInstallUi)}
          </span>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.installBtn}
            onClick={() => (isUpdate ? runUpdate() : runInstall({ onSuccess: dismiss }))}
          >
            {isUpdate ? 'Actualizar' : 'Instalar'}
          </button>
          {!isUpdate && (
            <button type="button" className={styles.dismissBtn} onClick={dismiss} aria-label="Cerrar">
              <i className="ti ti-x" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function PwaInstallNavButton() {
  const location = useLocation()
  const { showInstallUi, showUpdateUi, isStandalone, installedOnDevice, installing, runInstall, runUpdate } = usePwa()

  if (location.pathname === '/' || isStandalone || installing) return null
  if (installedOnDevice && !showUpdateUi) return null
  if (!showInstallUi && !showUpdateUi) return null

  return (
    <button type="button" className={styles.navBtn} onClick={() => (showUpdateUi ? runUpdate() : runInstall())}>
      <i className={showUpdateUi ? 'ti ti-refresh' : 'ti ti-download'} />
      {showUpdateUi ? 'Actualizar' : 'Instalar app'}
    </button>
  )
}
