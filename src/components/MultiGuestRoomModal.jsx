import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Users,
  X,
  Copy,
  Check,
  QrCode,
  Radio,
  Mic,
  MicOff,
  Sliders,
  Volume2,
  Share2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Info
} from 'lucide-react';
import { getMixMinusStatus } from '../utils/masterBroadcastEngine.js';

export default function MultiGuestRoomModal({
  open,
  onClose,
  localIp = 'localhost',
  cameraSlots = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  cameraMeta = [],
  onUpdateCameraMeta,
  cameraLevels = {},
  slotStreams = {},
  onDisconnectSlot,
  autoCintilloEnabled = false,
  onToggleAutoCintillo,
  onTriggerSpeakerCintillo,
}) {
  const [copiedSlot, setCopiedSlot] = useState(null);
  const [qrSlot, setQrSlot] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [mixMinusInfo, setMixMinusInfo] = useState({ totalBuses: 0, buses: [] });

  // Actualizar diagnóstico de Mix-Minus en tiempo real
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      try {
        const status = getMixMinusStatus();
        setMixMinusInfo(status);
      } catch (e) {}
    }, 1000);
    return () => clearInterval(interval);
  }, [open]);

  // Generar código QR para un enlace
  const handleShowQr = async (url, slotNum) => {
    if (qrSlot === slotNum) {
      setQrSlot(null);
      setQrDataUrl('');
      return;
    }
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 240,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' }
      });
      setQrDataUrl(dataUrl);
      setQrSlot(slotNum);
    } catch (e) {
      console.warn('Error generando QR:', e);
    }
  };

  const copyToClipboard = (text, slotNum) => {
    navigator.clipboard.writeText(text);
    setCopiedSlot(slotNum);
    setTimeout(() => setCopiedSlot(null), 2500);
  };

  if (!open) return null;

  const masterRoomUrl = `http://${localIp}:3001/camara?auto=true`;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(12px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 960,
          maxHeight: '90vh',
          backgroundColor: '#0c0f17',
          border: '1px solid rgba(6, 182, 212, 0.35)',
          borderRadius: 16,
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(6, 182, 212, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#f8fafc',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABECERA */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, rgba(6, 182, 212, 0.12), transparent)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: 'rgba(6, 182, 212, 0.2)',
                border: '1px solid rgba(6, 182, 212, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#22d3ee',
              }}
            >
              <Users size={20} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>Sala de Invitados Remotos & Retorno Mix-Minus N-1</span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 9999,
                    backgroundColor: 'rgba(34, 197, 94, 0.2)',
                    color: '#4ade80',
                    border: '1px solid rgba(34, 197, 94, 0.4)',
                  }}
                >
                  BROADCAST SFU
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                Gestión de hasta 8 invitados remotos con cancelación de eco física y cintillos automáticos por voz
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 8,
              display: 'flex',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* CONTENIDO SCROLLABLE */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* BANNER ENLACE MAESTRO DE SALA & STATUS MIX-MINUS */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr',
              gap: 16,
            }}
          >
            {/* ENLACE MAESTRO */}
            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                borderRadius: 12,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#22d3ee', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Share2 size={15} />
                    <span>Enlace Maestro de Invitación (Asignación Automática)</span>
                  </div>
                  <span style={{ fontSize: 10, color: '#64748b' }}>LAN / Wi-Fi</span>
                </div>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.4, marginBottom: 12 }}>
                  Comparte este enlace con cualquier participante. El sistema le asignará automáticamente el primer canal libre disponible.
                </p>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    backgroundColor: '#05070a',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#cbd5e1', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {masterRoomUrl}
                  </span>
                  <button
                    onClick={() => copyToClipboard(masterRoomUrl, 'master')}
                    style={{
                      background: copiedSlot === 'master' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(6, 182, 212, 0.2)',
                      border: '1px solid ' + (copiedSlot === 'master' ? '#4ade80' : '#22d3ee'),
                      color: copiedSlot === 'master' ? '#86efac' : '#22d3ee',
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {copiedSlot === 'master' ? <Check size={12} /> : <Copy size={12} />}
                    {copiedSlot === 'master' ? '¡Copiado!' : 'Copiar'}
                  </button>
                  <button
                    onClick={() => handleShowQr(masterRoomUrl, 'master')}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: '#cbd5e1',
                      padding: '4px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                    title="Ver Código QR"
                  >
                    <QrCode size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* STATUS MIX-MINUS & AUTO-CINTILLO */}
            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: 12,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldCheck size={16} />
                    <span>Retorno Limpio Mix-Minus N-1 Activo</span>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 9999,
                      background: 'rgba(34, 197, 94, 0.2)',
                      color: '#86efac',
                      border: '1px solid rgba(34, 197, 94, 0.4)',
                    }}
                  >
                    {mixMinusInfo.totalBuses} BUSES ACTIVOS
                  </span>
                </div>
                <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, lineHeight: 1.4, marginBottom: 10 }}>
                  Cada invitado remoto recibe el audio del conductor (CAM 1), música y efectos, <strong>restando su propia voz</strong> para evitar que se escuche a sí mismo con retraso.
                </p>
              </div>

              {/* TOGGLE AUTO-CINTILLO */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 8,
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={14} style={{ color: autoCintilloEnabled ? '#22d3ee' : '#64748b' }} />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>Auto-Cintillo por Reconocimiento de Voz</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>Muestra el nombre del invitado automáticamente cuando habla</div>
                  </div>
                </div>
                <button
                  onClick={onToggleAutoCintillo}
                  style={{
                    backgroundColor: autoCintilloEnabled ? '#06b6d4' : '#334155',
                    color: autoCintilloEnabled ? '#000' : '#cbd5e1',
                    border: 'none',
                    borderRadius: 9999,
                    padding: '4px 12px',
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {autoCintilloEnabled ? 'ACTIVADO' : 'APAGADO'}
                </button>
              </div>
            </div>
          </div>

          {/* CÓDIGO QR EXPANDIDO */}
          {qrSlot && qrDataUrl && (
            <div
              style={{
                backgroundColor: '#05070a',
                border: '1px solid rgba(6, 182, 212, 0.4)',
                borderRadius: 12,
                padding: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 20,
              }}
            >
              <img src={qrDataUrl} alt="QR Code" style={{ width: 140, height: 140, borderRadius: 8, background: '#fff', padding: 6 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#22d3ee', marginBottom: 6 }}>
                  Escanear con Cámara de Celular / iPad
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', maxWidth: 360, lineHeight: 1.4, marginBottom: 12 }}>
                  Apunta con la cámara de tu iPhone o Android conectado a la misma red Wi-Fi para ingresar de inmediato al estudio.
                </div>
                <button
                  onClick={() => setQrSlot(null)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: 6,
                    color: '#fff',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  Cerrar QR
                </button>
              </div>
            </div>
          )}

          {/* MATRIZ DE CANALES DE INVITADOS (CAM 2 A CAM 10) */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: 12 }}>
              Canales de Invitados Asignables (CAM 2 a CAM 10)
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {cameraSlots.filter(s => s >= 2).map((slotNum) => {
                const meta = (cameraMeta && (cameraMeta[slotNum] || cameraMeta[slotNum - 1])) || {};
                const stream = slotStreams[slotNum];
                const isConnected = Boolean(stream);
                const level = cameraLevels[slotNum] || 0;
                const slotUrl = `http://${localIp}:3001/camara?slot=${slotNum}&name=${encodeURIComponent(meta.guestName || '')}&role=${encodeURIComponent(meta.guestRole || 'guest')}`;

                return (
                  <div
                    key={slotNum}
                    style={{
                      backgroundColor: isConnected ? 'rgba(6, 182, 212, 0.06)' : 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid ' + (isConnected ? 'rgba(6, 182, 212, 0.5)' : 'rgba(255, 255, 255, 0.08)'),
                      borderRadius: 12,
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      position: 'relative',
                    }}
                  >
                    {/* ENCABEZADO DE CANAL */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 900,
                            padding: '3px 8px',
                            borderRadius: 6,
                            backgroundColor: isConnected ? '#0891b2' : '#334155',
                            color: '#fff',
                          }}
                        >
                          CAM {slotNum}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: isConnected ? '#22d3ee' : '#64748b' }}>
                          {isConnected ? 'EN VIVO' : 'DISPONIBLE'}
                        </span>
                      </div>

                      {/* MEDIDOR VU DE AUDIO */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div
                          style={{
                            width: 60,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${level}%`,
                              height: '100%',
                              backgroundColor: level > 75 ? '#ef4444' : level > 25 ? '#22c55e' : '#3b82f6',
                              transition: 'width 0.08s ease-out',
                            }}
                          />
                        </div>
                        {level > 15 ? <Mic size={12} color="#4ade80" /> : <MicOff size={12} color="#64748b" />}
                      </div>
                    </div>

                    {/* CAMPOS DE NOMBRE Y ROL DEL INVITADO */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input
                        type="text"
                        placeholder={`Nombre Invitado CAM ${slotNum}`}
                        value={meta.guestName || ''}
                        onChange={(e) => {
                          if (onUpdateCameraMeta) {
                            onUpdateCameraMeta(slotNum, { ...meta, guestName: e.target.value });
                          }
                        }}
                        style={{
                          backgroundColor: '#05070a',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: 6,
                          padding: '6px 10px',
                          color: '#fff',
                          fontSize: 12,
                          outline: 'none',
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Cargo / Título (ej. Especialista en IA)"
                        value={meta.guestRole || ''}
                        onChange={(e) => {
                          if (onUpdateCameraMeta) {
                            onUpdateCameraMeta(slotNum, { ...meta, guestRole: e.target.value });
                          }
                        }}
                        style={{
                          backgroundColor: '#05070a',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: 6,
                          padding: '6px 10px',
                          color: '#94a3b8',
                          fontSize: 11,
                          outline: 'none',
                        }}
                      />
                    </div>

                    {/* ACCIONES Y RETORNO */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: '#4ade80',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                      >
                        <ShieldCheck size={11} /> Retorno N-1 OK
                      </span>

                      <div style={{ display: 'flex', gap: 6 }}>
                        {onTriggerSpeakerCintillo && (
                          <button
                            onClick={() => onTriggerSpeakerCintillo(slotNum)}
                            style={{
                              backgroundColor: 'rgba(255, 255, 255, 0.08)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              color: '#cbd5e1',
                              padding: '3px 8px',
                              borderRadius: 4,
                              fontSize: 10,
                              cursor: 'pointer',
                            }}
                            title="Probar animación del cintillo de este participante"
                          >
                            Probar Cintillo
                          </button>
                        )}

                        <button
                          onClick={() => copyToClipboard(slotUrl, slotNum)}
                          style={{
                            backgroundColor: copiedSlot === slotNum ? 'rgba(34, 197, 94, 0.2)' : 'rgba(6, 182, 212, 0.15)',
                            border: '1px solid ' + (copiedSlot === slotNum ? '#4ade80' : '#0891b2'),
                            color: copiedSlot === slotNum ? '#86efac' : '#22d3ee',
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                          title="Copiar enlace directo asignado a esta cámara"
                        >
                          {copiedSlot === slotNum ? <Check size={10} /> : <Copy size={10} />}
                          {copiedSlot === slotNum ? 'Copiado' : 'Link CAM'}
                        </button>

                        <button
                          onClick={() => handleShowQr(slotUrl, slotNum)}
                          style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#94a3b8',
                            padding: '3px 6px',
                            borderRadius: 4,
                            cursor: 'pointer',
                          }}
                          title="Ver QR para esta cámara"
                        >
                          <QrCode size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* PIE DE PÁGINA */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11,
            color: '#64748b',
            background: '#070a10',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Info size={13} color="#0891b2" />
            <span>Los invitados pueden conectarse desde Safari en iOS, Chrome en Android o navegadores de escritorio sin instalar software.</span>
          </div>

          <button
            onClick={onClose}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              padding: '6px 16px',
              borderRadius: 6,
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
