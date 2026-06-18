import React, { useRef, useEffect } from 'react'
import styles from './Teleprompter.module.css'

export default function Teleprompter({
  script, onScriptChange, playing, onToggle, onReset,
  speed, onSpeedChange, fontSize, onFontSizeChange,
  mirror, onMirrorChange, offset, onMaxScrollChange,
  onGenerateScript, generatingScript, aiConfigured,
}) {
  const textRef = useRef(null)
  const viewRef = useRef(null)

  useEffect(() => {
    const textEl = textRef.current
    const viewEl = viewRef.current
    if (!textEl || !viewEl) return
    const max = Math.max(0, textEl.scrollHeight - viewEl.clientHeight + 40)
    onMaxScrollChange?.(max)
  }, [script, fontSize, onMaxScrollChange])

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
        rows={4}
      />

      <div className={styles.sliders}>
        <label>
          <span>Vel.</span>
          <input type="range" min={10} max={80} value={speed} onChange={e => onSpeedChange(+e.target.value)} />
        </label>
        <label>
          <span>Texto</span>
          <input type="range" min={16} max={36} value={fontSize} onChange={e => onFontSizeChange(+e.target.value)} />
        </label>
        <label className={styles.mirrorToggle}>
          <input type="checkbox" checked={mirror} onChange={e => onMirrorChange(e.target.checked)} />
          Espejo
        </label>
      </div>

      <div className={styles.prompter} ref={viewRef}>
        <div className={styles.readLine} />
        <div
          ref={textRef}
          className={styles.prompterText}
          style={{
            fontSize,
            transform: mirror
              ? `scaleX(-1) translateY(calc(50% - ${offset}px))`
              : `translateY(calc(50% - ${offset}px))`,
          }}
        >
          {script || 'El guion aparecerá aquí...'}
        </div>
        <div className={styles.prompterFade} />
      </div>

      <p className={styles.hint}>Solo tú ves el teleprompter — no sale en la grabación.</p>
    </div>
  )
}
