import React from 'react'
import { getBackgroundTemplate } from '../config/backgroundTemplates.js'
import styles from './SetBackground.module.css'

export default function SetBackground({
  templateId,
  customUrl,
  preview = false,
  motionEnabled = true,
  cameraAngle = 'mid', // 'mid' (Toma Conductor TV) | 'screen' (Conductor + Pantalla) | 'wide' (Plano General)
}) {
  if (customUrl) {
    const isVideo = /\.(mp4|webm|mov)(\?.*)?$/i.test(customUrl) || customUrl.startsWith('data:video')
    return (
      <div className={`${styles.set} ${preview ? styles.preview : ''}`}>
        {isVideo ? (
          <video
            src={customUrl}
            autoPlay
            loop
            muted
            playsInline
            className={styles.realisticBg}
          />
        ) : (
          <img src={customUrl} alt="Escenario virtual" className={styles.realisticBg} />
        )}
      </div>
    )
  }

  if (!templateId || templateId === 'none') return null

  const template = getBackgroundTemplate(templateId)

  // Si tiene video loop en vivo (reproducir tanto en vivo como en miniaturas/previews)
  const hasLiveVideo = Boolean(template.video && (preview || motionEnabled))

  // Encuadre de cámara broadcast estilo vMix:
  // 'mid': La cámara enfoca al conductor en el escritorio (zoom suave al área de conducción)
  // 'screen': La cámara se desplaza ligeramente para abrir espacio a la pantalla de contenido
  // 'wide': Plano general de todo el estudio
  let framingStyle = {}
  if (!preview) {
    if (cameraAngle === 'mid') {
      framingStyle = {
        transform: 'scale(1.22) translateY(2.5%)',
        transformOrigin: '50% 50%',
        transition: 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)',
      }
    } else if (cameraAngle === 'screen') {
      framingStyle = {
        transform: 'scale(1.18) translateX(6%)',
        transformOrigin: '40% 50%',
        transition: 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)',
      }
    } else if (cameraAngle === 'wide') {
      framingStyle = {
        transform: 'scale(1) translate(0, 0)',
        transition: 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)',
      }
    }
  }

  return (
    <div className={`${styles.set} ${preview ? styles.preview : ''}`}>
      <div style={{ width: '100%', height: '100%', ...framingStyle }}>
        {hasLiveVideo ? (
          <video
            src={template.video}
            autoPlay
            loop
            muted
            playsInline
            poster={template.image}
            className={styles.realisticBg}
          />
        ) : template.image ? (
          <img
            src={template.image}
            alt={template.name}
            className={styles.realisticBg}
            loading="eager"
          />
        ) : (
          <div className={`${styles.layerBase} ${styles[templateId] || ''}`} />
        )}

        {/* Capa de atmósfera luminosa dinámica broadcast */}
        {!preview && motionEnabled && (
          <div className={styles.ambientMotionLayer} aria-hidden>
            <div className={styles.studioLightGlow} />
            <div className={styles.studioLightRight} />
            {(template.id === 'interview-studio-warm' || template.id === 'news-city-skyline') && (
              <div className={styles.citySkylineShimmer} />
            )}
            {(template.category === 'noticias' || template.category === 'tech') && (
              <div className={styles.screenScanlines} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** Capa frontal de escritorio / podium (Desk Overlay PNG) */
export function SetForegroundDesk({
  templateId,
  showDesk = true,
  deskOffset = 0,
  cameraAngle = 'mid',
}) {
  if (!showDesk || !templateId || templateId === 'none') return null
  const template = getBackgroundTemplate(templateId)
  if (!template.desk) return null

  // En ángulo 'mid' (Toma Conductor), el escritorio está en primer plano televisión a escala completa
  let angleTransform = ''
  if (cameraAngle === 'mid') {
    angleTransform = `scale(1.22) translateY(${deskOffset + 4}px)`
  } else if (cameraAngle === 'screen') {
    angleTransform = `scale(1.18) translateX(6%) translateY(${deskOffset + 2}px)`
  } else if (deskOffset) {
    angleTransform = `translateY(${deskOffset}px)`
  }

  return (
    <div
      className={styles.deskOverlayLayer}
      style={{
        transform: angleTransform || undefined,
        transformOrigin: '50% 100%',
        transition: 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)',
      }}
      aria-hidden
    >
      <img src={template.desk} alt="" className={styles.deskOverlayImg} />
    </div>
  )
}
