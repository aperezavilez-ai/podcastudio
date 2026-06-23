import React from 'react'
import { CANONICAL_SITE_URL, isWrongAppHost } from '../lib/site.js'
import { detectBrowser, getBrowserLabel } from '../lib/pwaBrowser.js'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[PodcastStudio]', error, info?.componentStack)
  }

  render() {
    if (this.state.error) {
      const wrongHost = typeof window !== 'undefined' && (
        isWrongAppHost() || /podcaststudio/i.test(window.location.hostname)
      )
      const browser = getBrowserLabel(detectBrowser())
      const reloadHint = /mac/i.test(navigator.platform)
        ? 'Cmd+Shift+R'
        : 'Ctrl+Shift+R'

      return (
        <div style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 'max(24px, env(safe-area-inset-top)) 24px 24px',
          background: '#08080b',
          color: '#e8e8f0',
          fontFamily: 'Inter, system-ui, sans-serif',
          textAlign: 'center',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'rgba(232,97,42,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, color: '#e8612a',
          }}>
            !
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 600 }}>No se pudo cargar la app</h1>
          {wrongHost ? (
            <p style={{ fontSize: 14, color: '#ffb4b4', maxWidth: 360, lineHeight: 1.55 }}>
              Estás en un dominio incorrecto (<strong>podcaststudio.mx</strong>).
              El sitio oficial es <strong>www.podcastudio.mx</strong>.
            </p>
          ) : (
            <p style={{ fontSize: 14, color: '#8888a0', maxWidth: 360, lineHeight: 1.55 }}>
              Recarga con <strong>{reloadHint}</strong> en {browser} o en cualquier navegador
              (Chrome, Firefox, Safari, Edge, Opera, etc.).
              Si la tienes instalada como app, ciérrala por completo y ábrela de nuevo desde el navegador.
            </p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px', borderRadius: 8, border: 'none',
                background: '#e8612a', color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Recargar
            </button>
            {wrongHost && (
              <button
                type="button"
                onClick={() => {
                  window.location.replace(`${CANONICAL_SITE_URL}${window.location.pathname}${window.location.search}`)
                }}
                style={{
                  padding: '10px 20px', borderRadius: 8,
                  border: '1px solid rgba(232,97,42,0.5)',
                  background: 'transparent', color: '#e8612a', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Ir a www.podcastudio.mx
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                window.location.href = `${CANONICAL_SITE_URL}/studio`
              }}
              style={{
                padding: '10px 20px', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'transparent', color: '#e8e8f0', fontSize: 14, fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Abrir estudio
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
