import React, { useEffect, useRef, useMemo, useCallback } from 'react'
import { buildCanvasFilter } from '../utils/videoLook.js'
import { bindVideoKeepAlive } from '../utils/videoStream.js'
import SetBackground from './SetBackground.jsx'
import styles from './ProgramPreview.module.css'

function lutClass(lutId) {
  if (!lutId || lutId === 'none') return null
  return styles[`lut_${lutId.replace(/-/g, '_')}`] || null
}

function vignetteStyle(look) {
  const intensity = look?.vignette ?? 0
  if (intensity <= 0) return null
  const alpha = Math.min(0.88, (intensity / 100) * 0.82)
  return {
    background: `radial-gradient(ellipse 85% 78% at 50% 46%, transparent 32%, rgba(0,0,0,${alpha * 0.2}) 58%, rgba(0,0,0,${alpha}) 100%)`,
  }
}

function LookOverlays({ look }) {
  const lut = lutClass(look?.lutId)
  const vignette = vignetteStyle(look)
  return (
    <>
      {lut && <div className={`${styles.lut} ${lut}`} aria-hidden />}
      {vignette && <div className={styles.vignette} style={vignette} aria-hidden />}
    </>
  )
}

function safeAttachVideo(videoEl, targetStream) {
  if (!videoEl) return
  videoEl.setAttribute('playsinline', '')
  videoEl.setAttribute('webkit-playsinline', '')
  videoEl.muted = true

  if (targetStream) {
    if (videoEl.srcObject !== targetStream) {
      videoEl.srcObject = targetStream
    }
    const p = videoEl.play()
    if (p && typeof p.catch === 'function') p.catch(() => {})
  } else if (videoEl.srcObject) {
    videoEl.srcObject = null
  }
}

/** Visor principal: video HTML directo (fluido) + filtros CSS del LOOK PRO + Layouts Multi-cámara (Solo, PiP, Split, Triple, Quad). */
export default function ProgramPreview({
  stream,
  cameraKey = 0,
  look = null,
  directorCrop = null,
  virtualSet = null,
  layout = 'full', // 'full' | 'pip' | 'split' | 'triple' | 'quad'
  pipStream = null,
  pipLabel = '',
  onClosePip = null,
  secondaryStream = null,
  secondaryLabel = '',
  tertiaryStream = null,
  tertiaryLabel = '',
  quaternaryStream = null,
  quaternaryLabel = '',
  primaryLabel = '',
  onPromoteSecondaryToMaster = null,
  onPromoteTertiaryToMaster = null,
  onPromoteQuaternaryToMaster = null,
  onPromotePipToMaster = null,
  onOpenConnectModal = null,
}) {
  const videoRef = useRef(null)
  const pipVideoRef = useRef(null)
  const secondaryVideoRef = useRef(null)
  const tertiaryVideoRef = useRef(null)
  const quaternaryVideoRef = useRef(null)
  const hasSet = virtualSet?.enabled

  // Callback refs: asignan el stream de forma inmediata y síncrona en cuanto el elemento DOM se monta
  const setMainVideo = useCallback((node) => {
    videoRef.current = node
    safeAttachVideo(node, stream)
  }, [stream])

  const setSecondaryVideo = useCallback((node) => {
    secondaryVideoRef.current = node
    safeAttachVideo(node, secondaryStream)
  }, [secondaryStream])

  const setTertiaryVideo = useCallback((node) => {
    tertiaryVideoRef.current = node
    safeAttachVideo(node, tertiaryStream)
  }, [tertiaryStream])

  const setQuaternaryVideo = useCallback((node) => {
    quaternaryVideoRef.current = node
    safeAttachVideo(node, quaternaryStream)
  }, [quaternaryStream])

  const setPipVideo = useCallback((node) => {
    pipVideoRef.current = node
    safeAttachVideo(node, pipStream)
  }, [pipStream])

  // Efecto continuo de sincronización y keep-alive cuando cambian layout, streams o cámaras
  useEffect(() => {
    safeAttachVideo(videoRef.current, stream)
    safeAttachVideo(secondaryVideoRef.current, secondaryStream)
    safeAttachVideo(tertiaryVideoRef.current, tertiaryStream)
    safeAttachVideo(quaternaryVideoRef.current, quaternaryStream)
    safeAttachVideo(pipVideoRef.current, pipStream)

    const unbind1 = bindVideoKeepAlive(videoRef.current)
    const unbind2 = bindVideoKeepAlive(secondaryVideoRef.current)
    const unbind3 = bindVideoKeepAlive(tertiaryVideoRef.current)
    const unbind4 = bindVideoKeepAlive(quaternaryVideoRef.current)
    const unbind5 = bindVideoKeepAlive(pipVideoRef.current)

    return () => {
      unbind1?.()
      unbind2?.()
      unbind3?.()
      unbind4?.()
      unbind5?.()
    }
  }, [stream, secondaryStream, tertiaryStream, quaternaryStream, pipStream, cameraKey, layout])

  const cssFilter = useMemo(() => {
    const f = buildCanvasFilter(look)
    if (f && f !== 'none') return f
    if (directorCrop?.filter && directorCrop.filter !== 'none') return directorCrop.filter
    return undefined
  }, [look, directorCrop?.filter])

  const zoom = directorCrop?.zoom > 1.02 ? directorCrop.zoom : 1
  const originX = `${(directorCrop?.focusX ?? 0.5) * 100}%`
  const originY = `${(directorCrop?.focusY ?? 0.42) * 100}%`

  const hasAnyStream = Boolean(stream || pipStream || secondaryStream || tertiaryStream || quaternaryStream)
  if (!hasAnyStream && layout === 'full') {
    return (
      <div className={styles.empty} onClick={onOpenConnectModal} style={{ cursor: onOpenConnectModal ? 'pointer' : 'default' }}>
        <i className="ti ti-video-off" />
        <span>Sin señal — conecta una cámara</span>
      </div>
    )
  }

  // SET VIRTUAL CON FONDO
  if (hasSet && virtualSet.cameraRect) {
    const { top, left, width, height } = virtualSet.cameraRect
    return (
      <div className={styles.preview}>
        <SetBackground templateId={virtualSet.templateId} customUrl={virtualSet.customUrl} />
        <video
          ref={setMainVideo}
          className={styles.videoInset}
          autoPlay
          muted
          playsInline
          onLoadedMetadata={(e) => e.currentTarget.play().catch(() => {})}
          onCanPlay={(e) => e.currentTarget.play().catch(() => {})}
          style={{
            top: `${top}%`,
            left: `${left}%`,
            width: `${width}%`,
            height: `${height}%`,
            filter: cssFilter,
            transform: zoom > 1 ? `scale(${zoom})` : undefined,
            transformOrigin: `${originX} ${originY}`,
            transition: directorCrop?.pushIn ? 'none' : 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1), transform-origin 0.35s cubic-bezier(0.25, 1, 0.5, 1)',
          }}
        />
        <LookOverlays look={look} />
      </div>
    )
  }

  // MODO SPLIT (50/50 Lado a lado - Cuadratura 16:9 completa sin recortes)
  if (layout === 'split') {
    return (
      <div className={styles.preview}>
        <div className={styles.splitContainer}>
          <div
            className={`${styles.splitPane} ${styles.clickablePane}`}
            onClick={onClosePip}
            title="Master Central: Haz clic para cerrar división y volver a pantalla completa"
          >
            {stream ? (
              <video
                ref={setMainVideo}
                className={styles.videoSplit}
                autoPlay
                muted
                playsInline
                onLoadedMetadata={(e) => e.currentTarget.play().catch(() => {})}
                onCanPlay={(e) => e.currentTarget.play().catch(() => {})}
                style={{
                  filter: cssFilter,
                }}
              />
            ) : (
              <div className={styles.emptyPane} onClick={onOpenConnectModal}>
                <i className="ti ti-video-off" style={{ fontSize: 24 }} />
                <span>{primaryLabel || 'Cámara 1 (Sin señal)'}</span>
              </div>
            )}
            {primaryLabel && <div className={styles.splitBadge}>{primaryLabel}</div>}
          </div>
          <div
            className={`${styles.splitPane} ${styles.clickablePane}`}
            onClick={onPromoteSecondaryToMaster}
            title="Clic para mandar a MASTER"
          >
            {secondaryStream ? (
              <video
                ref={setSecondaryVideo}
                className={styles.videoSplit}
                autoPlay
                muted
                playsInline
                onLoadedMetadata={(e) => e.currentTarget.play().catch(() => {})}
                onCanPlay={(e) => e.currentTarget.play().catch(() => {})}
              />
            ) : (
              <div className={styles.emptyPane}>
                <i className="ti ti-video-plus" style={{ fontSize: 28, color: 'var(--accent, #e8612a)' }} />
                <span>{secondaryLabel || '2ª Cámara (Sin señal)'}</span>
                <span className={styles.emptyPaneSub}>Haz clic para mandar a MASTER</span>
              </div>
            )}
            <div className={styles.clickToMasterHint}>
              <i className="ti ti-arrow-left" /> Clic para Master
            </div>
            {secondaryLabel && <div className={styles.splitBadge}>{secondaryLabel}</div>}
          </div>
        </div>
        <LookOverlays look={look} />
      </div>
    )
  }

  // MODO TRIPLE (1 Master + 2 Secundarias - Cuadratura preservada)
  if (layout === 'triple') {
    return (
      <div className={styles.preview}>
        <div className={styles.tripleContainer}>
          <div
            className={`${styles.tripleMainPane} ${styles.clickablePane}`}
            onClick={onClosePip}
            title="Master Central: Haz clic para cerrar división y volver a pantalla completa"
          >
            {stream ? (
              <video
                ref={setMainVideo}
                className={styles.videoSplit}
                autoPlay
                muted
                playsInline
                onLoadedMetadata={(e) => e.currentTarget.play().catch(() => {})}
                onCanPlay={(e) => e.currentTarget.play().catch(() => {})}
                style={{
                  filter: cssFilter,
                }}
              />
            ) : (
              <div className={styles.emptyPane}>
                <i className="ti ti-video-off" style={{ fontSize: 24 }} />
                <span>{primaryLabel || 'Master (Sin señal)'}</span>
              </div>
            )}
            {primaryLabel && <div className={styles.splitBadge}>{primaryLabel}</div>}
          </div>
          <div className={styles.tripleSidePane}>
            <div
              className={`${styles.tripleSubPane} ${styles.clickablePane}`}
              onClick={onPromoteSecondaryToMaster}
              title="Clic para mandar a MASTER"
            >
              {secondaryStream ? (
                <video
                  ref={setSecondaryVideo}
                  className={styles.videoSplit}
                  autoPlay
                  muted
                  playsInline
                  onLoadedMetadata={(e) => e.currentTarget.play().catch(() => {})}
                  onCanPlay={(e) => e.currentTarget.play().catch(() => {})}
                />
              ) : (
                <div className={styles.emptyPane}>
                  <i className="ti ti-video-plus" style={{ fontSize: 20 }} />
                  <span style={{ fontSize: 10 }}>{secondaryLabel || '2ª Cámara'}</span>
                  <span className={styles.emptyPaneSub} style={{ fontSize: 8 }}>Clic para Master</span>
                </div>
              )}
              <div className={styles.clickToMasterHint}>
                <i className="ti ti-arrow-left" /> Master
              </div>
              {secondaryLabel && <div className={styles.splitBadge}>{secondaryLabel}</div>}
            </div>
            <div
              className={`${styles.tripleSubPane} ${styles.clickablePane}`}
              onClick={onPromoteTertiaryToMaster}
              title="Clic para mandar a MASTER"
            >
              {tertiaryStream ? (
                <video
                  ref={setTertiaryVideo}
                  className={styles.videoSplit}
                  autoPlay
                  muted
                  playsInline
                  onLoadedMetadata={(e) => e.currentTarget.play().catch(() => {})}
                  onCanPlay={(e) => e.currentTarget.play().catch(() => {})}
                />
              ) : (
                <div className={styles.emptyPane}>
                  <i className="ti ti-video-plus" style={{ fontSize: 20 }} />
                  <span style={{ fontSize: 10 }}>{tertiaryLabel || '3ª Cámara'}</span>
                  <span className={styles.emptyPaneSub} style={{ fontSize: 8 }}>Clic para Master</span>
                </div>
              )}
              <div className={styles.clickToMasterHint}>
                <i className="ti ti-arrow-left" /> Master
              </div>
              {tertiaryLabel && <div className={styles.splitBadge}>{tertiaryLabel}</div>}
            </div>
          </div>
        </div>
        <LookOverlays look={look} />
      </div>
    )
  }

  // MODO CUÁDRUPLE (2x2 Grid de 4 Cámaras - Cuadrantes 16:9 naturales)
  if (layout === 'quad') {
    return (
      <div className={styles.preview}>
        <div className={styles.quadContainer}>
          {/* Cámara 1: Master (Arriba Izquierda - Sin zoom forzado) */}
          <div
            className={`${styles.quadPane} ${styles.clickablePane}`}
            onClick={onClosePip}
            title="Master Central: Haz clic para cerrar cuadrícula y volver a pantalla completa"
          >
            {stream ? (
              <video
                ref={setMainVideo}
                className={styles.video}
                autoPlay
                muted
                playsInline
                onLoadedMetadata={(e) => e.currentTarget.play().catch(() => {})}
                onCanPlay={(e) => e.currentTarget.play().catch(() => {})}
                style={{
                  filter: cssFilter,
                }}
              />
            ) : (
              <div className={styles.emptyPane} onClick={onOpenConnectModal}>
                <i className="ti ti-video-off" style={{ fontSize: 24 }} />
                <span>{primaryLabel || 'Master (Sin señal)'}</span>
              </div>
            )}
            {primaryLabel && <div className={styles.splitBadge}>{primaryLabel}</div>}
          </div>

          {/* Cámara 2: Secundaria (Arriba Derecha) */}
          <div
            className={`${styles.quadPane} ${styles.clickablePane}`}
            onClick={onPromoteSecondaryToMaster}
            title="Clic para mandar a MASTER"
          >
            {secondaryStream ? (
              <video
                ref={setSecondaryVideo}
                className={styles.video}
                autoPlay
                muted
                playsInline
                onLoadedMetadata={(e) => e.currentTarget.play().catch(() => {})}
                onCanPlay={(e) => e.currentTarget.play().catch(() => {})}
              />
            ) : (
              <div className={styles.emptyPane}>
                <i className="ti ti-video-plus" style={{ fontSize: 22 }} />
                <span style={{ fontSize: 11 }}>{secondaryLabel || '2ª Cámara'}</span>
                <span className={styles.emptyPaneSub}>Clic para Master</span>
              </div>
            )}
            <div className={styles.clickToMasterHint}>
              <i className="ti ti-arrow-left" /> Master
            </div>
            {secondaryLabel && <div className={styles.splitBadge}>{secondaryLabel}</div>}
          </div>

          {/* Cámara 3: Terciaria (Abajo Izquierda) */}
          <div
            className={`${styles.quadPane} ${styles.clickablePane}`}
            onClick={onPromoteTertiaryToMaster}
            title="Clic para mandar a MASTER"
          >
            {tertiaryStream ? (
              <video
                ref={setTertiaryVideo}
                className={styles.video}
                autoPlay
                muted
                playsInline
                onLoadedMetadata={(e) => e.currentTarget.play().catch(() => {})}
                onCanPlay={(e) => e.currentTarget.play().catch(() => {})}
              />
            ) : (
              <div className={styles.emptyPane}>
                <i className="ti ti-video-plus" style={{ fontSize: 22 }} />
                <span style={{ fontSize: 11 }}>{tertiaryLabel || '3ª Cámara'}</span>
                <span className={styles.emptyPaneSub}>Clic para Master</span>
              </div>
            )}
            <div className={styles.clickToMasterHint}>
              <i className="ti ti-arrow-left" /> Master
            </div>
            {tertiaryLabel && <div className={styles.splitBadge}>{tertiaryLabel}</div>}
          </div>

          {/* Cámara 4: Cuaternaria (Abajo Derecha) */}
          <div
            className={`${styles.quadPane} ${styles.clickablePane}`}
            onClick={onPromoteQuaternaryToMaster}
            title="Clic para mandar a MASTER"
          >
            {quaternaryStream ? (
              <video
                ref={setQuaternaryVideo}
                className={styles.video}
                autoPlay
                muted
                playsInline
                onLoadedMetadata={(e) => e.currentTarget.play().catch(() => {})}
                onCanPlay={(e) => e.currentTarget.play().catch(() => {})}
              />
            ) : (
              <div className={styles.emptyPane}>
                <i className="ti ti-video-plus" style={{ fontSize: 22 }} />
                <span style={{ fontSize: 11 }}>{quaternaryLabel || '4ª Cámara'}</span>
                <span className={styles.emptyPaneSub}>Clic para Master</span>
              </div>
            )}
            <div className={styles.clickToMasterHint}>
              <i className="ti ti-arrow-left" /> Master
            </div>
            {quaternaryLabel && <div className={styles.splitBadge}>{quaternaryLabel}</div>}
          </div>
        </div>
        <LookOverlays look={look} />
      </div>
    )
  }

  // MODO NORMAL (FULL) con o sin PiP
  return (
    <div className={styles.preview}>
      {stream ? (
        <video
          ref={setMainVideo}
          className={`${styles.video} ${layout === 'pip' ? styles.clickablePane : ''}`}
          onClick={layout === 'pip' ? onClosePip : undefined}
          title={layout === 'pip' ? 'Haz clic en Master para ocultar el PiP y volver a pantalla completa' : undefined}
          autoPlay
          muted
          playsInline
          onLoadedMetadata={(e) => e.currentTarget.play().catch(() => {})}
          onCanPlay={(e) => e.currentTarget.play().catch(() => {})}
          style={{
            filter: cssFilter,
            transform: zoom > 1 ? `scale(${zoom})` : undefined,
            transformOrigin: `${originX} ${originY}`,
            transition: directorCrop?.pushIn ? 'none' : 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1), transform-origin 0.35s cubic-bezier(0.25, 1, 0.5, 1)',
          }}
        />
      ) : (
        <div className={styles.empty} onClick={onOpenConnectModal} style={{ cursor: onOpenConnectModal ? 'pointer' : 'default' }}>
          <i className="ti ti-video-off" />
          <span>{primaryLabel ? `${primaryLabel} (Sin señal)` : 'Sin señal — conecta una cámara'}</span>
          {onOpenConnectModal && (
            <span style={{ fontSize: 10, color: 'var(--accent, #e8612a)', marginTop: 4 }}>
              Clic para conectar entrada de video
            </span>
          )}
        </div>
      )}

      {/* Recuadro PiP (Picture in Picture) */}
      {layout === 'pip' && (
        <div
          className={`${styles.pipContainer} ${styles.clickablePane}`}
          onClick={onPromotePipToMaster}
          title="Clic para mandar a MASTER"
        >
          {pipStream ? (
            <video
              ref={setPipVideo}
              className={styles.pipVideo}
              autoPlay
              muted
              playsInline
              onLoadedMetadata={(e) => e.currentTarget.play().catch(() => {})}
              onCanPlay={(e) => e.currentTarget.play().catch(() => {})}
            />
          ) : (
            <div className={styles.pipPlaceholder}>
              <i className="ti ti-video-plus" style={{ fontSize: 22, color: 'var(--accent, #e8612a)' }} />
              <span>{pipLabel || 'PiP'} (Sin señal)</span>
              <span className={styles.emptyPaneSub}>Clic para mandar a Master</span>
            </div>
          )}
          <div className={styles.clickToMasterHint}>
            <i className="ti ti-arrows-exchange" /> Master
          </div>
          {pipLabel && <div className={styles.pipBadge}>{pipLabel}</div>}
          {onClosePip && (
            <button
              type="button"
              className={styles.pipCloseBtn}
              onClick={(e) => {
                e.stopPropagation()
                onClosePip()
              }}
              title="Cerrar recuadro PiP"
            >
              <i className="ti ti-x" />
            </button>
          )}
        </div>
      )}

      <LookOverlays look={look} />
    </div>
  )
}
