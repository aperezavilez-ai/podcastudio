import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import PlansGrid from '../components/PlansGrid.jsx'
import { saveLocalPlan, verifyCheckoutSession } from '../lib/billing.js'
import styles from './Plans.module.css'

export default function Plans({ user }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [message, setMessage] = useState('')

  useEffect(() => {
    const checkout = params.get('checkout')
    const sessionId = params.get('session_id')
    const plan = params.get('plan')

    if (checkout === 'success' && sessionId) {
      verifyCheckoutSession(sessionId)
        .then((data) => {
          if (data.ok) {
            saveLocalPlan(data.planId || plan)
            setMessage('¡Pago confirmado! Tu plan está activo.')
            setTimeout(() => navigate('/setup'), 2000)
          } else {
            setMessage('El pago aún se está procesando. Recarga en unos segundos.')
          }
        })
        .catch(() => setMessage('No se pudo verificar el pago. Contacta soporte si ya pagaste.'))
    } else if (checkout === 'cancel') {
      setMessage('Pago cancelado. Puedes elegir otro plan cuando quieras.')
    }
  }, [params, navigate])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate('/')}>
          <i className="ti ti-arrow-left" /> Inicio
        </button>
        <div className={styles.brand}>
          <i className="ti ti-microphone" />
          <span>Podcast<strong>Studio</strong></span>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.intro}>
          <span className={styles.label}>Planes</span>
          <h1>Elige tu plan</h1>
          <p>Sin contratos. Cancela cuando quieras. Pago seguro con Stripe.</p>
          {message && (
            <div className={message.includes('confirmado') ? styles.success : styles.notice}>
              {message}
            </div>
          )}
        </div>

        <PlansGrid
          user={user}
          onSkip={() => navigate('/setup')}
        />
      </div>
    </div>
  )
}
