import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MANUAL_SECTIONS, filterManualSections } from '../config/manualSections.js'
import styles from './Manual.module.css'

export default function Manual() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const fromStudio = params.get('from') === 'studio'
  const initialSection = params.get('section') || MANUAL_SECTIONS[0]?.id

  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState(initialSection)

  const sections = useMemo(() => filterManualSections(query), [query])
  const active = sections.find((s) => s.id === activeId) || sections[0]

  useEffect(() => {
    if (sections.length && !sections.find((s) => s.id === activeId)) {
      setActiveId(sections[0].id)
    }
  }, [sections, activeId])

  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash && MANUAL_SECTIONS.some((s) => s.id === hash)) {
      setActiveId(hash)
    }
  }, [])

  const selectSection = (id) => {
    setActiveId(id)
    window.history.replaceState(null, '', `#${id}`)
    document.getElementById(`manual-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => (fromStudio ? navigate('/studio') : navigate('/'))}>
          <i className="ti ti-arrow-left" />
          {fromStudio ? 'Volver al estudio' : 'Inicio'}
        </button>
        <div className={styles.headerTitle}>
          <i className="ti ti-book" />
          <span>Manual de operación</span>
        </div>
        <button type="button" className={styles.studioLink} onClick={() => navigate('/studio')}>
          <i className="ti ti-player-play" /> Estudio
        </button>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.searchWrap}>
            <i className="ti ti-search" />
            <input
              type="search"
              placeholder="Buscar en la guía…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar en el manual"
            />
          </div>
          <nav className={styles.toc} aria-label="Índice del manual">
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`${styles.tocItem} ${active?.id === s.id ? styles.tocActive : ''}`}
                onClick={() => selectSection(s.id)}
              >
                <i className={`ti ${s.icon}`} />
                <span>{s.title}</span>
              </button>
            ))}
            {sections.length === 0 && (
              <p className={styles.emptySearch}>Sin resultados para «{query}»</p>
            )}
          </nav>
        </aside>

        <main className={styles.main}>
          <div className={styles.intro}>
            <h1>Guía paso a paso</h1>
            <p>
              Todo lo que puedes hacer en PodcastStudio: dónde hacer clic, en qué orden y qué esperar.
              El recorrido <strong>/tour</strong> es una demo visual; este manual es la referencia de uso real.
            </p>
            <p className={styles.urlNote}>
              <i className="ti ti-link" />
              URL oficial: <strong>www.podcastudio.mx</strong>
            </p>
          </div>

          {sections.map((section) => (
            <article
              key={section.id}
              id={`manual-${section.id}`}
              className={`${styles.section} ${active?.id === section.id ? styles.sectionActive : ''}`}
            >
              <header className={styles.sectionHead}>
                <div className={styles.sectionIcon}>
                  <i className={`ti ${section.icon}`} />
                </div>
                <div>
                  <h2>{section.title}</h2>
                  <p>{section.summary}</p>
                </div>
              </header>

              <ol className={styles.steps}>
                {section.steps.map((step, i) => (
                  <li key={step.action}>
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
        </main>
      </div>
    </div>
  )
}
