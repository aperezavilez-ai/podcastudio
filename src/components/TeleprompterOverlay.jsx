import React, { useRef, useEffect } from 'react'
import styles from './TeleprompterOverlay.module.css'

const READ_LINE = 0.42

export default function TeleprompterOverlay({
  script,
  playing,
  offset,
  fontSize,
  mirror,
  direction = 'up',
  onMaxScrollChange,
}) {
  const textRef = useRef(null)
  const viewRef = useRef(null)

  useEffect(() => {
    const textEl = textRef.current
    const viewEl = viewRef.current
    if (!textEl || !viewEl) return

    const update = () => {
      const readPad = viewEl.clientHeight * READ_LINE
      const max = Math.max(0, textEl.scrollHeight - viewEl.clientHeight + readPad + 48)
      onMaxScrollChange?.(max)
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(viewEl)
    return () => ro.disconnect()
  }, [script, fontSize, direction, onMaxScrollChange])

  const readPad = `calc(${READ_LINE * 100}% - ${fontSize * 0.5}px)`
  const scrollY = direction === 'down' ? offset : -offset

  return (
    <div className={styles.overlay} aria-hidden="true">
      <div className={styles.prompter} ref={viewRef}>
        <div className={styles.readLine} />
        <div
          ref={textRef}
          className={styles.prompterText}
          style={{
            fontSize,
            paddingTop: readPad,
            transform: mirror
              ? `scaleX(-1) translateY(${scrollY}px)`
              : `translateY(${scrollY}px)`,
          }}
        >
          {script || ''}
        </div>
        <div className={styles.prompterFade} />
      </div>
      <div className={styles.statusBar}>
        <span className={playing ? styles.statusLive : styles.statusPaused}>
          <i className={`ti ${playing ? 'ti-player-play' : 'ti-player-pause'}`} />
          {playing ? 'Leyendo' : 'Pausado'}
        </span>
        <span className={styles.spaceHint}>Espacio — iniciar / pausar</span>
      </div>
    </div>
  )
}
