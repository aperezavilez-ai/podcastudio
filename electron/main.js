process.on('uncaughtException', (err) => {
  console.warn('[Electron Main Process UncaughtException]', err?.message || err);
});
process.on('unhandledRejection', (reason) => {
  console.warn('[Electron Main Process UnhandledRejection]', reason);
});

const { app, BrowserWindow, Menu, ipcMain, session, shell } = require('electron');
Menu.setApplicationMenu(null);
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const net = require('net');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const express = require('express');
const https = require('https');
const selfsigned = require('selfsigned');
const { WebSocketServer } = require('ws');
const os = require('os');

// Configurar App ID oficial para Windows para asociar el icono de PodcastStudio en la barra de tareas
if (process.platform === 'win32') {
  app.setAppUserModelId("com.podcaststudio.app");
}
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');

ffmpeg.setFfmpegPath(ffmpegPath);
let mainWindow;
let ffmpegRecordProcess = null;
let ffmpegStreamProcess = null;
let wss = null;

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  let bestIp = '127.0.0.1';
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const nameLower = name.toLowerCase();
        if (nameLower.includes('vbox') || nameLower.includes('vmware') || nameLower.includes('loopback')) continue;
        if (iface.address.startsWith('192.168.') || iface.address.startsWith('10.') || iface.address.startsWith('172.')) return iface.address;
      }
    }
  }
  return bestIp;
}
const LOCAL_IP = getLocalIP();

function getCertificates() {
  try {
    const certCachePath = path.join(app.getPath('userData'), 'podcaststudio_cert.json');
    if (fs.existsSync(certCachePath)) {
      const data = JSON.parse(fs.readFileSync(certCachePath, 'utf8'));
      if (data.key && data.cert && data.ip === LOCAL_IP) {
        return { key: data.key, cert: data.cert };
      }
    }
  } catch (e) {}

  try {
    const pems = selfsigned.generate([{ name: 'commonName', value: LOCAL_IP }], {
      days: 365, keySize: 1024,
      extensions: [
        { name: 'basicConstraints', cA: true },
        { name: 'keyUsage', keyCertSign: true, digitalSignature: true, keyEncipherment: true },
        { name: 'extKeyUsage', serverAuth: true },
        { name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }, { type: 7, ip: LOCAL_IP }] }
      ]
    });
    try {
      const certCachePath = path.join(app.getPath('userData'), 'podcaststudio_cert.json');
      fs.writeFileSync(certCachePath, JSON.stringify({ key: pems.private, cert: pems.cert, ip: LOCAL_IP }), 'utf8');
    } catch (e) {}
    return { key: pems.private, cert: pems.cert };
  } catch (e) {
    return null;
  }
}

function createWindow() {
  let iconPath = path.join(__dirname, '../icon.ico');
  if (!fs.existsSync(iconPath)) {
    iconPath = path.join(process.resourcesPath || __dirname, 'icon.ico');
  }
  if (!fs.existsSync(iconPath)) {
    iconPath = path.join(__dirname, '../icon.png');
  }

  mainWindow = new BrowserWindow({
    width: 1500, height: 900, title: "PodcastStudio",
    icon: iconPath,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a0a0a',
      symbolColor: '#ffffff',
      height: 38
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    backgroundColor: '#0a0a0a',
  });

  mainWindow.setMenu(null);
  if (mainWindow.removeMenu) mainWindow.removeMenu();

  if (iconPath && fs.existsSync(iconPath)) {
    try { mainWindow.setIcon(iconPath); } catch (e) {}
  }

  const showWindowSafely = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
      mainWindow.focus();
    }
  };

  // Mostrar inmediatamente al estar listo el renderizado (<300ms)
  mainWindow.once('ready-to-show', showWindowSafely);
  ipcMain.once('app-ui-ready', showWindowSafely);

  // Failsafe rápido de seguridad (1.5s máximo) por si algún evento se demora
  setTimeout(showWindowSafely, 1500);

  if (process.env.NODE_ENV !== 'development') {
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow.webContents.closeDevTools();
    });
  }

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost') && !url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });
  session.defaultSession.on('select-serial-port', (event, portList, webContents, callback) => {
    event.preventDefault();
    if (portList && portList.length > 0) callback(portList[0].portId);
    else callback('');
  });
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    return true;
  });
  session.defaultSession.setDevicePermissionHandler(() => true);

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

const http = require('http');

const mobileClients = new Map();
const remoteControlClients = new Set();
const tallyClients = new Set();
const programFeedClients = new Set();
let latestStudioState = null;
let latestPgmFrame = null;
let currentTallyState = {
  pgmCam: 1,
  pvwCam: 2,
  dualMode: false,
  cams: { 1: 'pgm', 2: 'pvw', 3: 'off', 4: 'off', 5: 'off', 6: 'off', 7: 'off', 8: 'off', 9: 'off', 10: 'off', 11: 'off', 12: 'off' }
};
let currentPrompterScript = 'Bienvenido a PodcastStudio Broadcast Pro.\n\nHoy conversaremos sobre los últimos avances en producción virtual, inteligencia artificial y realización multicámara.\n\nMantén la mirada fija en este recuadro para conservar un contacto visual 100% natural con tu audiencia.';
let httpWsServer = null;

function startMediaServer() {
  const appServer = express();
  const certs = getCertificates() || { key: '', cert: '' };
  const server = https.createServer(certs, appServer);
  
  // Servir estáticos de la aplicación web (dist) para dispositivos en la LAN (iPad, tablets)
  const distPath = path.join(__dirname, '../dist');
  if (fs.existsSync(distPath)) {
    appServer.use(express.static(distPath));
    appServer.get(['/control', '/mando'], (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Transcodificador universal RTSP a MJPEG vía FFmpeg para cámaras Steren / Chinas / IP
  appServer.get('/api/rtsp-stream', (req, res) => {
    const rtspUrl = req.query.url;
    if (!rtspUrl) return res.status(400).send('Missing url');

    res.writeHead(200, {
      'Content-Type': 'multipart/x-mixed-replace; boundary=--ffmpegframe',
      'Connection': 'close',
      'Pragma': 'no-cache',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    });

    const ffProc = spawn(ffmpegPath, [
      '-rtsp_transport', 'tcp',
      '-i', rtspUrl,
      '-f', 'mpjpeg',
      '-boundary_tag', 'ffmpegframe',
      '-q:v', '4',
      '-r', '25',
      '-vf', 'scale=1280:720',
      'pipe:1'
    ], { stdio: ['ignore', 'pipe', 'ignore'] });

    ffProc.stdout.pipe(res);

    const killProc = () => {
      try { ffProc.kill('SIGKILL'); } catch (e) {}
    };

    req.on('close', killProc);
    req.on('end', killProc);
  });

  // WebSocket seguro sobre HTTPS (puerto 3000)
  wss = new WebSocketServer({ server });

  // Servidor HTTP complementario para WebSocket estándar y acceso web sin SSL en LAN (puerto 3001)
  // Monta el mismo appServer para que iPads y tablets abran http://<ip>:3001/control sin errores de certificado
  const plainHttpServer = http.createServer(appServer);
  httpWsServer = new WebSocketServer({ server: plainHttpServer });

  const setupWebSocketConnection = (ws) => {
    const clientId = `Client_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 4)}`;
    ws.clientId = clientId;
    mobileClients.set(clientId, ws);

    ws.on('message', (msg) => {
      try {
        const data = JSON.parse(msg);

        // 1. Identificación como Control Remoto iPad / Tablet
        if (data.type === 'identify' && data.role === 'remote-control') {
          ws.isRemoteControl = true;
          remoteControlClients.add(ws);
          programFeedClients.add(ws);
          console.log(`[RemoteControl] iPad / Tablet conectada a consola de estudio (${ws.clientId})`);
          if (latestStudioState && ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'studio-state', state: latestStudioState }));
          }
          if (latestPgmFrame && ws.readyState === 1) {
            try { ws.send(JSON.stringify({ type: 'pgm-frame', data: latestPgmFrame })); } catch(e) {}
          }
          return;
        }

        // 1.1 Identificación como Dispositivo Tally Light (Móvil / ESP32)
        if (data.type === 'identify' && data.role === 'tally') {
          ws.isTally = true;
          tallyClients.add(ws);
          console.log(`[TallyLight] Dispositivo Tally conectado (${ws.clientId})`);
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'tally-state', ...currentTallyState }));
          }
          return;
        }

        // 1.2 Identificación como Salida LAN Program Feed (OBS Studio / vMix / Monitor) (P4.4)
        if (data.type === 'identify' && data.role === 'program-feed') {
          ws.isProgramFeed = true;
          programFeedClients.add(ws);
          console.log(`[ProgramFeed] Cliente OBS / vMix / Pantalla conectado a salida PGM (${ws.clientId})`);
          if (latestStudioState && ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'studio-state', state: latestStudioState }));
          }
          if (latestPgmFrame && ws.readyState === 1) {
            try { ws.send(JSON.stringify({ type: 'pgm-frame', data: latestPgmFrame })); } catch(e) {}
          }
          return;
        }

        // 2. Solicitud de estado actual del switcher
        if (data.type === 'request-state') {
          if (latestStudioState && ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'studio-state', state: latestStudioState }));
          }
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'tally-state', ...currentTallyState }));
          }
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('remote-studio-command', { type: 'REQUEST_STATE' });
          }
          return;
        }

        // 3. Comandos de control de estudio (CUT, AUTO, TBAR, CAM, LAYOUT, RECORD, CINTILLO)
        if (data.type === 'remote-command' && data.payload) {
          console.log(`[RemoteControl] Comando recibido de ${ws.clientId}:`, data.payload.type);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('remote-studio-command', data.payload);
          }
          return;
        }

        // 4. WebRTC para cámaras remotas móviles
        if (!mainWindow || mainWindow.isDestroyed()) return;
        if (data.type === 'offer') {
          mainWindow.webContents.send('remote-offer', { id: ws.clientId, offer: data.offer });
        } else if (data.type === 'candidate') {
          mainWindow.webContents.send('remote-candidate', { id: ws.clientId, candidate: data.candidate });
        }
      } catch (err) {
        console.error('Error procesando mensaje WebSocket:', err);
      }
    });

    ws.on('close', () => {
      remoteControlClients.delete(ws);
      tallyClients.delete(ws);
      programFeedClients.delete(ws);
      mobileClients.delete(ws.clientId);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('remote-disconnected', ws.clientId);
      }
    });

    ws.on('error', () => {
      remoteControlClients.delete(ws);
      tallyClients.delete(ws);
      programFeedClients.delete(ws);
      mobileClients.delete(ws.clientId);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('remote-disconnected', ws.clientId);
      }
    });
  };

  wss.on('connection', setupWebSocketConnection);
  httpWsServer.on('connection', setupWebSocketConnection);

  appServer.get('/camara', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>PodcastStudio Remote Cam</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #0a0a0a; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; height: 100vh; overflow: hidden; display: flex; flex-direction: column; }
          #video { width: 100%; height: 100%; object-fit: cover; position: absolute; inset: 0; background: #000; z-index: 1; }
          .ui-layer { position: relative; z-index: 20; height: 100%; display: flex; flex-direction: column; justify-content: space-between; padding: 20px; pointer-events: none; }
          .header { display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.7); backdrop-filter: blur(10px); padding: 10px 16px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.1); pointer-events: auto; }
          .logo { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 14px; color: #ff6b00; }
          .badge { font-size: 11px; padding: 4px 10px; border-radius: 999px; font-weight: 700; background: #222; color: #aaa; border: 1px solid #444; }
          .badge.live { background: rgba(220,38,38,0.9); color: #fff; border-color: #ef4444; animation: pulse 1.5s infinite; }
          .badge.connected { background: rgba(22,101,52,0.9); color: #86efac; border-color: #4ade80; }
          .center-box { pointer-events: auto; background: rgba(15,15,18,0.92); backdrop-filter: blur(16px); padding: 28px 22px; border-radius: 20px; border: 1px solid rgba(255,107,0,0.3); text-align: center; max-width: 380px; margin: auto; box-shadow: 0 20px 40px rgba(0,0,0,0.8); }
          .btn-main { background: linear-gradient(135deg, #ff6b00, #ea580c); color: white; border: none; padding: 16px 28px; font-size: 17px; font-weight: 800; border-radius: 12px; cursor: pointer; width: 100%; box-shadow: 0 8px 20px rgba(234,88,12,0.4); transition: transform 0.1s; }
          .btn-main:active { transform: scale(0.97); }
          .controls { display: flex; gap: 10px; justify-content: center; pointer-events: auto; margin-bottom: 10px; }
          .btn-action { background: rgba(0,0,0,0.75); backdrop-filter: blur(8px); color: #fff; border: 1px solid rgba(255,255,255,0.2); padding: 10px 16px; border-radius: 999px; font-size: 12px; font-weight: 700; cursor: pointer; }
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        </style>
      </head>
      <body>
        <video id="video" autoplay playsinline webkit-playsinline muted></video>

        <div class="ui-layer">
          <div class="header">
            <div class="logo">
              <span>●</span> PodcastStudio Remote
            </div>
            <div id="statusBadge" class="badge">En Espera</div>
          </div>

          <div id="startDialog" class="center-box">
            <h2 style="color: #ff6b00; margin-bottom: 8px;">Cámara de Invitado</h2>
            <p style="font-size: 13px; color: #aaa; margin-bottom: 20px; line-height: 1.4;">
              Conéctate en vivo como cámara remota HD para el programa.
            </p>
            <button id="startBtn" class="btn-main">CONECTAR CÁMARA</button>
            <div id="connectHelp" style="margin-top: 14px; font-size: 11px; color: #777;">
              Toca "Permitir" cuando el navegador solicite acceso a cámara y micrófono.
            </div>
          </div>

          <div id="footerControls" class="controls" style="display: none;">
            <button id="flipCamBtn" class="btn-action">🔄 Girar Cámara</button>
            <button id="muteBtn" class="btn-action">🎤 Silenciar</button>
          </div>
        </div>

        <script>
          const LOCAL_IP = '${LOCAL_IP}';
          const urlParams = new URLSearchParams(window.location.search);
          const guestSlot = urlParams.get('slot') || '2';
          const guestName = urlParams.get('name') || '';
          const guestRole = urlParams.get('role') || 'guest';

          // Screen WakeLock para que la pantalla del invitado nunca se apague en vivo
          if ('wakeLock' in navigator) {
            navigator.wakeLock.request('screen').catch(() => {});
            document.addEventListener('visibilitychange', () => {
              if (document.visibilityState === 'visible') navigator.wakeLock.request('screen').catch(() => {});
            });
          }

          let ws = null;
          let pc = null;
          let currentStream = null;
          let currentFacing = 'user';
          let isMuted = false;

          const statusBadge = document.getElementById('statusBadge');
          const startDialog = document.getElementById('startDialog');
          const footerControls = document.getElementById('footerControls');
          const videoEl = document.getElementById('video');

          if (guestName) {
            const h2 = document.querySelector('#startDialog h2');
            if (h2) h2.innerText = '¡Hola ' + guestName + '!';
            const p = document.querySelector('#startDialog p');
            if (p) p.innerText = 'Conéctate al estudio en vivo (CAM ' + guestSlot + ') con retorno limpio Mix-Minus N-1 sin eco.';
          }

          function updateStatus(text, type) {
            statusBadge.innerText = text;
            statusBadge.className = 'badge ' + (type || '');
          }

          function connectWebSocket() {
            return new Promise((resolve) => {
              // Intento 1: WSS en puerto 3000
              const wssUrl = 'wss://' + LOCAL_IP + ':3000';
              const wsUrl = 'ws://' + LOCAL_IP + ':3001';

              let socket = new WebSocket(wssUrl);
              let connected = false;

              const timer = setTimeout(() => {
                if (!connected) {
                  try { socket.close(); } catch (e) {}
                  // Fallback a WS estándar en puerto 3001 si WSS autofirmado es rechazado
                  socket = new WebSocket(wsUrl);
                  bindEvents(socket, resolve);
                }
              }, 1200);

              function bindEvents(s, done) {
                s.onopen = () => {
                  connected = true;
                  clearTimeout(timer);
                  ws = s;
                  done(s);
                };
                s.onmessage = async (e) => {
                  try {
                    const data = JSON.parse(e.data);
                    if (data.type === 'answer' && pc) {
                      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                      updateStatus('EN VIVO ★ AL AIRE', 'live');
                    } else if (data.type === 'candidate' && pc) {
                      await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
                    }
                  } catch (err) {}
                };
                s.onclose = () => {
                  updateStatus('Desconectado', '');
                };
                s.onerror = () => {
                  if (!connected) {
                    clearTimeout(timer);
                    socket = new WebSocket(wsUrl);
                    bindEvents(socket, done);
                  }
                };
              }

              bindEvents(socket, resolve);
            });
          }

          async function startCameraAndStream() {
            startDialog.style.display = 'none';
            updateStatus('Solicitando cámara...', '');

            try {
              currentStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: currentFacing, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
                audio: true
              });

              videoEl.srcObject = currentStream;
              videoEl.style.display = 'block';
              footerControls.style.display = 'flex';

              updateStatus('Conectando al Estudio...', '');
              await connectWebSocket();

              pc = new RTCPeerConnection({
                iceServers: [
                  { urls: 'stun:stun.l.google.com:19302' },
                  { urls: 'stun:stun1.l.google.com:19302' }
                ]
              });

              currentStream.getTracks().forEach(track => {
                const sender = pc.addTrack(track, currentStream);
                if (track.kind === 'video') {
                  try {
                    const params = sender.getParameters();
                    if (!params.encodings) params.encodings = [{}];
                    params.encodings[0].maxBitrate = 4500000;
                    params.encodings[0].networkPriority = 'high';
                    params.encodings[0].priority = 'high';
                    params.degradationPreference = 'maintain-resolution';
                    sender.setParameters(params);
                  } catch (e) {}
                }
              });

              pc.onicecandidate = (e) => {
                if (e.candidate && ws && ws.readyState === 1) {
                  ws.send(JSON.stringify({ type: 'candidate', candidate: e.candidate }));
                }
              };

              pc.oniceconnectionstatechange = () => {
                if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
                  updateStatus('EN VIVO ★ ESTUDIO', 'live');
                } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
                  updateStatus('Reconectando...', '');
                }
              // Forzar preferencia de códec H.264 por hardware en el móvil para 0% lag y 0 pixelado
              try {
                const transceivers = pc.getTransceivers();
                const vTransceiver = transceivers.find(t => t.sender && t.sender.track && t.sender.track.kind === 'video');
                if (vTransceiver && 'setCodecPreferences' in vTransceiver && window.RTCRtpReceiver && RTCRtpReceiver.getCapabilities) {
                  const caps = RTCRtpReceiver.getCapabilities('video');
                  if (caps && caps.codecs) {
                    const h264 = caps.codecs.filter(c => c.mimeType.toLowerCase() === 'video/h264');
                    const others = caps.codecs.filter(c => c.mimeType.toLowerCase() !== 'video/h264');
                    vTransceiver.setCodecPreferences([...h264, ...others]);
                  }
                }
              } catch (e) {}

              const offer = await pc.createOffer({
                offerToReceiveAudio: false,
                offerToReceiveVideo: false
              });

              function prioritizeH264(sdp) {
                const lines = sdp.split('\r\n');
                let mIdx = -1;
                const h264Pts = [];
                lines.forEach((l, i) => {
                  if (l.startsWith('m=video')) mIdx = i;
                  if (l.startsWith('a=rtpmap:') && l.toLowerCase().includes('h264')) {
                    const pt = l.split(':')[1].split(' ')[0];
                    if (!h264Pts.includes(pt)) h264Pts.push(pt);
                  }
                });
                if (mIdx !== -1 && h264Pts.length > 0) {
                  const parts = lines[mIdx].split(' ');
                  const header = parts.slice(0, 3);
                  const payloads = parts.slice(3);
                  const rest = payloads.filter(p => !h264Pts.includes(p));
                  lines[mIdx] = [...header, ...h264Pts, ...rest].join(' ');
                }
                return lines.join('\r\n');
              }

              offer.sdp = prioritizeH264(offer.sdp);
              await pc.setLocalDescription(offer);

              if (ws && ws.readyState === 1) {
                ws.send(JSON.stringify({ type: 'offer', offer: offer, slot: guestSlot, name: guestName, role: guestRole }));
              }
            } catch (err) {
              startDialog.style.display = 'block';
              updateStatus('Error de Cámara', '');
              alert('Error al acceder a la cámara: ' + err.message);
            }
          }

          document.getElementById('startBtn').addEventListener('click', startCameraAndStream);

          document.getElementById('flipCamBtn').addEventListener('click', async () => {
            currentFacing = currentFacing === 'user' ? 'environment' : 'user';
            if (currentStream) {
              currentStream.getTracks().forEach(t => t.stop());
            }
            startCameraAndStream();
          });

          document.getElementById('muteBtn').addEventListener('click', () => {
            if (!currentStream) return;
            isMuted = !isMuted;
            currentStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
            document.getElementById('muteBtn').innerText = isMuted ? '🔇 Desmutear' : '🎤 Silenciar';
          });
        </script>
      </body>
      </html>
    `);
  });

  // ============================================================================
  // ESTADO DE SALA MULTI-INVITADOS & RETORNO MIX-MINUS (P3.3)
  // ============================================================================
  appServer.get(['/room/status', '/guest/status'], (req, res) => {
    res.json({
      status: 'ok',
      localIp: LOCAL_IP,
      controlUrl: `http://${LOCAL_IP}:3001/control`,
      tallyUrl: `http://${LOCAL_IP}:3001/tally`,
      prompterUrl: `http://${LOCAL_IP}:3001/prompter`,
      guestRoomUrl: `http://${LOCAL_IP}:3001/camara?auto=true`,
      mixMinusActive: true,
      timestamp: Date.now(),
    });
  });

  // ============================================================================
  // TALLY LIGHT INALÁMBRICO LAN / MÓVILES / ESP32 (P2.4)
  // Permite montar cualquier celular en la zapata de la cámara como Tally Light
  // ============================================================================
  appServer.get('/tally/status', (req, res) => {
    res.json(currentTallyState);
  });

  appServer.get(['/tally', '/tally-light'], (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>PodcastStudio Tally Light</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; -webkit-tap-highlight-color: transparent; }
          html, body { width: 100%; height: 100%; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0c0d12; color: #fff; }
          .tally-box { width: 100vw; height: 100vh; display: flex; flex-direction: column; justify-content: space-between; align-items: center; padding: 24px; transition: background 0.25s ease, filter 0.25s ease; }
          .state-off { background: #0c0d12; color: #64748b; }
          .state-pvw { background: #15803d; color: #ffffff; text-shadow: 0 4px 14px rgba(0,0,0,0.6); }
          .state-pgm { background: #dc2626; color: #ffffff; text-shadow: 0 4px 18px rgba(0,0,0,0.8); animation: pulseGlow 1.6s infinite; }
          @keyframes pulseGlow {
            0%, 100% { filter: brightness(1); }
            50% { filter: brightness(1.18); }
          }
          .header-bar { width: 100%; display: flex; justify-content: space-between; align-items: center; z-index: 10; }
          .brand-title { font-size: 13px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.9; }
          .conn-status { font-size: 11px; padding: 5px 12px; border-radius: 999px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); }
          .cam-center { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; text-align: center; }
          .cam-number { font-size: clamp(100px, 34vw, 260px); font-weight: 900; line-height: 0.88; letter-spacing: -0.04em; }
          .status-badge { font-size: clamp(20px, 6vw, 36px); font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase; margin-top: 14px; padding: 10px 28px; border-radius: 999px; background: rgba(0,0,0,0.38); border: 1px solid rgba(255,255,255,0.25); }
          .footer-bar { width: 100%; display: flex; flex-direction: column; gap: 12px; align-items: center; z-index: 10; }
          .cam-selector { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; max-width: 520px; }
          .cam-btn { width: 44px; height: 44px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.25); background: rgba(0,0,0,0.5); color: #fff; font-weight: 800; font-size: 16px; cursor: pointer; transition: all 0.15s; }
          .cam-btn.active { background: #ff6b00; border-color: #ff8533; color: #fff; transform: scale(1.12); box-shadow: 0 4px 16px rgba(255,107,0,0.6); }
          .wake-btn { background: rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.85); font-size: 11px; padding: 7px 16px; border-radius: 999px; cursor: pointer; font-weight: 700; }
        </style>
      </head>
      <body>
        <div id="tallyBox" class="tally-box state-off">
          <div class="header-bar">
            <div class="brand-title">🎙️ PODCASTUDIO TALLY</div>
            <div id="connStatus" class="conn-status">Conectando...</div>
          </div>
          
          <div class="cam-center">
            <div id="camNumber" class="cam-number">CAM 1</div>
            <div id="statusBadge" class="status-badge">STANDBY</div>
          </div>

          <div class="footer-bar">
            <div class="cam-selector" id="camSelector"></div>
            <button id="wakeBtn" class="wake-btn">⚡ Pantalla Siempre Activa (WakeLock)</button>
          </div>
        </div>

        <script>
          const LOCAL_IP = '${LOCAL_IP}';
          let selectedCam = parseInt(new URLSearchParams(window.location.search).get('cam') || '1');
          if (isNaN(selectedCam) || selectedCam < 1 || selectedCam > 12) selectedCam = 1;

          const tallyBox = document.getElementById('tallyBox');
          const camNumberEl = document.getElementById('camNumber');
          const statusBadgeEl = document.getElementById('statusBadge');
          const connStatusEl = document.getElementById('connStatus');
          const camSelectorEl = document.getElementById('camSelector');
          const wakeBtn = document.getElementById('wakeBtn');

          for (let i = 1; i <= 12; i++) {
            const btn = document.createElement('button');
            btn.className = 'cam-btn' + (i === selectedCam ? ' active' : '');
            btn.innerText = i;
            btn.onclick = () => selectCam(i);
            camSelectorEl.appendChild(btn);
          }

          function selectCam(cam) {
            selectedCam = cam;
            try { history.replaceState(null, '', '?cam=' + cam); } catch(e){}
            Array.from(camSelectorEl.children).forEach((b, idx) => {
              b.className = 'cam-btn' + (idx + 1 === cam ? ' active' : '');
            });
            updateTallyDisplay();
          }

          let latestTally = { pgmCam: 1, pvwCam: 2, dualMode: false, cams: {} };
          let prevRole = 'off';

          function updateTallyDisplay() {
            camNumberEl.innerText = 'CAM ' + selectedCam;
            const state = latestTally.cams && latestTally.cams[selectedCam] 
              ? latestTally.cams[selectedCam] 
              : (selectedCam === latestTally.pgmCam ? 'pgm' : (latestTally.dualMode && selectedCam === latestTally.pvwCam ? 'pvw' : 'off'));
            
            tallyBox.className = 'tally-box state-' + (state || 'off');
            if (state === 'pgm') {
              statusBadgeEl.innerText = '● AL AIRE / ON AIR';
              if (prevRole !== 'pgm' && navigator.vibrate) {
                try { navigator.vibrate([160, 80, 160]); } catch(e){}
              }
            } else if (state === 'pvw') {
              statusBadgeEl.innerText = '★ PREVIEW / PRÓXIMO';
            } else {
              statusBadgeEl.innerText = 'STANDBY';
            }
            prevRole = state;
          }

          let ws = null;
          function connectWs() {
            const wsUrl = 'ws://' + LOCAL_IP + ':3001';
            ws = new WebSocket(wsUrl);
            ws.onopen = () => {
              connStatusEl.innerText = '● Enlazado';
              connStatusEl.style.borderColor = '#4ade80';
              connStatusEl.style.color = '#86efac';
              try {
                ws.send(JSON.stringify({ type: 'identify', role: 'tally' }));
                ws.send(JSON.stringify({ type: 'request-state' }));
              } catch(e){}
            };
            ws.onmessage = (e) => {
              try {
                const data = JSON.parse(e.data);
                if (data.type === 'tally-state') {
                  latestTally = data;
                  updateTallyDisplay();
                } else if (data.type === 'studio-state' && data.state) {
                  const st = data.state;
                  latestTally.pgmCam = st.activeCam || 1;
                  latestTally.pvwCam = st.pvwCam || 2;
                  latestTally.dualMode = !!st.dualMode;
                  latestTally.cams = {};
                  for (let i = 1; i <= 12; i++) {
                    if (i === latestTally.pgmCam) latestTally.cams[i] = 'pgm';
                    else if (latestTally.dualMode && i === latestTally.pvwCam) latestTally.cams[i] = 'pvw';
                    else latestTally.cams[i] = 'off';
                  }
                  updateTallyDisplay();
                }
              } catch(err) {}
            };
            ws.onclose = () => {
              connStatusEl.innerText = '○ Reconectando...';
              connStatusEl.style.borderColor = '#f59e0b';
              connStatusEl.style.color = '#fcd34d';
              setTimeout(connectWs, 2000);
            };
          }
          connectWs();

          setInterval(async () => {
            if (!ws || ws.readyState !== 1) {
              try {
                const res = await fetch('/tally/status');
                if (res.ok) {
                  latestTally = await res.json();
                  updateTallyDisplay();
                }
              } catch(e){}
            }
          }, 900);

          async function requestWakeLock() {
            if ('wakeLock' in navigator) {
              try {
                await navigator.wakeLock.request('screen');
                wakeBtn.innerText = '⚡ Pantalla Siempre Activa (ON)';
                wakeBtn.style.color = '#86efac';
              } catch(e) {}
            }
          }
          requestWakeLock();
          wakeBtn.onclick = requestWakeLock;
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') requestWakeLock();
          });
        </script>
      </body>
      </html>
    `);
  });

  // ============================================================================
  // TELEPROMPTER MÓVIL / TABLET / IPAD PARA CRISTAL DIVISOR (P3.2)
  // Permite montar un iPad o tablet en el cristal teleprompter con scroll y espejo
  // ============================================================================
  appServer.get('/prompter/text', (req, res) => {
    res.json({ text: currentPrompterScript });
  });

  appServer.get(['/prompter', '/teleprompter'], (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>PodcastStudio Tablet Teleprompter</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; -webkit-tap-highlight-color: transparent; }
          html, body { width: 100%; height: 100%; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #000; color: #fff; }
          .top-bar { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: rgba(0,0,0,0.85); backdrop-filter: blur(10px); padding: 8px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.15); }
          .btn { background: rgba(255,255,255,0.12); color: #fff; border: 1px solid rgba(255,255,255,0.25); padding: 7px 15px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; }
          .btn.active { background: #0284c7; border-color: #38bdf8; }
          .btn.play { background: #16a34a; border-color: #22c55e; }
          .btn.pause { background: #dc2626; border-color: #ef4444; }
          .prompter-box { width: 100%; height: 100%; overflow-y: scroll; padding: 180px 32px 360px 32px; text-align: center; scrollbar-width: none; }
          .prompter-text { font-size: clamp(34px, 5vw, 68px); font-weight: 800; line-height: 1.55; color: #fff; max-width: 950px; margin: 0 auto; white-space: pre-wrap; text-shadow: 0 4px 16px rgba(0,0,0,0.95); }
          .mirror-h { transform: scaleX(-1); }
          .eyeline { position: fixed; top: 40%; left: 0; right: 0; height: 2px; background: rgba(56, 189, 248, 0.7); box-shadow: 0 0 10px rgba(56, 189, 248, 0.8); pointer-events: none; z-index: 90; }
        </style>
      </head>
      <body>
        <div class="top-bar">
          <div style="font-weight: 800; font-size: 13px; color: #38bdf8;">🎙️ PODCASTUDIO TELEPROMPTER</div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button id="playBtn" class="btn play">▶ INICIAR</button>
            <button id="resetBtn" class="btn">↺ REINICIAR</button>
            <button id="mirrorBtn" class="btn">🪞 ESPEJO CRISTAL</button>
            <input type="range" id="speedRange" min="0.5" max="8.0" step="0.2" value="2.0" style="width: 80px; accent-color: #38bdf8;">
            <button id="wakeBtn" class="btn" style="font-size: 11px;">⚡ WAKELOCK</button>
          </div>
        </div>
        <div id="eyelineMarker" class="eyeline"></div>
        <div id="prompterBox" class="prompter-box">
          <div id="prompterText" class="prompter-text">Cargando guión del estudio...</div>
        </div>
        <script>
          let isPlaying = false;
          let speed = 2.0;
          let isMirrored = false;
          let scrollPos = 0;
          const prompterBox = document.getElementById('prompterBox');
          const prompterText = document.getElementById('prompterText');
          const playBtn = document.getElementById('playBtn');
          const resetBtn = document.getElementById('resetBtn');
          const mirrorBtn = document.getElementById('mirrorBtn');
          const speedRange = document.getElementById('speedRange');
          const wakeBtn = document.getElementById('wakeBtn');

          fetch('/prompter/text').then(r => r.json()).then(data => {
            if (data.text) prompterText.innerText = data.text;
          }).catch(()=>{});

          playBtn.onclick = () => {
            isPlaying = !isPlaying;
            playBtn.innerText = isPlaying ? '⏸ PAUSAR' : '▶ INICIAR';
            playBtn.className = isPlaying ? 'btn pause' : 'btn play';
          };

          resetBtn.onclick = () => {
            scrollPos = 0;
            prompterBox.scrollTop = 0;
          };

          mirrorBtn.onclick = () => {
            isMirrored = !isMirrored;
            prompterBox.className = 'prompter-box' + (isMirrored ? ' mirror-h' : '');
            mirrorBtn.className = 'btn' + (isMirrored ? ' active' : '');
          };

          speedRange.oninput = (e) => {
            speed = parseFloat(e.target.value);
          };

          let lastTime = performance.now();
          function loop(now) {
            const delta = (now - lastTime) / 1000;
            lastTime = now;
            if (isPlaying) {
              scrollPos += speed * 42 * delta;
              prompterBox.scrollTop = scrollPos;
            }
            requestAnimationFrame(loop);
          }
          requestAnimationFrame(loop);

          async function reqWake() {
            if ('wakeLock' in navigator) {
              try {
                await navigator.wakeLock.request('screen');
                wakeBtn.style.color = '#86efac';
                wakeBtn.innerText = '⚡ PANTALLA ACTIVA';
              } catch(e){}
            }
          }
          reqWake();
          wakeBtn.onclick = reqWake;
        </script>
      </body>
      </html>
    `);
  });

  // ============================================================================
  // SALIDA LAN PROGRAM & VIRTUAL WEB FEED (P4.4)
  // Señal limpia 1080p a 60 FPS para OBS Studio (Browser Source), vMix y Smart TVs
  // ============================================================================
  appServer.get('/program/status', (req, res) => {
    res.json({
      status: 'online',
      activeCam: latestStudioState?.activeCam || 1,
      pvwCam: latestStudioState?.pvwCam || 2,
      layout: latestStudioState?.layoutMode || '1',
      resolution: '1920x1080',
      fps: 60,
      isStreaming: !!isStreaming,
      isRecording: !!isRecording,
      isReplaying: !!latestStudioState?.isReplaying,
      feedClients: programFeedClients.size,
      lanUrl: `http://${LOCAL_IP}:3001/program/feed`
    });
  });

  appServer.get(['/program/frame.jpg', '/program/snapshot.jpg'], (req, res) => {
    if (!latestPgmFrame) {
      return res.status(503).send('No frame yet');
    }
    try {
      const base64Data = latestPgmFrame.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': buffer.length,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      res.end(buffer);
    } catch(e) {
      res.status(500).send('Error serving frame');
    }
  });

  appServer.get(['/program/feed', '/program', '/pgm'], (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>PodcastStudio Program Master Feed (1080p60)</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body {
            width: 100%;
            height: 100%;
            background: #000;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            cursor: none;
          }
          #feedCanvas {
            width: 100vw;
            height: 100vh;
            object-fit: contain;
            background: #000;
            image-rendering: high-quality;
          }
          .hud {
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: rgba(15, 23, 42, 0.88);
            border: 1px solid rgba(255, 255, 255, 0.18);
            backdrop-filter: blur(12px);
            padding: 8px 16px;
            border-radius: 9999px;
            color: #fff;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.05em;
            display: flex;
            align-items: center;
            gap: 10px;
            opacity: 1;
            transition: opacity 1.2s ease;
            pointer-events: none;
            z-index: 100;
            box-shadow: 0 4px 20px rgba(0,0,0,0.8);
          }
          .hud.fade { opacity: 0; }
          .dot {
            width: 9px;
            height: 9px;
            border-radius: 50%;
            background: #ef4444;
            box-shadow: 0 0 10px #ef4444;
            animation: pulse 1.5s infinite;
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(0.85); }
          }
        </style>
      </head>
      <body>
        <canvas id="feedCanvas" width="1920" height="1080"></canvas>
        <div id="hud" class="hud">
          <div class="dot"></div>
          <span>PGM LIVE · 1080p60 · BROADCAST FEED</span>
        </div>
        <script>
          const canvas = document.getElementById('feedCanvas');
          const ctx = canvas.getContext('2d');
          const hud = document.getElementById('hud');

          // Ocultar distintivo de inicio tras 4 segundos
          setTimeout(() => { hud.classList.add('fade'); }, 4000);

          let ws = null;
          const img = new Image();

          // Carga instantánea inicial de fotograma PGM vía HTTP para cero latencia y evitar pantalla negra
          const initImg = new Image();
          initImg.onload = () => {
            ctx.drawImage(initImg, 0, 0, canvas.width, canvas.height);
          };
          initImg.src = '/program/frame.jpg?t=' + Date.now();

          function connect() {
            const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
            ws = new WebSocket(proto + '//' + location.host);
            ws.binaryType = 'arraybuffer';

            ws.onopen = () => {
              ws.send(JSON.stringify({ type: 'identify', role: 'program-feed' }));
            };

            ws.onmessage = (e) => {
              if (typeof e.data === 'string') {
                try {
                  const msg = JSON.parse(e.data);
                  if (msg.type === 'pgm-frame' && msg.data) {
                    img.onload = () => {
                      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    };
                    img.src = msg.data;
                  }
                } catch(err) {}
              } else if (e.data instanceof ArrayBuffer) {
                const blob = new Blob([e.data], { type: 'image/jpeg' });
                const url = URL.createObjectURL(blob);
                img.onload = () => {
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                  URL.revokeObjectURL(url);
                };
                img.src = url;
              }
            };

            ws.onclose = () => {
              setTimeout(connect, 2000);
            };
            ws.onerror = () => {
              ws.close();
            };
          }

          connect();

          // Screen WakeLock para pantallas de retorno y Smart TV
          if ('wakeLock' in navigator) {
            navigator.wakeLock.request('screen').catch(()=>{});
          }
        </script>
      </body>
      </html>
    `);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn('[MediaServer] Puerto 3000 ocupado por Docker/WSL u otra instancia. Servidor local seguro omitido.');
    } else {
      console.warn('[MediaServer] Error:', err.message);
    }
  });

  plainHttpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn('[HttpServer] Puerto 3001 ocupado. Servidor local HTTP omitido.');
    } else {
      console.warn('[HttpServer] Error:', err.message);
    }
  });

  try {
    server.listen(3000, '0.0.0.0', () => {
      console.log('[MediaServer] Servidor HTTPS activo en puerto 3000');
    });
  } catch (e) {
    console.warn('[MediaServer] Catch listen 3000:', e.message);
  }

  try {
    plainHttpServer.listen(3001, '0.0.0.0', () => {
      console.log('[HttpServer] Servidor HTTP activo en puerto 3001');
    });
  } catch (e) {
    console.warn('[HttpServer] Catch listen 3001:', e.message);
  }
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(() => {
    createWindow();
    setImmediate(() => {
      startMediaServer();
    });
  });
}

ipcMain.handle('get-qr-url', () => `https://www.podcastudio.mx/remote-cam?slot=2&room=studio_cam_2`);

ipcMain.handle('get-local-control-url', () => `http://${LOCAL_IP}:3001/control`);

ipcMain.handle('get-tally-url', () => `http://${LOCAL_IP}:3001/tally`);

ipcMain.handle('get-tally-state', () => currentTallyState);

ipcMain.handle('get-prompter-url', () => `http://${LOCAL_IP}:3001/prompter`);

ipcMain.handle('get-prompter-text', () => currentPrompterScript);

ipcMain.handle('set-prompter-text', (event, text) => {
  currentPrompterScript = text || '';
  return { success: true };
});

ipcMain.handle('get-guest-room-url', () => `http://${LOCAL_IP}:3001/camara?auto=true`);

// ============================================================================
// SALIDA LAN PROGRAM & VIRTUAL FEED IPC HANDLERS (P4.4)
// ============================================================================
ipcMain.handle('get-program-feed-url', () => `http://${LOCAL_IP}:3001/program/feed`);

ipcMain.handle('get-program-status', () => ({
  status: 'online',
  activeCam: latestStudioState?.activeCam || 1,
  pvwCam: latestStudioState?.pvwCam || 2,
  layout: latestStudioState?.layoutMode || '1',
  resolution: '1920x1080',
  fps: 60,
  isStreaming: !!isStreaming,
  isRecording: !!isRecording,
  isReplaying: !!latestStudioState?.isReplaying,
  feedClients: programFeedClients.size,
  lanUrl: `http://${LOCAL_IP}:3001/program/feed`
}));

ipcMain.on('program-feed-frame', (event, frameData) => {
  if (!frameData) return;
  latestPgmFrame = frameData;
  if (programFeedClients.size === 0) return;
  const msg = JSON.stringify({ type: 'pgm-frame', data: frameData });
  programFeedClients.forEach(client => {
    if (client.readyState === 1) {
      try { client.send(msg); } catch(e) {}
    }
  });
});

// ============================================================================
// HARDWARE SERIAL / USB TALLY SUPPORT (P2.4)
// Detección de puertos COM y envío nativo a Arduino, ESP32, USB Relays
// ============================================================================
ipcMain.handle('list-serial-ports', async () => {
  return new Promise((resolve) => {
    const psCmd = `[System.IO.Ports.SerialPort]::getportnames()`;
    exec(`powershell -NoProfile -Command "${psCmd}"`, { timeout: 3000 }, (err, stdout) => {
      if (err || !stdout) {
        return resolve([]);
      }
      const rawPorts = stdout.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      const uniquePorts = [...new Set(rawPorts)].map(port => ({
        port,
        description: `Puerto Serial / USB (${port})`
      }));
      resolve(uniquePorts);
    });
  });
});

ipcMain.handle('send-tally-serial', async (event, { port = 'COM3', baudRate = 9600, data = '' }) => {
  return new Promise((resolve) => {
    if (!port || !data) return resolve({ success: false, error: 'Puerto o datos no válidos' });
    const cleanPort = String(port).replace(/[^A-Za-z0-9]/g, '');
    const cleanBaud = parseInt(baudRate) || 9600;
    const cleanData = String(data).replace(/"/g, '`"');

    const psScript = `$p = New-Object System.IO.Ports.SerialPort '${cleanPort}', ${cleanBaud}, None, 8, one; try { $p.Open(); $p.WriteLine("${cleanData}"); $p.Close(); Write-Output "OK" } catch { Write-Output "ERR:$($_.Exception.Message)" }`;
    exec(`powershell -NoProfile -Command "${psScript}"`, { timeout: 3000 }, (err, stdout) => {
      if (err) return resolve({ success: false, error: err.message });
      const out = (stdout || '').trim();
      if (out.startsWith('ERR:')) {
        return resolve({ success: false, error: out.replace('ERR:', '') });
      }
      resolve({ success: true, response: out });
    });
  });
});

ipcMain.on('studio-state-update', (event, state) => {
  latestStudioState = state;
  const msg = JSON.stringify({ type: 'studio-state', state });
  remoteControlClients.forEach(client => {
    if (client.readyState === 1) {
      try { client.send(msg); } catch (e) {}
    }
  });

  // Actualizar y emitir estado Tally (P2.4)
  if (state && (state.activeCam !== undefined || state.pvwCam !== undefined)) {
    const pgm = state.activeCam || 1;
    const pvw = state.pvwCam || 2;
    currentTallyState.pgmCam = pgm;
    currentTallyState.pvwCam = pvw;
    currentTallyState.dualMode = !!state.dualMode;
    for (let i = 1; i <= 12; i++) {
      if (i === pgm) {
        currentTallyState.cams[i] = 'pgm';
      } else if (state.dualMode && i === pvw) {
        currentTallyState.cams[i] = 'pvw';
      } else {
        currentTallyState.cams[i] = 'off';
      }
    }

    const tallyMsg = JSON.stringify({ type: 'tally-state', ...currentTallyState });
    tallyClients.forEach(client => {
      if (client.readyState === 1) {
        try { client.send(tallyMsg); } catch (e) {}
      }
    });

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tally-state-change', currentTallyState);
    }
  }
});

ipcMain.on('send-answer', (event, { id, answer }) => {
  const client = mobileClients.get(id);
  if (client && client.readyState === 1) {
    client.send(JSON.stringify({ type: 'answer', answer }));
  }
});

ipcMain.on('send-candidate', (event, { id, candidate }) => {
  const client = mobileClients.get(id);
  if (client && client.readyState === 1) {
    client.send(JSON.stringify({ type: 'candidate', candidate }));
  }
});

ipcMain.on('open-external', (event, url) => shell.openExternal(url));

ipcMain.on('open-recordings-folder', (event, projectName) => {
  const cleanProjectName = projectName ? String(projectName).replace(/[/\\?%*:|"<>]/g, '_').trim() : '';
  let recDir = path.join('D:', 'PROGRAMAS IA', 'PODCASTUDIO', 'proyectos');
  if (cleanProjectName) {
    const subDir = path.join(recDir, cleanProjectName);
    if (fs.existsSync(subDir)) recDir = subDir;
  }
  if (!fs.existsSync(recDir)) {
    try { fs.mkdirSync(recDir, { recursive: true }); } catch (e) {}
  }
  shell.openPath(recDir);
});

let currentRecordingPath = null;
let streamDestinations = [];
let activeStreamWorkers = [];
let currentRecordingProjectName = 'Proyecto_General';

// ============================================================================
// GRABACIÓN BROADCAST MASTER (MP4 LIMPIO + AUDIO MEZCLADO - EN CARPETA DE PROYECTO)
// ============================================================================
ipcMain.handle('start-recording', async (event, options = {}) => {
  return new Promise((resolve) => {
    const rawProjectName = (typeof options === 'string' ? options : options?.projectName) || 'Proyecto_General';
    // Sanitizar nombre de proyecto: remover prefijos PodcaStudio_ y timestamps para mantener una sola carpeta limpia
    let cleanProjectName = String(rawProjectName)
      .replace(/^PodcaStudio_/i, '')
      .replace(/_\d{10,}$/, '')
      .replace(/[/\\?%*:|"<>]/g, '_')
      .trim() || 'Proyecto_General';
    
    currentRecordingProjectName = cleanProjectName;

    // Carpeta raíz estructurada: D:\PROGRAMAS IA\PODCASTUDIO\proyectos\[NombreProyecto]\
    const projectDir = path.join('D:', 'PROGRAMAS IA', 'PODCASTUDIO', 'proyectos', cleanProjectName);
    try {
      if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });
    } catch (e) {}

    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
    currentRecordingPath = path.join(projectDir, `${timestamp}_Master_1080p.mp4`);

    if (ffmpegRecordProcess) {
      try {
        if (ffmpegRecordProcess.stdin && !ffmpegRecordProcess.stdin.destroyed) ffmpegRecordProcess.stdin.end();
        ffmpegRecordProcess.kill('SIGINT');
      } catch (e) {}
      ffmpegRecordProcess = null;
    }

    try {
      // Configuración de codificación de calidad broadcast Full HD 1080p real a 30fps sin pixelación
      ffmpegRecordProcess = spawn(ffmpegPath, [
        '-probesize', '32M',
        '-analyzeduration', '0',
        '-f', 'webm',
        '-i', 'pipe:0',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '17',
        '-maxrate', '12M',
        '-bufsize', '24M',
        '-pix_fmt', 'yuv420p',
        '-r', '30',
        '-g', '60',
        '-keyint_min', '30',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-ar', '48000',
        '-movflags', '+faststart',
        '-y',
        currentRecordingPath
      ], {
        stdio: ['pipe', 'ignore', 'pipe']
      });

      ffmpegRecordProcess.on('error', (err) => {
        console.error('Error FFmpeg Grabación:', err.message);
      });

      ffmpegRecordProcess.on('close', () => {
        ffmpegRecordProcess = null;
      });

      resolve({ success: true, path: currentRecordingPath, projectName: cleanProjectName });
    } catch (err) {
      console.error('Fallo al iniciar grabación FFmpeg:', err);
      resolve({ success: false, error: err.message });
    }
  });
});

ipcMain.on('record-chunk', (event, chunkBuffer) => {
  if (ffmpegRecordProcess && ffmpegRecordProcess.stdin && !ffmpegRecordProcess.stdin.destroyed) {
    try {
      const buf = Buffer.isBuffer(chunkBuffer) ? chunkBuffer : Buffer.from(chunkBuffer);
      ffmpegRecordProcess.stdin.write(buf);
    } catch (e) {
      console.warn('Error escribiendo chunk de grabación:', e.message);
    }
  }
});

ipcMain.handle('stop-recording', async () => {
  return new Promise((resolve) => {
    if (ffmpegRecordProcess) {
      const proc = ffmpegRecordProcess;
      const recPath = currentRecordingPath;
      let finished = false;

      const finishAndGenerateThumb = () => {
        if (finished) return;
        finished = true;
        ffmpegRecordProcess = null;

        if (recPath && fs.existsSync(recPath)) {
          const stats = fs.statSync(recPath);
          console.log(`[FFmpeg Grabación] Master MP4 finalizado: ${recPath} (${stats.size} bytes)`);
          const thumbPath = recPath.replace(/\.mp4$/i, '_Thumbnail.jpg');
          try {
            const thumbProcess = spawn(ffmpegPath, [
              '-y',
              '-ss', '00:00:00.800',
              '-i', recPath,
              '-vframes', '1',
              '-q:v', '2',
              thumbPath
            ]);
            thumbProcess.on('close', () => {
              resolve({ success: true, path: recPath, thumbnailPath: thumbPath });
            });
            thumbProcess.on('error', () => {
              resolve({ success: true, path: recPath, thumbnailPath: thumbPath });
            });
            setTimeout(() => resolve({ success: true, path: recPath, thumbnailPath: thumbPath }), 1500);
            return;
          } catch (e) {
            resolve({ success: true, path: recPath });
            return;
          }
        }
        resolve({ success: true, path: recPath });
      };

      proc.on('close', (code) => {
        console.log('[FFmpeg Grabación] Proceso cerrado limpiamente con código:', code);
        finishAndGenerateThumb();
      });

      // Señalizar fin de stream a FFmpeg para que escriba las cabeceras completas y faststart
      try {
        if (proc.stdin && !proc.stdin.destroyed) {
          proc.stdin.end();
        }
      } catch (e) {}

      // Tiempo de gracia para permitir a FFmpeg escribir el moov atom
      setTimeout(() => {
        if (!finished) {
          console.warn('[FFmpeg Grabación] Forzando cierre tras timeout de finalización');
          try { proc.kill(); } catch (e) {}
          finishAndGenerateThumb();
        }
      }, 4000);
    } else {
      resolve({ success: false });
    }
  });
});

// ============================================================================
// GRABACIÓN ISO MULTICANAL (PISTAS INDEPENDIENTES POR CÁMARA) (P4.1)
// Permite grabar cada ángulo de cámara individual en Full HD 1080p sincronizado
// en la subcarpeta proyectos/[Proyecto]/ISO/ para edición NLE (Premiere / DaVinci)
// ============================================================================
const ffmpegIsoProcesses = new Map(); // slotNum -> { proc, path, slotNum }

ipcMain.handle('start-iso-recording', async (event, { slots = [], projectName = 'Proyecto_General', timestamp = '' }) => {
  const cleanProjectName = String(projectName)
    .replace(/^PodcaStudio_/i, '')
    .replace(/_\d{10,}$/, '')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .trim() || 'Proyecto_General';

  const isoDir = path.join('D:', 'PROGRAMAS IA', 'PODCASTUDIO', 'proyectos', cleanProjectName, 'ISO');
  try {
    if (!fs.existsSync(isoDir)) fs.mkdirSync(isoDir, { recursive: true });
  } catch (e) {}

  const now = new Date();
  const ts = timestamp || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;

  const startedSlots = [];

  slots.forEach((slotNum) => {
    // Si ya existe proceso para este slot, cerrarlo primero
    if (ffmpegIsoProcesses.has(slotNum)) {
      try {
        const old = ffmpegIsoProcesses.get(slotNum);
        if (old.proc?.stdin && !old.proc.stdin.destroyed) old.proc.stdin.end();
      } catch (e) {}
      ffmpegIsoProcesses.delete(slotNum);
    }

    const isoPath = path.join(isoDir, `${ts}_CAM${slotNum}_ISO.mp4`);

    try {
      const proc = spawn(ffmpegPath, [
        '-probesize', '16M',
        '-analyzeduration', '0',
        '-f', 'webm',
        '-i', 'pipe:0',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '18',
        '-pix_fmt', 'yuv420p',
        '-r', '30',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
        '-y',
        isoPath
      ], {
        stdio: ['pipe', 'ignore', 'pipe']
      });

      proc.on('error', (err) => {
        console.error(`[FFmpeg ISO CAM ${slotNum}] Error:`, err.message);
      });

      proc.on('close', () => {
        console.log(`[FFmpeg ISO CAM ${slotNum}] Cerrado limpiamente`);
      });

      ffmpegIsoProcesses.set(slotNum, { proc, path: isoPath, slotNum });
      startedSlots.push(slotNum);
    } catch (err) {
      console.warn(`[start-iso-recording] Fallo al iniciar ISO para CAM ${slotNum}:`, err.message);
    }
  });

  return { success: true, count: startedSlots.length, slots: startedSlots, isoDir };
});

ipcMain.on('record-iso-chunk', (event, { slot, chunk }) => {
  const slotNum = Number(slot);
  const entry = ffmpegIsoProcesses.get(slotNum);
  if (entry && entry.proc && entry.proc.stdin && !entry.proc.stdin.destroyed) {
    try {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      entry.proc.stdin.write(buf);
    } catch (e) {
      console.warn(`[record-iso-chunk] Error escribiendo en CAM ${slotNum}:`, e.message);
    }
  }
});

ipcMain.handle('stop-iso-recording', async () => {
  const entries = Array.from(ffmpegIsoProcesses.values());
  const completedPaths = [];

  for (const entry of entries) {
    try {
      if (entry.proc && entry.proc.stdin && !entry.proc.stdin.destroyed) {
        entry.proc.stdin.end();
      }
      completedPaths.push({ slot: entry.slotNum, path: entry.path });
    } catch (e) {}
  }

  ffmpegIsoProcesses.clear();
  return { success: true, files: completedPaths };
});

ipcMain.handle('get-iso-status', () => {
  const activeSlots = Array.from(ffmpegIsoProcesses.keys());
  return {
    isRecording: activeSlots.length > 0,
    activeSlots,
    count: activeSlots.length,
  };
});

// COPIAR GRABACIÓN Y MINIATURA OFICIAL DIRECTAMENTE A LA CARPETA DE DESCARGAS DE WINDOWS
ipcMain.handle('save-to-downloads', async (event, { sourcePath, filename }) => {
  try {
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      return { success: false, error: 'El archivo de video master no existe en disco' };
    }
    const downloadsFolder = app.getPath('downloads');
    const finalFilename = filename ? (filename.endsWith('.mp4') ? filename : `${filename}.mp4`) : path.basename(sourcePath);
    const destPath = path.join(downloadsFolder, finalFilename);
    fs.copyFileSync(sourcePath, destPath);

    // Copiar también la miniatura oficial JPG de alta resolución
    const thumbSrc = sourcePath.replace(/\.mp4$/i, '_Thumbnail.jpg');
    if (fs.existsSync(thumbSrc)) {
      const thumbDest = destPath.replace(/\.mp4$/i, '_Miniatura.jpg');
      try { fs.copyFileSync(thumbSrc, thumbDest); } catch (e) {}
    }

    return { success: true, path: destPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// EXPORTACIÓN MULTI-FORMATO NATIVA CON FFMPEG (TIKTOK 9:16, INSTAGRAM 1:1, FACEBOOK 16:9) A 1080P REAL
ipcMain.handle('export-social-format', async (event, { sourcePath, formatKey, projectName }) => {
  return new Promise((resolve) => {
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      return resolve({ success: false, error: 'Archivo de video original no encontrado' });
    }

    // Guardar SIEMPRE en la misma carpeta del video master para no duplicar carpetas
    let projectDir = (sourcePath && fs.existsSync(sourcePath)) ? path.dirname(sourcePath) : null;
    if (!projectDir) {
      const cleanProjectName = currentRecordingProjectName || (projectName ? String(projectName).replace(/^PodcaStudio_/i, '').replace(/_\d{10,}$/, '').replace(/[/\\?%*:|"<>]/g, '_').trim() : 'Proyecto_General');
      projectDir = path.join('D:', 'PROGRAMAS IA', 'PODCASTUDIO', 'proyectos', cleanProjectName);
    }
    if (!fs.existsSync(projectDir)) {
      try { fs.mkdirSync(projectDir, { recursive: true }); } catch (e) {}
    }

    let filter = '';
    let suffix = '16x9';

    if (formatKey === '9:16') {
      suffix = 'TikTok_Reels_9x16';
      filter = 'crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920';
    } else if (formatKey === '1:1') {
      suffix = 'Instagram_Feed_1x1';
      filter = 'crop=ih:ih:(iw-ih)/2:0,scale=1080:1080';
    } else if (formatKey === '4:5') {
      suffix = 'Facebook_Feed_4x5';
      filter = 'crop=ih*4/5:ih:(iw-ih*4/5)/2:0,scale=1080:1350';
    } else {
      suffix = 'Facebook_YouTube_16x9';
      filter = 'scale=1920:1080';
    }

    const baseName = path.basename(sourcePath, '.mp4');
    const outFilename = `${baseName}_${suffix}.mp4`;
    const outPath = path.join(projectDir, outFilename);

    const args = [
      '-y',
      '-i', sourcePath,
      '-vf', filter,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '18',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      outPath
    ];

    const convertProc = spawn(ffmpegPath, args);
    convertProc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outPath)) {
        // Copiar a la carpeta Downloads del usuario automáticamente
        const downloadsFolder = app.getPath('downloads');
        const dlPath = path.join(downloadsFolder, outFilename);
        try { fs.copyFileSync(outPath, dlPath); } catch (e) {}

        // Generar miniatura JPG para el formato exportado
        const thumbPath = outPath.replace(/\.mp4$/i, '_Thumbnail.jpg');
        try {
          const tProc = spawn(ffmpegPath, ['-y', '-ss', '00:00:00.800', '-i', outPath, '-vframes', '1', '-q:v', '2', thumbPath]);
          tProc.on('close', () => {
            const dlThumb = dlPath.replace(/\.mp4$/i, '_Miniatura.jpg');
            try { fs.copyFileSync(thumbPath, dlThumb); } catch (e) {}
            resolve({ success: true, path: outPath, downloadPath: dlPath });
          });
          setTimeout(() => resolve({ success: true, path: outPath, downloadPath: dlPath }), 1200);
          return;
        } catch (e) {}

        resolve({ success: true, path: outPath, downloadPath: dlPath });
      } else {
        resolve({ success: false, error: 'Error en proceso de conversión FFmpeg' });
      }
    });

    convertProc.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
});

// ============================================================================
// EXPORTADOR AUTOMÁTICO DE CLIPS HIGHLIGHT CON RECORTE TEMPORAL (P3.1)
// Corta clips de momentos destacados (15s, 30s, 60s) en 9:16 vertical o 16:9
// ============================================================================
ipcMain.handle('export-highlight-clip', async (event, { sourcePath, startTime, duration = 30, formatKey = '9:16', title, projectName }) => {
  return new Promise((resolve) => {
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      return resolve({ success: false, error: 'Video master no encontrado en disco' });
    }

    const cleanProjectName = projectName ? String(projectName).replace(/^PodcaStudio_/i, '').replace(/_\d{10,}$/, '').replace(/[/\\?%*:|"<>]/g, '_').trim() : 'Proyecto_General';
    const projectDir = path.join('D:', 'PROGRAMAS IA', 'PODCASTUDIO', 'proyectos', cleanProjectName);
    const clipsDir = path.join(projectDir, 'Clips');
    if (!fs.existsSync(clipsDir)) {
      try { fs.mkdirSync(clipsDir, { recursive: true }); } catch (e) {}
    }

    const safeTitle = (title || 'Highlight').replace(/[/\\?%*:|"<> ]/g, '_');
    const startSec = Math.max(0, parseFloat(startTime) || 0);
    const durSec = Math.max(3, parseFloat(duration) || 30);
    const suffix = formatKey === '9:16' ? '9x16_Vertical' : (formatKey === '1:1' ? '1x1_Instagram' : '16x9_Master');
    const outFilename = `Clip_${safeTitle}_${Math.floor(startSec)}s_${suffix}_${Date.now()}.mp4`;
    const outPath = path.join(clipsDir, outFilename);

    let filter = '';
    if (formatKey === '9:16') {
      filter = 'crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920';
    } else if (formatKey === '1:1') {
      filter = 'crop=ih:ih:(iw-ih)/2:0,scale=1080:1080';
    } else {
      filter = 'scale=1920:1080';
    }

    const args = [
      '-y',
      '-ss', startSec.toFixed(2),
      '-t', durSec.toFixed(2),
      '-i', sourcePath,
      '-vf', filter,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '18',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      outPath
    ];

    const convertProc = spawn(ffmpegPath, args);
    convertProc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outPath)) {
        const downloadsFolder = app.getPath('downloads');
        const dlPath = path.join(downloadsFolder, outFilename);
        try { fs.copyFileSync(outPath, dlPath); } catch (e) {}

        const thumbPath = outPath.replace(/\.mp4$/i, '_Thumbnail.jpg');
        try {
          const tProc = spawn(ffmpegPath, ['-y', '-ss', '00:00:00.800', '-i', outPath, '-vframes', '1', '-q:v', '2', thumbPath]);
          tProc.on('close', () => {
            const dlThumb = dlPath.replace(/\.mp4$/i, '_Miniatura.jpg');
            try { fs.copyFileSync(thumbPath, dlThumb); } catch (e) {}
            resolve({ success: true, path: outPath, downloadPath: dlPath });
          });
          setTimeout(() => resolve({ success: true, path: outPath, downloadPath: dlPath }), 1200);
          return;
        } catch (e) {}

        resolve({ success: true, path: outPath, downloadPath: dlPath });
      } else {
        resolve({ success: false, error: 'Error procesando clip con FFmpeg' });
      }
    });

    convertProc.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
});

ipcMain.handle('save-recording-thumbnail', async (event, { base64Data, targetPath, projectName }) => {
  try {
    if (!base64Data) return { success: false };
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    let dest = targetPath || (currentRecordingPath ? currentRecordingPath.replace(/\.mp4$/i, '_Thumbnail.jpg') : null);
    if (!dest) {
      const cleanProjectName = projectName ? String(projectName).replace(/[/\\?%*:|"<>]/g, '_').trim() : 'Proyecto_General';
      const projectDir = path.join('D:', 'PROGRAMAS IA', 'PODCASTUDIO', 'proyectos', cleanProjectName);
      if (!fs.existsSync(projectDir)) {
        try { fs.mkdirSync(projectDir, { recursive: true }); } catch (e) {}
      }
      dest = path.join(projectDir, `Thumbnail_${Date.now()}.jpg`);
    }
    if (dest) {
      fs.writeFileSync(dest, buffer);
      return { success: true, path: dest };
    }
    return { success: false };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('scan-network-cameras', async () => {
  const checkTcpPort = (host, port, timeout = 450) => {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(timeout);
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      socket.once('error', () => {
        socket.destroy();
        resolve(false);
      });
      try {
        socket.connect(port, host);
      } catch (e) {
        resolve(false);
      }
    });
  };

  const getLocalArpIps = () => {
    return new Promise((resolve) => {
      exec('arp -a', { timeout: 2000 }, (err, stdout) => {
        if (err || !stdout) return resolve([]);
        const ips = [];
        const lines = stdout.split('\n');
        for (const line of lines) {
          const match = line.trim().match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
          if (match) {
            const ip = match[1];
            if (!ip.startsWith('224.') && !ip.startsWith('239.') && !ip.endsWith('.255') && ip !== '127.0.0.1') {
              ips.push(ip);
            }
          }
        }
        resolve([...new Set(ips)]);
      });
    });
  };

  const discovered = [];

  // 1. Clientes móviles WebRTC actualmente conectados al servidor local
  if (mobileClients && mobileClients.size > 0) {
    for (const [clientId, ws] of mobileClients.entries()) {
      discovered.push({
        id: `mobile_live_${clientId}`,
        name: `Celular Conectado (${clientId.slice(-4)})`,
        url: null,
        type: 'remote',
        status: 'Transmitiendo en vivo vía WebRTC local',
        real: true,
      });
    }
  }

  // 2. Sondear IPs activas en la red mediante ARP y puertos de cámaras reales
  try {
    const arpIps = await getLocalArpIps();
    // Subnet local base
    const baseIps = ['127.0.0.1', LOCAL_IP, '192.168.1.1', '192.168.1.254', '10.5.5.9', '192.168.42.1'];
    const ipsToScan = [...new Set([...baseIps, ...arpIps])];

    const cameraPorts = [
      { port: 554, name: 'Cámara Steren / China (RTSP)', path: '', proto: 'rtsp' },
      { port: 80, name: 'Cámara IP / Web Stream', path: '/video', proto: 'http' },
      { port: 8080, name: 'GoPro / IP Webcam', path: '/video', proto: 'http' },
      { port: 8000, name: 'Cámara ONVIF / CCTV', path: '', proto: 'http' },
      { port: 8899, name: 'Cámara Wi-Fi Genérica', path: '/onvif/device_service', proto: 'http' },
      { port: 4747, name: 'DroidCam Wi-Fi', path: '/video', proto: 'http' },
      { port: 8192, name: 'Cámara de Acción', path: '/', proto: 'http' },
      { port: 8554, name: 'RTSP Stream Universal', path: '', proto: 'rtsp' },
    ];

    const probePromises = [];

    for (const ip of ipsToScan) {
      for (const cp of cameraPorts) {
        probePromises.push(
          checkTcpPort(ip, cp.port, 400).then((isOpen) => {
            if (isOpen) {
              if (cp.port === 554) {
                // Generar perfiles específicos para SterenCAM-900 y SterenCAM500
                discovered.push({
                  id: `steren_900_${ip}`,
                  name: `SterenCAM-900 (${ip})`,
                  url: `rtsp://admin:123456789@${ip}:554/live/ch0`,
                  type: 'wifi_url',
                  status: `Cámara SterenCAM-900 (RTSP Clave: 123456789)`,
                  real: true,
                });
                discovered.push({
                  id: `steren_500_${ip}`,
                  name: `SterenCAM500 (${ip})`,
                  url: `rtsp://admin:66666666@${ip}:554/live/ch0`,
                  type: 'wifi_url',
                  status: `Cámara SterenCAM500 (RTSP Clave: 66666666)`,
                  real: true,
                });
              }
              const streamUrl = cp.proto === 'rtsp'
                ? `rtsp://${ip}:${cp.port}${cp.path}`
                : (cp.path ? `http://${ip}:${cp.port}${cp.path}` : `http://${ip}:${cp.port}`);
              discovered.push({
                id: `real_cam_${ip}_${cp.port}`,
                name: `${cp.name} (${ip})`,
                url: streamUrl,
                type: 'wifi_url',
                status: `Cámara activa en red (puerto ${cp.port})`,
                real: true,
              });
            }
          })
        );
      }
    }

    await Promise.all(probePromises);
  } catch (err) {
    console.warn('[Network Scanner Error]:', err.message);
  }

  // Retorna ÚNICAMENTE las cámaras que respondieron de verdad
  return discovered;
});

// ============================================================================
// TRANSMISIÓN EN VIVO REAL / MULTI-STREAMING SIMULTÁNEO (FACEBOOK LIVE RTMPS + YOUTUBE + TIKTOK)
// Cada destino corre en su propio worker FFmpeg dedicado para evitar caídas y asegurar handshake TLS
// ============================================================================
ipcMain.handle('start-streaming', async (event, payload) => {
  return new Promise((resolve) => {
    let targets = [];
    if (typeof payload === 'string') {
      targets = [{ id: 'custom', name: 'Stream', url: payload.trim() }];
    } else if (payload && Array.isArray(payload.destinations)) {
      targets = payload.destinations.filter(d => d.url && d.url.trim().length > 0);
    }

    if (targets.length === 0) {
      return resolve({ success: false, error: "No se proporcionaron destinos válidos con clave de transmisión." });
    }

    if (payload && payload.initialHeader && Array.isArray(payload.initialHeader)) {
      streamInitHeader = Buffer.from(payload.initialHeader);
    }

    // Detener cualquier worker anterior
    for (const worker of activeStreamWorkers) {
      try {
        if (worker.process && worker.process.stdin && !worker.process.stdin.destroyed) {
          worker.process.stdin.end();
        }
        worker.process.kill('SIGINT');
      } catch (e) {}
    }
    activeStreamWorkers = [];
    streamDestinations = targets;

    let startedCount = 0;
    const errors = [];

    // Spawnea un proceso FFmpeg independiente para cada destino configurado
    for (const target of targets) {
      const destUrl = target.url.trim();

      const workerArgs = [
        '-probesize', '32M',
        '-analyzeduration', '2000000',
        '-fflags', '+nobuffer+flush_packets',
        '-f', 'webm',
        '-i', 'pipe:0',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-b:v', '2500k',
        '-maxrate', '2800k',
        '-bufsize', '2800k',
        '-pix_fmt', 'yuv420p',
        '-g', '60',
        '-keyint_min', '60',
        '-r', '30',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '48000',
        '-max_interleave_delta', '0',
        '-flvflags', 'no_duration_filesize',
        '-rtmp_buffer', '100',
        '-rtmp_live', 'live',
        '-f', 'flv',
        destUrl
      ];

      try {
        const proc = spawn(ffmpegPath, workerArgs, {
          stdio: ['pipe', 'ignore', 'pipe']
        });

        const workerEntry = {
          id: target.id,
          name: target.name,
          url: destUrl,
          process: proc,
          connected: false
        };

        // Si ya disponemos de la cabecera EBML inicial del Master, inyectarla al inicio de la tubería
        if (streamInitHeader && proc.stdin && !proc.stdin.destroyed) {
          try {
            proc.stdin.write(streamInitHeader);
          } catch (e) {}
        }

        proc.stderr.on('data', (data) => {
          const msg = data.toString();
          console.log(`[FFmpeg Stream ${target.name}]:`, msg);
          if (!workerEntry.connected && (msg.includes('Output #0') || msg.includes('Stream #0') || msg.includes('frame='))) {
            workerEntry.connected = true;
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('stream-status', {
                active: true,
                destinations: streamDestinations
              });
            }
          }

          // Telemetría de salud y estabilidad de streaming (Fase P1.4)
          if (msg.includes('frame=') || msg.includes('bitrate=')) {
            const fpsMatch = msg.match(/fps=\s*([\d.]+)/);
            const bitrateMatch = msg.match(/bitrate=\s*([\d.]+\s*\w+\/s)/);
            const dropMatch = msg.match(/drop=\s*(\d+)/);
            const speedMatch = msg.match(/speed=\s*([\d.]+x)/);

            if (mainWindow && !mainWindow.isDestroyed()) {
              const dropped = dropMatch ? parseInt(dropMatch[1], 10) : 0;
              mainWindow.webContents.send('stream-telemetry', {
                targetId: target.id,
                targetName: target.name,
                fps: fpsMatch ? parseFloat(fpsMatch[1]) : 30,
                bitrate: bitrateMatch ? bitrateMatch[1] : '2500 kbits/s',
                droppedFrames: dropped,
                speed: speedMatch ? speedMatch[1] : '1.0x',
                health: dropped > 15 ? 'warning' : 'excellent'
              });
            }
          }
        });

        proc.on('error', (err) => {
          console.error(`Error en worker stream (${target.name}):`, err.message);
          errors.push(`${target.name}: ${err.message}`);
        });

        proc.on('close', (code) => {
          console.log(`Worker stream (${target.name}) cerrado con código: ${code}`);
          activeStreamWorkers = activeStreamWorkers.filter(w => w !== workerEntry);
          if (activeStreamWorkers.length === 0 && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('stream-status', {
              active: false,
              destinations: []
            });
          }
        });

        activeStreamWorkers.push(workerEntry);
        startedCount++;
      } catch (err) {
        errors.push(`${target.name}: ${err.message}`);
      }
    }

    if (startedCount > 0) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('stream-status', {
          active: true,
          destinations: streamDestinations
        });
      }
      resolve({ success: true, destinations: targets });
    } else {
      resolve({ success: false, error: errors.join(', ') || 'No se pudo conectar a los servidores de streaming.' });
    }
  });
});

let streamInitHeader = null;

// Receptor de chunks de audio/video del Master en vivo
ipcMain.on('stream-chunk', (event, chunkBuffer) => {
  if (!chunkBuffer) return;
  try {
    const buf = Buffer.isBuffer(chunkBuffer) ? chunkBuffer : Buffer.from(chunkBuffer);
    if (!streamInitHeader) {
      streamInitHeader = buf;
    }
    if (activeStreamWorkers.length === 0) return;
    for (const worker of activeStreamWorkers) {
      if (worker.process && worker.process.stdin && !worker.process.stdin.destroyed) {
        try {
          worker.process.stdin.write(buf);
        } catch (e) {}
      }
    }
  } catch (err) {}
});

ipcMain.handle('stop-streaming', async () => {
  return new Promise((resolve) => {
    streamInitHeader = null;
    for (const worker of activeStreamWorkers) {
      try {
        if (worker.process && worker.process.stdin && !worker.process.stdin.destroyed) {
          worker.process.stdin.end();
        }
        setTimeout(() => {
          try {
            if (worker.process) worker.process.kill('SIGINT');
          } catch (e) {}
        }, 500);
      } catch (e) {}
    }
    activeStreamWorkers = [];
    streamDestinations = [];
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('stream-status', {
        active: false,
        destinations: []
      });
    }
    resolve({ success: true });
  });
});