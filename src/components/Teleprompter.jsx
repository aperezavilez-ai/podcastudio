import React from 'react'
import styles from './Teleprompter.module.css'

export default function Teleprompter({
  script, onScriptChange, playing, onToggle, onReset,
  speed, onSpeedChange, fontSize, onFontSizeChange,
  mirror, onMirrorChange, offset, onClose,
}) {
  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <span className={styles.title}><i className="ti ti-script" /> Teleprompter</span>
        <div className={styles.tools}>
          <button type="button" className={styles.toolBtn} onClick={onToggle} title={playing ? 'Pausar' : 'Reproducir'}>
            <i className={`ti ${playing ? 'ti-player-pause' : 'ti-player-play'}`} />
          </button>
          <button type="button" className={styles.toolBtn} onClick={onReset} title="Reiniciar">
            <i className="ti ti-reload" />
          </button>
          <button type="button" className={styles.toolBtn} onClick={onClose} title="Cerrar">
            <i className="ti ti-x" />
          </button>
        </div>
      </div>

      <textarea
        className={styles.editor}
        value={script}
        onChange={e => onScriptChange(e.target.value)}
        placeholder="Escribe tu guion aquí..."
        rows={3}
      />

      <div className={styles.sliders}>
        <label>
          <span>Velocidad</span>
          <input type="range" min={15} max={90} value={speed} onChange={e => onSpeedChange(+e.target.value)} />
        </label>
        <label>
          <span>Tamaño</span>
          <input type="range" min={18} max={48} value={fontSize} onChange={e => onFontSizeChange(+e.target.value)} />
        </label>
        <label className={styles.mirrorToggle}>
          <input type="checkbox" checked={mirror} onChange={e => onMirrorChange(e.target.checked)} />
          Espejo
        </label>
      </div>

      <div className={styles.prompter}>
        <div
          className={`${styles.prompterText} ${mirror ? styles.mirror : ''}`}
          style={{
            fontSize,
            transform: mirror ? `scaleX(-1) translateY(-${offset}px)` : `translateY(-${offset}px)`,
          }}
        >
          {script || 'Tu guion aparecerá aquí al escribir arriba...'}
        </div>
        <div className={styles.prompterFade} />
      </div>
    </div>
  )
}
