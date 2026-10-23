import React, { useState, useEffect, useMemo, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Video,
  Usb,
  Wifi,
  QrCode,
  Sliders,
  X,
  Plus,
  Check,
  Copy,
  Mail,
  Share2,
  ExternalLink,
  AlertTriangle,
  Power,
  Star,
  Search,
  Smartphone,
  Info,
  Radio,
  FileText,
  Loader2,
  Save,
  MessageCircle,
  Trash2
} from 'lucide-react';
import styles from './CameraConnectModal.module.css';

function ModalVideoPreview({ stream, label }) {
  const vRef = useRef(null);

  useEffect(() => {
    if (vRef.current && stream) {
      vRef.current.setAttribute('playsinline', 'true');
      vRef.current.setAttribute('webkit-playsinline', 'true');
      vRef.current.muted = true;
      if (vRef.current.srcObject !== stream) {
        vRef.current.srcObject = stream;
      }
      vRef.current.play().catch(() => {});
    }
  }, [stream]);

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 380,
        aspectRatio: '16/9',
        backgroundColor: '#05070a',
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        border: '1px solid rgba(255,255,255,0.18)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        margin: '12px auto',
      }}
    >
      <video
        ref={vRef}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        autoPlay
        playsInline
        muted
      />
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          background: 'rgba(22,101,52,0.85)',
          border: '1px solid #4ade80',
          color: '#86efac',
          padding: '3px 8px',
          borderRadius: 9999,
          fontSize: 10,
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          backdropFilter: 'blur(8px)',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#4ade80',
            boxShadow: '0 0 6px #4ade80',
          }}
        />
        {label || 'SEÑAL EN VIVO'}
      </div>
    </div>
  );
}

export default function CameraConnectModal({
  open,
  onClose,
  initialSlot = 0,
  slotsCount = 4,
  onAddSlot,
  devices = [],
  cameraMeta = {},
  streams = {},
  remoteCams = [],
  masterCameraSlot = 0,
  onSetMaster,
  onUsbConnect,
  onWifiConnect,
  onAssignRemoteStream,
  onDisconnect,
  onRenameSlot,
  localQrUrl = '',
}) {
  const [targetSlot, setTargetSlot] = useState(initialSlot);
  const [activeTab, setActiveTab] = useState('usb');
  const [wifiUrl, setWifiUrl] = useState('');
  const [wifiConnecting, setWifiConnecting] = useState(false);
  const [isScanningWifi, setIsScanningWifi] = useState(false);
  const [hasScannedWifi, setHasScannedWifi] = useState(false);
  const [discoveredCameras, setDiscoveredCameras] = useState([]);
  const [customLabel, setCustomLabel] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestRole, setGuestRole] = useState('guest');
  const [connectingUsbId, setConnectingUsbId] = useState(null);
  const [usbConnectError, setUsbConnectError] = useState(null);
  const [wifiConnectError, setWifiConnectError] = useState(null);
  const [wifiConnectSuccess, setWifiConnectSuccess] = useState(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [useCloudDomain, setUseCloudDomain] = useState(true);

  useEffect(() => {
    if (open) {
      setTargetSlot(initialSlot);
      const currentMeta = cameraMeta[initialSlot];
      setCustomLabel(currentMeta?.label || '');
      setWifiUrl(currentMeta?.url || '');
      setUsbConnectError(null);
      setWifiConnectError(null);
      setWifiConnectSuccess(null);
    }
  }, [open, initialSlot, cameraMeta]);

  useEffect(() => {
    const currentMeta = cameraMeta[targetSlot];
    setCustomLabel(currentMeta?.label || '');
    setWifiUrl(currentMeta?.url || '');
    setUsbConnectError(null);
    setWifiConnectError(null);
    setWifiConnectSuccess(null);
  }, [targetSlot, cameraMeta]);

  // ESC para cerrar
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const isConnected = Boolean(streams[targetSlot]);
  const isMaster = targetSlot === masterCameraSlot;
  const currentMeta = cameraMeta[targetSlot];

  // URL Remota oficial para celulares (Wi-Fi Local Directo o Enlace Cloud Seguro)
  const remoteUrl = useMemo(() => {
    if (!useCloudDomain && localQrUrl && !localQrUrl.includes('remote-cam')) {
      return localQrUrl;
    }
    const base = 'https://www.podcastudio.mx/remote-cam';
    const params = new URLSearchParams({
      slot: String(targetSlot + 1),
      room: `studio_cam_${targetSlot + 1}`,
    });
    if (guestName.trim()) params.set('name', guestName.trim());
    if (guestRole && guestRole !== 'guest') params.set('role', guestRole);
    return `${base}?${params.toString()}`;
  }, [targetSlot, guestName, guestRole, useCloudDomain, localQrUrl]);

  // Generación de QR Data URL
  useEffect(() => {
    if (remoteUrl) {
      QRCode.toDataURL(remoteUrl, { width: 220, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
        .then((url) => setQrCodeDataUrl(url))
        .catch(() => {
          setQrCodeDataUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(remoteUrl)}`);
        });
    }
  }, [remoteUrl]);

  const handleConnectUsb = async (deviceId, label) => {
    if (!onUsbConnect) return;
    setConnectingUsbId(deviceId);
    setUsbConnectError(null);
    try {
      const res = await onUsbConnect(deviceId, targetSlot, customLabel.trim() || label);
      if (!res) {
        setUsbConnectError('No se pudo abrir la cámara. Verifica que no esté en uso por otra aplicación (Zoom, Meet, OBS) o bloqueada por la tecla de privacidad.');
      }
    } catch (err) {
      setUsbConnectError(err.message || 'Error al conectar la cámara USB');
    } finally {
      setConnectingUsbId(null);
    }
  };

  const handleConnectWifi = async (urlToConnect) => {
    const url = (urlToConnect || wifiUrl)?.trim();
    if (!url || !onWifiConnect) return;
    setWifiConnecting(true);
    setWifiConnectError(null);
    setWifiConnectSuccess(null);
    try {
      const resStream = await onWifiConnect(url, targetSlot, customLabel.trim() || `WiFi Cam ${targetSlot + 1}`);
      if (resStream) {
        setWifiConnectSuccess(`¡Conectado exitosamente a CAM ${targetSlot + 1}!`);
      } else {
        setWifiConnectError('No se pudo establecer el stream de video desde esa URL. Verifica que la cámara esté encendida y accesible.');
      }
    } catch (err) {
      setWifiConnectError(err.message || 'Error al conectar con la cámara IP/WiFi.');
    } finally {
      setWifiConnecting(false);
    }
  };

  const handleExplicitDisconnect = (slot) => {
    if (onDisconnect) {
      onDisconnect(slot);
    }
    setCustomLabel('');
    setWifiUrl('');
    setDiscoveredCameras(prev =>
      prev.map(c => {
        if (c.isAssignedSlot === slot) return { ...c, isAssignedSlot: null };
        return c;
      })
    );
  };

  const handleScanWifiCameras = async () => {
    setIsScanningWifi(true);
    setHasScannedWifi(false);

    try {
      const found = [];

      // 1. Sondeo REAL de red en Electron vía ARP y sockets TCP activos en la red local
      if (typeof window !== 'undefined' && window.api?.scanNetworkCameras) {
        try {
          const netCams = await window.api.scanNetworkCameras();
          if (Array.isArray(netCams)) {
            netCams.forEach((nc) => {
              let assigned = null;
              Object.entries(cameraMeta).forEach(([s, m]) => {
                if (m?.url === nc.url || m?.deviceId === nc.id) assigned = parseInt(s, 10);
              });
              found.push({
                ...nc,
                isAssignedSlot: assigned,
              });
            });
          }
        } catch (e) {
          console.warn('[Scanner Error]:', e);
        }
      }

      // 2. Cámaras de Celular o Remotas con señal WebRTC REAL activa en el estudio
      Object.entries(streams).forEach(([slotStr, stream]) => {
        const slotNum = parseInt(slotStr, 10);
        const meta = cameraMeta[slotNum];
        if (stream && (meta?.type === 'remote' || meta?.type === 'mobile' || meta?.deviceId?.includes('cloud') || meta?.deviceId?.startsWith('Mobil_'))) {
          if (!found.some(f => f.stream === stream || (f.id && f.id === meta?.deviceId))) {
            found.push({
              id: `active_remote_${slotNum}`,
              name: meta?.label || `Celular Remoto (CAM ${slotNum + 1})`,
              type: 'remote',
              stream: stream,
              status: 'Transmisión activa en vivo',
              isAssignedSlot: slotNum,
            });
          }
        }
      });

      // Celulares en buffer de remoteCams si aún no están asignados a ningún slot
      (remoteCams || []).forEach((rc, idx) => {
        if (rc.stream && !found.some(f => f.stream === rc.stream)) {
          found.push({
            id: `remotecam_${rc.id || idx}`,
            name: `Celular Móvil (${rc.id ? rc.id.slice(-4) : idx + 1})`,
            type: 'remote',
            stream: rc.stream,
            status: 'Señal móvil detectada en red local',
            isAssignedSlot: null,
          });
        }
      });

      // 3. Drivers reales de cámaras Wi-Fi / virtuales detectados por hardware en Windows
      (devices || []).forEach((dev) => {
        const labelLower = (dev.label || '').toLowerCase();
        const isWifiOrVirtual =
          labelLower.includes('droidcam') ||
          labelLower.includes('iriun') ||
          labelLower.includes('camo') ||
          labelLower.includes('epoccam') ||
          labelLower.includes('obs virtual');

        if (isWifiOrVirtual) {
          let assigned = null;
          Object.entries(cameraMeta).forEach(([s, m]) => {
            if (m?.deviceId === dev.deviceId) assigned = parseInt(s, 10);
          });

          if (!found.some(f => f.id === dev.deviceId)) {
            found.push({
              id: dev.deviceId,
              name: dev.label || 'Cámara Virtual Wi-Fi',
              type: 'usb_virtual',
              deviceId: dev.deviceId,
              status: 'Driver detectado en el sistema',
              isAssignedSlot: assigned,
            });
          }
        }
      });

      // NOTA: ÚNICAMENTE DISPOSITIVOS REALES DETECTADOS (CERO PRESETS FALSOS)
      setDiscoveredCameras(found);
    } finally {
      setIsScanningWifi(false);
      setHasScannedWifi(true);
    }
  };

  const handleAssignDiscovered = async (camera) => {
    if (camera.type === 'wifi_url') {
      setWifiUrl(camera.url);
      await handleConnectWifi(camera.url);
    } else if (camera.type === 'usb_virtual') {
      await handleConnectUsb(camera.deviceId, camera.name);
    } else if (camera.type === 'remote' && camera.stream) {
      if (onAssignRemoteStream) {
        onAssignRemoteStream(camera.stream, targetSlot, camera.name, { id: camera.id });
      }
    }

    setDiscoveredCameras(prev =>
      prev.map(c => {
        if (c.id === camera.id) return { ...c, isAssignedSlot: targetSlot };
        if (c.isAssignedSlot === targetSlot) return { ...c, isAssignedSlot: null };
        return c;
      })
    );
  };

  const handleSaveLabel = (e) => {
    e.preventDefault();
    if (onRenameSlot) {
      onRenameSlot(targetSlot, customLabel);
    }
  };

  const copyTextToClipboard = async (text) => {
    if (!text) return false;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {}
    return false;
  };

  const handleCopyLink = async () => {
    const ok = await copyTextToClipboard(remoteUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const roleNameMap = {
    guest: 'Invitado Especial',
    student: 'Alumno / Clase Virtual',
    cohost: 'Co-presentador',
  };
  const roleLabel = roleNameMap[guestRole] || 'Invitado';

  const invitationText = `🎙️ Invitación para unirte en vivo a PodcastStudio (${roleLabel} - CAM ${targetSlot + 1})

${guestName.trim() ? `Hola ${guestName.trim()}, ` : 'Hola, '}te invito a conectarte en vivo con tu cámara y micrófono como ${guestRole === 'student' ? 'alumno a la clase virtual' : guestRole === 'cohost' ? 'co-presentador' : 'invitado'}:

👉 Enlace de acceso directo:
${remoteUrl}

Instrucciones:
1. Abre el enlace en tu celular o computadora (Safari en iPhone, Chrome en Android/PC).
2. Permite el acceso a tu cámara y micrófono cuando te lo solicite el navegador.
3. Presiona "Activar Cámara y Conectar".
¡Listo! Tu video y voz entrarán en vivo al estudio.`;

  const handleCopyInvite = async () => {
    const ok = await copyTextToClipboard(invitationText);
    if (ok) {
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    }
  };

  const openExternalLink = (url) => {
    if (!url) return;
    if (typeof window !== 'undefined' && window.api?.openExternal) {
      window.api.openExternal(url);
      return;
    }
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  if (!open) return null;

  return (
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="camera-modal-title"
      >
        {/* HEADER */}
        <header className={styles.head}>
          <div className={styles.headTitle}>
            <Video size={20} className="text-[#e8612a]" />
            <h2 id="camera-modal-title">Configurar Entrada de Video</h2>
            <span className={styles.slotBadge}>CAM {targetSlot + 1}</span>
            {isMaster && (
              <span className={styles.slotBadge} style={{ background: 'rgba(232, 97, 42, 0.3)', color: '#fff' }}>
                ★ MASTER
              </span>
            )}
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>

        {/* SELECTOR DE SLOT */}
        <div className={styles.slotSelectorRow}>
          <span className={styles.slotSelectorLabel}>Canal:</span>
          <div className={styles.slotPills}>
            {Array.from({ length: slotsCount }).map((_, i) => {
              const hasStream = Boolean(streams[i]);
              const hasMeta = Boolean(cameraMeta[i]);
              const active = targetSlot === i;
              return (
                <div
                  key={i}
                  style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
                >
                  <button
                    type="button"
                    className={`${styles.slotPill} ${active ? styles.slotPillActive : ''} ${hasStream ? styles.slotPillConnected : ''}`}
                    onClick={() => setTargetSlot(i)}
                    style={{ paddingRight: (hasStream || hasMeta) ? 20 : undefined }}
                  >
                    <span>{i + 1}</span>
                    {hasStream && <span className={styles.slotConnectedDot} />}
                  </button>
                  {(hasStream || hasMeta) && onDisconnect && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExplicitDisconnect(i);
                      }}
                      title={`Desconectar CAM ${i + 1}`}
                      style={{
                        position: 'absolute',
                        right: -6,
                        top: -6,
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: '#ef4444',
                        border: '1.5px solid #18181b',
                        color: '#fff',
                        fontSize: 9,
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1,
                        zIndex: 5,
                        padding: 0,
                        boxShadow: '0 0 6px rgba(239,68,68,0.7)',
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
            {slotsCount < 8 && onAddSlot && (
              <button
                type="button"
                className={styles.slotPill}
                style={{ borderStyle: 'dashed' }}
                onClick={() => {
                  onAddSlot();
                  setTargetSlot(slotsCount);
                }}
                title="Añadir nuevo canal"
              >
                <Plus size={12} />
              </button>
            )}
          </div>
        </div>

        {/* BARRA DE ESTADO DEL CANAL SELECCIONADO */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
            background: isConnected ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255, 255, 255, 0.03)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            fontSize: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isConnected ? '#22c55e' : '#666',
                boxShadow: isConnected ? '0 0 8px #22c55e' : 'none',
              }}
            />
            <span style={{ color: isConnected ? '#fff' : '#aaa' }}>
              CAM {targetSlot + 1}: <strong>{isConnected ? `Activa (${currentMeta?.label || 'Transmitiendo'})` : currentMeta ? `Asignada (${currentMeta.label || 'Sin señal'})` : 'Libre (Sin señal)'}</strong>
            </span>
          </div>
          {(isConnected || Boolean(currentMeta)) && onDisconnect && (
            <button
              type="button"
              onClick={() => handleExplicitDisconnect(targetSlot)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.45)',
                color: '#f87171',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 11,
                cursor: 'pointer',
                fontWeight: 700,
                transition: 'all 0.15s',
              }}
              title={`Desconectar y liberar CAM ${targetSlot + 1}`}
            >
              <Trash2 size={12} /> Desconectar CAM {targetSlot + 1}
            </button>
          )}
        </div>

        {/* TABS */}
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'usb' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('usb')}
          >
            <Usb size={14} /> USB / Capturadora
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'wifi' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('wifi')}
          >
            <Wifi size={14} /> WiFi / IP Stream
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'remote' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('remote')}
          >
            <QrCode size={14} /> Móvil / Remota QR
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'settings' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Sliders size={14} /> Ajustes de Canal
          </button>
        </div>

        {/* BODY */}
        <div className={styles.body}>
          {/* TAB USB */}
          {activeTab === 'usb' && (
            <div className={styles.deviceList}>
              {devices.length === 0 ? (
                <div className={styles.emptyMsg}>
                  <AlertTriangle size={24} style={{ display: 'block', margin: '0 auto 6px', color: '#e8612a' }} />
                  No se detectaron cámaras USB o capturadoras HDMI conectadas.
                </div>
              ) : (
                devices.map((cam, idx) => {
                  const isCurrent = currentMeta?.deviceId === cam.deviceId && isConnected;
                  return (
                    <div
                      key={cam.deviceId || idx}
                      className={`${styles.deviceItem} ${isCurrent ? styles.deviceItemActive : ''}`}
                    >
                      <div className={styles.deviceInfo}>
                        <Video size={18} className={styles.deviceIcon} />
                        <div>
                          <div className={styles.deviceLabel}>{cam.label || `Cámara USB ${idx + 1}`}</div>
                          <div className={styles.deviceSub}>
                            {cam.deviceId ? `ID: ${cam.deviceId.slice(0, 14)}…` : 'Dispositivo de video local'}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className={`${styles.connectBtn} ${isCurrent ? styles.connectBtnConnected : ''}`}
                        disabled={connectingUsbId === cam.deviceId}
                        onClick={() => {
                          if (isCurrent) {
                            if (onDisconnect) onDisconnect(targetSlot);
                          } else {
                            handleConnectUsb(cam.deviceId, cam.label);
                          }
                        }}
                        title={isCurrent ? 'Desactivar esta cámara' : `Asignar a CAM ${targetSlot + 1}`}
                      >
                        {connectingUsbId === cam.deviceId ? (
                          <>
                            <Loader2 size={13} className="animate-spin" /> Conectando...
                          </>
                        ) : isCurrent ? (
                          <>
                            <Power size={13} className="text-red-400" /> Desactivar
                          </>
                        ) : (
                          <>
                            <Usb size={13} /> Asignar a CAM {targetSlot + 1}
                          </>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
              {usbConnectError && (
                <div
                  style={{
                    color: '#f87171',
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    borderRadius: 8,
                    padding: '10px 14px',
                    fontSize: 12,
                    marginTop: 12,
                    lineHeight: 1.4,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                  }}
                >
                  <AlertTriangle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
                  <span>{usbConnectError}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB WIFI */}
          {activeTab === 'wifi' && (
            <>
              <div className={styles.scannerBanner}>
                <div className={styles.scannerInfo}>
                  <div className={styles.scannerTitle}>
                    <Radio size={16} />
                    <span>Búsqueda Automática en Red Wi-Fi</span>
                  </div>
                  <span className={styles.scannerSub}>
                    Detecta celulares iPhone/Android, cámaras DroidCam, GoPro y streams locales
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.scanBtn}
                  onClick={handleScanWifiCameras}
                  disabled={isScanningWifi}
                >
                  {isScanningWifi ? (
                    <>
                      <Loader2 size={13} className="animate-spin" /> Escaneando red...
                    </>
                  ) : (
                    <>
                      <Search size={13} /> Buscar Cámaras
                    </>
                  )}
                </button>
              </div>

              {/* ESTADO DE ESCANEO ACTIVO */}
              {isScanningWifi && (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: 8,
                    background: 'rgba(232, 97, 42, 0.08)',
                    border: '1px dashed rgba(232, 97, 42, 0.4)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    marginBottom: 14,
                  }}
                >
                  <Loader2 size={24} className="animate-spin text-orange-500" />
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>
                    Escaneando red Wi-Fi local...
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
                    Sondeando cámaras IP, DroidCam (puerto 4747), IP Webcam (8080), GoPro y celulares en vivo
                  </div>
                </div>
              )}

              {/* LISTA DE CÁMARAS DETECTADAS */}
              {!isScanningWifi && hasScannedWifi && (
                <div className={styles.discoveredList}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>
                      Cámaras Detectadas en Red Wi-Fi ({discoveredCameras.length}):
                    </span>
                    <button
                      type="button"
                      onClick={handleScanWifiCameras}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ea580c',
                        fontSize: 11,
                        cursor: 'pointer',
                        fontWeight: 600,
                        textDecoration: 'underline',
                      }}
                    >
                      Re-escanear
                    </button>
                  </div>

                  {discoveredCameras.length === 0 ? (
                    <div
                      style={{
                        padding: '12px',
                        borderRadius: 8,
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        fontSize: 11,
                        color: '#94a3b8',
                        textAlign: 'center',
                      }}
                    >
                      No se encontraron cámaras activas automáticamente. Puedes ingresar la URL manual o seleccionar un preset debajo.
                    </div>
                  ) : (
                    discoveredCameras.map((cam) => {
                      const isCurrentSlot = cam.isAssignedSlot === targetSlot;
                      const isOtherSlot = cam.isAssignedSlot !== null && cam.isAssignedSlot !== targetSlot;

                      return (
                        <div
                          key={cam.id}
                          className={styles.discoveredCard}
                          style={{
                            background: isCurrentSlot
                              ? 'rgba(34, 197, 94, 0.12)'
                              : isOtherSlot
                              ? 'rgba(234, 179, 8, 0.08)'
                              : 'rgba(255, 255, 255, 0.03)',
                            borderColor: isCurrentSlot
                              ? 'rgba(34, 197, 94, 0.4)'
                              : isOtherSlot
                              ? 'rgba(234, 179, 8, 0.3)'
                              : 'rgba(255, 255, 255, 0.08)',
                          }}
                        >
                          <div className={styles.discoveredMeta}>
                            <div
                              className={styles.discoveredIcon}
                              style={{
                                color: isCurrentSlot ? '#4ade80' : isOtherSlot ? '#facc15' : '#94a3b8',
                              }}
                            >
                              {cam.type === 'remote' ? (
                                <Smartphone size={18} />
                              ) : cam.type === 'usb_virtual' ? (
                                <Video size={18} />
                              ) : (
                                <Wifi size={18} />
                              )}
                            </div>
                            <div>
                              <div className={styles.discoveredName}>{cam.name}</div>
                              <div
                                className={styles.discoveredSub}
                                style={{
                                  color: isCurrentSlot ? '#86efac' : isOtherSlot ? '#fde047' : '#94a3b8',
                                }}
                              >
                                {cam.status || cam.url}
                                {cam.isAssignedSlot !== null && (
                                  <span style={{ marginLeft: 6, fontWeight: 700 }}>
                                    (Asignada a CAM {cam.isAssignedSlot + 1})
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {isCurrentSlot ? (
                              <button
                                type="button"
                                onClick={() => onDisconnect(targetSlot)}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.2)',
                                  border: '1px solid rgba(239, 68, 68, 0.45)',
                                  color: '#f87171',
                                  padding: '5px 10px',
                                  borderRadius: 6,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                                title="Desconectar y eliminar de este slot"
                              >
                                <Trash2 size={12} /> Eliminar de CAM {targetSlot + 1}
                              </button>
                            ) : isOtherSlot ? (
                              <button
                                type="button"
                                className={styles.assignBtn}
                                style={{ background: '#eab308', color: '#000' }}
                                onClick={() => handleAssignDiscovered(cam)}
                              >
                                Mover a CAM {targetSlot + 1}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className={styles.assignBtn}
                                onClick={() => handleAssignDiscovered(cam)}
                              >
                                <Plus size={12} /> Asignar a CAM {targetSlot + 1}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>URL de transmisión directa (MJPEG / HLS / RTSP-HTTP):</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="url"
                    placeholder="http://192.168.1.1:8192/ o http://192.168.1.100:8080/video"
                    value={wifiUrl}
                    onChange={(e) => {
                      setWifiUrl(e.target.value);
                      setWifiConnectError(null);
                      setWifiConnectSuccess(null);
                    }}
                    className={styles.formInput}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className={styles.connectBtn}
                    onClick={() => handleConnectWifi()}
                    disabled={wifiConnecting || !wifiUrl.trim()}
                  >
                    {wifiConnecting ? <Loader2 size={13} className="animate-spin" /> : <Wifi size={13} />}
                    {wifiConnecting ? 'Conectando...' : 'Conectar'}
                  </button>
                </div>

                {wifiConnectSuccess && (
                  <div
                    style={{
                      marginTop: 8,
                      color: '#4ade80',
                      background: 'rgba(34, 197, 94, 0.12)',
                      border: '1px solid rgba(34, 197, 94, 0.35)',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Check size={14} />
                    <span>{wifiConnectSuccess}</span>
                  </div>
                )}

                {wifiConnectError && (
                  <div
                    style={{
                      marginTop: 8,
                      color: '#f87171',
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <AlertTriangle size={14} />
                    <span>{wifiConnectError}</span>
                  </div>
                )}
              </div>

              <div
                style={{
                  marginTop: 14,
                  padding: '12px 14px',
                  borderRadius: 8,
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  fontSize: 11,
                  color: '#93c5fd',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6, color: '#bfdbfe' }}>
                  <Info size={14} className="text-blue-400" />
                  Conexión directa de Cámara de Acción / Celular por Wi-Fi
                </div>
                <div>
                  <strong>Cámaras de Acción (ActionCam / GoPro / SJCam):</strong> Si tu cámara crea una red Wi-Fi propia (ej. <em>ActionCam_...</em>), primero conecta tu computadora a esa red en Windows con su contraseña (ej. <em>12345678</em>). La cámara asignará la IP local (habitualmente <code>http://192.168.1.1:8192/</code> o puerto <code>8080</code>). Ingresa esa dirección arriba y pulsa <strong>Conectar</strong>.
                </div>
                <div style={{ marginTop: 6 }}>
                  <strong>Conexión Directa USB (Recomendada):</strong> También puedes conectar la cámara por cable USB y en su pantalla seleccionar <em>Modo PC Cam / Cámara Web</em>. Aparecerá de inmediato en la pestaña <strong>USB / Capturadora</strong> sin latencia de red.
                </div>
              </div>
            </>
          )}

          {/* TAB REMOTE / QR */}
          {activeTab === 'remote' && (
            <div className={styles.remoteBox}>
              {isConnected && currentMeta?.type === 'remote' ? (
                <div className={styles.remoteConnectedBox}>
                  <div className={styles.remoteLiveBadge}>
                    <Radio size={14} />
                    <span>¡Cámara Remota Conectada en Vivo!</span>
                  </div>

                  <ModalVideoPreview stream={streams[targetSlot]} label={`CAM ${targetSlot + 1} Remota`} />

                  <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>
                    Transmitiendo señal HD y micrófono en tiempo real a CAM {targetSlot + 1}
                  </div>
                  <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                    Verifica aquí el encuadre, enfoque y distancia. El invitado o conductor remoto está conectado vía WebRTC de baja latencia.
                  </p>
                  <button
                    type="button"
                    className={styles.disconnectAction}
                    onClick={() => {
                      if (onDisconnect) onDisconnect(targetSlot);
                    }}
                  >
                    <Power size={13} /> Desconectar señal de este canal
                  </button>
                </div>
              ) : (
                <>
                  {/* PERSONALIZACIÓN DE INVITACIÓN */}
                  <div
                    style={{
                      marginBottom: 16,
                      padding: '12px 14px',
                      borderRadius: 10,
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      textAlign: 'left',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#e2e8f0',
                        marginBottom: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Smartphone size={14} className="text-cyan-400" />
                      Personalizar Invitación (Para Alumnos, Clases Virtuales o Invitados)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
                          Nombre de la persona (opcional):
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: Dra. Sofía / Juan Pérez"
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          className={styles.formInput}
                          style={{ fontSize: 12, padding: '7px 10px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
                          Rol en la sesión:
                        </label>
                        <select
                          value={guestRole}
                          onChange={(e) => setGuestRole(e.target.value)}
                          className={styles.formInput}
                          style={{ fontSize: 12, padding: '7px 10px', background: '#0f172a', color: '#f8fafc', cursor: 'pointer' }}
                        >
                          <option value="guest">Invitado</option>
                          <option value="student">Alumno / Clase</option>
                          <option value="cohost">Co-presentador</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Info size={12} className="text-cyan-400" />
                      El enlace se personalizará y cuando se conecte, CAM {targetSlot + 1} se etiquetará automáticamente.
                    </div>
                  </div>

                  {/* SELECTOR DOMINIO LOCAL VS CLOUD */}
                  <div
                    style={{
                      marginBottom: 14,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'rgba(234, 179, 8, 0.08)',
                      border: '1px solid rgba(234, 179, 8, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 8,
                      fontSize: 11,
                      color: '#fef08a',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Radio size={13} className="text-yellow-400" />
                      <span>
                        {useCloudDomain ? 'Enlace WebRTC listo para celular en cualquier red' : 'Enlace Servidor Local Wi-Fi'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => setUseCloudDomain(false)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          background: !useCloudDomain ? '#e8612a' : 'rgba(255,255,255,0.06)',
                          color: '#fff',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        🏠 Wi-Fi Local Directo
                      </button>
                      <button
                        type="button"
                        onClick={() => setUseCloudDomain(true)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          background: useCloudDomain ? '#38bdf8' : 'rgba(255,255,255,0.06)',
                          color: useCloudDomain ? '#000' : '#cbd5e1',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        🌐 Enlace Cloud / 4G
                      </button>
                    </div>
                  </div>

                  {/* INDICADOR EN VIVO DEL PROCESO DE CONEXIÓN */}
                  <div
                    style={{
                      marginBottom: 16,
                      padding: '12px 14px',
                      borderRadius: 12,
                      background: isConnected
                        ? 'rgba(16, 185, 129, 0.12)'
                        : 'rgba(56, 189, 248, 0.08)',
                      border: isConnected
                        ? '1px solid rgba(16, 185, 129, 0.35)'
                        : '1px solid rgba(56, 189, 248, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: isConnected ? '#059669' : '#0284c7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: isConnected ? '0 0 12px rgba(16,185,129,0.4)' : '0 0 12px rgba(56,189,248,0.3)',
                      }}
                    >
                      {isConnected ? (
                        <Check size={18} className="text-white" />
                      ) : (
                        <Radio size={18} className="text-white animate-pulse" />
                      )}
                    </div>
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: isConnected ? '#6ee7b7' : '#7dd3fc', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{isConnected ? `¡CAM ${targetSlot + 1} CONECTADA EN VIVO!` : `ESPERANDO CONEXIÓN EN CAM ${targetSlot + 1}...`}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, lineHeight: 1.35 }}>
                        {isConnected
                          ? 'Transmisión fluida y audio sincronizados en tiempo real.'
                          : 'Apunta la cámara de tu celular al código QR abajo. En cuanto el teléfono ingrese, se activará en vivo aquí.'}
                      </div>
                    </div>
                  </div>

                  {/* QR IMAGE */}
                  <div className={styles.qrWrap}>
                    {qrCodeDataUrl ? (
                      <img src={qrCodeDataUrl} alt="Escanear con smartphone" className={styles.qrImage} />
                    ) : (
                      <div className="w-[180px] h-[180px] flex items-center justify-center bg-white text-black text-xs font-bold rounded-lg">
                        Cargando QR...
                      </div>
                    )}
                  </div>

                  <div className={styles.remoteText}>
                    Escanea con la cámara de tu <strong>iPhone o Android</strong>. No necesitas instalar nada; se abrirá automáticamente la cámara de tu teléfono y se conectará en vivo a <strong>CAM {targetSlot + 1}</strong>.
                  </div>

                  {/* ACCIONES DE COMPARTIR */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button type="button" className={styles.copyUrlBtn} onClick={handleCopyLink}>
                      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                      {copied ? '¡Enlace copiado!' : 'Copiar enlace directo'}
                    </button>
                    <button
                      type="button"
                      className={styles.copyUrlBtn}
                      onClick={handleCopyInvite}
                      style={{ background: 'rgba(59, 130, 246, 0.15)', borderColor: '#3b82f6', color: '#93c5fd' }}
                      title="Copiar mensaje con instrucciones completas"
                    >
                      {copiedInvite ? <Check size={14} className="text-green-400" /> : <FileText size={14} />}
                      {copiedInvite ? '¡Invitación copiada!' : 'Copiar texto para Invitar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openExternalLink(`mailto:?subject=${encodeURIComponent(`Invitación en vivo PodcastStudio - CAM ${targetSlot + 1}`)}&body=${encodeURIComponent(invitationText)}`)}
                      className={styles.copyUrlBtn}
                      style={{ background: '#1e3a8a', color: '#fff', borderColor: '#3b82f6' }}
                    >
                      <Mail size={14} /> Enviar por Correo
                    </button>
                    <button
                      type="button"
                      onClick={() => openExternalLink(`https://wa.me/?text=${encodeURIComponent(`🎙️ ¡Conéctate en vivo como ${roleLabel} a PodcastStudio (CAM ${targetSlot + 1})!: ${remoteUrl}`)}`)}
                      className={styles.copyUrlBtn}
                      style={{ background: '#166534', color: '#fff', borderColor: '#22c55e' }}
                    >
                      <MessageCircle size={14} /> Enviar por WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => openExternalLink(remoteUrl)}
                      className={styles.copyUrlBtn}
                    >
                      <ExternalLink size={14} /> Probar en navegador
                    </button>
                  </div>

                  {/* AVISO DE DISTANCIA */}
                  <div
                    style={{
                      marginTop: 14,
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'rgba(34, 197, 94, 0.08)',
                      border: '1px solid rgba(34, 197, 94, 0.25)',
                      fontSize: 11,
                      color: '#86efac',
                      lineHeight: 1.45,
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6, color: '#4ade80' }}>
                      <Radio size={13} />
                      ¿El celular está en otra ubicación o con datos móviles (4G/5G)?
                    </div>
                    <div>
                      <strong>¡Funciona a cualquier distancia!</strong> No necesitan estar en la misma red Wi-Fi. Solo copia el enlace o envíaselo por WhatsApp. La otra persona abre el link en su navegador (Safari en iPhone o Chrome en Android), pulsa <em>"Activar Cámara y Conectar"</em> y listo: su video HD y micrófono entrarán de inmediato en CAM {targetSlot + 1}.
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB SETTINGS */}
          {activeTab === 'settings' && (
            <>
              <form onSubmit={handleSaveLabel} className={styles.formGroup}>
                <label className={styles.formLabel}>Etiqueta o nombre del tiro (ej. Conductor, Invitado, Cenital):</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder={`CAM ${targetSlot + 1}`}
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    className={styles.formInput}
                    style={{ flex: 1 }}
                  />
                  <button type="submit" className={styles.connectBtn}>
                    <Save size={13} /> Guardar
                  </button>
                </div>
              </form>

              <div className={styles.formGroup} style={{ marginTop: 10 }}>
                <label className={styles.formLabel}>Rol en el Switcher:</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    className={`${styles.connectBtn} ${isMaster ? styles.connectBtnConnected : ''}`}
                    onClick={() => onSetMaster && onSetMaster(targetSlot)}
                  >
                    <Star size={13} />
                    {isMaster ? '★ Cámara Master Actual' : 'Designar como Cámara Master'}
                  </button>
                  <span style={{ fontSize: 11, color: '#888' }}>
                    (La cámara master es el plano general de referencia)
                  </span>
                </div>
              </div>
            </>
          )}

          {/* FOOTER ACTIONS */}
          <div className={styles.actionsRow}>
            <div style={{ fontSize: 11, color: '#aaa' }}>
              Estado:{' '}
              <strong style={{ color: isConnected ? '#22c55e' : '#888' }}>
                {isConnected ? `Conectada (${currentMeta?.type || 'Activa'})` : 'Sin señal'}
              </strong>
            </div>
            {isConnected && onDisconnect && (
              <button
                type="button"
                className={styles.disconnectAction}
                onClick={() => onDisconnect(targetSlot)}
              >
                <Power size={13} /> Desconectar señal de CAM {targetSlot + 1}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
