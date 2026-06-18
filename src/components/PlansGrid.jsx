import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PLANS } from '../config/plans.js'
import { startCheckout } from '../lib/billing.js'
import styles from './PlansGrid.module.css'

export default function PlansGrid({ user, onSkip, compact = false }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(null)
  const [error, setError] = useState('')

  const handleSelect = async (planId) => {
    setError('')
    if (!user?.email) {
      navigate(`/auth?plan=${planId}`)
      return
    }
    setLoading(planId)
    try {
      await startCheckout(planId, user.email)
    } catch (e) {
      setError(e.message || 'Error al conectar con Stripe')
      setLoading(null)
    }
  }

  return (
    <div className={compact ? styles.compact : ''}>
      {error && (
        <div className={styles.error}>
          <i className="ti ti-alert-circle" /> {error}
        </div>
      )}
      <div className={styles.grid}>
        {PLANS.map(plan => (
          <div
            key={plan.id}
            className={`${styles.card} ${plan.featured ? styles.featured : ''}`}
          >
            {plan.badge && <div className={styles.badge}>{plan.badge}</div>}
            <div className={styles.name}>{plan.name}</div>
            <div className={styles.price}>
              <span className={styles.currency}>$</span>
              <span className={styles.amount}>{plan.price}</span>
              <span className={styles.per}>{plan.intervalLabel}</span>
            </div>
            {plan.billedLabel && <div className={styles.billed}>{plan.billedLabel}</div>}
            {plan.save && <div className={styles.save}>{plan.save}</div>}
            <p className={styles.desc}>{plan.description}</p>
            <ul className={styles.features}>
              {plan.features.map(f => (
                <li key={f}><i className="ti ti-check" />{f}</li>
              ))}
            </ul>
            <button
              type="button"
              className={`${styles.btn} ${plan.featured ? styles.btnPrimary : ''}`}
              disabled={!!loading}
              onClick={() => handleSelect(plan.id)}
            >
              {loading === plan.id
                ? <><i className="ti ti-loader" style={{ animation: 'spin 1s linear infinite' }} /> Redirigiendo...</>
                : `Elegir ${plan.name}`}
            </button>
          </div>
        ))}
      </div>
      {onSkip && (
        <button type="button" className={styles.skipBtn} onClick={onSkip}>
          Continuar sin plan de pago (demo)
        </button>
      )}
    </div>
  )
}
