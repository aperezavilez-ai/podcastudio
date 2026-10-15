import React, { useState, useEffect } from 'react'
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
  selectedNetworks = ['facebook', 'youtube', 'tiktok', 'instagram'],
  onDownloadOriginal,
  onDownloadMp4,
  onDownloadCleanVoice,
  onOpenPublish,
}) {
  const [cropMode, setCropMode] = useState('smart-crop') // 'smart-crop' | 'blur-fill'
  const [convertingKey, setConvertingKey] = useState(null)
  const [progress, setProgress] = useState(0)
  const [packProgress, setPackProgress] = useState(null) // { current: 1, total: 3, label: '' }

  // Conjunto de presets seleccionados para exportar en el pack
  const [selectedKeys, setSelectedKeys] = useState(() => {
    return SOCIAL_PRESETS_EXPORT
      .filter(p => !p.id || selectedNetworks.includes(p.id))
      .map(p => p.key)
  })

  // Sincronizar cuando cambian las redes seleccionadas en el Studio
  useEffect(() => {
    if (selectedNetworks && selectedNetworks.length > 0) {
      const matchingKeys = SOCIAL_PRESETS_EXPORT
        .filter(p => !p.id || selectedNetworks.includes(p.id))
        .map(p => p.key)
      if (matchingKeys.length > 0) {
        setSelectedKeys(matchingKeys)
      }
    }
  }, [selectedNetworks])

  if (!open || !recording) return null

  const toggleKey = (key) => {
    setSelectedKeys(prev => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev // Mantener al menos 1 formato
        return prev.filter(k => k !== key)
      } else {
        return [...prev, key]
      }
    })
  }

  const toggleAllKeys = () => {
    setSelectedKeys(prev => {
      if (prev.length === SOCIAL_PRESETS_EXPORT.length) {
        return [SOCIAL_PRESETS_EXPORT[0].key]
      }
      return SOCIAL_PRESETS_EXPORT.map(p => p.key)
    })
  }

  const handleDownloadSingle = async (preset) => {
    if (preset.baseFormat === '16:9' || preset.key === '16:9') {
      // Descarga master con nombre correspondiente
      if (preset.filenameSuffix && recording.name) {
        const fn = `${recording.name}_${preset.filenameSuffix}.${recording.ext || 'webm'}`
        const url = URL.createObjectURL(recording.blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fn
        a.click()
        URL.revokeObjectURL(url)
      } else {
        onDownloadOriginal(recording)
      }
      return
    }

    setConvertingKey(preset.key)
    setProgress(0)
    try {
      let finalBlob
      if (preset.baseFormat === '16:9' || preset.key === '16:9') {
        finalBlob = recording.blob
      } else {
        finalBlob = await convertVideoToFormat(recording.blob, preset.key, {
          mode: cropMode,
          duration: recording.duration,
          onProgress: (pct) => setProgress(pct),
        })
      }
      if (!finalBlob) throw new Error('No se generó el video')

      let outputBlob = finalBlob
      let ext = 'mp4'
      if (finalBlob.type.includes('webm') || (!finalBlob.type.includes('mp4') && recording.ext === 'webm')) {
        try {
          const { convertWebmToMp4 } = await import('../utils/exportVideo.js')
          outputBlob = await convertWebmToMp4(finalBlob, (pct) => setProgress(Math.min(99, pct)))
          ext = 'mp4'
        } catch (e) {
          console.warn('MP4 fallback:', e)
          ext = finalBlob.type.includes('mp4') ? 'mp4' : 'webm'
        }
      }

      const filename = buildFormatFilename(recording.name, preset.key, ext)
      const url = URL.createObjectURL(outputBlob)
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
    const presetsToExport = SOCIAL_PRESETS_EXPORT.filter(p => selectedKeys.includes(p.key))
    if (presetsToExport.length === 0) return

    const total = presetsToExport.length
    for (let i = 0; i < total; i++) {
      const preset = presetsToExport[i]
      setPackProgress({ current: i + 1, total, label: `${preset.label} (${preset.key})...` })
      setProgress(0)

      try {
        let rawBlob
        if (preset.baseFormat === '16:9' || preset.key === '16:9') {
          rawBlob = recording.blob
        } else {
          rawBlob = await convertVideoToFormat(recording.blob, preset.key, {
            mode: cropMode,
            duration: recording.duration,
            onProgress: (pct) => setProgress(pct),
          })
        }

        if (rawBlob) {
          let outputBlob = rawBlob
          let ext = 'mp4'
          if (rawBlob.type.includes('webm') || (!rawBlob.type.includes('mp4') && recording.ext === 'webm')) {
            try {
              const { convertWebmToMp4 } = await import('../utils/exportVideo.js')
              outputBlob = await convertWebmToMp4(rawBlob, (pct) => setProgress(Math.min(99, pct)))
              ext = 'mp4'
            } catch (e) {
              console.warn('MP4 fallback:', e)
              ext = rawBlob.type.includes('mp4') ? 'mp4' : 'webm'
            }
          }

          const fn = buildFormatFilename(recording.name, preset.key, ext)
          const u = URL.createObjectURL(outputBlob)
          const a = document.createElement('a')
          a.href = u
          a.download = fn
          a.click()
          URL.revokeObjectURL(u)
        }
        await new Promise(r => setTimeout(r, 600))
      } catch (err) {
        console.error(`Error procesando ${preset.label}:`, err)
      }
    }

    setPackProgress(null)
    setProgress(0)
  }

  const isBusy = convertingKey !== null || packProgress !== null
  const selectedCount = selectedKeys.length

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

        {/* CONTENEDOR CON SCROLL SUAVE */}
        <div className={styles.scrollBody}>

        {/* BARRA DE REDES ACTIVAS & SELECCIÓN */}
        <div className={styles.targetNetworksBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>Redes destino:</span>
            {SOCIAL_PRESETS_EXPORT.map(p => {
              const isTarget = selectedKeys.includes(p.key)
              return (
                <span
                  key={p.key}
                  className={styles.networkBadgeChip}
                  style={{
                    background: isTarget ? `${p.color}22` : 'rgba(255,255,255,0.05)',
                    color: isTarget ? p.color : 'var(--text-muted)',
                    borderColor: isTarget ? `${p.color}55` : 'transparent',
                  }}
                >
                  <i className={p.icon} /> {p.label}
                </span>
              )
            })}
          </div>

          <button
            type="button"
            className={styles.selectAllFormatsBtn}
            onClick={toggleAllKeys}
            disabled={isBusy}
          >
            <i className={selectedCount === SOCIAL_PRESETS_EXPORT.length ? 'ti ti-checkbox' : 'ti ti-square'} />
            <span>{selectedCount === SOCIAL_PRESETS_EXPORT.length ? 'Deseleccionar' : 'Seleccionar Todos (4)'}</span>
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
              disabled={isBusy}
            >
              <i className="ti ti-crop" />
              <strong>Smart Auto-Framing</strong>
              <span>(Centrado en el orador)</span>
            </button>
            <button
              type="button"
              className={`${styles.modePill} ${cropMode === 'blur-fill' ? styles.modePillActive : ''}`}
              onClick={() => setCropMode('blur-fill')}
              disabled={isBusy}
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
            const isSelected = selectedKeys.includes(preset.key)
            return (
              <div
                key={preset.key}
                className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => !isBusy && toggleKey(preset.key)}
              >
                <div className={styles.cardHead}>
                  <div className={styles.iconCircle} style={{ background: `${preset.color}20`, color: preset.color }}>
                    <i className={preset.icon} style={{ fontSize: 18 }} />
                  </div>
                  <div>
                    <strong className={styles.cardTitle}>{preset.label}</strong>
                    <span className={styles.cardBadge}>{preset.badge}</span>
                  </div>
                  <div className={styles.cardCheckboxWrap} title={isSelected ? 'Incluido en el pack' : 'No incluido'}>
                    <i
                      className={isSelected ? 'ti ti-square-check-filled' : 'ti ti-square'}
                      style={{ color: isSelected ? preset.color : 'rgba(255,255,255,0.2)' }}
                    />
                  </div>
                </div>

                <div className={styles.cardNetworks}>
                  {preset.network}
                </div>

                <div className={styles.ratioPreviewWrap}>
                  <div
                    className={styles.ratioBox}
                    style={{
                      aspectRatio: (preset.baseFormat || preset.key).replace(':', ' / '),
                      maxHeight: 70,
                    }}
                  >
                    <span>{preset.baseFormat || preset.key}</span>
                  </div>
                  <span className={styles.resLabel}>{preset.width}x{preset.height}</span>
                </div>

                <button
                  type="button"
                  className={styles.cardDownloadBtn}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDownloadSingle(preset)
                  }}
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
                      Descargar {preset.key.replace('_yt', '')}
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
                <strong>Generando Pack ({packProgress.current}/{packProgress.total}):</strong> {packProgress.label}
              </span>
              <span>{progress}%</span>
            </div>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{
                  width: `${Math.max(5, ((packProgress.current - 1) / packProgress.total) * 100 + (progress / packProgress.total))}%`,
                }}
              />
            </div>
          </div>
        )}

        </div>{/* Fin scrollBody */}

        {/* Footer con Pack Completo y Publicar */}
        <div className={styles.footer}>
          <div className={styles.infoMeta}>
            <i className="ti ti-shield-check" style={{ color: '#10b981' }} />
            <span>Grabación blindada: {selectedCount} formato(s) seleccionados</span>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
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

            {recording?.hasCleanVoice && onDownloadCleanVoice && (
              <button
                type="button"
                className={styles.mp4Btn}
                onClick={() => onDownloadCleanVoice(recording)}
                disabled={isBusy}
                style={{ borderColor: 'rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399' }}
                title="Descargar pista de audio aislada de voz limpia sin música ni efectos de fondo"
              >
                <i className="ti ti-microphone" />
                Voz Limpia (ISO)
              </button>
            )}

            <button
              type="button"
              className={styles.packBtn}
              onClick={handleDownloadFullPack}
              disabled={isBusy || selectedCount === 0}
              title="Descargar todos los formatos seleccionados a la vez"
            >
              <i className="ti ti-package" />
              <strong>
                {selectedCount === SOCIAL_PRESETS_EXPORT.length
                  ? 'Descargar Pack Completo (4 Redes)'
                  : `Descargar Pack (${selectedCount} Formatos)`}
              </strong>
            </button>

            {onOpenPublish && (
              <button
                type="button"
                className={styles.publishBtn}
                onClick={() => {
                  onClose()
                  onOpenPublish()
                }}
                disabled={isBusy}
                title="Publicar directamente en redes sociales y generar copys con IA"
              >
                <i className="ti ti-share" />
                <strong>Publicar en Redes</strong>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
