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

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

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
    if (permission === 'media') callback(true); else callback(false);
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

const http = require('http');

const mobileClients = new Map();
let httpWsServer = null;

function startMediaServer() {
  const appServer = express();
  const certs = getCertificates() || { key: '', cert: '' };
  const server = https.createServer(certs, appServer);
  
  // WebSocket seguro sobre HTTPS (puerto 3000)
  wss = new WebSocketServer({ server });

  // Servidor HTTP complementario para WebSocket estándar (puerto 3001)
  // Esto evita bloqueos de certificados autofirmados en iOS Safari y Android Chrome
  const plainHttpServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('PodcastStudio Signaling Server Active');
  });
  httpWsServer = new WebSocketServer({ server: plainHttpServer });

  const setupWebSocketConnection = (ws) => {
    const clientId = `Mobil_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 4)}`;
    ws.clientId = clientId;
    mobileClients.set(clientId, ws);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mobile-ws-connected', clientId);
    }

    ws.on('message', (msg) => {
      try {
        const data = JSON.parse(msg);
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
      mobileClients.delete(ws.clientId);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('remote-disconnected', ws.clientId);
      }
    });

    ws.on('error', () => {
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
          let ws = null;
          let pc = null;
          let currentStream = null;
          let currentFacing = 'user';
          let isMuted = false;

          const statusBadge = document.getElementById('statusBadge');
          const startDialog = document.getElementById('startDialog');
          const footerControls = document.getElementById('footerControls');
          const videoEl = document.getElementById('video');

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
                ws.send(JSON.stringify({ type: 'offer', offer: offer }));
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
    startMediaServer();
  });
}

ipcMain.handle('get-qr-url', () => `https://www.podcastudio.mx/remote-cam?slot=2&room=studio_cam_2`);

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

ipcMain.on('open-recordings-folder', () => {
  const recDir = path.join('D:', 'PROGRAMAS IA', 'PODCASTUDIO', 'grabaciones');
  if (!fs.existsSync(recDir)) {
    try { fs.mkdirSync(recDir, { recursive: true }); } catch (e) {}
  }
  shell.openPath(recDir);
});

let currentRecordingPath = null;
let streamDestinations = [];
let activeStreamWorkers = [];

// ============================================================================
// GRABACIÓN BROADCAST MASTER (MP4 LIMPIO + AUDIO MEZCLADO - 0 CONGELAMIENTO)
// ============================================================================
ipcMain.handle('start-recording', async () => {
  return new Promise((resolve) => {
    const dir = path.join('D:', 'PROGRAMAS IA', 'PODCASTUDIO', 'grabaciones');
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch (e) {}

    currentRecordingPath = path.join(dir, `Grabacion_${Date.now()}.mp4`);

    if (ffmpegRecordProcess) {
      try {
        if (ffmpegRecordProcess.stdin && !ffmpegRecordProcess.stdin.destroyed) ffmpegRecordProcess.stdin.end();
        ffmpegRecordProcess.kill('SIGINT');
      } catch (e) {}
      ffmpegRecordProcess = null;
    }

    try {
      ffmpegRecordProcess = spawn(ffmpegPath, [
        '-probesize', '32M',
        '-analyzeduration', '0',
        '-f', 'webm',
        '-i', 'pipe:0',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-crf', '18',
        '-pix_fmt', 'yuv420p',
        '-r', '30',
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

      resolve({ success: true, path: currentRecordingPath });
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
      try {
        if (ffmpegRecordProcess.stdin && !ffmpegRecordProcess.stdin.destroyed) {
          ffmpegRecordProcess.stdin.end();
        }
        setTimeout(() => {
          if (ffmpegRecordProcess) {
            ffmpegRecordProcess.kill('SIGINT');
            ffmpegRecordProcess = null;
          }
          resolve({ success: true, path: currentRecordingPath });
        }, 800);
      } catch (e) {
        resolve({ success: true, path: currentRecordingPath });
      }
    } else {
      resolve({ success: false });
    }
  });
});

ipcMain.handle('scan-network-cameras', async () => {
  const checkTcpPort = (host, port, timeout = 250) => {
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
      exec('arp -a', { timeout: 1500 }, (err, stdout) => {
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
    const ipsToScan = [...new Set(['127.0.0.1', LOCAL_IP, ...arpIps, '192.168.1.254', '10.5.5.9', '192.168.42.1'])];

    const cameraPorts = [
      { port: 4747, name: 'DroidCam Wi-Fi', path: '/video' },
      { port: 8080, name: 'IP Webcam', path: '/video' },
      { port: 8192, name: 'Cámara Acción China', path: '' },
      { port: 8554, name: 'RTSP Stream', path: '' },
    ];

    const probePromises = [];

    for (const ip of ipsToScan) {
      for (const cp of cameraPorts) {
        probePromises.push(
          checkTcpPort(ip, cp.port, 250).then((isOpen) => {
            if (isOpen) {
              const streamUrl = cp.path ? `http://${ip}:${cp.port}${cp.path}` : `http://${ip}:${cp.port}`;
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
        '-analyzeduration', '0',
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
        '-ar', '44100',
        '-flvflags', 'no_duration_filesize',
        '-rtmp_buffer', '100',
        '-rtmp_live', 'live',
        ...(destUrl.startsWith('rtmps://') ? ['-tls_verify', '0'] : []),
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