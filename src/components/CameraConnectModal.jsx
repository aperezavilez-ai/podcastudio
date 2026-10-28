import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  Trash2,
  Camera
} from 'lucide-react';
import jsQR from 'jsqr';
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
  onOpenRemoteControl,
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
  const [copiedSlotNumber, setCopiedSlotNumber] = useState(null);
  const [autoAssignMode, setAutoAssignMode] = useState(true);
  const [ipadRemoteQrUrl, setIpadRemoteQrUrl] = useState('');
  const [useIpadLocalNetwork, setUseIpadLocalNetwork] = useState(false);
  const ipadRemoteLink = 'https://www.podcastudio.mx/control?room=master_studio';
  const [copiedIpadRemote, setCopiedIpadRemote] = useState(false);

  // CÁMARAS IP / WI-FI REALES DETECTADAS EN LA RED LOCAL (ONVIF, RTSP, STEREN)
  const [realNetworkCameras, setRealNetworkCameras] = useState([]);
  const [isScanningRealCameras, setIsScanningRealCameras] = useState(false);
  const [hasScannedRealCameras, setHasScannedRealCameras] = useState(false);

  // Formulario Universal de Registro de Cámaras
  const [regCamName, setRegCamName] = useState('');
  const [regCamProto, setRegCamProto] = useState('rtsp');
  const [regCamIp, setRegCamIp] = useState('');
  const [regCamPort, setRegCamPort] = useState('554');
  const [regCamUser, setRegCamUser] = useState('admin');
  const [regCamPass, setRegCamPass] = useState('');
  const [regCamPath, setRegCamPath] = useState('/live');
  const [showRegPass, setShowRegPass] = useState(false);
  const [registeredCameras, setRegisteredCameras] = useState(() => {
    try {
      const saved = localStorage.getItem('podcastudio_registered_cameras');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Escáner de Códigos QR de Cámaras (usando la cámara del iPad o PC)
  const [isScanningQrWithCam, setIsScanningQrWithCam] = useState(false);
  const [qrScanError, setQrScanError] = useState(null);
  const [qrScanSuccess, setQrScanSuccess] = useState(null);
  const qrVideoRef = useRef(null);
  const qrStreamRef = useRef(null);
  const qrAnimRef = useRef(null);
  const qrCanvasRef = useRef(null);

  const stopQrCamScanner = useCallback(() => {
    if (qrAnimRef.current) {
      cancelAnimationFrame(qrAnimRef.current);
      qrAnimRef.current = null;
    }
    if (qrStreamRef.current) {
      qrStreamRef.current.getTracks().forEach(t => t.stop());
      qrStreamRef.current = null;
    }
    setIsScanningQrWithCam(false);
  }, []);

  const startQrCamScanner = useCallback(async () => {
    setIsScanningQrWithCam(true);
    setQrScanError(null);
    setQrScanSuccess(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      qrStreamRef.current = stream;
      if (qrVideoRef.current) {
        qrVideoRef.current.srcObject = stream;
        qrVideoRef.current.setAttribute('playsinline', 'true');
        qrVideoRef.current.play().catch(() => {});
      }

      const scanFrame = () => {
        if (!qrVideoRef.current || !qrStreamRef.current) return;
        const video = qrVideoRef.current;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          if (!qrCanvasRef.current) {
            qrCanvasRef.current = document.createElement('canvas');
          }
          const canvas = qrCanvasRef.current;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            });
            if (code && code.data && code.data.trim()) {
              const scannedText = code.data.trim();
              setQrScanSuccess(`¡Código QR leído con éxito!: ${scannedText.slice(0, 40)}...`);
              stopQrCamScanner();
              setWifiUrl(scannedText);
              if (scannedText.startsWith('http://') || scannedText.startsWith('https://') || scannedText.startsWith('rtsp://')) {
                onWifiConnect?.(scannedText, targetSlot, `Cámara QR (CAM ${targetSlot + 1})`);
              }
              return;
            }
          }
        }
        qrAnimRef.current = requestAnimationFrame(scanFrame);
      };
      qrAnimRef.current = requestAnimationFrame(scanFrame);
    } catch (err) {
      setQrScanError('No se pudo acceder a la cámara para escanear QR: ' + (err.message || 'Permiso denegado'));
      setIsScanningQrWithCam(false);
    }
  }, [targetSlot, onWifiConnect, stopQrCamScanner]);

  useEffect(() => {
    if (!open) {
      stopQrCamScanner();
    }
  }, [open, stopQrCamScanner]);

  const activeIpadLink = useMemo(() => {
    if (useIpadLocalNetwork && localQrUrl) {
      try {
        const parsed = new URL(localQrUrl);
        return `${parsed.protocol}//${parsed.host}/control`;
      } catch {
        return localQrUrl.includes('/control') ? localQrUrl : `${localQrUrl.replace(/\/[^/]*$/, '')}/control`;
      }
    }
    return ipadRemoteLink;
  }, [useIpadLocalNetwork, localQrUrl, ipadRemoteLink]);

  useEffect(() => {
    QRCode.toDataURL(activeIpadLink, { 
      width: 320, 
      margin: 3, 
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' } 
    })
      .then(url => setIpadRemoteQrUrl(url))
      .catch(() => {
        setIpadRemoteQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=15&data=${encodeURIComponent(activeIpadLink)}`);
      });
  }, [activeIpadLink]);

  // Encontrar el siguiente slot disponible (libre de señal y metadatos)
  const getNextAvailableSlot = useCallback((preferredSlot) => {
    const isOccupied = (s) => Boolean(streams[s]) || Boolean(cameraMeta[s]?.deviceId || cameraMeta[s]?.url);
    
    // Si preferredSlot > 0 y está libre, usarlo directamente
    if (preferredSlot != null && preferredSlot > 0 && !isOccupied(preferredSlot)) {
      return preferredSlot;
    }

    // Buscar primer slot libre entre 1 y slotsCount - 1 (para cámaras remotas/invitados)
    for (let s = 1; s < slotsCount; s++) {
      if (!isOccupied(s)) {
        return s;
      }
    }

    // Si slots 1..N están ocupados pero slot 0 está desocupado
    if (!isOccupied(0)) {
      return 0;
    }

    // Si todos los slots están llenos y se pueden añadir más
    if (slotsCount < 12 && onAddSlot) {
      onAddSlot();
      return slotsCount;
    }

    return preferredSlot != null ? preferredSlot : 1;
  }, [streams, cameraMeta, slotsCount, onAddSlot]);

  // Si se abre la pestaña de celular y el slot actual está ocupado o es CAM 1, sugerir el siguiente libre
  useEffect(() => {
    if (open && activeTab === 'remote') {
      const isOccupied = Boolean(streams[targetSlot]) || Boolean(cameraMeta[targetSlot]?.deviceId || cameraMeta[targetSlot]?.url);
      if (targetSlot === 0 && isOccupied) {
        const nextFree = getNextAvailableSlot(targetSlot);
        if (nextFree !== targetSlot) {
          setTargetSlot(nextFree);
        }
      }
    }
  }, [open, activeTab, targetSlot, streams, cameraMeta, getNextAvailableSlot]);

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
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const isConnected = Boolean(streams[targetSlot]);
  const isMaster = targetSlot === masterCameraSlot;
  const currentMeta = cameraMeta[targetSlot];

  // Generador de URL Remota para cualquier slot (Wi-Fi Local Directo o Enlace Cloud Seguro)
  const generateRemoteUrl = useCallback((slotIdx) => {
    if (!useCloudDomain && localQrUrl && !localQrUrl.includes('remote-cam')) {
      return localQrUrl;
    }
    const base = 'https://www.podcastudio.mx/remote-cam';
    if (autoAssignMode) {
      const params = new URLSearchParams({ auto: 'true' });
      if (guestName.trim()) params.set('name', guestName.trim());
      if (guestRole && guestRole !== 'guest') params.set('role', guestRole);
      return `${base}?${params.toString()}`;
    }
    const params = new URLSearchParams({
      slot: String(slotIdx + 1),
      room: `studio_cam_${slotIdx + 1}`,
    });
    if (guestName.trim()) params.set('name', guestName.trim());
    if (guestRole && guestRole !== 'guest') params.set('role', guestRole);
    return `${base}?${params.toString()}`;
  }, [guestName, guestRole, useCloudDomain, localQrUrl, autoAssignMode]);

  const remoteUrl = useMemo(() => generateRemoteUrl(targetSlot), [generateRemoteUrl, targetSlot]);

  // Generación de QR Data URL de alta definición para escaneo instantáneo en cualquier celular Android / iOS
  useEffect(() => {
    if (remoteUrl) {
      QRCode.toDataURL(remoteUrl, { 
        width: 320, 
        margin: 3, 
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' } 
      })
        .then((url) => setQrCodeDataUrl(url))
        .catch(() => {
          setQrCodeDataUrl(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=15&data=${encodeURIComponent(remoteUrl)}`);
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

  const handleConnectWifi = async (urlToConnect, slotOverride, labelOverride) => {
    const url = (urlToConnect || wifiUrl)?.trim();
    const slot = typeof slotOverride === 'number' ? slotOverride : targetSlot;
    const label = labelOverride || customLabel.trim() || `WiFi Cam ${slot + 1}`;
    if (!url || !onWifiConnect) return;
    setWifiConnecting(true);
    setWifiConnectError(null);
    setWifiConnectSuccess(null);
    try {
      const resStream = await onWifiConnect(url, slot, label);
      if (resStream) {
        setWifiConnectSuccess(`¡Conectado exitosamente a CAM ${slot + 1}!`);
      } else {
        setWifiConnectError('No se pudo establecer el stream de video desde esa URL. Verifica que la cámara esté encendida y accesible.');
      }
    } catch (err) {
      setWifiConnectError(err.message || 'Error al conectar con la cámara IP/WiFi.');
    } finally {
      setWifiConnecting(false);
    }
  };

  const handleSaveRegisteredCamera = () => {
    if (!regCamIp.trim()) {
      setWifiConnectError('Por favor ingresa la IP o dirección de la cámara.');
      return;
    }
    const port = regCamPort.trim() || (regCamProto === 'rtsp' ? '554' : regCamProto === 'action' ? '8192' : '8080');
    const path = regCamPath.trim() || (regCamProto === 'rtsp' ? '/live' : regCamProto === 'action' ? '/' : '/video');
    const newCam = {
      id: `cam_reg_${Date.now()}`,
      name: regCamName.trim() || `Cámara IP (${regCamIp.trim()})`,
      proto: regCamProto,
      ip: regCamIp.trim(),
      port,
      user: regCamUser.trim(),
      pass: regCamPass.trim(),
      path,
    };
    const updated = [newCam, ...registeredCameras.filter(c => c.ip !== newCam.ip || c.port !== newCam.port)];
    setRegisteredCameras(updated);
    try {
      localStorage.setItem('podcastudio_registered_cameras', JSON.stringify(updated));
    } catch {}
    setWifiConnectSuccess(`¡Cámara "${newCam.name}" guardada en tu lista permanente!`);
  };

  const handleDeleteRegisteredCamera = (id) => {
    const updated = registeredCameras.filter(c => c.id !== id);
    setRegisteredCameras(updated);
    try {
      localStorage.setItem('podcastudio_registered_cameras', JSON.stringify(updated));
    } catch {}
  };

  const handleConnectRegisteredCamera = async (cam, slot = targetSlot) => {
    let fullUrl = '';
    const userPass = cam.user ? `${encodeURIComponent(cam.user)}${cam.pass ? ':' + encodeURIComponent(cam.pass) : ''}@` : '';
    const cleanPath = cam.path ? (cam.path.startsWith('/') ? cam.path : `/${cam.path}`) : '';
    if (cam.proto === 'rtsp') {
      fullUrl = `rtsp://${userPass}${cam.ip}:${cam.port || '554'}${cleanPath || '/live'}`;
    } else {
      fullUrl = `http://${userPass}${cam.ip}:${cam.port || '8080'}${cleanPath || '/'}`;
    }
    setWifiUrl(fullUrl);
    await handleConnectWifi(fullUrl, slot, `${cam.name} (CAM ${slot + 1})`);
  };

  const handleConnectFromForm = async () => {
    if (!regCamIp.trim()) {
      setWifiConnectError('Ingresa la IP de la cámara para conectar.');
      return;
    }
    const port = regCamPort.trim() || (regCamProto === 'rtsp' ? '554' : regCamProto === 'action' ? '8192' : '8080');
    const path = regCamPath.trim() || (regCamProto === 'rtsp' ? '/live' : regCamProto === 'action' ? '/' : '/video');
    const userPass = regCamUser.trim() ? `${encodeURIComponent(regCamUser.trim())}${regCamPass.trim() ? ':' + encodeURIComponent(regCamPass.trim()) : ''}@` : '';
    const cleanPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';

    let fullUrl = '';
    if (regCamProto === 'rtsp') {
      fullUrl = `rtsp://${userPass}${regCamIp.trim()}:${port}${cleanPath}`;
    } else {
      fullUrl = `http://${userPass}${regCamIp.trim()}:${port}${cleanPath}`;
    }
    setWifiUrl(fullUrl);
    await handleConnectWifi(fullUrl, targetSlot, regCamName.trim() || `Cámara WiFi (CAM ${targetSlot + 1})`);
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
          labelLower.includes('obs virtual') ||
          labelLower.includes('steren') ||
          labelLower.includes('wifi') ||
          labelLower.includes('wireless') ||
          labelLower.includes('ip camera') ||
          labelLower.includes('network');

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

  // ESCANEO REAL DE CÁMARAS IP / WI-FI EN LA RED LOCAL (ONVIF, RTSP, STEREN)
  const handleDiscoverRealCameras = async () => {
    setIsScanningRealCameras(true);
    setHasScannedRealCameras(true);
    try {
      if (typeof window !== 'undefined' && window.api?.discoverNetworkCameras) {
        const res = await window.api.discoverNetworkCameras();
        if (res && res.success && Array.isArray(res.cameras)) {
          setRealNetworkCameras(res.cameras);
        } else {
          setRealNetworkCameras([]);
        }
      } else {
        setRealNetworkCameras([]);
      }
    } catch (err) {
      console.warn('Error escaneando cámaras de red reales:', err);
      setRealNetworkCameras([]);
    } finally {
      setIsScanningRealCameras(false);
    }
  };

  useEffect(() => {
    if (open && activeTab === 'wifi') {
      handleDiscoverRealCameras();
    }
  }, [open, activeTab]);

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
    // Si targetSlot está ocupado o es slot 0 con señal, asignar inteligentemente al siguiente slot libre
    let slotToAssign = targetSlot;
    const isOccupied = Boolean(streams[slotToAssign]) || Boolean(cameraMeta[slotToAssign]?.deviceId || cameraMeta[slotToAssign]?.url);
    if (slotToAssign === 0 || isOccupied) {
      slotToAssign = getNextAvailableSlot(targetSlot);
      setTargetSlot(slotToAssign);
    }

    const assignedUrl = generateRemoteUrl(slotToAssign);
    const ok = await copyTextToClipboard(assignedUrl);
    if (ok) {
      setCopiedSlotNumber(slotToAssign + 1);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const roleNameMap = {
    guest: 'Invitado Especial',
    student: 'Alumno / Clase Virtual',
    cohost: 'Co-presentador',
  };
  const roleLabel = roleNameMap[guestRole] || 'Invitado';

  const invitationText = useMemo(() => {
    return `🎙️ Invitación para unirte en vivo a PodcastStudio (${roleLabel} - CAM ${targetSlot + 1})

${guestName.trim() ? `Hola ${guestName.trim()}, ` : 'Hola, '}te invito a conectarte en vivo con tu cámara y micrófono como ${guestRole === 'student' ? 'alumno a la clase virtual' : guestRole === 'cohost' ? 'co-presentador' : 'invitado'}:

👉 Enlace de acceso directo:
${remoteUrl}

Instrucciones:
1. Abre el enlace en tu celular o computadora (Safari en iPhone, Chrome en Android/PC).
2. Permite el acceso a tu cámara y micrófono cuando te lo solicite el navegador.
3. Presiona "Activar Cámara y Conectar".
¡Listo! Tu video y voz entrarán en vivo al estudio en CAM ${targetSlot + 1}.`;
  }, [guestName, guestRole, roleLabel, targetSlot, remoteUrl]);

  const handleCopyInvite = async () => {
    let slotToAssign = targetSlot;
    const isOccupied = Boolean(streams[slotToAssign]) || Boolean(cameraMeta[slotToAssign]?.deviceId || cameraMeta[slotToAssign]?.url);
    if (slotToAssign === 0 || isOccupied) {
      slotToAssign = getNextAvailableSlot(targetSlot);
      setTargetSlot(slotToAssign);
    }

    const assignedUrl = generateRemoteUrl(slotToAssign);
    const inviteText = `🎙️ Invitación para unirte en vivo a PodcastStudio (${roleLabel} - CAM ${slotToAssign + 1})

${guestName.trim() ? `Hola ${guestName.trim()}, ` : 'Hola, '}te invito a conectarte en vivo con tu cámara y micrófono como ${guestRole === 'student' ? 'alumno a la clase virtual' : guestRole === 'cohost' ? 'co-presentador' : 'invitado'}:

👉 Enlace de acceso directo:
${assignedUrl}

Instrucciones:
1. Abre el enlace en tu celular o computadora (Safari en iPhone, Chrome en Android/PC).
2. Permite el acceso a tu cámara y micrófono cuando te lo solicite el navegador.
3. Presiona "Activar Cámara y Conectar".
¡Listo! Tu video y voz entrarán en vivo al estudio en CAM ${slotToAssign + 1}.`;

    const ok = await copyTextToClipboard(inviteText);
    if (ok) {
      setCopiedSlotNumber(slotToAssign + 1);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 3000);
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
    <div 
      className={styles.backdrop} 
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }} 
      role="presentation"
    >
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
          <button 
            type="button" 
            className={styles.closeBtn} 
            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onClose?.(); }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose?.(); }} 
            aria-label="Cerrar ventana"
            title="Cerrar ventana (Esc)"
          >
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
            {slotsCount < 12 && onAddSlot && (
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

          {/* TAB WIFI: ESCANEO Y CONEXIÓN REAL DE CÁMARAS IP / WI-FI */}
          {activeTab === 'wifi' && (
            <>
              {/* PASO 1: BOTÓN DE BÚSQUEDA REAL DE CÁMARAS IP / WI-FI */}
              <div className={styles.scannerBanner} style={{ background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.15), rgba(15, 23, 42, 0.8))', border: '1.5px solid rgba(234, 88, 12, 0.45)' }}>
                <div className={styles.scannerInfo}>
                  <div className={styles.scannerTitle} style={{ color: '#fed7aa' }}>
                    <Wifi size={17} className="text-orange-500" />
                    <span>Búsqueda de Cámaras IP / Wi-Fi en Red Local</span>
                  </div>
                  <span className={styles.scannerSub}>
                    Detecta cámaras activas en tu red local vía ONVIF WS-Discovery y sondeo de puertos RTSP / Steren
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.scanBtn}
                  onClick={handleDiscoverRealCameras}
                  disabled={isScanningRealCameras}
                  style={{ background: 'linear-gradient(135deg, #ea580c, #c2410c)', boxShadow: '0 4px 14px rgba(234, 88, 12, 0.35)' }}
                >
                  {isScanningRealCameras ? (
                    <>
                      <Loader2 size={13} className="animate-spin" /> Buscando cámaras...
                    </>
                  ) : (
                    <>
                      <Search size={13} /> Buscar Cámaras Wi-Fi
                    </>
                  )}
                </button>
              </div>

              {/* PASO 2: RECUADRO CON CÁMARAS IP / WI-FI REALES DETECTADAS */}
              <div style={{
                marginBottom: 16,
                padding: '14px',
                borderRadius: 12,
                background: '#0c0f17',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Camera size={15} className="text-orange-400" />
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc' }}>
                      Cámaras Detectadas en Red Local ({realNetworkCameras.length})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDiscoverRealCameras}
                    disabled={isScanningRealCameras}
                    style={{ background: 'none', border: 'none', color: '#ea580c', fontSize: 11, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Actualizar
                  </button>
                </div>

                {isScanningRealCameras ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                    <Loader2 size={24} className="animate-spin text-orange-500" style={{ margin: '0 auto 8px' }} />
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Sondeando subred local...</div>
                    <div style={{ fontSize: 11 }}>Enviando paquetes ONVIF WS-Discovery y verificando puertos 554, 8192 y 8000</div>
                  </div>
                ) : !hasScannedRealCameras ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                    Presiona el botón <strong>"Buscar Cámaras Wi-Fi"</strong> para rastrear dispositivos en tu red.
                  </div>
                ) : realNetworkCameras.length === 0 ? (
                  <div style={{ padding: '20px 14px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px dashed rgba(255,255,255,0.1)' }}>
                    <AlertTriangle size={22} style={{ display: 'block', margin: '0 auto 6px', color: '#f59e0b' }} />
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc', marginBottom: 4 }}>
                      No se detectaron cámaras en tu red local
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4, maxWidth: 420, margin: '0 auto' }}>
                      Asegúrate de que la cámara (Steren, ONVIF, Hikvision o Wi-Fi) esté encendida y conectada al mismo módem o router que esta computadora. O ingresa su enlace directo RTSP abajo.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {realNetworkCameras.map((cam) => {
                      const isAssigned = Object.entries(cameraMeta).some(([slotStr, meta]) => meta?.url === cam.url);
                      return (
                        <div
                          key={cam.id || cam.url}
                          style={{
                            padding: '12px 14px',
                            borderRadius: 10,
                            background: 'rgba(234, 88, 12, 0.08)',
                            border: '1.5px solid rgba(234, 88, 12, 0.45)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: 8,
                                background: '#ea580c',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}
                            >
                              <Camera size={18} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc' }}>
                                  {cam.name}
                                </span>
                                <span style={{ fontSize: 9.5, padding: '2px 7px', borderRadius: 9999, background: '#1e293b', color: '#38bdf8', fontWeight: 800, border: '1px solid rgba(56,189,248,0.3)' }}>
                                  {cam.protocol || 'RTSP'}
                                </span>
                              </div>
                              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, fontFamily: 'monospace' }}>
                                {cam.url}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={async () => {
                              let targetUrl = cam.url;
                              if (cam.protocol === 'RTSP' || cam.port === 554) {
                                const pass = window.prompt(`Cámara detectada en ${cam.ip}.\n\nIngresa la contraseña configurada en la app Steren Home (si no pusiste contraseña, déjalo vacío y presiona Aceptar):`, '');
                                if (pass === null) return;
                                if (pass.trim()) {
                                  targetUrl = `rtsp://admin:${encodeURIComponent(pass.trim())}@${cam.ip}:554/live/ch0`;
                                } else {
                                  targetUrl = `rtsp://${cam.ip}:554/live/ch0`;
                                }
                              }
                              setWifiUrl(targetUrl);
                              await handleConnectWifi(targetUrl, targetSlot, `${cam.name} (CAM ${targetSlot + 1})`);
                            }}
                            disabled={wifiConnecting}
                            style={{
                              padding: '7px 14px',
                              borderRadius: 6,
                              background: '#ea580c',
                              color: '#fff',
                              border: 'none',
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              flexShrink: 0
                            }}
                          >
                            Asignar a CAM {targetSlot + 1}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* CONEXIÓN DIRECTA POR URL / IP (RTSP O HTTP) */}
              <div style={{
                padding: '12px 14px',
                borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                marginBottom: 12
              }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
                  O ingresar enlace directo de cámara (RTSP o HTTP):
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="url"
                    placeholder="ej. http://192.168.1.1:8192/ o rtsp://admin:pass@192.168.1.50:554/live/ch0"
                    value={wifiUrl}
                    onChange={(e) => {
                      setWifiUrl(e.target.value);
                      setWifiConnectError(null);
                      setWifiConnectSuccess(null);
                    }}
                    className={styles.formInput}
                    style={{ flex: 1, fontSize: 12 }}
                  />
                  <button
                    type="button"
                    className={styles.connectBtn}
                    onClick={() => handleConnectWifi()}
                    disabled={wifiConnecting || !wifiUrl.trim()}
                    style={{ padding: '7px 16px', fontSize: 12, fontWeight: 800 }}
                  >
                    {wifiConnecting ? <Loader2 size={13} className="animate-spin" /> : <Wifi size={13} />}
                    {wifiConnecting ? 'Conectando...' : `Conectar a CAM ${targetSlot + 1}`}
                  </button>
                </div>

                {wifiConnectSuccess && (
                  <div style={{ marginTop: 8, color: '#4ade80', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Check size={14} /> <span>{wifiConnectSuccess}</span>
                  </div>
                )}
                {wifiConnectError && (
                  <div style={{ marginTop: 8, color: '#f87171', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <AlertTriangle size={14} /> <span>{wifiConnectError}</span>
                  </div>
                )}
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

                  {/* SELECTOR DE MODO DE ASIGNACIÓN */}
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 12 }}>
                    <button
                      type="button"
                      onClick={() => setAutoAssignMode(true)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: autoAssignMode ? '#ea580c' : 'rgba(255,255,255,0.06)',
                        color: autoAssignMode ? '#fff' : '#94a3b8',
                        border: autoAssignMode ? '1px solid #ea580c' : '1px solid rgba(255,255,255,0.1)',
                        transition: 'all 0.15s ease'
                      }}
                      title="Permite que varios celulares escaneen el mismo QR y cada uno se conecte a la siguiente cámara libre"
                    >
                      ⚡ Auto-Asignación (Recomendado)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAutoAssignMode(false)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: !autoAssignMode ? '#0284c7' : 'rgba(255,255,255,0.06)',
                        color: !autoAssignMode ? '#fff' : '#94a3b8',
                        border: !autoAssignMode ? '1px solid #0284c7' : '1px solid rgba(255,255,255,0.1)',
                        transition: 'all 0.15s ease'
                      }}
                      title={`Fijar este enlace únicamente para entrar en CAM ${targetSlot + 1}`}
                    >
                      🎯 Fijo a CAM {targetSlot + 1}
                    </button>
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
                    {autoAssignMode ? (
                      <span>Escanea con tu celular o tablet. Si conectas varios dispositivos con este mismo código, cada uno tomará <strong>la siguiente ranura libre (CAM 2, 3, 4...)</strong> sin pisarse.</span>
                    ) : (
                      <span>Escanea con tu smartphone. Se abrirá la cámara de tu teléfono y se conectará exclusivamente a <strong>CAM {targetSlot + 1}</strong>.</span>
                    )}
                  </div>

                  {/* ENLACE DIRECTO VISIBLE */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'rgba(0,0,0,0.5)',
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    maxWidth: 420,
                    margin: '8px auto'
                  }}>
                    <span style={{ fontSize: 11, color: '#38bdf8', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {remoteUrl}
                    </span>
                  </div>

                  {/* ACCIONES DE COMPARTIR */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button type="button" className={styles.copyUrlBtn} onClick={handleCopyLink}>
                      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                      {copied ? `¡Enlace copiado para CAM ${copiedSlotNumber || (targetSlot + 1)}!` : 'Copiar enlace directo'}
                    </button>
                    <button
                      type="button"
                      className={styles.copyUrlBtn}
                      onClick={handleCopyInvite}
                      style={{ background: 'rgba(59, 130, 246, 0.15)', borderColor: '#3b82f6', color: '#93c5fd' }}
                      title="Copiar mensaje con instrucciones completas"
                    >
                      {copiedInvite ? <Check size={14} className="text-green-400" /> : <FileText size={14} />}
                      {copiedInvite ? `¡Invitación copiada para CAM ${copiedSlotNumber || (targetSlot + 1)}!` : 'Copiar texto para Invitar'}
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
