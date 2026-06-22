import React, { useEffect, useMemo, useState } from 'react'
import { MANUAL_SECTIONS, filterManualSections } from '../config/manualSections.js'
import styles from './GuideModal.module.css'

export default function GuideModal({ open, onClose }) {
  const [query, setQuery] = useState('')
  const sections = useMemo(() => filterManualSections(query), [query])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-modal-title"
      >
        <header className={styles.head}>
          <div className={styles.headTitle}>
            <i className="ti ti-book" />
            <h2 id="guide-modal-title">Guía</h2>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar guía">
            <i className="ti ti-x" />
          </button>
        </header>

        <div className={styles.searchWrap}>
          <i className="ti ti-search" />
          <input
            type="search"
            placeholder="Buscar en la guía…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar en la guía"
          />
        </div>

        <div className={styles.body}>
          <p className={styles.intro}>
            Referencia rápida sin salir del estudio. Tus cámaras y micrófono siguen conectados.
          </p>

          {sections.length === 0 ? (
            <p className={styles.empty}>Sin resultados para «{query}»</p>
          ) : sections.map((section) => (
            <article key={section.id} className={styles.section}>
              <header className={styles.sectionHead}>
                <i className={`ti ${section.icon}`} />
                <div>
                  <h3>{section.title}</h3>
                  <p>{section.summary}</p>
                </div>
              </header>
              <ol className={styles.steps}>
                {section.steps.map((step, i) => (
                  <li key={`${section.id}-${i}`}>
                    <span className={styles.stepNum}>{i + 1}</span>
                    <div>
                      <strong>{step.action}</strong>
                      <p>{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
              {section.tip && (
                <div className={styles.tip}>
                  <i className="ti ti-bulb" />
                  <span>{section.tip}</span>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
