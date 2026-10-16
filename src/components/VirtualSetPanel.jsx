import React, { useState, useRef } from 'react'
import { BACKGROUND_TEMPLATES, BACKGROUND_CATEGORIES } from '../config/backgroundTemplates.js'
import SetBackground from './SetBackground.jsx'
import styles from './VirtualSetPanel.module.css'

export default function VirtualSetPanel({
  templateId = 'none',
  customUrl = null,
  cameraScale = 100,
  chromaEnabled = false,
  chromaColor = '#00b140',
  chromaSimilarity = 40,
  chromaSmoothness = 25,
  chromaDespill = 50,
  onTemplateChange,
  onCustomUpload,
  onClearCustom,
  onCameraScaleChange,
  onChromaToggle,
  onChromaColorChange,
  onChromaSimilarityChange,
  onChromaSmoothnessChange,
  onChromaDespillChange,
}) {
  const [selectedCat, setSelectedCat] = useState('all')
  const fileRef = useRef(null)

  const filteredTemplates = selectedCat === 'all'
    ? BACKGROUND_TEMPLATES
    : BACKGROUND_TEMPLATES.filter(t => t.category === selectedCat || t.id === 'none')

  return (
    <div className={styles.panel}>
      {/* BOTÓN MAESTRO DE CROMAKEY */}
      <button
        type="button"
        className={`${styles.masterChromaBtn} ${chromaEnabled ? styles.masterChromaActive : ''}`}
        onClick={() => onChromaToggle?.(!chromaEnabled)}
        title={chromaEnabled ? 'Haz clic para apagar el croma key' : 'Haz clic para activar el croma key (Pantalla Verde / Azul)'}
      >
        <span className={styles.masterIconWrap}>
          <i className="ti ti-background" />
        </span>
        <div className={styles.masterTextCol}>
          <span className={styles.masterMainText}>
            {chromaEnabled ? 'CROMAKEY ACTIVADO' : 'ACTIVAR CROMAKEY'}
          </span>
          <span className={styles.masterSubText}>
            {chromaEnabled ? '● Recortando fondo con pantalla verde/azul' : 'Fondo real sin recorte'}
          </span>
        </div>
        <span className={`${styles.masterPill} ${chromaEnabled ? styles.masterPillOn : styles.masterPillOff}`}>
          {chromaEnabled ? 'ON' : 'OFF'}
        </span>
      </button>

      {/* CONFIGURACIÓN Y CALIBRACIÓN DE CROMAKEY */}
      {chromaEnabled && (
        <div className={styles.chromaSettingsBox}>
          {/* Selector de color de pantalla */}
          <div className={styles.colorPickerRow}>
            <button
              type="button"
              className={`${styles.colorOptionBtn} ${chromaColor.toLowerCase() === '#00b140' ? styles.colorOptionBtnActive : ''}`}
              onClick={() => onChromaColorChange?.('#00b140')}
              title="Pantalla Verde estándar de televisión"
            >
              <span className={styles.colorDot} style={{ background: '#00b140' }} />
              Verde
            </button>
            <button
              type="button"
              className={`${styles.colorOptionBtn} ${chromaColor.toLowerCase() === '#0047bb' ? styles.colorOptionBtnActive : ''}`}
              onClick={() => onChromaColorChange?.('#0047bb')}
              title="Pantalla Azul estándar de televisión"
            >
              <span className={styles.colorDot} style={{ background: '#0047bb' }} />
              Azul
            </button>
            <div className={styles.customColorWrap} title="Elegir color personalizado">
              <input
                type="color"
                value={chromaColor}
                onChange={e => onChromaColorChange?.(e.target.value)}
              />
            </div>
          </div>

          {/* Sliders de ajuste */}
          <div className={styles.sliderRow}>
            <span>Sensibilidad</span>
            <input
              type="range"
              min={15}
              max={80}
              value={chromaSimilarity}
              onChange={e => onChromaSimilarityChange?.(+e.target.value)}
            />
            <span className={styles.val}>{chromaSimilarity}%</span>
          </div>

          <div className={styles.sliderRow}>
            <span>Suavizado</span>
            <input
              type="range"
              min={0}
              max={50}
              value={chromaSmoothness}
              onChange={e => onChromaSmoothnessChange?.(+e.target.value)}
            />
            <span className={styles.val}>{chromaSmoothness}%</span>
          </div>

          <div className={styles.sliderRow}>
            <span>Anti-reflejo</span>
            <input
              type="range"
              min={0}
              max={100}
              value={chromaDespill}
              onChange={e => onChromaDespillChange?.(+e.target.value)}
              title="Elimina el halo o reflejo verde/azul en pelo y ropa"
            />
            <span className={styles.val}>{chromaDespill}%</span>
          </div>

          <div className={styles.sliderRow}>
            <span>Escala presentador</span>
            <input
              type="range"
              min={70}
              max={130}
              value={cameraScale}
              onChange={e => onCameraScaleChange?.(+e.target.value)}
            />
            <span className={styles.val}>{cameraScale}%</span>
          </div>
        </div>
      )}

      {/* PESTAÑAS DE CATEGORÍA DE ESCENARIOS */}
      <div className={styles.catBar}>
        {BACKGROUND_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            type="button"
            className={`${styles.catBtn} ${selectedCat === cat.id ? styles.catBtnActive : ''}`}
            onClick={() => setSelectedCat(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* GALERÍA DE ESCENARIOS VIRTUALES */}
      <div className={styles.grid}>
        {filteredTemplates.map(t => (
          <button
            key={t.id}
            type="button"
            className={`${styles.card} ${templateId === t.id && !customUrl ? styles.cardActive : ''}`}
            onClick={() => {
              if (customUrl) onClearCustom?.()
              onTemplateChange?.(t.id)
            }}
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
            <span className={styles.desc}>{t.desc}</span>
          </button>
        ))}
      </div>

      {/* SUBIR ESCENARIO PROPIO */}
      <div className={styles.customRow}>
        <button
          type="button"
          className={styles.customBtn}
          onClick={() => fileRef.current?.click()}
          title="Subir cualquier imagen JPG o PNG en alta resolución"
        >
          <i className="ti ti-photo-up" />
          {customUrl ? 'Cambiar mi imagen' : 'Subir escenario propio'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onCustomUpload} />
        {customUrl && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={onClearCustom}
            title="Quitar imagen personalizada"
          >
            <i className="ti ti-trash" />
          </button>
        )}
      </div>
    </div>
  )
}
