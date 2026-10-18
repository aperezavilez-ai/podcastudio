import React from 'react'
import styles from './AudioDspPanel.module.css'

export const DSP_PRESETS = [
  {
    id: 'podcast_pro',
    label: 'Podcast Pro',
    icon: 'ti-microphone-2',
    settings: {
      noiseReduction: true,
      deHiss: true,
      lowCut: true,
      compressor: true,
      eqBass: 3,
      eqMid: 1.5,
      eqTreble: 0.5,
      micGain: 1.0,
    },
  },
  {
    id: 'anti_noise',
    label: 'Anti-Ruido',
    icon: 'ti-shield-check',
    settings: {
      noiseReduction: true,
      deHiss: true,
      lowCut: true,
      compressor: true,
      eqBass: 0,
      eqMid: 2.0,
      eqTreble: -2.0,
      micGain: 1.1,
    },
  },
  {
    id: 'broadcaster',
    label: 'Locutor FM',
    icon: 'ti-broadcast',
    settings: {
      noiseReduction: true,
      deHiss: true,
      lowCut: true,
      compressor: true,
      eqBass: 5.5,
      eqMid: 0.5,
      eqTreble: 1.5,
      micGain: 1.0,
    },
  },
  {
    id: 'flat',
    label: 'Plano / Directo',
    icon: 'ti-equalizer',
    settings: {
      noiseReduction: false,
      deHiss: false,
      lowCut: false,
      compressor: false,
      eqBass: 0,
      eqMid: 0,
      eqTreble: 0,
      micGain: 1.0,
    },
  },
]

export default function AudioDspPanel({ settings, onChange }) {
  const upd = (key, val) => {
    onChange?.({ ...settings, [key]: val })
  }

  const applyPreset = (preset) => {
    onChange?.({ ...settings, ...preset.settings })
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>
          <i className="ti ti-adjustments-alt" />
          <span>DSP Master: Limpieza & Ecualizador</span>
        </div>
        <span className={styles.badgeMaster}>Toma Master</span>
      </div>

      <p className={styles.hint}>
        Limpia siseo, elimina retumbos y ecualiza la voz antes de entrar a la grabación final.
      </p>

      {/* PRESETS RÁPIDOS */}
      <div className={styles.presetsRow}>
        {DSP_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={styles.presetBtn}
            onClick={() => applyPreset(p)}
            title={`Aplicar preset ${p.label}`}
          >
            <i className={`ti ${p.icon}`} />
            <span>{p.label}</span>
          </button>
        ))}
      </div>

      {/* FILTROS DE LIMPIEZA */}
      <div className={styles.filterGroup}>
        <label className={styles.toggleRow}>
          <input
            type="checkbox"
            checked={!!settings.deHiss}
            onChange={(e) => upd('deHiss', e.target.checked)}
          />
          <div className={styles.toggleInfo}>
            <span className={styles.toggleLabel}>
              <i className="ti ti-volume-3" style={{ color: '#00f2fe' }} /> Reductor de His / Siseo
            </span>
            <span className={styles.toggleSub}>Atenúa ruido blanco y estática de cámaras USB / WiFi</span>
          </div>
        </label>

        <label className={styles.toggleRow}>
          <input
            type="checkbox"
            checked={!!settings.lowCut}
            onChange={(e) => upd('lowCut', e.target.checked)}
          />
          <div className={styles.toggleInfo}>
            <span className={styles.toggleLabel}>
              <i className="ti ti-wave-sine" style={{ color: '#ffb703' }} /> Filtro Anti-Retumbo (Low-Cut 80Hz)
            </span>
            <span className={styles.toggleSub}>Corta vibraciones de escritorio, golpes y aire acondicionado</span>
          </div>
        </label>

        <label className={styles.toggleRow}>
          <input
            type="checkbox"
            checked={!!settings.compressor}
            onChange={(e) => upd('compressor', e.target.checked)}
          />
          <div className={styles.toggleInfo}>
            <span className={styles.toggleLabel}>
              <i className="ti ti-arrows-minimize" style={{ color: '#e8612a' }} /> Compresor de Voz Broadcast
            </span>
            <span className={styles.toggleSub}>Nivela susurros y gritos para evitar saturación (clipping)</span>
          </div>
        </label>
      </div>

      {/* ECUALIZADOR DE 3 BANDAS */}
      <div className={styles.eqBox}>
        <div className={styles.eqHeader}>
          <span>Ecualizador Master</span>
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Graves · Medios · Agudos</span>
        </div>

        <div className={styles.eqSliders}>
          {/* GRAVES */}
          <div className={styles.eqCol}>
            <span className={styles.eqVal}>{settings.eqBass > 0 ? `+${settings.eqBass}` : settings.eqBass}dB</span>
            <input
              type="range"
              min={-10}
              max={10}
              step={0.5}
              value={settings.eqBass ?? 0}
              onChange={(e) => upd('eqBass', +e.target.value)}
              className={styles.eqSlider}
            />
            <span className={styles.eqBandLabel}>Graves</span>
            <span className={styles.eqFreq}>200 Hz</span>
          </div>

          {/* MEDIOS */}
          <div className={styles.eqCol}>
            <span className={styles.eqVal}>{settings.eqMid > 0 ? `+${settings.eqMid}` : settings.eqMid}dB</span>
            <input
              type="range"
              min={-10}
              max={10}
              step={0.5}
              value={settings.eqMid ?? 0}
              onChange={(e) => upd('eqMid', +e.target.value)}
              className={styles.eqSlider}
            />
            <span className={styles.eqBandLabel}>Medios</span>
            <span className={styles.eqFreq}>1.5 kHz</span>
          </div>

          {/* AGUDOS */}
          <div className={styles.eqCol}>
            <span className={styles.eqVal}>{settings.eqTreble > 0 ? `+${settings.eqTreble}` : settings.eqTreble}dB</span>
            <input
              type="range"
              min={-10}
              max={10}
              step={0.5}
              value={settings.eqTreble ?? 0}
              onChange={(e) => upd('eqTreble', +e.target.value)}
              className={styles.eqSlider}
            />
            <span className={styles.eqBandLabel}>Agudos</span>
            <span className={styles.eqFreq}>5.5 kHz</span>
          </div>
        </div>
      </div>

      {/* COMPENSADOR DE SINCRONÍA LABIAL (LIP-SYNC DELAY) */}
      <div className={styles.section} style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>
            <i className="ti ti-clock-play" style={{ color: '#e8612a' }} />
            <span>Sincronía Labial (Lip-Sync)</span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#e8612a' }}>
            {settings.lipSyncDelayMs ? `+${settings.lipSyncDelayMs} ms` : '0 ms (En Vivo)'}
          </span>
        </div>
        <p className={styles.hint} style={{ margin: '0 0 8px 0', fontSize: 11 }}>
          Compensa cualquier retraso milimétrico entre el audio del micrófono y la imagen de cámara USB/celular.
        </p>
        <input
          type="range"
          min={0}
          max={400}
          step={10}
          value={settings.lipSyncDelayMs ?? 0}
          onChange={(e) => upd('lipSyncDelayMs', +e.target.value)}
          style={{
            width: '100%',
            accentColor: '#e8612a',
            height: 6,
            borderRadius: 3,
            cursor: 'pointer',
          }}
        />
      </div>
    </div>
  )
}
