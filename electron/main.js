process.on('uncaughtException', (err) => {
  console.warn('[Electron Main Process UncaughtException]', err?.message || err);
});
process.on('unhandledRejection', (reason) => {
  console.warn('[Electron Main Process UnhandledRejection]', reason);
});

const { app, BrowserWindow, Menu, ipcMain, session, shell, desktopCapturer } = require('electron');
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
const { setupNativeEngineIPC } = require('./media-engine/bridge');

try {
  setupNativeEngineIPC();
} catch (e) {
  console.warn('[Native Engine IPC] Init warning:', e.message);
}

function writeChunkWithBackpressure(writable, chunk) {
  return new Promise((resolve, reject) => {
    if (!writable || writable.destroyed || writable.writableEnded) return resolve();
    let settled = false;
    const cleanup = () => {
      writable.removeListener('drain', onDrain);
      writable.removeListener('error', onError);
    };
    const finish = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    const onDrain = () => finish();
    const onError = (error) => finish(error);
    writable.once('error', onError);
    try {
      if (writable.write(chunk)) finish();
      else writable.once('drain', onDrain);
    } catch (error) {
      finish(error);
    }
  });
}

// Configurar App ID oficial para Windows para asociar el icono de PodcastStudio en la barra de tareas
if (process.platform === 'win32') {
  app.setAppUserModelId("com.podcaststudio.app");
}
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
// Switches Chromium para latencia ultra-baja y cero throttling de video/audio en Windows
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

ffmpeg.setFfmpegPath(ffmpegPath);
let mainWindow;
let ffmpegRecordProcess = null;
let recordChunkQueue = Promise.resolve();
let recordChunkError = null;
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
  // Abrir ocupando el área de trabajo completa evita que el renderer quede
  // limitado al ancho inicial y deje una banda negra dentro de la ventana.
  mainWindow.maximize();

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
let latestCamThumbnails = {};
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

  // Transcodificador universal RTSP a MJPEG vía FFmpeg para cámaras Wi-Fi / IP (TP-Link Tapo, ONVIF, etc.)
  appServer.get('/api/rtsp-stream', (req, res) => {
    const rtspUrl = req.query.url;
    if (!rtspUrl) return res.status(400).send('Missing url');

    res.writeHead(200, {
      'Content-Type': 'multipart/x-mixed-replace; boundary=ffmpegframe',
      'Connection': 'close',
      'Pragma': 'no-cache',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    });

    console.log('[RTSP-STREAM] Conectando FFmpeg a URL RTSP:', rtspUrl);

    const ffProc = spawn(ffmpegPath, [
      '-rtsp_transport', 'tcp',
      '-timeout', '15000000',
      '-analyzeduration', '2000000',
      '-probesize', '1000000',
      '-i', rtspUrl,
      '-f', 'mpjpeg',
      '-boundary_tag', 'ffmpegframe',
      '-q:v', '2',
      '-r', '30',
      '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black',
      'pipe:1'
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    ffProc.stderr.on('data', (d) => {
      const msg = d.toString();
      if (msg.includes('Error') || msg.includes('404') || msg.includes('401') || msg.includes('Invalid') || msg.includes('Unauthorized')) {
        console.warn('[RTSP-FFMPEG]:', msg.trim());
      }
    });

    ffProc.stdout.pipe(res);

    ffProc.on('close', (code) => {
      if (code !== 0) {
        console.warn(`[RTSP-FFMPEG] Proceso FFmpeg terminó con código ${code}`);
        try { res.end(); } catch (e) {}
      }
    });

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
          if (latestCamThumbnails && Object.keys(latestCamThumbnails).length > 0 && ws.readyState === 1) {
            try { ws.send(JSON.stringify({ type: 'cam-thumbnails', thumbnails: latestCamThumbnails })); } catch(e) {}
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
          mainWindow.webContents.send('remote-offer', {
            id: ws.clientId,
            offer: data.offer,
            slot: data.slot,
            name: data.name,
            role: data.role
          });
        } else if (data.type === 'candidate') {
          mainWindow.webContents.send('remote-candidate', { id: ws.clientId, candidate: data.candidate });
        }
      } catch (err) {
        console.error('Error procesando mensaje WebSocket:', err);
      }
    });

    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    const heartbeat = setInterval(() => {
      if (ws.isAlive === false) {
        clearInterval(heartbeat);
        try { ws.terminate(); } catch (e) {}
        return;
      }
      ws.isAlive = false;
      try { ws.ping(); } catch (e) {}
    }, 10000);

    ws.on('close', () => {
      clearInterval(heartbeat);
      remoteControlClients.delete(ws);
      tallyClients.delete(ws);
      programFeedClients.delete(ws);
      mobileClients.delete(ws.clientId);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('remote-disconnected', ws.clientId);
      }
    });

    ws.on('error', () => {
      clearInterval(heartbeat);
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
              const isHttps = window.location.protocol === 'https:';
              const wssUrl = 'wss://' + LOCAL_IP + ':3000';
              const wsUrl = 'ws://' + LOCAL_IP + ':3001';
              const primaryUrl = isHttps ? wssUrl : wsUrl;

              let socket = new WebSocket(primaryUrl);
              let connected = false;

              const timer = setTimeout(() => {
                if (!connected) {
                  try { socket.close(); } catch (e) {}
                  socket = new WebSocket(isHttps ? wsUrl : wssUrl);
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
              if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                alert('El navegador bloqueó la cámara por seguridad. En Android, abre en Chrome y asegúrate de dar permisos de cámara.');
                return;
              }

              try {
                currentStream = await navigator.mediaDevices.getUserMedia({
                  video: { 
                    facingMode: currentFacing, 
                    width: { ideal: 1920 }, 
                    height: { ideal: 1080 }, 
                    frameRate: { ideal: 30 } 
                  },
                  audio: true
                });
              } catch (retryErr) {
                currentStream = await navigator.mediaDevices.getUserMedia({
                  video: { facingMode: currentFacing },
                  audio: true
                });
              }

              // Activar auto-enfoque continuo por hardware en el móvil
              const vTrack = currentStream.getVideoTracks()[0];
              if (vTrack && vTrack.applyConstraints) {
                try {
                  await vTrack.applyConstraints({
                    advanced: [{ focusMode: 'continuous' }]
                  });
                } catch (e) {}
              }

              videoEl.srcObject = currentStream;
              videoEl.setAttribute('playsinline', 'true');
              videoEl.setAttribute('webkit-playsinline', 'true');
              videoEl.muted = true;
              videoEl.defaultMuted = true;
              videoEl.style.display = 'block';
              footerControls.style.display = 'flex';
              videoEl.play().catch(() => { document.addEventListener('touchstart', () => videoEl.play().catch(()=>{}), {once:true}); });

              updateStatus('Conectando al Estudio...', '');
              await connectWebSocket();

              pc = new RTCPeerConnection({
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun.cloudflare.com:3478' },
            ],
            iceCandidatePoolSize: 0,
            iceTransportPolicy: 'all'
          });

              currentStream.getTracks().forEach(track => {
                const sender = pc.addTrack(track, currentStream);
                if (track.kind === 'video') {
                  try {
                    const params = sender.getParameters();
                    if (!params.encodings) params.encodings = [{}];
                    params.encodings[0].maxBitrate = 5000000;
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
              };

              // Preferencia de códecs universales (VP8 y H.264)
              try {
                const transceivers = pc.getTransceivers();
                const vTransceiver = transceivers.find(t => t.sender && t.sender.track && t.sender.track.kind === 'video');
                if (vTransceiver && 'setCodecPreferences' in vTransceiver && window.RTCRtpReceiver && RTCRtpReceiver.getCapabilities) {
                  const caps = RTCRtpReceiver.getCapabilities('video');
                  if (caps && caps.codecs) {
                    const vp8 = caps.codecs.filter(c => c.mimeType.toLowerCase() === 'video/vp8');
                    const h264 = caps.codecs.filter(c => c.mimeType.toLowerCase() === 'video/h264');
                    const others = caps.codecs.filter(c => !vp8.includes(c) && !h264.includes(c));
                    const preferred = [...vp8, ...h264, ...others];
                    if (preferred.length > 0) {
                      try { vTransceiver.setCodecPreferences(preferred); } catch (e) {}
                    }
                  }
                }
              } catch (e) {}

              const offer = await pc.createOffer({
                offerToReceiveAudio: false,
                offerToReceiveVideo: false
              });

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

  appServer.get('/api/cam-thumbnail/:slot', (req, res) => {
    const slot = req.params.slot;
    const dataUrl = latestCamThumbnails[slot];
    if (!dataUrl) {
      return res.status(404).send('No frame yet for cam ' + slot);
    }
    try {
      const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': buffer.length,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      res.end(buffer);
    } catch(e) {
      res.status(500).send('Error serving thumbnail');
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
    try {
      session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = details.responseHeaders || {};
        responseHeaders['Access-Control-Allow-Origin'] = ['*'];
        responseHeaders['Access-Control-Allow-Methods'] = ['GET, POST, OPTIONS, HEAD'];
        responseHeaders['Access-Control-Allow-Headers'] = ['*'];
        callback({ responseHeaders });
      });
    } catch (e) {}
    createWindow();
    setImmediate(() => {
      startMediaServer();
    });
  });
}

ipcMain.handle('get-desktop-sources', async (event, opts) => {
  try {
    const sources = await desktopCapturer.getSources(opts || { types: ['window', 'screen'], thumbnailSize: { width: 320, height: 180 } });
    return sources.map(s => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail.toDataURL()
    }));
  } catch (err) {
    console.error('Error obteniendo fuentes de escritorio:', err);
    return [];
  }
});

ipcMain.handle('get-qr-url', () => `https://www.podcastudio.mx/remote-cam?auto=true`);

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
// DESCUBRIDOR REAL DE CÁMARAS IP / WI-FI EN LA RED LOCAL (ONVIF, RTSP, TP-LINK TAPO, UNIVERSAL)
// ============================================================================
ipcMain.handle('discover-network-cameras', async () => {
  return new Promise((resolve) => {
    const discovered = new Map();
    const dgram = require('dgram');
    const net = require('net');

    // Timeout global de seguridad para evitar bloqueo indefinido
    const globalTimeout = setTimeout(() => {
      try { if (udpClient) udpClient.close(); } catch (e) {}
      resolve({ success: true, cameras: Array.from(discovered.values()), total: discovered.size });
    }, 8000);

    const subnetPrefix = LOCAL_IP && LOCAL_IP.includes('.') ? LOCAL_IP.substring(0, LOCAL_IP.lastIndexOf('.') + 1) : '192.168.1.';
    const arpIps = new Set();

    // 1. Enviar Sonda WS-Discovery ONVIF por Multicast UDP a 239.255.255.250:3702
    let udpClient = null;
    try {
      udpClient = dgram.createSocket('udp4');
      const probeXml = `<?xml version="1.0" encoding="utf-8"?>
<Envelope xmlns="http://www.w3.org/2003/05/soap-envelope">
  <Header>
    <wsa:MessageID xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing">uuid:${Date.now()}</wsa:MessageID>
    <wsa:To xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing">urn:schemas-xmlsoap-org:ws:2005:04:discovery</wsa:To>
    <wsa:Action xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing">http://schemas.xmlsoap.org/ws/2005:04/discovery/Probe</wsa:Action>
  </Header>
  <Body>
    <Probe xmlns="http://schemas.xmlsoap.org/ws/2005/04/discovery">
      <Types xmlns:dn="http://www.onvif.org/ver10/network/wsdl">dn:NetworkVideoTransmitter</Types>
    </Probe>
  </Body>
</Envelope>`;

      udpClient.on('message', (msg, rinfo) => {
        const resp = msg.toString();
        const ip = rinfo.address;
        const xaddrMatch = resp.match(/XAddrs>([^<]+)<\//i);
        const xaddr = xaddrMatch ? xaddrMatch[1].trim() : '';

        let name = `Cámara Wi-Fi / IP (${ip})`;
        const respLower = resp.toLowerCase();
        if (respLower.includes('tapo') || respLower.includes('tp-link')) {
          name = `Cámara TP-Link Tapo (${ip})`;
        } else if (respLower.includes('hikvision')) {
          name = `Cámara Hikvision (${ip})`;
        } else if (respLower.includes('dahua')) {
          name = `Cámara Dahua (${ip})`;
        }

        discovered.set(ip, {
          id: `cam_onvif_${ip}`,
          name,
          ip,
          port: 554,
          type: 'wifi_url',
          protocol: 'RTSP',
          url: `rtsp://${ip}:554/live`,
          service: xaddr
        });
      });

      udpClient.bind(() => {
        try {
          udpClient.setBroadcast(true);
          udpClient.send(probeXml, 3702, '239.255.255.250');
        } catch(e) {}
      });
    } catch(e) {}

    // 2. Leer tabla ARP para IPs prioritarias
    exec('arp -a', { timeout: 1500, encoding: 'utf8' }, async (arpErr, arpStdout) => {
      if (!arpErr && arpStdout) {
        const ipRegex = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g;
        let match;
        while ((match = ipRegex.exec(arpStdout)) !== null) {
          const ip = match[1];
          if (ip.startsWith(subnetPrefix) && !ip.endsWith('.255') && !ip.endsWith('.1') && ip !== LOCAL_IP) {
            arpIps.add(ip);
          }
        }
      }

      // Función para probar un socket TCP
      const checkPort = (ip, port, timeout = 750) => {
        return new Promise(res => {
          const s = new net.Socket();
          s.setTimeout(timeout);
          s.once('connect', () => {
            s.destroy();
            res(true);
          });
          s.once('timeout', () => { s.destroy(); res(false); });
          s.once('error', () => res(false));
          try { s.connect(port, ip); } catch(e) { res(false); }
        });
      };

      // Lista de IPs a sondear: primero las de ARP (alta prioridad), luego el resto de la subred
      const allSubnetIps = [];
      for (let i = 1; i <= 254; i++) {
        const ip = `${subnetPrefix}${i}`;
        if (ip !== LOCAL_IP && !ip.endsWith('.255') && !ip.endsWith('.1')) {
          allSubnetIps.push(ip);
        }
      }

      // Ordenar: primero las que están en ARP
      const sortedIps = [...arpIps, ...allSubnetIps.filter(ip => !arpIps.has(ip))];

      // Probar en lotes de 25 para no saturar la pila de red de Windows
      const BATCH_SIZE = 25;
      for (let i = 0; i < sortedIps.length; i += BATCH_SIZE) {
        const batch = sortedIps.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (ip) => {
          if (discovered.has(ip)) return;
          // Chequear puerto RTSP principal 554
          const is554Open = await checkPort(ip, 554, 750);
          if (is554Open) {
            discovered.set(ip, {
              id: `cam_${ip}_554`,
              name: `Cámara Wi-Fi / IP (${ip})`,
              ip,
              port: 554,
              type: 'wifi_url',
              protocol: 'RTSP',
              url: `rtsp://${ip}:554/live`
            });
            return;
          }
          // Chequear puerto Action Cam / Web IP 8192
          const is8192Open = await checkPort(ip, 8192, 400);
          if (is8192Open) {
            discovered.set(ip, {
              id: `cam_${ip}_8192`,
              name: `Cámara IP / Wi-Fi (${ip})`,
              ip,
              port: 8192,
              type: 'wifi_url',
              protocol: 'HTTP',
              url: `http://${ip}:8192/`
            });
          }
        }));

        // Si ya encontramos cámaras en las primeras páginas de ARP, dar tiempo pero continuar
      }

      if (udpClient) {
        try { udpClient.close(); } catch(e) {}
      }

      clearTimeout(globalTimeout);
      const cameras = Array.from(discovered.values());
      resolve({
        success: true,
        cameras,
        total: cameras.length
      });
    });
  });
});

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

ipcMain.on('cam-thumbnails', (event, thumbs) => {
  if (!thumbs) return;
  latestCamThumbnails = { ...latestCamThumbnails, ...thumbs };
  if (remoteControlClients.size === 0) return;
  const msg = JSON.stringify({ type: 'cam-thumbnails', thumbnails: thumbs });
  remoteControlClients.forEach(client => {
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
    const portMatch = String(port).match(/^COM(\d+)$/i);
    if (!portMatch) return resolve({ success: false, error: 'Formato de puerto inválido (ej: COM3, COM10)' });
    const portNum = parseInt(portMatch[1], 10);
    if (portNum < 1 || portNum > 255) return resolve({ success: false, error: 'Número de puerto fuera de rango (1-255)' });
    const cleanBaud = parseInt(baudRate) || 9600;
    const cleanData = String(data).replace(/"/g, '`"');

    const psScript = `try { $p = New-Object System.IO.Ports.SerialPort 'COM${portNum}', ${cleanBaud}, None, 8, One; $p.ReadTimeout = 500; $p.WriteTimeout = 500; $p.Open(); $p.WriteLine("${cleanData}"); $p.Close(); Write-Output "OK" } catch { Write-Output "ERR:$($_.Exception.Message)" }`;
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

function getProjectsRootDir() {
  if (process.env.PODCASTUDIO_PROJECTS_DIR) return process.env.PODCASTUDIO_PROJECTS_DIR;
  const preferredD = path.join('D:', 'PROGRAMAS IA', 'PODCASTUDIO', 'proyectos');
  if (fs.existsSync(path.join('D:', 'PROGRAMAS IA', 'PODCASTUDIO'))) {
    return preferredD;
  }
  return path.join(app.getPath('videos'), 'PodcastStudio');
}

ipcMain.on('open-external', (event, url) => shell.openExternal(url));

ipcMain.on('open-recordings-folder', (event, projectName) => {
  const cleanProjectName = projectName ? String(projectName).replace(/[/\\?%*:|"<>]/g, '_').trim() : '';
  let recDir = getProjectsRootDir();
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
let streamStartupInProgress = false;
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
    recordChunkQueue = Promise.resolve();
    recordChunkError = null;

    // Carpeta raíz estructurada garantizada en D:\PROGRAMAS IA\PODCASTUDIO\proyectos\[NombreProyecto]\
    const projectsRoot = getProjectsRootDir();
    const projectDir = path.join(projectsRoot, cleanProjectName);
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
      // Configuración de codificación Full HD broadcast instantánea (probesize optimizado + auto mapping de audio)
      ffmpegRecordProcess = spawn(ffmpegPath, [
        '-probesize', '2M',
        '-analyzeduration', '1000000',
        '-f', 'webm',
        '-i', 'pipe:0',
        '-map', '0:v:0',
        '-map', '0:a?',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '18',
        '-maxrate', '10M',
        '-bufsize', '20M',
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

      if (ffmpegRecordProcess.stderr) {
        ffmpegRecordProcess.stderr.on('data', (data) => {
          const msg = data.toString();
          if (msg.includes('Error') || msg.includes('fatal') || msg.includes('Opening') || msg.includes('frame=')) {
            console.log('[FFmpeg Grabación]:', msg.trim());
          }
        });
      }

      ffmpegRecordProcess.on('error', (err) => {
        console.error('Error FFmpeg Grabación:', err.message);
      });

      ffmpegRecordProcess.on('close', (code) => {
        console.log('[FFmpeg Grabación] Proceso finalizó con código:', code);
        ffmpegRecordProcess = null;
      });

      const initialHeader = options?.initialHeader;
      if (initialHeader && ffmpegRecordProcess.stdin && !ffmpegRecordProcess.stdin.destroyed) {
        const headerBuffer = Buffer.isBuffer(initialHeader) ? initialHeader : Buffer.from(initialHeader);
        const proc = ffmpegRecordProcess;
        recordChunkQueue = writeChunkWithBackpressure(proc.stdin, headerBuffer).catch((error) => {
          recordChunkError = error.message || String(error);
          console.warn('[FFmpeg Grabación] No se pudo escribir la cabecera WebM:', recordChunkError);
        });
      }

      resolve({ success: true, path: currentRecordingPath, projectName: cleanProjectName });
    } catch (err) {
      console.error('Fallo al iniciar grabación FFmpeg:', err);
      resolve({ success: false, error: err.message });
    }
  });
});

ipcMain.on('record-chunk', (event, chunkBuffer) => {
  const proc = ffmpegRecordProcess;
  if (!proc?.stdin || proc.stdin.destroyed || !chunkBuffer) return;
  let buf;
  try { buf = Buffer.isBuffer(chunkBuffer) ? chunkBuffer : Buffer.from(chunkBuffer); }
  catch (e) { recordChunkError = e.message; return; }
  recordChunkQueue = recordChunkQueue.then(() => writeChunkWithBackpressure(proc.stdin, buf)).catch((error) => {
    recordChunkError = error.message || String(error);
    console.warn('Error escribiendo chunk de grabación:', recordChunkError);
  });
});

ipcMain.handle('flush-recording-chunks', async () => {
  await recordChunkQueue;
  return { success: !recordChunkError, error: recordChunkError };
});

ipcMain.handle('stop-recording', async () => {
  await recordChunkQueue;
  return new Promise((resolve) => {
    if (ffmpegRecordProcess) {
      const proc = ffmpegRecordProcess;
      const recPath = currentRecordingPath;
      let finished = false;
      let stopTimeout = null;
      let forcedCloseTimeout = null;

      const finishAndGenerateThumb = () => {
        if (finished) return;
        finished = true;
        ffmpegRecordProcess = null;

        if (recPath && fs.existsSync(recPath) && fs.statSync(recPath).size > 0) {
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
            let thumbResolved = false;
            const thumbTimeout = setTimeout(() => {
              if (thumbResolved) return;
              thumbResolved = true;
              try { thumbProcess.kill(); } catch (e) {}
              resolve({ success: true, path: recPath, thumbnailError: 'No se pudo generar la miniatura del video.' });
            }, 15000);
            thumbProcess.on('close', (code) => {
              if (thumbResolved) return;
              thumbResolved = true;
              clearTimeout(thumbTimeout);
              if (code === 0 && fs.existsSync(thumbPath) && fs.statSync(thumbPath).size > 0) {
                resolve({ success: true, path: recPath, thumbnailPath: thumbPath });
              } else {
                resolve({ success: true, path: recPath, thumbnailError: 'El MP4 se guardó, pero no se pudo generar su miniatura.' });
              }
            });
            thumbProcess.on('error', (err) => {
              if (thumbResolved) return;
              thumbResolved = true;
              clearTimeout(thumbTimeout);
              resolve({ success: true, path: recPath, thumbnailError: `No se pudo generar la miniatura: ${err.message}` });
            });
            return;
          } catch (e) {
            resolve({ success: true, path: recPath, thumbnailError: `No se pudo iniciar la miniatura: ${e.message}` });
            return;
          }
        }
        resolve({ success: false, path: recPath, error: 'FFmpeg no creó un archivo MP4 válido.' });
      };

      proc.on('close', (code) => {
        if (stopTimeout) clearTimeout(stopTimeout);
        if (forcedCloseTimeout) clearTimeout(forcedCloseTimeout);
        console.log('[FFmpeg Grabación] Proceso cerrado limpiamente con código:', code);
        if (code !== 0 || recordChunkError) {
          finished = true;
          if (ffmpegRecordProcess === proc) ffmpegRecordProcess = null;
          resolve({ success: false, path: recPath, error: recordChunkError || `FFmpeg terminó con código ${code}.` });
          return;
        }
        finishAndGenerateThumb();
      });

      // Señalizar fin de stream a FFmpeg para que escriba las cabeceras completas y faststart
      try {
        if (proc.stdin && !proc.stdin.destroyed) {
          proc.stdin.end();
        }
      } catch (e) {}

      // Dejar que FFmpeg finalice el contenedor y mueva el índice MP4 antes de terminar.
      stopTimeout = setTimeout(() => {
        if (!finished) {
          console.error('[FFmpeg Grabación] FFmpeg tardó demasiado en cerrar; terminando con error.');
          try { proc.kill(); } catch (e) {}
          forcedCloseTimeout = setTimeout(() => {
            if (finished) return;
            finished = true;
            if (ffmpegRecordProcess === proc) ffmpegRecordProcess = null;
            resolve({ success: false, path: recPath, error: 'FFmpeg no cerró el archivo de grabación dentro del tiempo permitido.' });
          }, 5000);
        }
      }, 60000);
    } else {
      resolve({ success: false, error: 'No hay una grabación activa para finalizar.' });
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

  const projectsRoot = getProjectsRootDir();
  const isoDir = path.join(projectsRoot, cleanProjectName, 'ISO');
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
        '-preset', 'ultrafast',
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

      ffmpegIsoProcesses.set(slotNum, { proc, path: isoPath, slotNum, writeQueue: Promise.resolve() });
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
  if (!entry?.proc?.stdin || entry.proc.stdin.destroyed || !chunk) return;
  let buf;
  try { buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); }
  catch (e) { console.warn(`[record-iso-chunk] Error leyendo CAM ${slotNum}:`, e.message); return; }
  entry.writeQueue = entry.writeQueue.then(() => writeChunkWithBackpressure(entry.proc.stdin, buf)).catch((error) => {
    console.warn(`[record-iso-chunk] Error escribiendo en CAM ${slotNum}:`, error.message);
  });
});

ipcMain.handle('stop-iso-recording', async () => {
  const entries = Array.from(ffmpegIsoProcesses.values());
  const completedPaths = [];

  await Promise.all(entries.map(async (entry) => {
    try {
      await entry.writeQueue;
      if (entry.proc?.stdin && !entry.proc.stdin.destroyed) entry.proc.stdin.end();
      const code = await new Promise((resolve) => {
        if (entry.proc?.exitCode != null) return resolve(entry.proc.exitCode);
        const timeout = setTimeout(() => {
          try { entry.proc?.kill('SIGINT'); } catch (e) {}
          resolve(null);
        }, 30000);
        entry.proc?.once('close', (exitCode) => { clearTimeout(timeout); resolve(exitCode); });
      });
      const validFile = fs.existsSync(entry.path) && fs.statSync(entry.path).size > 0;
      if (code === 0 && validFile) completedPaths.push({ slot: entry.slotNum, path: entry.path });
      else console.warn(`[ISO] El archivo de CAM ${entry.slotNum} no finalizó correctamente (code=${code}).`);
    } catch (e) {
      console.warn(`[ISO] Error cerrando CAM ${entry.slotNum}:`, e.message);
    }
  }));
  ffmpegIsoProcesses.clear();
  return { success: completedPaths.length === entries.length, files: completedPaths };
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
      const projectsRoot3 = getProjectsRootDir();
      projectDir = path.join(projectsRoot3, cleanProjectName);
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
    } else if (formatKey === '16:9_yt') {
      suffix = 'YouTube_16x9';
      filter = 'scale=1920:1080';
    } else {
      suffix = 'Facebook_16x9';
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
        try { fs.copyFileSync(outPath, dlPath); }
        catch (e) { return resolve({ success: false, path: outPath, error: `El archivo quedó en el proyecto, pero no se pudo copiar a Descargas: ${e.message}` }); }

        // Generar miniatura JPG para el formato exportado
        const thumbPath = outPath.replace(/\.mp4$/i, '_Thumbnail.jpg');
        try {
          const tProc = spawn(ffmpegPath, ['-y', '-ss', '00:00:00.800', '-i', outPath, '-vframes', '1', '-q:v', '2', thumbPath]);
          let thumbFinished = false;
          const thumbTimeout = setTimeout(() => {
            if (thumbFinished) return;
            thumbFinished = true;
            try { tProc.kill(); } catch (e) {}
            resolve({ success: false, path: outPath, downloadPath: dlPath, error: 'El video se guardó, pero la miniatura tardó demasiado en generarse.' });
          }, 15000);
          tProc.on('close', (thumbCode) => {
            if (thumbFinished) return;
            thumbFinished = true;
            clearTimeout(thumbTimeout);
            if (thumbCode !== 0 || !fs.existsSync(thumbPath) || fs.statSync(thumbPath).size === 0) {
              return resolve({ success: false, path: outPath, downloadPath: dlPath, error: 'El video se guardó, pero no se pudo crear la miniatura.' });
            }
            const dlThumb = dlPath.replace(/\.mp4$/i, '_Miniatura.jpg');
            try { fs.copyFileSync(thumbPath, dlThumb); }
            catch (e) { return resolve({ success: false, path: outPath, downloadPath: dlPath, thumbnailPath: thumbPath, error: `No se pudo copiar la miniatura a Descargas: ${e.message}` }); }
            resolve({ success: true, path: outPath, downloadPath: dlPath, thumbnailPath: thumbPath, thumbnailDownloadPath: dlThumb });
          });
          tProc.on('error', (err) => {
            if (thumbFinished) return;
            thumbFinished = true;
            clearTimeout(thumbTimeout);
            resolve({ success: false, path: outPath, downloadPath: dlPath, error: `Falló la miniatura: ${err.message}` });
          });
          return;
        } catch (e) {
          resolve({ success: false, path: outPath, downloadPath: dlPath, error: `El video se guardó, pero no se pudo iniciar la miniatura: ${e.message}` });
          return;
        }

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
    const projectsRoot4 = getProjectsRootDir();
    const projectDir = path.join(projectsRoot4, cleanProjectName);
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

ipcMain.handle('cancel-recording', async () => {
  const proc = ffmpegRecordProcess;
  const recPath = currentRecordingPath;
  ffmpegRecordProcess = null;
  if (proc && proc.exitCode == null && !proc.killed) {
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 2500);
      proc.once('close', () => { clearTimeout(timeout); resolve(); });
      try { proc.kill(); } catch { clearTimeout(timeout); resolve(); }
    });
  }
  try { await recordChunkQueue; } catch {}
  recordChunkQueue = Promise.resolve();
  recordChunkError = null;
  if (recPath) {
    try { await fs.promises.unlink(recPath); } catch (error) {
      if (error.code !== 'ENOENT') return { success: false, error: error.message };
    }
  }
  currentRecordingPath = null;
  return { success: true };
});

ipcMain.handle('save-recording-thumbnail', async (event, { base64Data, targetPath, projectName }) => {
  try {
    if (!base64Data) return { success: false };
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    let dest = targetPath || (currentRecordingPath ? currentRecordingPath.replace(/\.mp4$/i, '_Thumbnail.jpg') : null);
    if (!dest) {
      const cleanProjectName = projectName ? String(projectName).replace(/[/\\?%*:|"<>]/g, '_').trim() : 'Proyecto_General';
      const projectDir = path.join(getProjectsRootDir(), cleanProjectName);
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

  const discoverOnvifCameras = () => {
    return new Promise((resolve) => {
      const onvifCams = [];
      try {
        const dgram = require('dgram');
        const client = dgram.createSocket('udp4');
        const probeMsg = `<?xml version="1.0" encoding="utf-8"?>
<Envelope xmlns="http://www.w3.org/2003/05/soap-envelope" xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
  <Header>
    <wsa:MessageID xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing">uuid:c0a80101-0000-0000-0000-000000000001</wsa:MessageID>
    <wsa:To xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing">urn:schemas-xmlsoap-org:ws:2005:04:discovery</wsa:To>
    <wsa:Action xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing">http://schemas.xmlsoap.org/ws/2005:04/discovery/Probe</wsa:Action>
  </Header>
  <Body>
    <Probe xmlns="http://schemas.xmlsoap.org/ws/2005/04/discovery">
      <Types>dn:NetworkVideoTransmitter</Types>
    </Probe>
  </Body>
</Envelope>`;

        client.on('error', () => {
          try { client.close(); } catch(e) {}
          resolve(onvifCams);
        });

        client.on('message', (msg, rinfo) => {
          if (rinfo && rinfo.address && !onvifCams.some(c => c.ip === rinfo.address)) {
            onvifCams.push({
              ip: rinfo.address,
              name: `Cámara ONVIF (${rinfo.address})`,
              url: `rtsp://${rinfo.address}:554/live`,
            });
          }
        });

        client.bind(0, () => {
          try {
            client.setBroadcast(true);
            const buffer = Buffer.from(probeMsg, 'utf-8');
            client.send(buffer, 0, buffer.length, 3702, '239.255.255.250');
          } catch(e) {}
        });

        setTimeout(() => {
          try { client.close(); } catch (e) {}
          resolve(onvifCams);
        }, 1000);
      } catch (e) {
        resolve(onvifCams);
      }
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

  // 2. Ejecutar descubrimiento ONVIF en paralelo
  const onvifResults = await discoverOnvifCameras();
  for (const oc of onvifResults) {
    discovered.push({
      id: `onvif_${oc.ip.replace(/\./g, '_')}`,
      name: oc.name,
      url: oc.url,
      ip: oc.ip,
      port: 554,
      proto: 'rtsp',
      type: 'wifi_url',
      status: 'Cámara ONVIF / RTSP detectada por multidifusión',
      real: true,
    });
  }

  // 3. Sondear IPs activas en la red mediante ARP + Gateways de Acción + Rango Subred
  try {
    const arpIps = await getLocalArpIps();
    const subnetPrefix = LOCAL_IP.substring(0, LOCAL_IP.lastIndexOf('.') + 1); // e.g. "192.168.1."
    const baseGateways = [
      '192.168.1.1',
      '192.168.0.1',
      '192.168.42.1', // Gateway típico de cámaras de acción AP Wi-Fi
      '10.5.5.9',     // GoPro AP Wi-Fi
      '192.168.10.1',
    ];
    if (LOCAL_IP && LOCAL_IP !== '127.0.0.1') {
      baseGateways.push(LOCAL_IP);
    }

    // Subred local completa: sondear todo el rango 1..254
    const commonIps = [];
    if (subnetPrefix && subnetPrefix.length > 4) {
      for (let i = 1; i <= 254; i++) commonIps.push(`${subnetPrefix}${i}`);
    }

    const ipsToScan = [...new Set([...baseGateways, ...arpIps, ...commonIps])];

    const cameraPorts = [
      // RTSP genéricos y de marcas
      { port: 554, name: 'RTSP Genérico', path: '/live', proto: 'rtsp' },
      { port: 554, name: 'RTSP Stream1', path: '/stream1', proto: 'rtsp' },
      { port: 554, name: 'RTSP H264', path: '/h264', proto: 'rtsp' },
      { port: 554, name: 'RTSP Main', path: '/main', proto: 'rtsp' },
      { port: 554, name: 'RTSP Streaming', path: '/Streaming/Channels/101', proto: 'rtsp' },
      { port: 554, name: 'TP-Link Tapo', path: '/stream1', proto: 'rtsp' },
      { port: 554, name: 'Hikvision', path: '/Streaming/Channels/101', proto: 'rtsp' },
      { port: 554, name: 'Dahua', path: '/cam/realmonitor?channel=1&subtype=0', proto: 'rtsp' },
      { port: 554, name: 'Reolink', path: '/h264Preview_01_main', proto: 'rtsp' },
      { port: 554, name: 'Amcrest', path: '/cam/realmonitor?channel=1&subtype=0', proto: 'rtsp' },
      { port: 554, name: 'ONVIF / Genérico', path: '/onvif1', proto: 'rtsp' },
      { port: 8554, name: 'RTSP Alt', path: '/live', proto: 'rtsp' },
      // HTTP / MJPEG
      { port: 8192, name: 'Cámara de Acción Wi-Fi', path: '/', proto: 'http' },
      { port: 4747, name: 'DroidCam Wi-Fi', path: '/video', proto: 'http' },
      { port: 8080, name: 'Cámara IP / Webcam', path: '/video', proto: 'http' },
      { port: 80, name: 'HTTP MJPEG', path: '/video', proto: 'http' },
    ];

    const verifyHttpVideo = (host, port, path) => {
      return new Promise((resolve) => {
        const req = http.request({ host, port, path, method: 'GET', timeout: 450 }, (res) => {
          const ctype = (res.headers['content-type'] || '').toLowerCase();
          const server = (res.headers['server'] || '').toLowerCase();
          // Descartar impresoras Epson/HP o páginas de configuración HTML
          if (server.includes('epson') || server.includes('printer') || ctype.includes('text/html')) {
            resolve(false);
          } else if (ctype.includes('multipart') || ctype.includes('image') || ctype.includes('video') || ctype.includes('octet-stream')) {
            resolve(true);
          } else {
            resolve(res.statusCode === 200);
          }
          req.destroy();
        });
        req.on('timeout', () => { req.destroy(); resolve(false); });
        req.on('error', () => resolve(false));
        req.end();
      });
    };

    const checkIpPort = async (ip, cp) => {
      if (ip === '127.0.0.1' || ip.endsWith('.255')) return;
      if (discovered.some(d => d.ip === ip && d.port === cp.port)) return;

      const isOpen = await checkTcpPort(ip, cp.port, 300);
      if (isOpen) {
        if (cp.proto === 'http') {
          const isRealVideo = await verifyHttpVideo(ip, cp.port, cp.path);
          if (!isRealVideo) return;
        }

        const streamUrl = cp.proto === 'rtsp'
          ? `rtsp://${ip}:${cp.port}${cp.path}`
          : `http://${ip}:${cp.port}${cp.path}`;

        discovered.push({
          id: `cam_${ip.replace(/\./g, '_')}_${cp.port}`,
          name: `${cp.name} (${ip})`,
          url: streamUrl,
          ip: ip,
          port: cp.port,
          proto: cp.proto,
          type: 'wifi_url',
          status: `Cámara activa en red (puerto ${cp.port})`,
          real: true,
        });
      }
    };

    const tasks = [];
    for (const ip of ipsToScan) {
      for (const cp of cameraPorts) {
        tasks.push(() => checkIpPort(ip, cp));
      }
    }

    const BATCH_SIZE = 15;
    const scanStart = Date.now();
    const SCAN_TIMEOUT = 25000;
    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
      if (Date.now() - scanStart > SCAN_TIMEOUT) break;
      const chunk = tasks.slice(i, i + BATCH_SIZE);
      await Promise.all(chunk.map(fn => fn()));
    }
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
ipcMain.handle('start-streaming', async (_event, payload = {}) => {
  const targets = typeof payload === 'string'
    ? [{ id: 'custom', name: 'Stream', url: payload.trim() }]
    : Array.isArray(payload.destinations)
      ? payload.destinations.filter(target => target?.url && target.url.trim())
      : [];

  if (!targets.length) return { success: false, error: 'No se proporcionaron destinos con una clave de transmisión.' };

  for (const worker of activeStreamWorkers) {
    try { worker.process?.stdin?.destroy(); worker.process?.kill('SIGINT'); } catch (error) {}
  }
  activeStreamWorkers = [];
  streamDestinations = targets;
  streamStartupInProgress = true;
  // La cabecera WebM llegará junto con el primer segmento del MediaRecorder.
  streamInitHeader = null;

  const availableCores = Math.max(1, os.cpus().length - 1);
  const threadsPerDestination = Math.max(1, Math.min(4, Math.floor(availableCores / targets.length)));
  const startupResults = await Promise.all(targets.map((target) => new Promise((resolve) => {
    const destUrl = target.url.trim();
    let settled = false;
    let startupTimer;
    let workerEntry = null;
    const settle = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(startupTimer);
      if (!result.success && workerEntry && !workerEntry.connected) {
        activeStreamWorkers = activeStreamWorkers.filter(worker => worker !== workerEntry);
        try { workerEntry.process?.stdin?.destroy(); workerEntry.process?.kill('SIGINT'); } catch (error) {}
      }
      resolve(result);
    };
    const safeError = (message) => {
      let safeMessage = String(message || 'Error de conexión RTMP/RTMPS.');
      try {
        const parsed = new URL(destUrl);
        const segments = parsed.pathname.split('/').filter(Boolean);
        if (segments.length) segments[segments.length - 1] = '[clave oculta]';
        parsed.pathname = `/${segments.join('/')}`;
        parsed.search = '';
        safeMessage = safeMessage.replaceAll(destUrl, parsed.toString());
      } catch (error) {
        safeMessage = safeMessage.replaceAll(destUrl, '[URL RTMP oculta]');
      }
      return safeMessage.slice(-700);
    };
    const isWindows = process.platform === 'win32';
    const videoEncoder = isWindows ? 'h264_mf' : 'libx264';
    const videoEncoderArgs = videoEncoder === 'h264_mf'
      ? ['-c:v', 'h264_mf', '-b:v', '4500k']
      : [
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-tune', 'zerolatency',
          '-threads', String(threadsPerDestination),
          '-profile:v', 'main',
          '-level', '4.1',
          '-b:v', '4500k',
        ];

    const workerArgs = [
      '-probesize', '32M',
      '-analyzeduration', '3000000',
      '-fflags', '+discardcorrupt',
      '-f', 'webm',
      '-i', 'pipe:0',
      ...videoEncoderArgs,
      '-maxrate', '5000k',
      '-bufsize', '5000k',
      '-pix_fmt', 'yuv420p',
      '-g', '60',
      '-keyint_min', '30',
      '-r', '30',
      '-c:a', 'aac',
      '-b:a', '160k',
      '-ar', '48000',
      '-ac', '2',
      '-max_interleave_delta', '0',
      '-flvflags', 'no_duration_filesize',
      '-rtmp_buffer', '200',
      '-rtmp_live', 'live',
      '-rw_timeout', '12000000',
      '-f', 'flv',
      destUrl,
    ];

    let proc;
    try {
      proc = spawn(ffmpegPath, workerArgs, { stdio: ['pipe', 'ignore', 'pipe'] });
    } catch (error) {
      settle({ target, success: false, error: safeError(error.message) });
      return;
    }

    workerEntry = {
      id: target.id,
      name: target.name,
      url: destUrl,
      process: proc,
      connected: false,
      writeQueue: Promise.resolve(),
      writeError: null,
    };
    activeStreamWorkers.push(workerEntry);

    proc.stderr.on('data', (data) => {
      const message = data.toString();
      const connectionError = message.match(/connection refused|connection timed out|network is unreachable|could not write header|error opening output|server error|authorization failed|access denied|invalid stream key|handshake failed|tls[^\r\n]*(?:error|fail)|failed to resolve|no route to host|input\/output error|broken pipe|permission denied/i);
      if (connectionError && !workerEntry.connected) {
        settle({ target, success: false, error: safeError(connectionError[0]) });
      }

      if (!workerEntry.connected && /frame=\s*\d+/.test(message)) {
        workerEntry.connected = true;
        settle({ target, success: true, worker: workerEntry });
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('stream-status', { active: true, destinations: activeStreamWorkers.filter(worker => worker.connected) });
        }
      }

      if (/frame=|bitrate=/.test(message) && mainWindow && !mainWindow.isDestroyed()) {
        const fpsMatch = message.match(/fps=\s*([\d.]+)/);
        const bitrateMatch = message.match(/bitrate=\s*([\d.]+\s*\w+\/s)/);
        const dropMatch = message.match(/drop=\s*(\d+)/);
        const speedMatch = message.match(/speed=\s*([\d.]+x)/);
        const dropped = dropMatch ? parseInt(dropMatch[1], 10) : 0;
        mainWindow.webContents.send('stream-telemetry', {
          targetId: target.id,
          targetName: target.name,
          fps: fpsMatch ? parseFloat(fpsMatch[1]) : 30,
          bitrate: bitrateMatch ? bitrateMatch[1] : '4500 kbits/s',
          droppedFrames: dropped,
          speed: speedMatch ? speedMatch[1] : '1.0x',
          health: dropped > 15 ? 'warning' : 'excellent',
        });
      }
    });

    proc.once('error', (error) => {
      settle({ target, success: false, error: safeError(error.message) });
    });
    proc.once('close', (code, signal) => {
      workerEntry.closed = true;
      if (!workerEntry.connected) {
        settle({ target, success: false, error: `FFmpeg cerró antes de conectar (código ${code ?? signal ?? 'desconocido'}).` });
      }
      activeStreamWorkers = activeStreamWorkers.filter(worker => worker !== workerEntry);
      if (workerEntry.connected && !streamStartupInProgress && activeStreamWorkers.every(worker => !worker.connected) && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('stream-status', { active: false, destinations: [] });
      }
    });

    startupTimer = setTimeout(() => {
      settle({ target, success: false, error: 'Tiempo agotado esperando que el servidor acepte el video. Verifica que el evento esté activo.' });
      try { proc.kill('SIGINT'); } catch (error) {}
    }, 15000);
  })));

  streamStartupInProgress = false;
  const connectedDestinations = startupResults
    .filter(result => result.success && result.worker && !result.worker.closed)
    .map(result => result.target);
  const failures = startupResults.filter(result => !result.success).map(result => ({ name: result.target.name, error: result.error }));
  if (!connectedDestinations.length) {
    for (const worker of activeStreamWorkers) {
      try { worker.process?.stdin?.destroy(); worker.process?.kill('SIGINT'); } catch (error) {}
    }
    activeStreamWorkers = [];
    streamDestinations = [];
    return { success: false, error: failures.map(failure => `${failure.name}: ${failure.error}`).join('\n') || 'No se pudo conectar con el servidor de transmisión.', failures };
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('stream-status', { active: true, destinations: connectedDestinations });
  }
  return { success: true, connectedDestinations, failures };
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
      if (!worker.process?.stdin || worker.process.stdin.destroyed) continue;
      worker.writeQueue = worker.writeQueue
        .then(() => writeChunkWithBackpressure(worker.process.stdin, buf))
        .catch((error) => {
          worker.writeError = error.message || String(error);
          console.warn(`[stream-chunk] ${worker.name} write error:`, worker.writeError);
        });
    }
  } catch (err) {}
});

ipcMain.handle('stop-streaming', async () => {
  streamStartupInProgress = false;
  streamInitHeader = null;
  const workers = activeStreamWorkers.slice();
  await Promise.all(workers.map(async (worker) => {
    try {
      await worker.writeQueue;
      if (worker.process?.stdin && !worker.process.stdin.destroyed) worker.process.stdin.end();
      await new Promise((resolve) => {
        if (worker.process?.exitCode != null) return resolve();
        const timeout = setTimeout(() => {
          try { worker.process?.kill('SIGINT'); } catch (e) {}
          resolve();
        }, 5000);
        worker.process?.once('close', () => { clearTimeout(timeout); resolve(); });
      });
    } catch (e) {
      console.warn(`[stop-streaming] Error cerrando ${worker.name}:`, e.message);
      try { worker.process?.kill('SIGINT'); } catch (killError) {}
    }
  }));
  activeStreamWorkers = [];
  streamDestinations = [];
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('stream-status', {
      active: false,
      destinations: []
    });
  }
  return { success: true };
});
