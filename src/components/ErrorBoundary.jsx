import React, { Component } from 'react';
import { logger } from '../utils/logger.js';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    logger.error('[PodcastStudio ErrorBoundary]', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: '100vh', width: '100vw', background: '#0a0a0a', color: '#fff',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 16, fontFamily: 'system-ui, sans-serif', padding: 24,
        }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Error Inesperado</h1>
          <p style={{ fontSize: 13, color: '#a1a1aa', textAlign: 'center', maxWidth: 500 }}>
            PodcastStudio encontró un error inesperado. Los datos de la sesión pueden haberse perdido.
          </p>
          {this.state.error && (
            <pre style={{
              background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8,
              padding: 12, fontSize: 11, color: '#f87171', maxWidth: 600, maxHeight: 200,
              overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {this.state.error.toString()}
            </pre>
          )}
          <button
            onClick={this.handleReload}
            style={{
              background: '#ea580c', color: '#fff', border: 'none', borderRadius: 8,
              padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Recargar Aplicación
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}