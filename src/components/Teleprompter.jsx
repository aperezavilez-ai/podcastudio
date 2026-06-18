import React from 'react'
import styles from './Teleprompter.module.css'

export default function Teleprompter({
  script, onScriptChange, playing, onToggle, onReset,
  speed, onSpeedChange, fontSize, onFontSizeChange,
  mirror, onMirrorChange, direction, onDirectionChange,
  onGenerateScript, generatingScript, aiConfigured,
}) {
  return (
    <div className={styles.docked}>
      <div className={styles.toolbar}>
        <div className={styles.tools}>
          <button type="button" className={`${styles.playBtn} ${playing ? styles.playing : ''}`} onClick={onToggle}>
            <i className={`ti ${playing ? 'ti-player-pause' : 'ti-player-play'}`} />
            {playing ? 'Pausar' : 'Leer'}
          </button>
          <button type="button" className={styles.toolBtn} onClick={onReset} title="Reiniciar">
            <i className="ti ti-reload" />
          </button>
        </div>
        {onGenerateScript && (
          <button
            type="button"
            className={styles.aiBtn}
            onClick={onGenerateScript}
            disabled={generatingScript || !aiConfigured}
            title={aiConfigured ? 'Generar guion con IA' : 'Configura ANTHROPIC_API_KEY en Vercel'}
          >
            <i className={`ti ${generatingScript ? 'ti-loader' : 'ti-sparkles'}`} style={generatingScript ? { animation: 'spin 1s linear infinite' } : {}} />
            {generatingScript ? 'Generando...' : 'Guion IA'}
          </button>
        )}
      </div>

      <textarea
        className={styles.editor}
        value={script}
        onChange={e => onScriptChange(e.target.value)}
        placeholder="Escribe tu guion aquí o usa «Guion IA»..."
        rows={5}
      />

      <div className={styles.sliders}>
        <label>
          <span>Vel.</span>
          <input type="range" min={10} max={80} value={speed} onChange={e => onSpeedChange(+e.target.value)} />
        </label>
        <label>
          <span>Texto</span>
          <input type="range" min={18} max={48} value={fontSize} onChange={e => onFontSizeChange(+e.target.value)} />
        </label>
        <label className={styles.mirrorToggle}>
          <input type="checkbox" checked={mirror} onChange={e => onMirrorChange(e.target.checked)} />
          Espejo
        </label>
      </div>

      <div className={styles.directionRow}>
        <span>Dirección</span>
        <button
          type="button"
          className={`${styles.dirBtn} ${direction === 'up' ? styles.dirBtnActive : ''}`}
          onClick={() => onDirectionChange('up')}
        >
          <i className="ti ti-arrow-up" /> Abajo → arriba
        </button>
        <button
          type="button"
          className={`${styles.dirBtn} ${direction === 'down' ? styles.dirBtnActive : ''}`}
          onClick={() => onDirectionChange('down')}
        >
          <i className="ti ti-arrow-down" /> Arriba → abajo
        </button>
      </div>

      <p className={styles.hint}>
        El guion aparece sobre el visor (solo tú lo ves). Pulsa <kbd>Espacio</kbd> para iniciar o pausar el scroll.
      </p>
    </div>
  )
}
