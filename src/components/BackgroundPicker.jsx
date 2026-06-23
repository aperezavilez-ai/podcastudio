import React, { useRef } from 'react'
import { BACKGROUND_TEMPLATES, getBackgroundTemplate } from '../config/backgroundTemplates.js'
import SetBackground from './SetBackground.jsx'
import styles from './BackgroundPicker.module.css'

export default function BackgroundPicker({
  templateId,
  customUrl,
  chromaEnabled,
  chromaSimilarity,
  chromaSmoothness,
  cameraScale,
  aiBackgroundEnabled,
  onTemplateChange,
  onCustomUpload,
  onClearCustom,
  onChromaChange,
  onChromaSimilarityChange,
  onChromaSmoothnessChange,
  onCameraScaleChange,
  onAiBackgroundChange,
  virtualSetOnly = false,
  compact = false,
}) {
  const fileRef = useRef()
  const current = getBackgroundTemplate(templateId)

  return (
    <div className={`${styles.picker} ${compact ? styles.compact : ''}`}>
      <div className={styles.grid}>
        {BACKGROUND_TEMPLATES.map(t => (
          <button
            key={t.id}
            type="button"
            className={`${styles.card} ${templateId === t.id ? styles.cardActive : ''}`}
            onClick={() => onTemplateChange(t.id)}
            title={t.desc}
          >
            <div className={styles.thumb}>
              {t.id === 'none' ? (
                <div className={styles.thumbNone}>
                  <i className="ti ti-video" />
                </div>
              ) : (
                <SetBackground templateId={t.id} preview />
              )}
            </div>
            <span className={styles.name}>{t.name}</span>
          </button>
        ))}
      </div>

      <div className={styles.customRow}>
        <button type="button" className={styles.customBtn} onClick={() => fileRef.current?.click()}>
          <i className="ti ti-photo-up" />
          {customUrl ? 'Cambiar mi set' : 'Subir mi propio set'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onCustomUpload} />
        {customUrl && (
          <button type="button" className={styles.clearBtn} onClick={onClearCustom} title="Quitar imagen">
            <i className="ti ti-x" />
          </button>
        )}
      </div>

      {templateId !== 'none' && virtualSetOnly && (
        <>
          <p className={styles.hint}>
            Set virtual: tu cámara se coloca sobre el escenario. También se incluye en la grabación.
          </p>
          <div className={styles.chromaSection}>
            <div className={styles.sliderRow}>
              <span>Escala cámara</span>
              <input
                type="range"
                min={70}
                max={130}
                value={cameraScale}
                onChange={e => onCameraScaleChange(+e.target.value)}
              />
              <span className={styles.val}>{cameraScale}%</span>
            </div>
          </div>
        </>
      )}

      {templateId !== 'none' && !virtualSetOnly && (
        <div className={styles.chromaSection}>
          {!aiBackgroundEnabled && !chromaEnabled && (
            <p className={styles.hint}>
              Los sets solo aparecen dentro del video si activas quitar fondo con IA o croma key.
            </p>
          )}
          <label className={styles.chromaToggle}>
            <input
              type="checkbox"
              checked={aiBackgroundEnabled}
              onChange={e => onAiBackgroundChange?.(e.target.checked)}
            />
            <span><i className="ti ti-wand" /> Quitar fondo con IA (sin pantalla verde)</span>
          </label>
          {aiBackgroundEnabled && (
            <p className={styles.hint}>
              La IA detecta tu silueta y coloca el set de estudio detrás. Funciona mejor con buena luz frontal.
            </p>
          )}

          <label className={styles.chromaToggle}>
            <input
              type="checkbox"
              checked={chromaEnabled}
              disabled={aiBackgroundEnabled}
              onChange={e => onChromaChange(e.target.checked)}
            />
            <span><i className="ti ti-background" /> Croma key (pantalla verde)</span>
          </label>

          {chromaEnabled && !aiBackgroundEnabled && (
            <>
              <div className={styles.sliderRow}>
                <span>Sensibilidad</span>
                <input
                  type="range"
                  min={15}
                  max={80}
                  value={chromaSimilarity}
                  onChange={e => onChromaSimilarityChange(+e.target.value)}
                />
                <span className={styles.val}>{chromaSimilarity}%</span>
              </div>
              <div className={styles.sliderRow}>
                <span>Suavizado</span>
                <input
                  type="range"
                  min={0}
                  max={60}
                  value={chromaSmoothness}
                  onChange={e => onChromaSmoothnessChange(+e.target.value)}
                />
                <span className={styles.val}>{chromaSmoothness}%</span>
              </div>
              <p className={styles.hint}>
                Usa pantalla verde (#00B140) detrás tuyo. {current.chromaRecommended ? 'Recomendado para este set.' : ''}
              </p>
            </>
          )}

          <div className={styles.sliderRow}>
            <span>Escala cámara</span>
            <input
              type="range"
              min={70}
              max={130}
              value={cameraScale}
              onChange={e => onCameraScaleChange(+e.target.value)}
            />
            <span className={styles.val}>{cameraScale}%</span>
          </div>
        </div>
      )}
    </div>
  )
}
