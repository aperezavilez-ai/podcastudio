import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  BookOpen,
  Play,
  Pause,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Sliders,
  Type,
  Sun,
  X,
  Upload,
  Tablet,
  Copy,
  Check,
  Eye,
  Maximize2,
  Minimize2,
  Move
} from 'lucide-react'
import mammoth from 'mammoth'

export default function BroadcastTeleprompter({
  isOpen,
  onClose,
  initialText = 'Bienvenido a PodcastStudio Broadcast Pro.\n\nHoy conversaremos sobre los últimos avances en producción virtual, inteligencia artificial y realización multicámara.\n\nMantén la mirada fija en este recuadro para conservar un contacto visual 100% natural con tu audiencia.',
  lanUrl = ''
}) {
  const [text, setText] = useState(initialText)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(2.0) // 0.5 a 8.0
  const [fontSize, setFontSize] = useState(36) // 18 a 64
  const [opacity, setOpacity] = useState(0.85) // 0.2 a 1.0
  const [mirrorH, setMirrorH] = useState(false)
  const [mirrorV, setMirrorV] = useState(false)
  const [eyelineMarker, setEyelineMarker] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [copiedLan, setCopiedLan] = useState(false)
  const [positionPreset, setPositionPreset] = useState('top-center') // 'top-center' | 'fullscreen' | 'compact'

  const scrollContainerRef = useRef(null)
  const scrollPosRef = useRef(0)
  const animFrameRef = useRef(null)

  // Sincronizar texto en localStorage para que el iPad/tablet lo reciba
  useEffect(() => {
    try {
      localStorage.setItem('podcastudio_prompter_text', text)
      localStorage.setItem('podcastudio_prompter_speed', String(speed))
      localStorage.setItem('podcastudio_prompter_playing', String(isPlaying))
    } catch (e) {}
  }, [text, speed, isPlaying])

  // Motor de scroll suave continuo a 60 FPS
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      return
    }

    let lastTime = performance.now()
    const loop = (now) => {
      const delta = (now - lastTime) / 1000
      lastTime = now

      if (scrollContainerRef.current) {
        // Velocidad calibrada en píxeles por segundo
        const pxPerSec = speed * 42
        scrollPosRef.current += pxPerSec * delta
        scrollContainerRef.current.scrollTop = scrollPosRef.current

        // Pausa al llegar al final del texto
        const maxScroll = scrollContainerRef.current.scrollHeight - scrollContainerRef.current.clientHeight
        if (scrollPosRef.current >= maxScroll && maxScroll > 0) {
          setIsPlaying(false)
          return
        }
      }

      animFrameRef.current = requestAnimationFrame(loop)
    }

    animFrameRef.current = requestAnimationFrame(loop)

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [isPlaying, speed])

  // Atajos de teclado: Espacio = Play/Pause, R = Reiniciar, Arriba/Abajo = Velocidad
  useEffect(() => {
    if (!isOpen || editMode) return

    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return

      if (e.code === 'Space') {
        e.preventDefault()
        setIsPlaying(p => !p)
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        handleReset()
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSpeed(s => Math.min(8.0, +(s + 0.3).toFixed(1)))
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSpeed(s => Math.max(0.5, +(s - 0.3).toFixed(1)))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, editMode])

  const handleReset = () => {
    scrollPosRef.current = 0
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
    }
  }

  // Cargar guión desde archivo .txt o .docx
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.name.endsWith('.docx')) {
      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const res = await mammoth.extractRawText({ arrayBuffer: event.target.result })
          if (res.value) {
            setText(res.value)
            handleReset()
            setEditMode(false)
          }
        } catch (err) {
          alert('Error leyendo archivo Word: ' + err.message)
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      const reader = new FileReader()
      reader.onload = (event) => {
        setText(event.target.result)
        handleReset()
        setEditMode(false)
      }
      reader.readAsText(file)
    }
  }

  const handleCopyLan = () => {
    const url = lanUrl ? `${lanUrl.replace(/\/control$/, '')}/prompter` : `http://localhost:3001/prompter`
    navigator.clipboard.writeText(url)
    setCopiedLan(true)
    setTimeout(() => setCopiedLan(false), 2000)
  }

  // Estimación de palabras y tiempo de lectura
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length
  const estimatedMins = (wordCount / (130 * (speed / 2))).toFixed(1)

  if (!isOpen) return null

  // Estilos de posición del prompter
  const getContainerStyle = () => {
    if (positionPreset === 'fullscreen') {
      return {
        position: 'fixed',
        inset: '16px',
        zIndex: 99990,
      }
    }
    if (positionPreset === 'compact') {
      return {
        position: 'fixed',
        top: '64px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '540px',
        height: '420px',
        zIndex: 99990,
      }
    }
    // top-center (Óptimo para mirar a la lente de la cámara)
    return {
      position: 'fixed',
      top: '52px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'min(860px, 92vw)',
      height: '480px',
      zIndex: 99990,
    }
  }

  return (
    <div
      style={{
        ...getContainerStyle(),
        backgroundColor: `rgba(10, 11, 16, ${opacity})`,
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(56, 189, 248, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'width 0.2s, height 0.2s'
      }}
    >
      {/* Barra Superior de Control del Teleprompter */}
      <div
        style={{
          padding: '8px 14px',
          background: 'rgba(0, 0, 0, 0.65)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={16} color="#38bdf8" />
          <span style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', letterSpacing: '0.04em' }}>
            TELEPROMPTER HUD BROADCAST
          </span>
          <span style={{ fontSize: 10, color: '#94a3b8', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 4 }}>
            {wordCount} palabras • ~{estimatedMins} min
          </span>
        </div>

        {/* Controles de Transporte y Ajustes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Play / Pause */}
          <button
            onClick={() => setIsPlaying(p => !p)}
            style={{
              background: isPlaying ? '#dc2626' : '#16a34a',
              border: 'none',
              color: '#fff',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              boxShadow: isPlaying ? '0 0 12px rgba(220, 38, 38, 0.5)' : '0 0 12px rgba(22, 163, 74, 0.5)'
            }}
            title="Iniciar o pausar desplazamiento (Barra Espaciadora)"
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} />}
            <span>{isPlaying ? 'PAUSAR' : 'INICIAR'}</span>
          </button>

          {/* Reiniciar */}
          <button
            onClick={handleReset}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#cbd5e1',
              borderRadius: 6,
              padding: '6px 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Volver al inicio del guión (Tecla R)"
          >
            <RotateCcw size={13} />
          </button>

          {/* Espejo Horizontal (Beam Splitter Glass) */}
          <button
            onClick={() => setMirrorH(m => !m)}
            style={{
              background: mirrorH ? '#0284c7' : 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff',
              borderRadius: 6,
              padding: '6px 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Modo Espejo Horizontal (para hardware de cristal divisor)"
          >
            <FlipHorizontal size={13} />
          </button>

          {/* Guía de Mirada */}
          <button
            onClick={() => setEyelineMarker(m => !m)}
            style={{
              background: eyelineMarker ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.08)',
              border: `1px solid ${eyelineMarker ? '#38bdf8' : 'rgba(255,255,255,0.15)'}`,
              color: eyelineMarker ? '#38bdf8' : '#cbd5e1',
              borderRadius: 6,
              padding: '6px 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Alternar guía horizontal de contacto visual con la cámara"
          >
            <Eye size={13} />
          </button>

          {/* Modo Edición */}
          <button
            onClick={() => setEditMode(e => !e)}
            style={{
              background: editMode ? '#ea580c' : 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff',
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {editMode ? 'Listo' : 'Editar'}
          </button>

          {/* Presets de tamaño */}
          <button
            onClick={() => setPositionPreset(p => p === 'top-center' ? 'fullscreen' : (p === 'fullscreen' ? 'compact' : 'top-center'))}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#cbd5e1',
              borderRadius: 6,
              padding: '6px 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Alternar tamaño (Lente Superior / Pantalla Completa / Compacto)"
          >
            {positionPreset === 'fullscreen' ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>

          {/* Cerrar */}
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Barra de Ajustes Rápidos: Velocidad, Tamaño de Letra y Transparencia */}
      <div
        style={{
          padding: '6px 14px',
          background: 'rgba(0, 0, 0, 0.4)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          fontSize: 11,
          color: '#cbd5e1'
        }}
      >
        {/* Velocidad */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>Velocidad:</span>
          <input
            type="range"
            min="0.5"
            max="8.0"
            step="0.1"
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            style={{ width: 90, accentColor: '#38bdf8' }}
          />
          <span style={{ fontWeight: 800, color: '#38bdf8', minWidth: 32 }}>{speed.toFixed(1)}x</span>
        </div>

        {/* Tamaño Letra */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>Letra:</span>
          <input
            type="range"
            min="20"
            max="64"
            step="2"
            value={fontSize}
            onChange={(e) => setFontSize(parseInt(e.target.value))}
            style={{ width: 80, accentColor: '#38bdf8' }}
          />
          <span style={{ fontWeight: 800, color: '#38bdf8', minWidth: 32 }}>{fontSize}px</span>
        </div>

        {/* Transparencia Vidrio HUD */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>Opacidad Vidrio:</span>
          <input
            type="range"
            min="0.2"
            max="1.0"
            step="0.05"
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            style={{ width: 80, accentColor: '#38bdf8' }}
          />
          <span style={{ fontWeight: 800, color: '#38bdf8', minWidth: 32 }}>{Math.round(opacity * 100)}%</span>
        </div>

        {/* Cargar archivo */}
        <label
          style={{
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: '#38bdf8',
            fontSize: 11,
            fontWeight: 700,
            marginLeft: 'auto'
          }}
        >
          <Upload size={12} />
          <span>Cargar .docx / .txt</span>
          <input
            type="file"
            accept=".txt,.docx"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </label>

        {/* Copiar enlace para Tablet / Celular */}
        <button
          onClick={handleCopyLan}
          style={{
            background: copiedLan ? 'rgba(34, 197, 94, 0.2)' : 'rgba(56, 189, 248, 0.15)',
            border: `1px solid ${copiedLan ? '#22c55e' : 'rgba(56, 189, 248, 0.3)'}`,
            color: copiedLan ? '#86efac' : '#38bdf8',
            borderRadius: 6,
            padding: '3px 8px',
            fontSize: 10,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
          title="Abrir teleprompter en un iPad o tablet en el cristal de la cámara"
        >
          {copiedLan ? <Check size={11} /> : <Tablet size={11} />}
          <span>{copiedLan ? 'Enlace Copiado' : 'Link iPad / Tablet'}</span>
        </button>
      </div>

      {/* Guía Visual de Mirada a la Lente (Eyeline Marker) */}
      {eyelineMarker && !editMode && (
        <div
          style={{
            position: 'absolute',
            top: '38%',
            left: 0,
            right: 0,
            height: '2px',
            background: 'linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.8), transparent)',
            boxShadow: '0 0 10px rgba(56, 189, 248, 0.6)',
            pointerEvents: 'none',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingLeft: 16
          }}
        >
          <span style={{ fontSize: 9, color: '#38bdf8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', background: 'rgba(0,0,0,0.8)', padding: '1px 6px', borderRadius: 4 }}>
            ▲ MIRAR AQUÍ (LENTE DE CÁMARA)
          </span>
        </div>
      )}

      {/* Área del Guión / Desplazamiento */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {editMode ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Pega o escribe aquí tu guión..."
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: 'transparent',
              color: '#f8fafc',
              border: 'none',
              padding: '24px 32px',
              fontSize: '18px',
              lineHeight: 1.6,
              fontFamily: 'inherit',
              resize: 'none',
              outline: 'none'
            }}
          />
        ) : (
          <div
            ref={scrollContainerRef}
            style={{
              width: '100%',
              height: '100%',
              overflowY: 'auto',
              padding: '120px 48px 240px 48px',
              textAlign: 'center',
              userSelect: 'none',
              transform: `${mirrorH ? 'scaleX(-1)' : ''} ${mirrorV ? 'scaleY(-1)' : ''}`,
              scrollbarWidth: 'none'
            }}
          >
            <div
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: 1.55,
                fontWeight: 800,
                color: '#ffffff',
                textShadow: '0 3px 12px rgba(0, 0, 0, 0.95), 0 0 24px rgba(0, 0, 0, 0.8)',
                whiteSpace: 'pre-wrap',
                maxWidth: '800px',
                margin: '0 auto',
                letterSpacing: '-0.01em'
              }}
            >
              {text}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
