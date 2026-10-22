import React, { useState, useEffect, useRef } from 'react'
import {
  SOCIAL_PRESETS_EXPORT,
  convertVideoToFormat,
  buildFormatFilename,
} from '../utils/multiFormatExporter.js'
import { fixWebmDuration } from '../utils/fixWebmDuration.js'
import {
  generateAllSocialThumbnails,
  downloadThumbnailFile,
  SOCIAL_THUMBNAIL_PRESETS,
} from '../utils/thumbnailGenerator.js'
import {
  Share2,
  X,
  CheckSquare,
  Square,
  Crop,
  Layers,
  Loader2,
  Download,
  Image as ImageIcon,
  FolderOpen,
  Film,
  Video,
  Package,
  ShieldCheck,
  Check,
  FileVideo
} from 'lucide-react'
import styles from './MultiFormatExportModal.module.css'

function PlatformIcon({ id, size = 18, color }) {
  if (id === 'youtube') return <Video size={size} style={{ color: color || '#ef4444' }} />
  if (id === 'facebook') return <Share2 size={size} style={{ color: color || '#1877f2' }} />
  if (id === 'tiktok') return <Film size={size} style={{ color: color || '#00f2fe' }} />
  if (id === 'instagram') return <ImageIcon size={size} style={{ color: color || '#e1306c' }} />
  return <Video size={size} style={{ color: color || '#fff' }} />
}

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
  const [packProgress, setPackProgress] = useState(null)
  const [thumbnails, setThumbnails] = useState([])
  const [generatingThumbs, setGeneratingThumbs] = useState(false)
  const [thumbError, setThumbError] = useState(null)

  const [selectedKeys, setSelectedKeys] = useState(() => {
    return SOCIAL_PRESETS_EXPORT
      .filter(p => !p.id || selectedNetworks.includes(p.id))
      .map(p => p.key)
  })

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

  useEffect(() => {
    if (!open || !recording) return
    let isMounted = true
    setGeneratingThumbs(true)
    setThumbError(null)

    const mediaSource = recording.blob || recording.url
    if (!mediaSource) {
      setGeneratingThumbs(false)
      return
    }

    generateAllSocialThumbnails(mediaSource, recording.name || 'episodio')
      .then((thumbs) => {
        if (isMounted) {
          setThumbnails(thumbs)
          setGeneratingThumbs(false)
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.warn('[MultiFormatExportModal] No se pudieron extraer miniaturas:', err)
          setThumbError('No se pudo extraer la miniatura del video')
          setGeneratingThumbs(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [open, recording])

  const handleDownloadAllThumbnails = () => {
    if (!thumbnails || thumbnails.length === 0) return
    thumbnails.forEach((thumb, idx) => {
      setTimeout(() => downloadThumbnailFile(thumb), idx * 300)
    })
  }

  const downloadThumbnailForPreset = (preset) => {
    if (!thumbnails || thumbnails.length === 0) return
    const thumb = thumbnails.find(t => t.id === preset.id)
    if (thumb) {
      setTimeout(() => downloadThumbnailFile(thumb), 350)
    }
  }

  const cancelRef = useRef(false)

  const toggleKey = (key) => {
    setSelectedKeys(prev => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev
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

  const handleCancelExport = () => {
    cancelRef.current = true
    setConvertingKey(null)
    setPackProgress(null)
    setProgress(0)
  }

  const handleDownloadSingle = async (preset) => {
    cancelRef.current = false
    setConvertingKey(preset.key)
    setProgress(0)
    try {
      let outputBlob = null
      if (preset.baseFormat === '16:9' || preset.key === '16:9' || preset.key === '16:9_yt') {
        outputBlob = recording.blob
        if (outputBlob && !outputBlob.type?.includes('mp4')) {
          const durMs = Math.max(1000, Math.round((recording.duration || 1) * 1000))
          try {
            outputBlob = await fixWebmDuration(outputBlob, durMs)
          } catch {}
        }
      } else {
        outputBlob = await convertVideoToFormat(recording.blob, preset.key, {
          mode: cropMode,
          duration: recording.duration,
          onProgress: (pct) => setProgress(pct),
        })
      }

      if (cancelRef.current) return
      if (!outputBlob) throw new Error('No se generó el video')

      const actualExt = (outputBlob.type && outputBlob.type.includes('mp4')) ? 'mp4' : 'webm'
      const filename = buildFormatFilename(recording.name, preset.key, actualExt)
      const url = URL.createObjectURL(outputBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)

      downloadThumbnailForPreset(preset)
    } catch (err) {
      if (!cancelRef.current) {
        console.error('Error al exportar formato:', err)
        alert('Hubo un error al reencuadrar el video para ' + preset.label)
      }
    } finally {
      setConvertingKey(null)
      setProgress(0)
    }
  }

  const handleDownloadFullPack = async () => {
    const presetsToExport = SOCIAL_PRESETS_EXPORT.filter(p => selectedKeys.includes(p.key))
    if (presetsToExport.length === 0) return

    cancelRef.current = false
    const total = presetsToExport.length
    for (let i = 0; i < total; i++) {
      if (cancelRef.current) break
      const preset = presetsToExport[i]
      setPackProgress({ current: i + 1, total, label: `${preset.label} (${preset.key})...` })
      setProgress(0)

      try {
        let outputBlob = null
        if (preset.baseFormat === '16:9' || preset.key === '16:9' || preset.key === '16:9_yt') {
          outputBlob = recording.blob
          if (outputBlob && !outputBlob.type?.includes('mp4')) {
            const durMs = Math.max(1000, Math.round((recording.duration || 1) * 1000))
            try {
              outputBlob = await fixWebmDuration(outputBlob, durMs)
            } catch {}
          }
        } else {
          outputBlob = await convertVideoToFormat(recording.blob, preset.key, {
            mode: cropMode,
            duration: recording.duration,
            onProgress: (pct) => setProgress(pct),
          })
        }

        if (cancelRef.current) break

        if (outputBlob) {
          const actualExt = (outputBlob.type && outputBlob.type.includes('mp4')) ? 'mp4' : 'webm'
          const fn = buildFormatFilename(recording.name, preset.key, actualExt)
          const u = URL.createObjectURL(outputBlob)
          const a = document.createElement('a')
          a.href = u
          a.download = fn
          a.click()
          URL.revokeObjectURL(u)

          downloadThumbnailForPreset(preset)
        }
        await new Promise(r => setTimeout(r, 900))
      } catch (err) {
        console.error(`Error procesando ${preset.label}:`, err)
      }
    }

    setPackProgress(null)
    setProgress(0)
  }

  const isBusy = convertingKey !== null || packProgress !== null
  const selectedCount = selectedKeys.length

  const handleModalClose = () => {
    if (isBusy) handleCancelExport()
    onClose()
  }

  if (!open || !recording) return null

  return (
    <div className={styles.overlay} onClick={handleModalClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <div className={styles.titleRow}>
              <div className="p-2 bg-orange-600/20 text-orange-500 rounded-lg flex items-center justify-center">
                <Share2 size={20} />
              </div>
              <h2 className={styles.title}>Exportación Multi-Redes con Auto-Reencuadre</h2>
            </div>
            <p className={styles.subtitle}>
              Tu sesión Master se adapta automáticamente para YouTube, Facebook, TikTok e Instagram con calidad óptima.
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={handleModalClose} title="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className={styles.scrollBody}>

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
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5
                  }}
                >
                  <PlatformIcon id={p.id} size={14} color={p.color} /> {p.label}
                </span>
              )
            })}
          </div>

          <button
            type="button"
            className={styles.selectAllFormatsBtn}
            onClick={toggleAllKeys}
            disabled={isBusy}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {selectedCount === SOCIAL_PRESETS_EXPORT.length ? <CheckSquare size={14} /> : <Square size={14} />}
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
              <Crop size={15} style={{ marginRight: 6 }} />
              <strong>Smart Auto-Framing</strong>
              <span>(Centrado en el orador)</span>
            </button>
            <button
              type="button"
              className={`${styles.modePill} ${cropMode === 'blur-fill' ? styles.modePillActive : ''}`}
              onClick={() => setCropMode('blur-fill')}
              disabled={isBusy}
            >
              <Layers size={15} style={{ marginRight: 6 }} />
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
                  <div className={styles.iconCircle} style={{ background: `${preset.color}20`, color: preset.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PlatformIcon id={preset.id} size={20} color={preset.color} />
                  </div>
                  <div>
                    <strong className={styles.cardTitle}>{preset.label}</strong>
                    <span className={styles.cardBadge}>{preset.badge}</span>
                  </div>
                  <div className={styles.cardCheckboxWrap} title={isSelected ? 'Incluido en el pack' : 'No incluido'}>
                    {isSelected ? <CheckSquare size={18} style={{ color: preset.color }} /> : <Square size={18} style={{ color: 'rgba(255,255,255,0.2)' }} />}
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
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  {isThisConverting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Reencuadrando {progress}%...</span>
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      <span>Descargar {preset.key.replace('_yt', '')}</span>
                    </>
                  )}
                </button>
              </div>
            )
          })}
        </div>

        {/* SECCIÓN DE MINIATURAS OFICIALES PARA CADA RED SOCIAL */}
        <div className={styles.thumbsSection}>
          <div className={styles.thumbsHeader}>
            <div className={styles.thumbsTitleRow}>
              <ImageIcon size={16} style={{ color: '#38bdf8' }} />
              <h3 className={styles.thumbsTitle}>Miniaturas y Portadas Oficiales para Redes</h3>
              <span className={styles.thumbsBadge}>JPG HD</span>
            </div>

            <button
              type="button"
              className={styles.downloadAllThumbsBtn}
              onClick={handleDownloadAllThumbnails}
              disabled={generatingThumbs || thumbnails.length === 0}
              title="Descargar las 4 portadas oficiales de una vez"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Download size={13} />
              <span>{generatingThumbs ? 'Generando miniaturas...' : 'Descargar Pack Miniaturas (4 Redes)'}</span>
            </button>
          </div>

          <div className={styles.thumbsGrid}>
            {SOCIAL_THUMBNAIL_PRESETS.map((preset) => {
              const thumb = thumbnails.find(t => t.id === preset.id)
              return (
                <div key={preset.id} className={styles.thumbCard}>
                  <div className={styles.thumbImgWrap}>
                    {thumb?.dataUrl ? (
                      <img src={thumb.dataUrl} alt={preset.label} className={styles.thumbImg} />
                    ) : (
                      <div className={styles.thumbPlaceholder}>
                        <PlatformIcon id={preset.id} size={22} color={preset.color} />
                        <span>{generatingThumbs ? 'Procesando...' : preset.aspectRatio}</span>
                      </div>
                    )}
                  </div>
                  <div className={styles.thumbMeta}>
                    <span className={styles.thumbLabel} title={preset.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <PlatformIcon id={preset.id} size={13} color={preset.color} />
                      {preset.network}
                    </span>
                    <span className={styles.thumbDim}>{preset.badge}</span>
                  </div>
                  <button
                    type="button"
                    className={styles.thumbDownloadBtn}
                    onClick={() => thumb && downloadThumbnailFile(thumb)}
                    disabled={!thumb || generatingThumbs}
                    title={`Descargar miniatura para ${preset.network}`}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <Download size={12} />
                    <span>Descargar {preset.aspectRatio}</span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {packProgress && (
          <div className={styles.packProgressWrap}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 5 }}>
              <span>
                <strong>Generando Pack ({packProgress.current}/{packProgress.total}):</strong> {packProgress.label}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontWeight: 700, color: '#38bdf8' }}>{progress}%</span>
                <button
                  type="button"
                  onClick={handleCancelExport}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid #ef4444',
                    color: '#f87171',
                    padding: '4px 9px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  title="Detener y cancelar la descarga de inmediato"
                >
                  <X size={12} /> Cancelar proceso
                </button>
              </div>
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

        {convertingKey && !packProgress && (
          <div className={styles.packProgressWrap}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 5 }}>
              <span>
                <strong>Reencuadrando formato:</strong> {convertingKey}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontWeight: 700, color: '#38bdf8' }}>{progress}%</span>
                <button
                  type="button"
                  onClick={handleCancelExport}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid #ef4444',
                    color: '#f87171',
                    padding: '4px 9px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  title="Detener y cancelar la descarga de inmediato"
                >
                  <X size={12} /> Cancelar proceso
                </button>
              </div>
            </div>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${Math.max(5, progress)}%` }}
              />
            </div>
          </div>
        )}

        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.infoMeta} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={16} style={{ color: '#10b981' }} />
            <span>Grabación master lista: {selectedCount} formato(s) listos</span>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {window.api?.openRecordingsFolder && (
              <button
                type="button"
                className={styles.mp4Btn}
                onClick={() => window.api.openRecordingsFolder()}
                style={{ borderColor: 'rgba(249, 115, 22, 0.5)', background: 'rgba(249, 115, 22, 0.15)', color: '#fb923c', display: 'flex', alignItems: 'center', gap: 6 }}
                title="Abrir carpeta de grabaciones en Windows"
              >
                <FolderOpen size={14} />
                <span>Abrir Carpeta en Windows</span>
              </button>
            )}

            {onDownloadMp4 && (
              <button
                type="button"
                className={styles.mp4Btn}
                onClick={() => onDownloadMp4(recording)}
                disabled={isBusy}
                title="Descargar Master original"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <FileVideo size={14} />
                <span>Descargar Master MP4</span>
              </button>
            )}

            <button
              type="button"
              className={styles.packBtn}
              onClick={handleDownloadFullPack}
              disabled={isBusy || selectedCount === 0}
              title="Descargar todos los formatos seleccionados a la vez"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Package size={15} />
              <strong>
                {selectedCount === SOCIAL_PRESETS_EXPORT.length
                  ? 'Descargar Pack Completo (4 Redes)'
                  : `Descargar Pack (${selectedCount} Formatos)`}
              </strong>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
