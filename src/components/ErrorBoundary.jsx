import React from 'react'

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
          <p style={{ fontSize: 14, color: '#8888a0', maxWidth: 320, lineHeight: 1.5 }}>
            Prueba recargar la página. Si usas la app instalada, ciérrala y ábrela de nuevo desde Safari.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8, padding: '10px 20px', borderRadius: 8, border: 'none',
              background: '#e8612a', color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Recargar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
