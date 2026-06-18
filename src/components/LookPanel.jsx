import React from 'react'
import {
  LOOK_PRESETS,
  LUT_PRESETS,
  TRANSITION_MODES,
} from '../config/lookPresets.js'
import styles from './LookPanel.module.css'

function Slider({ label, value, min, max, onChange, unit = '' }) {
  return (
    <div className={styles.sliderRow}>
      <span>{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={e => onChange(+e.target.value)} />
      <span className={styles.val}>{value}{unit}</span>
    </div>
  )
}

export default function LookPanel({ look, onPreset, onField, onReset }) {
  return (
    <div className={styles.panel}>
      <p className={styles.lead}>
        Ajustes quemados en la grabación — preview y export idénticos.
      </p>

      <div className={styles.presetGrid}>
        {LOOK_PRESETS.map(p => (
          <button
            key={p.id}
            type="button"
            className={`${styles.presetBtn} ${look.presetId === p.id ? styles.presetActive : ''}`}
            onClick={() => onPreset(p.id)}
            title={p.desc}
          >
            <span className={styles.presetName}>{p.name}</span>
            <span className={styles.presetDesc}>{p.desc}</span>
          </button>
        ))}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Ajustes finos</div>
        <Slider label="Brillo" value={look.brightness} min={70} max={130} onChange={v => onField('brightness', v)} />
        <Slider label="Contraste" value={look.contrast} min={70} max={140} onChange={v => onField('contrast', v)} />
        <Slider label="Saturación" value={look.saturation} min={60} max={140} onChange={v => onField('saturation', v)} />
        <Slider label="Temperatura" value={look.warmth} min={-30} max={30} onChange={v => onField('warmth', v)} />
        <Slider label="Viñeta" value={look.vignette} min={0} max={60} onChange={v => onField('vignette', v)} unit="%" />
        <Slider label="Suavidad viñeta" value={look.vignetteSoft} min={20} max={90} onChange={v => onField('vignetteSoft', v)} />
        <Slider label="Nitidez" value={look.sharpness} min={0} max={30} onChange={v => onField('sharpness', v)} />
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>LUT / Color grade</div>
        <div className={styles.lutRow}>
          {LUT_PRESETS.map(lut => (
            <button
              key={lut.id}
              type="button"
              className={`${styles.lutBtn} ${look.lutId === lut.id ? styles.lutActive : ''}`}
              onClick={() => onField('lutId', lut.id)}
              title={lut.desc}
            >
              {lut.name}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Transición de cámaras</div>
        <div className={styles.lutRow}>
          {TRANSITION_MODES.map(t => (
            <button
              key={t.id}
              type="button"
              className={`${styles.lutBtn} ${look.transition === t.id ? styles.lutActive : ''}`}
              onClick={() => onField('transition', t.id)}
              title={t.desc}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={!!look.temporalVignette}
          onChange={e => onField('temporalVignette', e.target.checked)}
        />
        <span><i className="ti ti-clock" /> Viñeta temporal al grabar (fade in/out)</span>
      </label>

      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={look.cintilloMotion !== false}
          onChange={e => onField('cintilloMotion', e.target.checked)}
        />
        <span><i className="ti ti-animation" /> Animación de cintillos en export</span>
      </label>

      <button type="button" className={styles.resetBtn} onClick={onReset}>
        <i className="ti ti-refresh" /> Restablecer look
      </button>
    </div>
  )
}
