import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import TourPreview from '../components/TourPreview.jsx'
import { PLANS } from '../config/plans.js'
import { TOUR_STEPS, markTourSeen } from '../config/tourSteps.js'
import { isAdminUser } from '../lib/access.js'
import styles from './Tour.module.css'

const PLAN_NAMES = Object.fromEntries(PLANS.map(p => [p.id, p.name]))

export default function Tour({ user }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const pendingPlan = params.get('plan')
  const [step, setStep] = useState(0)

  const current = TOUR_STEPS[step]
  const isLast = step === TOUR_STEPS.length - 1

  const goPlans = () => {
    markTourSeen()
    if (isAdminUser(user)) {
      navigate('/studio')
      return
    }
    navigate(pendingPlan ? `/plans?plan=${pendingPlan}` : '/plans')
  }

  const skip = () => {
    markTourSeen()
    if (isAdminUser(user)) {
      navigate('/studio')
    } else if (user) {
      navigate('/plans')
    } else {
      navigate('/auth')
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.brand} onClick={() => navigate('/')}>
          <i className="ti ti-microphone" style={{ color: 'var(--accent)' }} />
          Podcast<strong>Studio</strong>
        </button>
        <button type="button" className={styles.skipBtn} onClick={skip}>
          {isAdminUser(user) ? 'Entrar al estudio' : user ? 'Ir a planes' : 'Saltar recorrido'}
        </button>
      </header>

      <main className={styles.main}>
        <div className={styles.demoBanner}>
          <i className="ti ti-info-circle" />
          <span>
            <strong>Recorrido informativo.</strong> Todo lo que ves aquí es una simulación:
            no se usa tu cámara, no se graba, no se transmite y no se gastan créditos de IA.
            Explora las funciones y elige el plan que mejor se adapte a ti.
          </span>
        </div>

        <div className={styles.progress}>
          {TOUR_STEPS.map((_, i) => (
            <div
              key={TOUR_STEPS[i].id}
              className={`${styles.dot} ${i === step ? styles.dotActive : ''} ${i < step ? styles.dotDone : ''}`}
            />
          ))}
        </div>

        <div className={styles.stepLabel}>
          Paso {step + 1} de {TOUR_STEPS.length}
        </div>
        <h1 className={styles.title}>
          <i className={`ti ${current.icon}`} style={{ color: 'var(--accent)', marginRight: 8 }} />
          {current.title}
        </h1>
        <p className={styles.desc}>{current.description}</p>
        <p className={styles.hint}>
          <i className="ti ti-eye" /> {current.demoHint}
        </p>

        <div className={styles.plans}>
          {current.plans.map(p => (
            <div
              key={p.id}
              className={`${styles.planChip} ${p.highlight ? styles.planChipHighlight : ''} ${p.muted ? styles.planChipMuted : ''}`}
            >
              <span className={styles.planChipName}>{PLAN_NAMES[p.id] || p.id}</span>
              <span className={styles.planChipVal}>{p.label}</span>
            </div>
          ))}
        </div>

        <div className={styles.previewWrap}>
          <TourPreview stepId={current.id} />
        </div>

        <nav className={styles.nav}>
          <div className={styles.navLeft}>
            <button
              type="button"
              className={styles.btn}
              disabled={step === 0}
              onClick={() => setStep(s => s - 1)}
            >
              <i className="ti ti-arrow-left" /> Anterior
            </button>
            {!isLast && (
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setStep(s => s + 1)}>
                Siguiente <i className="ti ti-arrow-right" />
              </button>
            )}
          </div>

          {isLast ? (
            <div className={styles.finalCtas}>
              {isAdminUser(user) ? (
                <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={goPlans}>
                  <i className="ti ti-player-play" /> Entrar al estudio
                </button>
              ) : (
                <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={goPlans}>
                  <i className="ti ti-credit-card" /> Elegir mi plan
                </button>
              )}
              {user && !isAdminUser(user) && (
                <button type="button" className={styles.btn} onClick={goPlans}>
                  Ver planes y contratar
                </button>
              )}
            </div>
          ) : (
            <button type="button" className={styles.btn} onClick={goPlans}>
              {isAdminUser(user) ? 'Entrar al estudio' : 'Ya sé lo que necesito — ver planes'}
            </button>
          )}
        </nav>
      </main>
    </div>
  )
}
