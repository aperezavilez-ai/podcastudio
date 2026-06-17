import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function Plans() {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Elige tu plan</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>Próximamente integración con Stripe para pagos reales.</div>
        <button style={{ padding: '10px 28px', borderRadius: 9, background: 'var(--accent)', border: 'none', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }} onClick={() => navigate('/setup')}>
          Continuar al estudio
        </button>
      </div>
    </div>
  )
}
