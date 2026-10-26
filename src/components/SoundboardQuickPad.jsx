import React, { useState } from 'react'
import {
  Volume2,
  VolumeX,
  Play,
  Square,
  Sparkles,
  Zap,
  Radio,
  X
} from 'lucide-react'
import { MUSIC_SFX } from '../config/musicTracks.js'

export default function SoundboardQuickPad({
  isOpen,
  onClose,
  onPlaySfx,
  onStopSfx
}) {
  const [activeSfxId, setActiveSfxId] = useState(null)

  const sfxList = [
    { id: 'applause', name: 'Aplausos', emoji: '👏', color: '#16a34a', hotkey: '1' },
    { id: 'horn', name: 'Bocina / Claxon', emoji: '📣', color: '#eab308', hotkey: '2' },
    { id: 'laugh', name: 'Carcajadas', emoji: '😂', color: '#ea580c', hotkey: '3' },
    { id: 'cheering', name: 'Ovación', emoji: '🙌', color: '#06b6d4', hotkey: '4' },
    { id: 'glass', name: 'Cristales', emoji: '🥂', color: '#38bdf8', hotkey: '5' },
    { id: 'door', name: 'Puerta', emoji: '🚪', color: '#8b5cf6', hotkey: '6' },
    { id: 'ringtone', name: 'Teléfono', emoji: '📞', color: '#ec4899', hotkey: '7' },
    { id: 'crickets', name: 'Grillos / Silencio', emoji: '🦗', color: '#10b981', hotkey: '8' },
    { id: 'palms', name: 'Palmas Rítmicas', emoji: '👏', color: '#f97316', hotkey: '9' }
  ]

  const handleTrigger = (id) => {
    setActiveSfxId(id)
    if (onPlaySfx) onPlaySfx(id)
    setTimeout(() => {
      setActiveSfxId((curr) => (curr === id ? null : curr))
    }, 1800)
  }

  const handleStopAll = () => {
    setActiveSfxId(null)
    if (onStopSfx) onStopSfx()
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '80px',
        right: '24px',
        width: '360px',
        backgroundColor: '#12131a',
        border: '1px solid rgba(255, 255, 255, 0.16)',
        borderRadius: 16,
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(234, 88, 12, 0.2)',
        zIndex: 99980,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backdropFilter: 'blur(12px)'
      }}
    >
      {/* Cabecera */}
      <div
        style={{
          padding: '10px 14px',
          background: 'rgba(0, 0, 0, 0.5)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={16} color="#ff6b00" />
          <span style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', letterSpacing: '0.04em' }}>
            SOUNDBOARD EN CABINA (P3.2)
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: 2
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Grid de Pads */}
      <div
        style={{
          padding: '12px',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px'
        }}
      >
        {sfxList.map((item) => {
          const isPlayingThis = activeSfxId === item.id
          return (
            <button
              key={item.id}
              onClick={() => handleTrigger(item.id)}
              style={{
                position: 'relative',
                height: '76px',
                borderRadius: '10px',
                border: isPlayingThis ? `2px solid ${item.color}` : '1px solid rgba(255, 255, 255, 0.08)',
                background: isPlayingThis ? `${item.color}33` : 'rgba(255, 255, 255, 0.04)',
                boxShadow: isPlayingThis ? `0 0 16px ${item.color}66` : 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                cursor: 'pointer',
                transition: 'all 0.12s ease',
                transform: isPlayingThis ? 'scale(0.96)' : 'scale(1)'
              }}
            >
              <span style={{ fontSize: '20px' }}>{item.emoji}</span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#e2e8f0', textAlign: 'center', padding: '0 4px', lineHeight: 1.1 }}>
                {item.name}
              </span>
              <span
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '5px',
                  fontSize: '9px',
                  fontWeight: 800,
                  color: '#94a3b8',
                  background: 'rgba(0,0,0,0.4)',
                  padding: '1px 4px',
                  borderRadius: 3
                }}
              >
                [{item.hotkey}]
              </span>
            </button>
          )
        })}
      </div>

      {/* Botón de Parada Rápida */}
      <div
        style={{
          padding: '8px 12px 12px 12px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)'
        }}
      >
        <button
          onClick={handleStopAll}
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: 8,
            border: '1px solid #ef4444',
            background: 'rgba(239, 68, 68, 0.18)',
            color: '#f87171',
            fontSize: '11px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6
          }}
        >
          <Square size={12} fill="#f87171" />
          <span>CORTAR TODOS LOS EFECTOS [TECLA 0]</span>
        </button>
      </div>
    </div>
  )
}
