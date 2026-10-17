import React, { useState, useRef } from 'react'
import { BACKGROUND_TEMPLATES, BACKGROUND_CATEGORIES } from '../config/backgroundTemplates.js'
import SetBackground from './SetBackground.jsx'
import styles from './VirtualSetPanel.module.css'

export default function VirtualSetPanel({
  templateId = 'none',
  customUrl = null,
  chromaEnabled = false,
  cutoutMode = 'ai',
  chromaColor = '#00b140',
  chromaSimilarity = 40,
  chromaSmoothness = 25,
  chromaDespill = 50,
  presenterScale = 92,
  presenterX = 50,
  presenterY = 55,
  cropLeft = 0,
  cropRight = 0,
  cropTop = 0,
  cropBottom = 0,
  showDesk = true,
  deskHeightOffset = 0,
  edgeSmoothness = 30,
  aiSensitivity = 38,
  antiFlicker = 70,
  presenterWarmth = 8,
  presenterBrightness = 102,
  presenterContrast = 104,
  presenterSharpness = 14,
  presenterSaturation = 104,
  presenterBacklight = 20,
  liveMotionEnabled = true,
  onTemplateChange,
  onCutoutModeChange,
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
  onDeskHeightOffsetChange,
  onEdgeSmoothnessChange,
  onAiSensitivityChange,
  onAntiFlickerChange,
  onPresenterWarmthChange,
  onPresenterBrightnessChange,
  onPresenterContrastChange,
  onPresenterSharpnessChange,
  onPresenterSaturationChange,
  onPresenterBacklightChange,
  onLiveMotionToggle,
  onApplyPresetPosition,
}) {
  const [selectedCat, setSelectedCat] = useState('all')
  const [activeTab, setActiveTab] = useState('sets') // 'sets' | 'cutout' | 'adjust' | 'lighting'
  const fileRef = useRef(null)

  const activeTemplate = BACKGROUND_TEMPLATES.find(t => t.id === templateId) || BACKGROUND_TEMPLATES[0]

  const filteredTemplates = selectedCat === 'all'
    ? BACKGROUND_TEMPLATES
    : BACKGROUND_TEMPLATES.filter(t => t.category === selectedCat || t.id === 'none')

  return (
    <div className={styles.panel}>
      {/* BOTÓN MAESTRO DE RECORTE / CROMAKEY */}
      <button
        type="button"
        className={`${styles.masterChromaBtn} ${chromaEnabled ? styles.masterChromaActive : ''}`}
        onClick={() => onChromaToggle?.(!chromaEnabled)}
        title={chromaEnabled ? 'Clic para apagar el recorte del fondo' : 'Clic para activar recorte inteligente (IA o Pantalla Verde)'}
      >
        <span className={styles.masterIconWrap}>
          <i className="ti ti-background" />
        </span>
        <div className={styles.masterTextCol}>
          <span className={styles.masterMainText}>
            {chromaEnabled ? 'RECORTE & INTEGRACIÓN ACTIVO' : 'ACTIVAR RECORTE DE FONDO'}
          </span>
          <span className={styles.masterSubText}>
            {chromaEnabled
              ? (cutoutMode === 'ai' ? '● IA Neural: Habitación borrada en vivo (Anti-Flicker)' : '● Croma Key: Pantalla verde/azul activa')
              : 'Cámara completa sin recorte'}
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
          title="Escenarios 3D"
        >
          <i className="ti ti-photo" /> Sets
        </button>
        <button
          type="button"
          className={`${styles.subTabBtn} ${activeTab === 'cutout' ? styles.subTabBtnActive : ''}`}
          onClick={() => setActiveTab('cutout')}
          title="Método de Recorte (IA / Croma)"
        >
          <i className="ti ti-wand" /> Recorte IA
        </button>
        <button
          type="button"
          className={`${styles.subTabBtn} ${activeTab === 'adjust' ? styles.subTabBtnActive : ''}`}
          onClick={() => setActiveTab('adjust')}
          title="Posición, Zoom y Mesa"
        >
          <i className="ti ti-adjustments-horizontal" /> Encuadre
        </button>
        <button
          type="button"
          className={`${styles.subTabBtn} ${activeTab === 'lighting' ? styles.subTabBtnActive : ''}`}
          onClick={() => setActiveTab('lighting')}
          title="Iluminación & Color Matching"
        >
          <i className="ti ti-sun" /> Luz Set
        </button>
      </div>

      {/* 1. SELECCIÓN DE ESCENARIOS */}
      {activeTab === 'sets' && (
        <div className={styles.tabContent}>
          {/* Toggle de Escenario Vivo / Video Loops */}
          <label className={styles.deskToggleRow} style={{ marginBottom: 8 }} title="Activa o pausa el movimiento continuo de pantallas LED, focos y atmósfera de estudio">
            <input
              type="checkbox"
              checked={liveMotionEnabled}
              onChange={e => onLiveMotionToggle?.(e.target.checked)}
            />
            <span>🎬 Escenario Vivo (Movimiento y atmósfera de estudio en bucle)</span>
          </label>

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
                  {t.id !== 'none' && <span className={styles.badgeLive}>Set Vivo</span>}
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
              title="Subir cualquier imagen o video MP4 en alta resolución (1080p o 4K)"
            >
              <i className="ti ti-photo-up" />
              {customUrl ? 'Cambiar fondo subido' : 'Subir fondo o video propio'}
            </button>
            <input ref={fileRef} type="file" accept="image/*,video/mp4,video/webm" hidden onChange={onCustomUpload} />
            {customUrl && (
              <button
                type="button"
                className={styles.clearBtn}
                onClick={onClearCustom}
                title="Quitar imagen o video personalizado"
              >
                <i className="ti ti-trash" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. MÉTODO DE RECORTE & IA (SIN TELA VERDE VS CROMA KEY) */}
      {activeTab === 'cutout' && (
        <div className={styles.tabContent}>
          <div className={styles.sectionHeader}>
            <i className="ti ti-brain" style={{ color: '#38bdf8' }} />
            <span>Motor de Recorte de Fondo</span>
          </div>

          <div className={styles.modeSelectorCol}>
            <button
              type="button"
              className={`${styles.modeOptionCard} ${cutoutMode === 'ai' ? styles.modeOptionCardActive : ''}`}
              onClick={() => onCutoutModeChange?.('ai')}
            >
              <i className={`ti ti-sparkles ${styles.modeIcon}`} />
              <div className={styles.modeTextCol}>
                <span className={styles.modeTitle}>🧠 Recorte IA (Sin tela verde)</span>
                <span className={styles.modeDesc}>Red neuronal MediaPipe con filtro temporal anti-flicker: silueta limpia en tiempo real.</span>
              </div>
            </button>

            <button
              type="button"
              className={`${styles.modeOptionCard} ${cutoutMode === 'chroma' ? styles.modeOptionCardActive : ''}`}
              onClick={() => onCutoutModeChange?.('chroma')}
            >
              <i className={`ti ti-color-filter ${styles.modeIcon}`} style={{ color: '#10b981' }} />
              <div className={styles.modeTextCol}>
                <span className={styles.modeTitle}>🟩 Croma Key Físico (Tela Verde / Azul)</span>
                <span className={styles.modeDesc}>Para estudios con ciclorama o tela verde iluminada (espacio YCbCr).</span>
              </div>
            </button>

            <button
              type="button"
              className={`${styles.modeOptionCard} ${cutoutMode === 'hybrid' ? styles.modeOptionCardActive : ''}`}
              onClick={() => onCutoutModeChange?.('hybrid')}
            >
              <i className={`ti ti-layers-intersect ${styles.modeIcon}`} style={{ color: '#a855f7' }} />
              <div className={styles.modeTextCol}>
                <span className={styles.modeTitle}>🔀 Híbrido IA + Corrección Croma</span>
                <span className={styles.modeDesc}>Corta el fondo con IA y elimina desbordes o reflejos verdes en la piel.</span>
              </div>
            </button>
          </div>

          {cutoutMode === 'ai' && (
            <>
              <div className={styles.sliderRow}>
                <span className={styles.sliderLabel}>Sensibilidad IA (Captura Ropa y Cabello)</span>
                <input
                  type="range"
                  min={20}
                  max={70}
                  value={aiSensitivity}
                  onChange={e => onAiSensitivityChange?.(+e.target.value)}
                  title="Baja el valor si la IA borra tu ropa negra o silla; súbelo para recortar más fondo"
                />
                <span className={styles.val}>{aiSensitivity}%</span>
              </div>

              <div className={styles.sliderRow}>
                <span className={styles.sliderLabel}>Estabilizador Anti-Parpadeo (Jitter Filter)</span>
                <input
                  type="range"
                  min={0}
                  max={90}
                  value={antiFlicker}
                  onChange={e => onAntiFlickerChange?.(+e.target.value)}
                  title="Elimina el ruido y saltos entre cuadros congelando los bordes de la toma"
                />
                <span className={styles.val}>{antiFlicker}%</span>
              </div>
            </>
          )}

          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Suavizado de Silueta (Feathering)</span>
            <input
              type="range"
              min={5}
              max={70}
              value={edgeSmoothness}
              onChange={e => onEdgeSmoothnessChange?.(+e.target.value)}
              title="Suaviza los bordes para eliminar contornos duros en cabello y hombros"
            />
            <span className={styles.val}>{edgeSmoothness}%</span>
          </div>

          {cutoutMode !== 'ai' && (
            <>
              <div className={styles.sectionHeader} style={{ marginTop: 12 }}>
                <i className="ti ti-color-filter" style={{ color: '#10b981' }} />
                <span>Color de Tela Física</span>
              </div>

              <div className={styles.colorPickerRow}>
                <button
                  type="button"
                  className={`${styles.colorOptionBtn} ${chromaColor.toLowerCase() === '#00b140' ? styles.colorOptionBtnActive : ''}`}
                  onClick={() => onChromaColorChange?.('#00b140')}
                >
                  <span className={styles.colorDot} style={{ background: '#00b140' }} />
                  Verde
                </button>
                <button
                  type="button"
                  className={`${styles.colorOptionBtn} ${chromaColor.toLowerCase() === '#0047bb' ? styles.colorOptionBtnActive : ''}`}
                  onClick={() => onChromaColorChange?.('#0047bb')}
                >
                  <span className={styles.colorDot} style={{ background: '#0047bb' }} />
                  Azul
                </button>
                <div className={styles.customColorWrap}>
                  <input
                    type="color"
                    value={chromaColor}
                    onChange={e => onChromaColorChange?.(e.target.value)}
                  />
                  <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>Muestrear</span>
                </div>
              </div>

              <div className={styles.sliderRow}>
                <span className={styles.sliderLabel}>Tolerancia de Color</span>
                <input
                  type="range"
                  min={15}
                  max={85}
                  value={chromaSimilarity}
                  onChange={e => onChromaSimilarityChange?.(+e.target.value)}
                />
                <span className={styles.val}>{chromaSimilarity}%</span>
              </div>

              <div className={styles.sliderRow}>
                <span className={styles.sliderLabel}>Supresión Despill</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={chromaDespill}
                  onChange={e => onChromaDespillChange?.(+e.target.value)}
                />
                <span className={styles.val}>{chromaDespill}%</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* 3. ENCUADRE, POSICIÓN Y MESA */}
      {activeTab === 'adjust' && (
        <div className={styles.tabContent}>
          <div className={styles.sectionHeader}>
            <i className="ti ti-layout-grid" style={{ color: '#38bdf8' }} />
            <span>Calibración Rápida de Posición</span>
          </div>

          <div className={styles.presetGrid}>
            <button
              type="button"
              className={styles.presetBtn}
              onClick={() => onApplyPresetPosition?.('anchor_desk')}
              title="Alinea al conductor exactamente detrás del escritorio"
            >
              🎙️ Conductor
            </button>
            <button
              type="button"
              className={styles.presetBtn}
              onClick={() => onApplyPresetPosition?.('close_up')}
              title="Primer plano cerrado con zoom"
            >
              🔍 Primer Plano
            </button>
            <button
              type="button"
              className={styles.presetBtn}
              onClick={() => onApplyPresetPosition?.('wide_stage')}
              title="Plano general abierto de pie"
            >
              🧍 Plano Abierto
            </button>
            <button
              type="button"
              className={styles.presetBtn}
              onClick={() => onApplyPresetPosition?.('guest_side')}
              title="Posición lateral para invitado"
            >
              👥 Invitado
            </button>
          </div>

          {activeTemplate?.hasDesk && (
            <>
              <label className={styles.deskToggleRow} title="Muestra la mesa 3D en primer plano para que tus brazos y pecho queden naturalmente detrás de ella">
                <input
                  type="checkbox"
                  checked={showDesk}
                  onChange={e => onShowDeskChange?.(e.target.checked)}
                />
                <span>Sentar tras el escritorio (Mesa al frente)</span>
              </label>

              {showDesk && (
                <div className={styles.sliderRow}>
                  <span className={styles.sliderLabel}>Ajuste Fino Altura Mesa</span>
                  <input
                    type="range"
                    min={-30}
                    max={30}
                    value={deskHeightOffset}
                    onChange={e => onDeskHeightOffsetChange?.(+e.target.value)}
                    title="Sube o baja el escritorio para adaptarlo a la altura exacta de tus codos"
                  />
                  <span className={styles.val}>{deskHeightOffset > 0 ? `+${deskHeightOffset}px` : `${deskHeightOffset}px`}</span>
                </div>
              )}
            </>
          )}

          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Tamaño / Zoom</span>
            <input
              type="range"
              min={45}
              max={160}
              value={presenterScale}
              onChange={e => onPresenterScaleChange?.(+e.target.value)}
              title="Ajusta el tamaño del cuerpo a la escala exacta de la silla y mesa"
            />
            <span className={styles.val}>{presenterScale}%</span>
          </div>

          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Posición Horizontal (X)</span>
            <input
              type="range"
              min={15}
              max={85}
              value={presenterX}
              onChange={e => onPresenterXChange?.(+e.target.value)}
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
            <span className={styles.sliderLabel}>Altura / Sentado (Y)</span>
            <input
              type="range"
              min={25}
              max={85}
              value={presenterY}
              onChange={e => onPresenterYChange?.(+e.target.value)}
              title="Sube o baja tu cuerpo para que tus codos descansen en la mesa"
            />
            <span className={styles.val}>{presenterY}%</span>
          </div>

          <div className={styles.sectionHeader} style={{ marginTop: 12 }}>
            <i className="ti ti-crop" style={{ color: '#f59e0b' }} />
            <span>Recorte de Habitación (Crop)</span>
          </div>

          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Cortar Izquierda</span>
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
            <span className={styles.sliderLabel}>Cortar Derecha</span>
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
            <span className={styles.sliderLabel}>Cortar Arriba</span>
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
            <span className={styles.sliderLabel}>Cortar Abajo</span>
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

      {/* 4. ILUMINACIÓN & COLOR MATCHING */}
      {activeTab === 'lighting' && (
        <div className={styles.tabContent}>
          <div className={styles.sectionHeader}>
            <i className="ti ti-bulb" style={{ color: '#fbbf24' }} />
            <span>Tono de Iluminación del Estudio (Color Match)</span>
          </div>

          <div className={styles.toneBar}>
            <button
              type="button"
              className={`${styles.toneBtn} ${presenterWarmth > 4 ? styles.toneBtnActive : ''}`}
              onClick={() => onPresenterWarmthChange?.(14)}
              title="Luz cálida de tungsteno (ideal para Talkshow Late Night y madera)"
            >
              ☀️ Cálido
            </button>
            <button
              type="button"
              className={`${styles.toneBtn} ${presenterWarmth === 0 ? styles.toneBtnActive : ''}`}
              onClick={() => onPresenterWarmthChange?.(0)}
              title="Luz blanca pura de televisión informativa"
            >
              💡 Neutro
            </button>
            <button
              type="button"
              className={`${styles.toneBtn} ${presenterWarmth < -4 ? styles.toneBtnActive : ''}`}
              onClick={() => onPresenterWarmthChange?.(-14)}
              title="Luz azulada fría (ideal para Keynotes, Cyberpunk y Tech)"
            >
              ❄️ Frío
            </button>
          </div>

          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Temperatura de Color</span>
            <input
              type="range"
              min={-40}
              max={40}
              value={presenterWarmth}
              onChange={e => onPresenterWarmthChange?.(+e.target.value)}
              title="Ajusta el balance de color de tu piel para que coincida con las luces del set"
            />
            <span className={styles.val}>{presenterWarmth > 0 ? `+${presenterWarmth}` : presenterWarmth}</span>
          </div>

          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Luz de Contra (Rim Light)</span>
            <input
              type="range"
              min={0}
              max={60}
              value={presenterBacklight}
              onChange={e => onPresenterBacklightChange?.(+e.target.value)}
              title="Halo luminoso de estudio que separa al presentador del fondo y lo funde en la iluminación 3D"
            />
            <span className={styles.val}>{presenterBacklight}%</span>
          </div>

          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Nitidez de Cámara (Sharpness)</span>
            <input
              type="range"
              min={0}
              max={40}
              value={presenterSharpness}
              onChange={e => onPresenterSharpnessChange?.(+e.target.value)}
              title="Realce de micro-contraste broadcast para que la cámara no se vea borrosa"
            />
            <span className={styles.val}>{presenterSharpness}%</span>
          </div>

          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Saturación de Color</span>
            <input
              type="range"
              min={70}
              max={140}
              value={presenterSaturation}
              onChange={e => onPresenterSaturationChange?.(+e.target.value)}
            />
            <span className={styles.val}>{presenterSaturation}%</span>
          </div>

          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Brillo Integrado</span>
            <input
              type="range"
              min={80}
              max={130}
              value={presenterBrightness}
              onChange={e => onPresenterBrightnessChange?.(+e.target.value)}
            />
            <span className={styles.val}>{presenterBrightness}%</span>
          </div>

          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Contraste de Silueta</span>
            <input
              type="range"
              min={80}
              max={130}
              value={presenterContrast}
              onChange={e => onPresenterContrastChange?.(+e.target.value)}
            />
            <span className={styles.val}>{presenterContrast}%</span>
          </div>
        </div>
      )}
    </div>
  )
}
