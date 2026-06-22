import React, { useEffect, useState } from 'react'
import { isTouchDevice } from '../lib/device.js'
import styles from './LandscapeGate.module.css'

async function tryLockLandscape() {
  if (!isTouchDevice()) return
  try {
    await screen.orientation?.lock?.('landscape')
  } catch {
    try {
      await screen.orientation?.lock?.('landscape-primary')
    } catch { /* Safari / navegador sin lock */ }
  }
}

export default function LandscapeGate({ children }) {
  const [portrait, setPortrait] = useState(false)

  useEffect(() => {
    if (!isTouchDevice()) return undefined

    const update = () => {
      setPortrait(window.innerHeight > window.innerWidth)
      tryLockLandscape()
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    tryLockLandscape()

    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
      try {
        screen.orientation?.unlock?.()
      } catch { /* noop */ }
    }
  }, [])

  if (portrait && isTouchDevice()) {
    return (
      <div className={styles.blocked}>
        <div className={styles.card}>
          <i className="ti ti-rotate-clockwise" />
          <h1>Gira el teléfono</h1>
          <p>PodcastStudio funciona en <strong>horizontal</strong>. Rota el dispositivo para continuar.</p>
        </div>
      </div>
    )
  }

  return children
}
