import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import PlansGrid from '../components/PlansGrid.jsx'
import { getPlan } from '../config/plans.js'
import {
  fetchSubscription,
  openBillingPortal,
  saveLocalPlan,
  syncCheckoutSession,
  verifyCheckoutSession,
} from '../lib/billing.js'
import styles from './Plans.module.css'

export default function Plans({ user }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [message, setMessage] = useState('')
  const [subscription, setSubscription] = useState(null)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    if (!user?.id) {
      setSubscription(null)
      return
    }
    fetchSubscription().then(setSubscription)
  }, [user?.id])

  useEffect(() => {
    const checkout = params.get('checkout')
    const sessionId = params.get('session_id')
    const plan = params.get('plan')

    if (checkout === 'success' && sessionId) {
      verifyCheckoutSession(sessionId)
        .then(async (data) => {
          if (data.ok) {
            const planId = data.planId || plan
            saveLocalPlan(planId)
            if (user?.id) {
              try {
                await syncCheckoutSession(sessionId)
                const sub = await fetchSubscription()
                setSubscription(sub)
              } catch {
                // El webhook puede sincronizar después
              }
            }
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
  }, [params, navigate, user?.id])

  const activePlanId = subscription?.active ? subscription.planId : null
  const activePlan = activePlanId ? getPlan(activePlanId) : null

  const handlePortal = async () => {
    setPortalLoading(true)
    try {
      await openBillingPortal()
    } catch (e) {
      setMessage(e.message || 'No se pudo abrir el portal de facturación')
      setPortalLoading(false)
    }
  }

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
          <button type="button" className={styles.tourLink} onClick={() => navigate('/tour')}>
            <i className="ti ti-route" /> ¿No estás seguro? Ver recorrido de funciones
          </button>

          {activePlan && (
            <div className={styles.activeBanner}>
              <div>
                <strong>Plan activo: {activePlan.name}</strong>
                {subscription?.currentPeriodEnd && (
                  <span className={styles.renew}>
                    Renueva el {new Date(subscription.currentPeriodEnd).toLocaleDateString('es-MX')}
                  </span>
                )}
              </div>
              {subscription?.hasStripeCustomer && (
                <button
                  type="button"
                  className={styles.portalBtn}
                  disabled={portalLoading}
                  onClick={handlePortal}
                >
                  {portalLoading ? 'Abriendo...' : 'Gestionar suscripción'}
                </button>
              )}
            </div>
          )}

          {message && (
            <div className={message.includes('confirmado') ? styles.success : styles.notice}>
              {message}
            </div>
          )}
        </div>

        <PlansGrid
          user={user}
          activePlanId={activePlanId}
          onSkip={() => navigate('/setup')}
        />
      </div>
    </div>
  )
}
