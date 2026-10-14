import React, { useState } from 'react'
import {
  SOCIAL_PRESETS_EXPORT,
  convertVideoToFormat,
  buildFormatFilename,
} from '../utils/multiFormatExporter.js'
import styles from './MultiFormatExportModal.module.css'

export default function MultiFormatExportModal({
  open,
  onClose,
  recording,
  onDownloadOriginal,
  onDownloadMp4,
}) {
  const [cropMode, setCropMode] = useState('smart-crop') // 'smart-crop' | 'blur-fill'
  const [convertingKey, setConvertingKey] = useState(null)
  const [progress, setProgress] = useState(0)
  const [packProgress, setPackProgress] = useState(null) // { current: 1, total: 3, label: '' }

  if (!open || !recording) return null

  const handleDownloadSingle = async (preset) => {
    if (preset.key === '16:9') {
      // El 16:9 es el master nativo
      onDownloadOriginal(recording)
      return
    }

    setConvertingKey(preset.key)
    setProgress(0)
    try {
      const convertedBlob = await convertVideoToFormat(recording.blob, preset.key, {
        mode: cropMode,
        onProgress: (pct) => setProgress(pct),
      })
      if (!convertedBlob) throw new Error('No se generó el video')

      const filename = buildFormatFilename(recording.name, preset.key, recording.ext || 'webm')
      const url = URL.createObjectURL(convertedBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error al exportar formato:', err)
      alert('Hubo un error al reencuadrar el video para ' + preset.label)
    } finally {
      setConvertingKey(null)
      setProgress(0)
    }
  }

  const handleDownloadFullPack = async () => {
    setPackProgress({ current: 1, total: 3, label: 'YouTube (16:9)...' })
    try {
      // 1. YouTube 16:9
      onDownloadOriginal(recording)
      await new Promise(r => setTimeout(r, 600))

      // 2. TikTok / Reels 9:16
      setPackProgress({ current: 2, total: 3, label: 'TikTok / Reels (9:16 Auto-reencuadre)...' })
      const blob916 = await convertVideoToFormat(recording.blob, '9:16', {
        mode: cropMode,
        onProgress: (pct) => setProgress(pct),
      })
      if (blob916) {
        const fn = buildFormatFilename(recording.name, '9:16', recording.ext || 'webm')
        const u = URL.createObjectURL(blob916)
        const a = document.createElement('a')
        a.href = u
        a.download = fn
        a.click()
        URL.revokeObjectURL(u)
      }
      await new Promise(r => setTimeout(r, 600))

      // 3. Instagram Feed 1:1
      setPackProgress({ current: 3, total: 3, label: 'Instagram Feed (1:1 Cuadrado)...' })
      const blob11 = await convertVideoToFormat(recording.blob, '1:1', {
        mode: cropMode,
        onProgress: (pct) => setProgress(pct),
      })
      if (blob11) {
        const fn = buildFormatFilename(recording.name, '1:1', recording.ext || 'webm')
        const u = URL.createObjectURL(blob11)
        const a = document.createElement('a')
        a.href = u
        a.download = fn
        a.click()
        URL.revokeObjectURL(u)
      }
    } catch (err) {
      console.error('Error en pack multi-redes:', err)
      alert('Ocurrió un error generando el pack completo')
    } finally {
      setPackProgress(null)
      setProgress(0)
    }
  }

  const isBusy = convertingKey !== null || packProgress !== null

  return (
    <div className={styles.overlay} onClick={isBusy ? undefined : onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <div className={styles.titleRow}>
              <i className="ti ti-share" style={{ color: 'var(--accent)', fontSize: 20 }} />
              <h2 className={styles.title}>Exportación Multi-Redes con Auto-Reencuadre</h2>
            </div>
            <p className={styles.subtitle}>
              Tu sesión completa se adapta automáticamente a cada red social con calidad óptima y sin recortes indeseados.
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} disabled={isBusy}>
            <i className="ti ti-x" />
          </button>
        </div>

        {/* Modo de Reencuadre */}
        <div className={styles.modeSection}>
          <span className={styles.modeLabel}>Modo de Adaptación Vertical (9:16 / 1:1):</span>
          <div className={styles.modePills}>
            <button
              type="button"
              className={`${styles.modePill} ${cropMode === 'smart-crop' ? styles.modePillActive : ''}`}
              onClick={() => setCropMode('smart-crop')}
            >
              <i className="ti ti-crop" />
              <strong>Smart Auto-Framing</strong>
              <span>(Centrado en el orador)</span>
            </button>
            <button
              type="button"
              className={`${styles.modePill} ${cropMode === 'blur-fill' ? styles.modePillActive : ''}`}
              onClick={() => setCropMode('blur-fill')}
            >
              <i className="ti ti-layers-intersect" />
              <strong>Fondo Desenfoque Broadcast</strong>
              <span>(Efecto TV sin cortes)</span>
            </button>
          </div>
        </div>

        {/* Formatos Cards */}
        <div className={styles.cardsGrid}>
          {SOCIAL_PRESETS_EXPORT.map((preset) => {
            const isThisConverting = convertingKey === preset.key
            return (
              <div key={preset.key} className={styles.card}>
                <div className={styles.cardHead}>
                  <div className={styles.iconCircle} style={{ background: `${preset.color}20`, color: preset.color }}>
                    <i className={preset.icon} style={{ fontSize: 18 }} />
                  </div>
                  <div>
                    <strong className={styles.cardTitle}>{preset.label}</strong>
                    <span className={styles.cardBadge}>{preset.badge}</span>
                  </div>
                </div>

                <div className={styles.cardNetworks}>
                  {preset.network}
                </div>

                <div className={styles.ratioPreviewWrap}>
                  <div
                    className={styles.ratioBox}
                    style={{
                      aspectRatio: preset.key.replace(':', ' / '),
                      maxHeight: 70,
                    }}
                  >
                    <span>{preset.key}</span>
                  </div>
                  <span className={styles.resLabel}>{preset.width}x{preset.height}</span>
                </div>

                <button
                  type="button"
                  className={styles.cardDownloadBtn}
                  onClick={() => handleDownloadSingle(preset)}
                  disabled={isBusy}
                >
                  {isThisConverting ? (
                    <>
                      <i className="ti ti-loader" style={{ animation: 'spin 1s linear infinite' }} />
                      Reencuadrando {progress}%...
                    </>
                  ) : (
                    <>
                      <i className="ti ti-download" />
                      Descargar {preset.key}
                    </>
                  )}
                </button>
              </div>
            )
          })}
        </div>

        {/* Barra de progreso global */}
        {packProgress && (
          <div className={styles.packProgressWrap}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
              <span>
                <strong>Generando Pack ({packProgress.current}/3):</strong> {packProgress.label}
              </span>
              <span>{progress}%</span>
            </div>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${Math.max(5, ((packProgress.current - 1) / 3) * 100 + (progress / 3))}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer con Pack Completo */}
        <div className={styles.footer}>
          <div className={styles.infoMeta}>
            <i className="ti ti-shield-check" style={{ color: '#10b981' }} />
            <span>Grabación blindada y completa lista para subir</span>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {onDownloadMp4 && (
              <button
                type="button"
                className={styles.mp4Btn}
                onClick={() => onDownloadMp4(recording)}
                disabled={isBusy}
                title="Convertir a MP4 estándar"
              >
                <i className="ti ti-file-export" />
                Descargar Master MP4
              </button>
            )}

            <button
              type="button"
              className={styles.packBtn}
              onClick={handleDownloadFullPack}
              disabled={isBusy}
            >
              <i className="ti ti-package" />
              <strong>Descargar Pack Redes (3 Formatos)</strong>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
