import React, { useState, useRef } from 'react'
import { BACKGROUND_TEMPLATES, BACKGROUND_CATEGORIES } from '../config/backgroundTemplates.js'
import SetBackground from './SetBackground.jsx'
import styles from './VirtualSetPanel.module.css'

export default function VirtualSetPanel({
  templateId = 'none',
  customUrl = null,
  chromaEnabled = false,
  chromaColor = '#00b140',
  chromaSimilarity = 40,
  chromaSmoothness = 25,
  chromaDespill = 50,
  presenterScale = 100,
  presenterX = 50,
  presenterY = 55,
  cropLeft = 0,
  cropRight = 0,
  cropTop = 0,
  cropBottom = 0,
  showDesk = true,
  onTemplateChange,
  onCustomUpload,
  onClearCustom,
  onChromaToggle,
  onChromaColorChange,
  onChromaSimilarityChange,
  onChromaSmoothnessChange,
  onChromaDespillChange,
  onPresenterScaleChange,
  onPresenterXChange,
  onPresenterYChange,
  onCropLeftChange,
  onCropRightChange,
  onCropTopChange,
  onCropBottomChange,
  onShowDeskChange,
}) {
  const [selectedCat, setSelectedCat] = useState('all')
  const [activeTab, setActiveTab] = useState('sets') // 'sets' | 'adjust' | 'chroma'
  const fileRef = useRef(null)

  const activeTemplate = BACKGROUND_TEMPLATES.find(t => t.id === templateId) || BACKGROUND_TEMPLATES[0]

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
        title={chromaEnabled ? 'Clic para apagar Croma Key' : 'Clic para activar Croma Key (Pantalla Verde / Azul)'}
      >
        <span className={styles.masterIconWrap}>
          <i className="ti ti-background" />
        </span>
        <div className={styles.masterTextCol}>
          <span className={styles.masterMainText}>
            {chromaEnabled ? 'CROMA KEY ACTIVO' : 'ACTIVAR CROMA KEY'}
          </span>
          <span className={styles.masterSubText}>
            {chromaEnabled ? '● Recorte automático transparente' : 'Cámara completa sin recorte'}
          </span>
        </div>
        <span className={`${styles.masterPill} ${chromaEnabled ? styles.masterPillOn : styles.masterPillOff}`}>
          {chromaEnabled ? 'ON' : 'OFF'}
        </span>
      </button>

      {/* TABS DE SUB-HERRAMIENTAS */}
      <div className={styles.subTabBar}>
        <button
          type="button"
          className={`${styles.subTabBtn} ${activeTab === 'sets' ? styles.subTabBtnActive : ''}`}
          onClick={() => setActiveTab('sets')}
        >
          <i className="ti ti-photo" /> Escenarios
        </button>
        <button
          type="button"
          className={`${styles.subTabBtn} ${activeTab === 'adjust' ? styles.subTabBtnActive : ''}`}
          onClick={() => setActiveTab('adjust')}
        >
          <i className="ti ti-adjustments-horizontal" /> Posición & Encuadre
        </button>
        <button
          type="button"
          className={`${styles.subTabBtn} ${activeTab === 'chroma' ? styles.subTabBtnActive : ''}`}
          onClick={() => setActiveTab('chroma')}
        >
          <i className="ti ti-color-filter" /> Calibrar Croma
        </button>
      </div>

      {/* 1. SELECCIÓN DE ESCENARIOS */}
      {activeTab === 'sets' && (
        <div className={styles.tabContent}>
          {/* Categorías */}
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

          {/* Grilla de escenarios */}
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
                      <i className="ti ti-video-off" />
                    </div>
                  ) : (
                    <SetBackground templateId={t.id} preview />
                  )}
                </div>
                <div className={styles.cardInfo}>
                  <span className={styles.name}>{t.name}</span>
                  {t.hasDesk && <span className={styles.badgeDesk}>Escritorio 3D</span>}
                </div>
              </button>
            ))}
          </div>

          {/* Subir propio */}
          <div className={styles.customRow}>
            <button
              type="button"
              className={styles.customBtn}
              onClick={() => fileRef.current?.click()}
              title="Subir cualquier imagen JPG o PNG en alta resolución (1080p o 4K)"
            >
              <i className="ti ti-photo-up" />
              {customUrl ? 'Cambiar imagen subida' : 'Subir imagen de escenario propio'}
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
      )}

      {/* 2. AJUSTE DE POSICIÓN, ESCALA Y ÁREA DE GRABACIÓN */}
      {activeTab === 'adjust' && (
        <div className={styles.tabContent}>
          <div className={styles.sectionHeader}>
            <i className="ti ti-user-check" style={{ color: '#38bdf8' }} />
            <span>Colocación del Presentador en el Set</span>
          </div>

          {activeTemplate?.hasDesk && (
            <label className={styles.deskToggleRow} title="Muestra el escritorio de noticias en primer plano, cubriendo la parte inferior del presentador para un efecto de telediario 100% realista">
              <input
                type="checkbox"
                checked={showDesk}
                onChange={e => onShowDeskChange?.(e.target.checked)}
              />
              <span>Sentar presentador tras el escritorio (Escritorio al frente)</span>
            </label>
          )}

          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Posición Horizontal (X)</span>
            <input
              type="range"
              min={15}
              max={85}
              value={presenterX}
              onChange={e => onPresenterXChange?.(+e.target.value)}
              title="Mover a la izquierda o derecha en el escenario"
            />
            <span className={styles.val}>{presenterX}%</span>
            <button
              type="button"
              className={styles.resetBtn}
              onClick={() => onPresenterXChange?.(50)}
              title="Centrar"
            >
              <i className="ti ti-layout-align-center" />
            </button>
          </div>

          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Posición Vertical (Y)</span>
            <input
              type="range"
              min={20}
              max={85}
              value={presenterY}
              onChange={e => onPresenterYChange?.(+e.target.value)}
              title="Subir o bajar al presentador en el escenario"
            />
            <span className={styles.val}>{presenterY}%</span>
          </div>

          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Tamaño / Zoom</span>
            <input
              type="range"
              min={50}
              max={160}
              value={presenterScale}
              onChange={e => onPresenterScaleChange?.(+e.target.value)}
              title="Hacer más grande o chico al presentador para guardar proporción con el set"
            />
            <span className={styles.val}>{presenterScale}%</span>
          </div>

          <div className={styles.sectionHeader} style={{ marginTop: 14 }}>
            <i className="ti ti-crop" style={{ color: '#f59e0b' }} />
            <span>Recorte de Paredes (Fuera de Tela Verde)</span>
          </div>
          <p className={styles.hintText}>
            Si tu tela verde no cubre toda la habitación, recorta los lados para eliminar puertas, ventanas o muebles de tu cuarto:
          </p>

          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Recorte Izquierdo</span>
            <input
              type="range"
              min={0}
              max={40}
              value={cropLeft}
              onChange={e => onCropLeftChange?.(+e.target.value)}
            />
            <span className={styles.val}>{cropLeft}%</span>
          </div>

          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Recorte Derecho</span>
            <input
              type="range"
              min={0}
              max={40}
              value={cropRight}
              onChange={e => onCropRightChange?.(+e.target.value)}
            />
            <span className={styles.val}>{cropRight}%</span>
          </div>

          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Recorte Superior</span>
            <input
              type="range"
              min={0}
              max={30}
              value={cropTop}
              onChange={e => onCropTopChange?.(+e.target.value)}
            />
            <span className={styles.val}>{cropTop}%</span>
          </div>

          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Recorte Inferior</span>
            <input
              type="range"
              min={0}
              max={35}
              value={cropBottom}
              onChange={e => onCropBottomChange?.(+e.target.value)}
            />
            <span className={styles.val}>{cropBottom}%</span>
          </div>
        </div>
      )}

      {/* 3. CALIBRACIÓN DE CROMA KEY */}
      {activeTab === 'chroma' && (
        <div className={styles.tabContent}>
          <div className={styles.sectionHeader}>
            <i className="ti ti-color-filter" style={{ color: '#10b981' }} />
            <span>Color de la Tela de Fondo</span>
          </div>

          <div className={styles.colorPickerRow}>
            <button
              type="button"
              className={`${styles.colorOptionBtn} ${chromaColor.toLowerCase() === '#00b140' ? styles.colorOptionBtnActive : ''}`}
              onClick={() => onChromaColorChange?.('#00b140')}
              title="Pantalla Verde estándar de televisión"
            >
              <span className={styles.colorDot} style={{ background: '#00b140' }} />
              Verde Croma
            </button>
            <button
              type="button"
              className={`${styles.colorOptionBtn} ${chromaColor.toLowerCase() === '#0047bb' ? styles.colorOptionBtnActive : ''}`}
              onClick={() => onChromaColorChange?.('#0047bb')}
              title="Pantalla Azul estándar de televisión"
            >
              <span className={styles.colorDot} style={{ background: '#0047bb' }} />
              Azul Croma
            </button>
            <div className={styles.customColorWrap} title="Elegir color exacto con el cuentagotas">
              <input
                type="color"
                value={chromaColor}
                onChange={e => onChromaColorChange?.(e.target.value)}
              />
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Muestrear</span>
            </div>
          </div>

          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Tolerancia / Similitud</span>
            <input
              type="range"
              min={15}
              max={85}
              value={chromaSimilarity}
              onChange={e => onChromaSimilarityChange?.(+e.target.value)}
              title="Aumenta para eliminar más verde/azul aún con sombras o arrugas"
            />
            <span className={styles.val}>{chromaSimilarity}%</span>
          </div>

          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Suavizado de Bordes</span>
            <input
              type="range"
              min={5}
              max={60}
              value={chromaSmoothness}
              onChange={e => onChromaSmoothnessChange?.(+e.target.value)}
              title="Suaviza el borde alrededor del cabello y ropa para evitar pixelación"
            />
            <span className={styles.val}>{chromaSmoothness}%</span>
          </div>

          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Supresión de Reflejos (Despill)</span>
            <input
              type="range"
              min={0}
              max={100}
              value={chromaDespill}
              onChange={e => onChromaDespillChange?.(+e.target.value)}
              title="Elimina el tinte o halo verde reflejado en piel y cabello por la tela"
            />
            <span className={styles.val}>{chromaDespill}%</span>
          </div>
        </div>
      )}
    </div>
  )
}
