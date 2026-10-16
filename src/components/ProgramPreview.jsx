import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
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

/** Motor de video A/B con doble búfer: elimina al 100% el parpadeo en negro al conmutar cámaras y aplica transiciones fluidas a 60fps */
function SeamlessMasterVideo({
  stream,
  className = '',
  style = {},
  filter,
  transitionMode = 'crossfade',
  cameraKey = 0,
  onClick,
  title,
  mainVideoRef,
}) {
  const [activeBus, setActiveBus] = useState('A')
  const [streamA, setStreamA] = useState(stream)
  const [streamB, setStreamB] = useState(null)
  const [transitionPhase, setTransitionPhase] = useState('idle')

  const videoARef = useRef(null)
  const videoBRef = useRef(null)
  const prevStreamRef = useRef(stream)
  const prevKeyRef = useRef(cameraKey)
  const timeoutRef = useRef(null)

  useEffect(() => {
    if (mainVideoRef) {
      mainVideoRef.current = activeBus === 'A' ? videoARef.current : videoBRef.current
    }
  }, [activeBus, mainVideoRef])

  useEffect(() => {
    safeAttachVideo(videoARef.current, streamA)
  }, [streamA])

  useEffect(() => {
    safeAttachVideo(videoBRef.current, streamB)
  }, [streamB])

  useEffect(() => {
    const unbindA = bindVideoKeepAlive(videoARef.current)
    const unbindB = bindVideoKeepAlive(videoBRef.current)
    return () => {
      unbindA?.()
      unbindB?.()
    }
  }, [])

  useEffect(() => {
    const streamChanged = stream !== prevStreamRef.current
    const keyChanged = cameraKey !== prevKeyRef.current
    prevStreamRef.current = stream
    prevKeyRef.current = cameraKey

    if (!streamChanged && !keyChanged) return

    if (!streamA && !streamB) {
      setStreamA(stream)
      setActiveBus('A')
      return
    }

    if (!stream) {
      if (activeBus === 'A') setStreamA(null)
      else setStreamB(null)
      return
    }

    const incomingBus = activeBus === 'A' ? 'B' : 'A'
    const incomingRef = incomingBus === 'B' ? videoBRef : videoARef

    // Asignar el stream directamente al elemento de video para no esperar el ciclo de render de React
    if (incomingRef.current && incomingRef.current.srcObject !== stream) {
      safeAttachVideo(incomingRef.current, stream)
    }

    if (incomingBus === 'B') {
      setStreamB(stream)
    } else {
      setStreamA(stream)
    }

    const duration = transitionMode === 'cut' ? 30 : 340

    const executeTransition = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setTransitionPhase('transitioning')

      timeoutRef.current = setTimeout(() => {
        setActiveBus(incomingBus)
        setTransitionPhase('idle')
      }, duration)
    }

    const node = incomingRef.current
    if (node) {
      if (typeof node.requestVideoFrameCallback === 'function') {
        node.requestVideoFrameCallback(() => {
          executeTransition()
        })
        timeoutRef.current = setTimeout(executeTransition, 80)
      } else if (node.readyState >= 2) {
        executeTransition()
      } else {
        const handleReady = () => {
          node.removeEventListener('canplay', handleReady)
          node.removeEventListener('loadeddata', handleReady)
          executeTransition()
        }
        node.addEventListener('canplay', handleReady, { once: true })
        node.addEventListener('loadeddata', handleReady, { once: true })
        timeoutRef.current = setTimeout(executeTransition, 90)
      }
    } else {
      timeoutRef.current = setTimeout(executeTransition, 50)
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [stream, cameraKey, activeBus, transitionMode, streamA, streamB])

  const isA = activeBus === 'A'
  const isTransitioning = transitionPhase === 'transitioning'

  const { top, left, width, height, ...videoCropStyle } = style
  const hasExplicitDimensions = top !== undefined || left !== undefined

  const containerStyle = hasExplicitDimensions ? {
    position: 'absolute',
    top,
    left,
    width,
    height,
    overflow: 'hidden',
    borderRadius: '4px',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.45)',
    cursor: onClick ? 'pointer' : 'default',
  } : {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    cursor: onClick ? 'pointer' : 'default',
  }

  let styleA = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    filter,
    ...videoCropStyle,
  }
  let styleB = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    filter,
    ...videoCropStyle,
  }

  if (transitionMode === 'push') {
    const dur = '380ms cubic-bezier(0.2, 0.8, 0.2, 1)'
    if (isA) {
      styleA = {
        ...styleA,
        transform: isTransitioning ? 'translateX(-100%)' : (videoCropStyle.transform || undefined),
        transition: isTransitioning ? `transform ${dur}` : videoCropStyle.transition,
        zIndex: 2,
        opacity: 1,
      }
      styleB = {
        ...styleB,
        transform: isTransitioning ? (videoCropStyle.transform || 'translateX(0)') : 'translateX(100%)',
        transition: isTransitioning ? `transform ${dur}` : undefined,
        zIndex: 3,
        opacity: streamB ? 1 : 0,
      }
    } else {
      styleB = {
        ...styleB,
        transform: isTransitioning ? 'translateX(-100%)' : (videoCropStyle.transform || undefined),
        transition: isTransitioning ? `transform ${dur}` : videoCropStyle.transition,
        zIndex: 2,
        opacity: 1,
      }
      styleA = {
        ...styleA,
        transform: isTransitioning ? (videoCropStyle.transform || 'translateX(0)') : 'translateX(100%)',
        transition: isTransitioning ? `transform ${dur}` : undefined,
        zIndex: 3,
        opacity: streamA ? 1 : 0,
      }
    }
  } else if (transitionMode === 'cut') {
    styleA = {
      ...styleA,
      zIndex: isA ? 2 : 1,
      opacity: isA ? 1 : 0,
      pointerEvents: isA ? 'auto' : 'none',
    }
    styleB = {
      ...styleB,
      zIndex: !isA ? 2 : 1,
      opacity: !isA ? 1 : 0,
      pointerEvents: !isA ? 'auto' : 'none',
    }
  } else if (transitionMode === 'dip') {
    // Fundido a negro voluntario (Dip)
    const dur = '320ms ease-in-out'
    const opacityA = isA ? (isTransitioning ? 0 : 1) : (isTransitioning ? 1 : 0)
    const opacityB = isA ? (isTransitioning ? 1 : 0) : (isTransitioning ? 0 : 1)

    styleA = {
      ...styleA,
      zIndex: isA ? 2 : 1,
      opacity: opacityA,
      transition: isTransitioning ? `opacity ${dur}` : videoCropStyle.transition,
      pointerEvents: isA ? 'auto' : 'none',
    }
    styleB = {
      ...styleB,
      zIndex: !isA ? 2 : 1,
      opacity: opacityB,
      transition: isTransitioning ? `opacity ${dur}` : videoCropStyle.transition,
      pointerEvents: !isA ? 'auto' : 'none',
    }
  } else {
    // Disolución profesional (Crossfade Broadcast puro)
    // El bus saliente se mantiene 100% opaco debajo (zIndex 1) para que NUNCA trasluzca el fondo negro
    // El bus entrante hace disolución de 0 a 1 encima (zIndex 2).
    const dur = '320ms cubic-bezier(0.25, 1, 0.5, 1)'
    if (isA) {
      styleA = {
        ...styleA,
        zIndex: 1,
        opacity: 1,
        pointerEvents: isTransitioning ? 'none' : 'auto',
      }
      styleB = {
        ...styleB,
        zIndex: 2,
        opacity: isTransitioning ? 1 : 0,
        transition: isTransitioning ? `opacity ${dur}` : videoCropStyle.transition,
        pointerEvents: isTransitioning ? 'auto' : 'none',
      }
    } else {
      styleB = {
        ...styleB,
        zIndex: 1,
        opacity: 1,
        pointerEvents: isTransitioning ? 'none' : 'auto',
      }
      styleA = {
        ...styleA,
        zIndex: 2,
        opacity: isTransitioning ? 1 : 0,
        transition: isTransitioning ? `opacity ${dur}` : videoCropStyle.transition,
        pointerEvents: isTransitioning ? 'auto' : 'none',
      }
    }
  }

  return (
    <div
      className={`${styles.seamlessWrapper} ${className}`}
      style={containerStyle}
      onClick={onClick}
      title={title}
    >
      <video
        ref={videoARef}
        className={className}
        autoPlay
        muted
        playsInline
        onLoadedMetadata={(e) => e.currentTarget.play().catch(() => {})}
        onCanPlay={(e) => e.currentTarget.play().catch(() => {})}
        style={styleA}
      />
      <video
        ref={videoBRef}
        className={className}
        autoPlay
        muted
        playsInline
        onLoadedMetadata={(e) => e.currentTarget.play().catch(() => {})}
        onCanPlay={(e) => e.currentTarget.play().catch(() => {})}
        style={styleB}
      />
      {transitionMode === 'dip' && isTransitioning && (
        <div className={`${styles.seamlessDipOverlay} ${styles.seamlessDipActive}`} />
      )}
    </div>
  )
}

/** Visor principal: video HTML directo (fluido) + filtros CSS del LOOK PRO + Layouts Multi-cámara (Solo, PiP, Split, Triple, Quad). */
export default function ProgramPreview({
  stream,
  cameraKey = 0,
  look = null,
  directorCrop = null,
  crops = {},
  masterCameraSlot = 0,
  secondarySlot = null,
  tertiarySlot = null,
  quaternarySlot = null,
  pipCameraSlot = null,
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

  useEffect(() => {
    safeAttachVideo(secondaryVideoRef.current, secondaryStream)
    safeAttachVideo(tertiaryVideoRef.current, tertiaryStream)
    safeAttachVideo(quaternaryVideoRef.current, quaternaryStream)
    safeAttachVideo(pipVideoRef.current, pipStream)

    const unbind2 = bindVideoKeepAlive(secondaryVideoRef.current)
    const unbind3 = bindVideoKeepAlive(tertiaryVideoRef.current)
    const unbind4 = bindVideoKeepAlive(quaternaryVideoRef.current)
    const unbind5 = bindVideoKeepAlive(pipVideoRef.current)

    return () => {
      unbind2?.()
      unbind3?.()
      unbind4?.()
      unbind5?.()
    }
  }, [secondaryStream, tertiaryStream, quaternaryStream, pipStream, cameraKey, layout])

  const cssFilter = useMemo(() => {
    const f = buildCanvasFilter(look)
    if (f && f !== 'none') return f
    if (directorCrop?.filter && directorCrop.filter !== 'none') return directorCrop.filter
    return undefined
  }, [look, directorCrop?.filter])

  function getCropStyle(crop, isPushIn = false) {
    const z = crop?.zoom > 1.02 ? crop.zoom : 1
    const fx = (crop?.focusX ?? 0.5) * 100
    const fy = (crop?.focusY ?? 0.42) * 100
    return {
      objectFit: 'cover',
      objectPosition: `${fx}% ${fy}%`,
      transform: z > 1 ? `scale(${z})` : undefined,
      transformOrigin: `${fx}% ${fy}%`,
      transition: isPushIn
        ? 'transform 7s cubic-bezier(0.2, 0.7, 0.2, 1), transform-origin 1.2s ease-out'
        : 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), transform-origin 0.4s cubic-bezier(0.25, 1, 0.5, 1)',
    }
  }

  const effectiveMasterCrop = directorCrop || (masterCameraSlot !== null ? crops[masterCameraSlot] : null)
  const masterStyle = getCropStyle(effectiveMasterCrop, effectiveMasterCrop?.pushIn)
  const secondaryStyle = getCropStyle(secondarySlot !== null ? crops[secondarySlot] : null)
  const tertiaryStyle = getCropStyle(tertiarySlot !== null ? crops[tertiarySlot] : null)
  const quaternaryStyle = getCropStyle(quaternarySlot !== null ? crops[quaternarySlot] : null)
  const pipStyle = getCropStyle(pipCameraSlot !== null ? crops[pipCameraSlot] : null)

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
        <SeamlessMasterVideo
          stream={stream}
          className={styles.videoInset}
          style={{
            top: `${top}%`,
            left: `${left}%`,
            width: `${width}%`,
            height: `${height}%`,
            ...masterStyle,
          }}
          filter={cssFilter}
          transitionMode={look?.transition || 'crossfade'}
          cameraKey={cameraKey}
          mainVideoRef={videoRef}
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
              <SeamlessMasterVideo
                stream={stream}
                className={styles.videoSplit}
                style={masterStyle}
                filter={cssFilter}
                transitionMode={look?.transition || 'crossfade'}
                cameraKey={cameraKey}
                mainVideoRef={videoRef}
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
                style={secondaryStyle}
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
              <SeamlessMasterVideo
                stream={stream}
                className={styles.videoSplit}
                style={masterStyle}
                filter={cssFilter}
                transitionMode={look?.transition || 'crossfade'}
                cameraKey={cameraKey}
                mainVideoRef={videoRef}
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
                  style={secondaryStyle}
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
                  style={tertiaryStyle}
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
              <SeamlessMasterVideo
                stream={stream}
                className={styles.video}
                style={masterStyle}
                filter={cssFilter}
                transitionMode={look?.transition || 'crossfade'}
                cameraKey={cameraKey}
                mainVideoRef={videoRef}
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
                style={secondaryStyle}
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
                style={tertiaryStyle}
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
                style={quaternaryStyle}
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
        <SeamlessMasterVideo
          stream={stream}
          className={styles.video}
          style={masterStyle}
          filter={cssFilter}
          transitionMode={look?.transition || 'crossfade'}
          cameraKey={cameraKey}
          mainVideoRef={videoRef}
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
              style={pipStyle}
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
