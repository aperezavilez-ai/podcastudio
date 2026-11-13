process.on('uncaughtException', (err) => {
  console.warn('[Electron Main Process UncaughtException]', err?.message || err);
});
process.on('unhandledRejection', (reason) => {
  console.warn('[Electron Main Process UnhandledRejection]', reason);
});

const { app, BrowserWindow, Menu, ipcMain, session, shell, desktopCapturer, powerSaveBlocker } = require('electron');
Menu.setApplicationMenu(null);
const path = require('path');
const fs = require('fs');
const { spawn, exec, spawnSync } = require('child_process');
const net = require('net');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const express = require('express');
const https = require('https');
const selfsigned = require('selfsigned');
const { WebSocketServer } = require('ws');
const os = require('os');
const readySignalPath = path.join(os.tmpdir(), 'podcaststudio_ready.signal');
try { if (fs.existsSync(readySignalPath)) fs.unlinkSync(readySignalPath); } catch (e) {}
const { setupNativeEngineIPC } = require('./media-engine/bridge');
const { computeExportSignature, siblingSuffixFor } = require('./export-signature');
const { buildExportArgs, probeExportEncoder, filtroParaFormato } = require('./export-args');
const { classifyStreamError, STREAM_ERROR_USER_MESSAGES } = require('./stream-error');
const { formatDiagLine, createPingAggregator } = require('./ventana-diag-core');
const { createStreamEncoderSession } = require('./stream-encoder');
const exportEncodeSignatures = new Map(); // firma de encode -> ruta ya codificada (dedupe FB/YT)

// Hito 3: codificador de exportación sondeado UNA vez por proceso con
// la escalera de electron/export-args.js (h264_nvenc → h264_qsv →
// h264_mf → libx264) sobre la salida de «ffmpeg -encoders» del binario
// empaquetado. Si la sonda falla, la escalera cae a libx264.
let exportEncoderCache = null;
function getExportEncoder() {
  if (exportEncoderCache) return exportEncoderCache;
  let listaCodificadores = '';
  try {
    const r = spawnSync(ffmpegPath, ['-hide_banner', '-encoders'], { encoding: 'utf8', timeout: 15000 });
    listaCodificadores = `${(r && r.stdout) || ''}\n${(r && r.stderr) || ''}`;
  } catch (e) { listaCodificadores = ''; }
  exportEncoderCache = probeExportEncoder((nombre) => listaCodificadores.includes(nombre));
  try { console.log(`[Export] Codificador de exportación (escalera Hito 3): ${exportEncoderCache}`); } catch (e) {}
  return exportEncoderCache;
}

try {
  setupNativeEngineIPC();
} catch (e) {
  console.warn('[Native Engine IPC] Init warning:', e.message);
}

function writeChunkWithBackpressure(writable, chunk) {
  return new Promise((resolve, reject) => {
    if (!writable || writable.destroyed || writable.writableEnded) return reject(new Error('El destino de escritura ya no está disponible (el proceso FFmpeg se cerró).'));
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

function toSafeBuffer(input) {
  if (!input) return null;
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array || ArrayBuffer.isView(input)) {
    return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  }
  if (input instanceof ArrayBuffer) {
    return Buffer.from(input);
  }
  if (typeof input === 'object') {
    if (input.type === 'Buffer' && Array.isArray(input.data)) {
      return Buffer.from(input.data);
    }
    const values = Object.values(input);
    if (values.length > 0) {
      return Buffer.from(values);
    }
  }
  try {
    return Buffer.from(input);
  } catch (e) {
    return null;
  }
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
// Habilitar MediaFoundation nativo para eliminar el retraso de 2 segundos en cámaras USB UVC
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

ffmpeg.setFfmpegPath(ffmpegPath);
let mainWindow;
// v2.0.0 (núcleo nuevo): ya no hay un proceso FFmpeg de grabación suelto
// ni workers por destino en este archivo: el grafo de programa (proceso
// codificador/mezclador único + consumidores con copia) vive en
// electron/program-core.js y se instancia en la sección de streaming.
let isStoppingRecording = false;
let isRecording = false;
let isStreaming = false;
let coreRecordingFailure = null;
// v1.5.1 (Frente B): la grabación se escribe primero a .partial.mp4 y solo
// se renombra al nombre final si el cierre es limpio. recordingProbe
// acumula, del stderr del ÚNICO FFmpeg de grabación, los segmentos de
// blackdetect de su segunda salida y el último time= procesado: con eso se
// calcula blackWarning al cerrar, sin una segunda pasada de verificación.
let currentRecordingPartialPath = null;
let recordingProbe = null;
let ffmpegStreamProcess = null;
let wss = null;
let mediaServerHttps = null;
let mediaServerHttp = null;

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
      backgroundThrottling: false,
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
        mainWindow.maximize();
        mainWindow.show();
      }
      mainWindow.focus();
      try {
        fs.writeFileSync(readySignalPath, '1', 'utf8');
      } catch (e) {}
    }
  };

  // Mostrar la ventana ÚNICAMENTE cuando la app React esté completamente montada y lista
  ipcMain.on('app-ui-ready', (event) => {
    console.log('[Main] Received app-ui-ready signal from renderer');
    showWindowSafely();
  });

  mainWindow.once('ready-to-show', () => {
    console.log('[Main] ready-to-show fired - mostrando ventana');
    showWindowSafely();
  });

  mainWindow.webContents.once('did-finish-load', () => {
    console.log('[Main] did-finish-load fired');
    showWindowSafely();
    // Autoprueba automática del Motor PodcastStudio (v3.0.0): a los
    // 2,5 s de cargar la UI, solo si no hay streaming ni grabación en
    // curso. Un fallo de la autoprueba jamás debe romper el arranque.
    setTimeout(() => {
      try {
        if (!streamingSessionActive && !currentRecordingPath) {
          programCore.runSelfTest({ durationMs: 3000 }).catch(() => {});
        }
      } catch (e) {}
    }, 2500);
  });

  // Temporizador de respaldo garantizado ultra-rápido por si no disparan los eventos
  const fallbackShowTimer = setTimeout(() => {
    showWindowSafely();
  }, 500);

  mainWindow.once('show', () => {
    clearTimeout(fallbackShowTimer);
  });

  // Detectar crash del renderer
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[Main] Renderer process gone:', details);
  });
  mainWindow.webContents.on('unresponsive', () => {
    console.warn('[Main] Renderer unresponsive');
  });
  mainWindow.webContents.on('responsive', () => {
    console.log('[Main] Renderer responsive again');
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

  // Permitir CORS para peticiones multimedia externas (Mixkit / CDN / audio)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    responseHeaders['access-control-allow-origin'] = ['*'];
    callback({ responseHeaders });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    cleanupAndExit();
  });

  // Instrumento de diagnóstico de ventana: eventos de foco/visibilidad de
  // la BrowserWindow al log (prefijo [foco]); ver startVentanaDiag().
  ['blur', 'focus', 'hide', 'show', 'minimize', 'restore'].forEach((ev) => {
    try {
      mainWindow.on(ev, () => appendVentanaDiag('foco', `ventana ${ev}`));
    } catch (e) {}
  });

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

function notifyClientCounts() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send('feed-clients-change', {
        feedClients: programFeedClients.size,
        remoteClients: remoteControlClients.size
      });
    } catch (e) {}
  }
}

ipcMain.handle('get-feed-client-count', () => ({
  feedClients: programFeedClients.size,
  remoteClients: remoteControlClients.size
}));

function startMediaServer() {
  const appServer = express();
  const certs = getCertificates() || { key: '', cert: '' };
  const server = https.createServer(certs, appServer);
  mediaServerHttps = server;
  
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
  mediaServerHttp = plainHttpServer;
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
          notifyClientCounts();
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
          notifyClientCounts();
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
      notifyClientCounts();
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
      notifyClientCounts();
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
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
              updateStatus('HTTPS Requerido', '');
              const h2 = document.querySelector('#startDialog h2');
              if (h2) h2.innerText = 'Cámara Bloqueada por Seguridad';
              const p = document.querySelector('#startDialog p');
              if (p) p.innerHTML = '<span style="color:#ef4444;font-weight:bold;">Safari (iPhone) y Chrome requieren conexión segura HTTPS para dar acceso a la cámara.</span><br><br>Abre el enlace seguro oficial de PodcastStudio:<br><strong style="color:#ff6b00;word-break:break-all;">https://www.podcastudio.mx/remote-cam' + window.location.search + '</strong>';
              const btn = document.getElementById('startBtn');
              if (btn) {
                btn.innerText = 'ABRIR ENLACE SEGURO (HTTPS)';
                btn.onclick = () => { window.location.href = 'https://www.podcastudio.mx/remote-cam' + window.location.search; };
              }
              return;
            }

            startDialog.style.display = 'none';
            updateStatus('Solicitando cámara...', '');

            try {
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
                    params.encodings[0].maxFramerate = 30;
                    params.encodings[0].networkPriority = 'high';
                    params.encodings[0].priority = 'high';
                    params.degradationPreference = 'maintain-resolution';
                    sender.setParameters(params);
                  } catch (e) {}
                } else if (track.kind === 'audio') {
                  try {
                    const params = sender.getParameters();
                    if (!params.encodings) params.encodings = [{}];
                    params.encodings[0].maxBitrate = 128000;
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
  // Vista de control JPEG para OBS Studio, vMix y Smart TVs. No es una cámara
  // virtual ni el encoder Master RTMP/recording (que permanece a 1080p30).
  // ============================================================================
  appServer.get('/program/status', (req, res) => {
    res.json({
      status: 'online',
      activeCam: latestStudioState?.activeCam || 1,
      pvwCam: latestStudioState?.pvwCam || 2,
      layout: latestStudioState?.layoutMode || '1',
      resolution: '960x540',
      fps: 3,
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
        <title>PodcastStudio Program Master Monitor (LAN)</title>
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
        <canvas id="feedCanvas" width="960" height="540"></canvas>
        <div id="hud" class="hud">
          <div class="dot"></div>
          <span>PGM LIVE · VISTA DE CONTROL · LAN</span>
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
      console.warn('[MediaServer] Puerto 3000 ocupado por Docker/WSL u otra instancia. Intentando puerto alternativo 3002...');
      try {
        server.listen(3002, '0.0.0.0', () => {
          console.log('[MediaServer] Servidor HTTPS activo en puerto 3002 (fallback)');
        });
      } catch (e) {}
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
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      try { fs.writeFileSync(readySignalPath, '1', 'utf8'); } catch (e) {}
    } else {
      createWindow();
    }
  });

  let exitCleanupStarted = false;
  const cleanupAndExit = () => {
    if (exitCleanupStarted) return;
    exitCleanupStarted = true;
    try {
      if (typeof mobileClients !== 'undefined') {
        mobileClients.forEach(c => { try { c.terminate(); } catch (e) {} });
        mobileClients.clear();
      }
      if (typeof programFeedClients !== 'undefined') programFeedClients.clear();
      if (typeof remoteControlClients !== 'undefined') remoteControlClients.clear();
    } catch (e) {}
    try {
      if (mediaServerHttps) mediaServerHttps.close();
      if (mediaServerHttp) mediaServerHttp.close();
      if (httpWsServer) httpWsServer.close();
      if (wss) wss.close();
    } catch (e) {}
    const finishExit = () => {
      try {
        if (ffmpegStreamProcess) ffmpegStreamProcess.kill('SIGKILL');
        try { programCore?.shutdown(); } catch (e) {}
        if (typeof ffmpegIsoProcesses !== 'undefined' && ffmpegIsoProcesses.size > 0) {
          ffmpegIsoProcesses.forEach(entry => { try { entry.proc?.kill('SIGKILL'); } catch (e) {} });
        }
      } catch (e) {}
      try { app.exit(0); } catch (e) {}
      try { process.exit(0); } catch (e) {}
    };
    // La grabación NO se mata con SIGKILL: un MP4 con +faststart solo queda
    // válido si FFmpeg cierra el contenedor y mueve el moov al frente. Al
    // núcleo se le pide el cierre del consumidor de grabación y se le dan
    // hasta 8 s antes de salir (el parcial queda como .partial.mp4, igual
    // que en un cierre forzado: nunca se renombra a máster al salir).
    try {
      if (programCore && programCore.getRecordingState()) {
        let exitDone = false;
        const goExit = () => { if (exitDone) return; exitDone = true; finishExit(); };
        programCore.stopRecording().then(goExit).catch(goExit);
        setTimeout(goExit, 8000);
        return;
      }
    } catch (e) {}
    finishExit();
  };

  app.on('window-all-closed', () => {
    cleanupAndExit();
  });

  app.on('before-quit', () => {
    cleanupAndExit();
  });
  app.whenReady().then(() => {
    // v1.6.1: el powerSaveBlocker ya no se activa al arrancar la app; se
    // adquiere al iniciar streaming o grabación (acquirePowerSaveBlocker).
    try { fs.writeFileSync(readySignalPath, '1', 'utf8'); } catch (e) {}
    try {
      session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = details.responseHeaders || {};
        responseHeaders['Access-Control-Allow-Origin'] = ['*'];
        responseHeaders['Access-Control-Allow-Methods'] = ['GET, POST, OPTIONS, HEAD'];
        responseHeaders['Access-Control-Allow-Headers'] = ['*'];
        callback({ responseHeaders });
      });
    } catch (e) {}
    // Instrumento de diagnóstico de ventana: el log nace con la app.
    try { startVentanaDiag(); } catch (e) {}
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
  resolution: '960x540',
  fps: 3,
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
  const projectsRoot = getProjectsRootDir();
  let recDir = projectsRoot;
  if (cleanProjectName) {
    const subDir = path.join(projectsRoot, cleanProjectName);
    if (!fs.existsSync(subDir)) {
      try { fs.mkdirSync(subDir, { recursive: true }); } catch (e) {}
    }
    recDir = subDir;
  }
  if (!fs.existsSync(recDir)) {
    try { fs.mkdirSync(recDir, { recursive: true }); } catch (e) {}
  }
  shell.openPath(recDir);
});

let currentRecordingPath = null;
let streamDestinations = [];
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
    isStoppingRecording = false;
    coreRecordingFailure = null;

    const projectsRoot = getProjectsRootDir();
    const projectDir = path.join(projectsRoot, cleanProjectName);
    try {
      if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });
    } catch (e) {}

    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
    currentRecordingPath = path.join(projectDir, `${cleanProjectName}_${timestamp}_Master_${currentProgramProfile?.id || '1080p'}.mp4`);
    // v1.5.1 (Frente B): el consumidor de grabación del núcleo escribe a
    // .partial.mp4; stop-recording lo renombra al nombre final SOLO si el
    // cierre fue limpio. Un cierre fallido deja el .partial.mp4 (nunca un
    // MP4 "bueno" falso).
    currentRecordingPartialPath = currentRecordingPath.replace(/\.mp4$/i, '.partial.mp4');
    recordingProbe = createRecordingProbe();

    // v2.0.0 (núcleo nuevo): la grabación ya NO abre su propio FFmpeg ni
    // recibe chunks propios del renderer: se engancha como consumidor
    // con copia del flujo de programa del núcleo (electron/program-core.js).
    // options.initialHeader ya no se necesita: el núcleo une al consumidor
    // en el último keyframe con sus etiquetas de secuencia re-selladas.
    programCore.attachRecording({ partialPath: currentRecordingPartialPath })
      .then((attach) => {
        if (!attach.success) {
          resolve({ success: false, error: attach.error || 'El núcleo no pudo enganchar la grabación.' });
          return;
        }
        acquirePowerSaveBlocker('recording');
        resolve({ success: true, path: currentRecordingPath, projectName: cleanProjectName });
      })
      .catch((err) => {
        console.error('Fallo al iniciar grabación (núcleo):', err);
        resolve({ success: false, error: err.message });
      });
  });
});

// v2.0.0 (núcleo nuevo): el renderer ya no envía chunks de grabación: la
// grabación consume el flujo del núcleo dentro del proceso principal.
// Este handler queda como no-op tolerante por compatibilidad del preload.
ipcMain.handle('record-chunk', async (event, chunkBuffer) => {
  const buf = chunkBuffer ? toSafeBuffer(chunkBuffer) : null;
  return { success: true, bytes: buf ? buf.length : 0 };
});

ipcMain.handle('flush-recording-chunks', async () => {
  const state = programCore.getRecordingState();
  if (!state) return { success: true };
  const error = state.failure || state.writeError || coreRecordingFailure || null;
  return { success: !error, error };
});

// v1.5.0: si la finalización del MP4 falla, el parcial NO se borra: se
// conserva como .partial.mp4 para poder diagnosticar/recuperar, y el
// resultado lo reporta como parcial, nunca como grabación buena.
function preservePartialRecording(recPath) {
  try {
    if (!recPath || !fs.existsSync(recPath)) return null;
    const partialPath = recPath.replace(/\.mp4$/i, '.partial.mp4');
    fs.renameSync(recPath, partialPath);
    return partialPath;
  } catch (e) { return null; }
}

// v1.5.1 (Frente B): la verificación de negro YA NO es una pasada aparte.
// El blackdetect corre como segunda salida del mismo FFmpeg que graba
// (ver start-recording) y esta sonda acumula sus segmentos desde stderr
// junto con el último time= procesado (la duración real de lo grabado).
function createRecordingProbe() {
  return { blackSec: 0, lastBlackEnd: null, lastTimeSec: 0, carry: '' };
}

function feedRecordingProbe(text) {
  const probe = recordingProbe;
  if (!probe) return;
  const buf = probe.carry + String(text || '');
  const timeRe = /time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/g;
  let tm;
  while ((tm = timeRe.exec(buf)) !== null) {
    probe.lastTimeSec = parseInt(tm[1], 10) * 3600 + parseInt(tm[2], 10) * 60 + parseFloat(tm[3]);
  }
  const blackRe = /black_start:(\d+(?:\.\d+)?) black_end:(\d+(?:\.\d+)?)/g;
  let bm;
  let consumed = 0;
  while ((bm = blackRe.exec(buf)) !== null) {
    probe.blackSec += Math.max(0, parseFloat(bm[2]) - parseFloat(bm[1]));
    probe.lastBlackEnd = parseFloat(bm[2]);
    consumed = blackRe.lastIndex;
  }
  // Cola sin consumir: puede traer un match partido entre dos chunks de
  // stderr. Los ya contados quedan fuera (consumed) para no duplicar.
  probe.carry = buf.slice(Math.max(consumed, buf.length - 128));
}

// Mismo criterio que la verificación v1.5.0: >=90% negro => blackWarning.
// Único ajuste: con el muestreo fps=2, un segmento negro que llega hasta el
// final del vídeo cierra en el último fotograma MUESTREADO (hasta 0,5 s
// antes del final real); si el último segmento termina a menos de un paso
// de muestreo del final, se extiende hasta el final — sin esto, una
// grabación corta 100% negra marcaría ~85% y no avisaría.
function buildRecordingVerification() {
  if (!recordingProbe) return {};
  const durationSec = recordingProbe.lastTimeSec;
  let blackSec = recordingProbe.blackSec;
  if (durationSec > 0 && recordingProbe.lastBlackEnd != null
      && recordingProbe.lastBlackEnd < durationSec
      && recordingProbe.lastBlackEnd >= durationSec - 0.55) {
    blackSec += durationSec - recordingProbe.lastBlackEnd;
  }
  const blackRatio = durationSec > 0 ? Math.min(1, blackSec / durationSec) : 0;
  return {
    durationSec: Math.round(durationSec * 10) / 10,
    blackRatio: Math.round(blackRatio * 100) / 100,
    blackWarning: durationSec > 0 && blackRatio >= 0.9,
  };
}

function sendFinalizeProgress(percent) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('finalize-progress', { stage: 'procesando', percent });
  }
}

ipcMain.handle('stop-recording', async () => {
  isStoppingRecording = true;
  releasePowerSaveBlocker('recording');
  const recPath = currentRecordingPath;
  const partialInProgress = currentRecordingPartialPath;
  // Progreso de finalización: la codificación ocurrió EN VIVO en el
  // núcleo; al detener no hay transcode que esperar: se reporta
  // indeterminado (null) y 100 al terminar el cierre del consumidor.
  sendFinalizeProgress(null);

  const stateBefore = programCore.getRecordingState();
  if (!stateBefore && !recPath) {
    return { success: false, error: 'No hay una grabación activa para finalizar.' };
  }
  const stopResult = await programCore.stopRecording();
  const bytesWritten = stateBefore?.bytesWritten || 0;
  const failure = stateBefore?.failure || stateBefore?.writeError || coreRecordingFailure || stopResult.error || null;
  coreRecordingFailure = null;
  currentRecordingPartialPath = null;

  const partialExists = partialInProgress && fs.existsSync(partialInProgress);
  if (stopResult.timedOut || (stopResult.code !== 0 && stopResult.code !== null) || failure) {
    // Cierre no limpio: NO se renombra; el parcial se conserva como
    // .partial.mp4 para diagnóstico, nunca como grabación buena (v1.5.0).
    currentRecordingPath = null;
    return {
      success: false,
      path: recPath,
      partial: true,
      partialPath: partialExists ? partialInProgress : null,
      error: failure || (stopResult.timedOut
        ? 'FFmpeg no cerró el archivo de grabación dentro del tiempo permitido. El parcial se conservó como .partial.mp4 para diagnóstico; no es una grabación válida.'
        : `FFmpeg terminó con código ${stopResult.code}.`),
    };
  }
  if (!partialExists) {
    currentRecordingPath = null;
    return { success: false, path: recPath, error: 'FFmpeg no creó un archivo MP4 válido.' };
  }
  if (bytesWritten === 0) {
    return { success: false, path: recPath, partial: true, partialPath: partialInProgress, error: 'No se recibieron datos de video para la grabación.' };
  }

  // Cierre limpio: el .partial.mp4 pasa a ser el máster final. La
  // verificación de negro salió de la MISMA pasada del consumidor
  // (buildRecordingVerification): no se lanza ningún FFmpeg de
  // verificación ni de faststart aparte.
  try {
    if (partialInProgress !== recPath) fs.renameSync(partialInProgress, recPath);
  } catch (e) { console.warn('[FFmpeg Grabación] No se pudo renombrar el parcial a master:', e.message); }

  if (!(recPath && fs.existsSync(recPath) && fs.statSync(recPath).size > 0)) {
    currentRecordingPath = null;
    return { success: false, path: recPath, error: 'FFmpeg no creó un archivo MP4 válido.' };
  }
  const verification = buildRecordingVerification();
  sendFinalizeProgress(100);
  if (verification.blackWarning) {
    console.warn(`[FFmpeg Grabación] ADVERTENCIA: el master salió >=90% negro (${recPath}).`);
  }
  const stats = fs.statSync(recPath);
  console.log(`[FFmpeg Grabación] Master MP4 finalizado: ${recPath} (${stats.size} bytes)`);

  // Miniatura con el mismo patrón asíncrono de siempre (proceso aparte,
  // timeout 15 s; su fallo no invalida el máster).
  const thumbPath = recPath.replace(/\.mp4$/i, '_Thumbnail.jpg');
  return await new Promise((resolve) => {
    let thumbResolved = false;
    const done = (extra) => {
      if (thumbResolved) return;
      thumbResolved = true;
      currentRecordingPath = null;
      resolve({ success: true, path: recPath, projectName: currentRecordingProjectName, ...verification, ...extra });
    };
    try {
      const thumbProcess = spawn(ffmpegPath, [
        '-y',
        '-ss', '00:00:00.800',
        '-i', recPath,
        '-vframes', '1',
        '-q:v', '2',
        thumbPath
      ]);
      const thumbTimeout = setTimeout(() => {
        try { thumbProcess.kill(); } catch (e) {}
        done({ thumbnailError: 'No se pudo generar la miniatura del video.' });
      }, 15000);
      thumbProcess.on('close', (code) => {
        clearTimeout(thumbTimeout);
        if (code === 0 && fs.existsSync(thumbPath) && fs.statSync(thumbPath).size > 0) {
          done({ thumbnailPath: thumbPath });
        } else {
          done({ thumbnailError: 'El MP4 se guardó, pero no se pudo generar su miniatura.' });
        }
      });
      thumbProcess.on('error', (err) => {
        clearTimeout(thumbTimeout);
        done({ thumbnailError: `No se pudo generar la miniatura: ${err.message}` });
      });
    } catch (e) {
      done({ thumbnailError: `No se pudo iniciar la miniatura: ${e.message}` });
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
    await fs.promises.copyFile(sourcePath, destPath);

    // Copiar también la miniatura oficial JPG de alta resolución
    const thumbSrc = sourcePath.replace(/\.mp4$/i, '_Thumbnail.jpg');
    if (fs.existsSync(thumbSrc)) {
      const thumbDest = destPath.replace(/\.mp4$/i, '_Miniatura.jpg');
      try { await fs.promises.copyFile(thumbSrc, thumbDest); } catch (e) {}
    }

    return { success: true, path: destPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// EXPORTACIÓN MULTI-FORMATO NATIVA CON FFMPEG (TIKTOK 9:16, INSTAGRAM 1:1, FACEBOOK 16:9) A 1080P REAL
ipcMain.handle('export-social-format', async (event, { sourcePath, formatKey, projectName, cropMode }) => {
  return new Promise(async (resolve) => {
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

    // Hito 3: la sonda de la fuente corre ANTES de construir los
    // argumentos: hacen falta la duración (progreso honesto) y las
    // DIMENSIONES (el 16:9 al mismo tamaño que el máster es COPIA de
    // flujos, no re-codificación). Antes la sonda corría después de
    // construir los argumentos y el 16:9 se re-codificaba siempre por
    // software (libx264 ultrafast), tardando ~10× la duración.
    let totalSecs = 0;
    let sourceWidth = 0;
    let sourceHeight = 0;
    try {
      const probeOut = await new Promise((res2) => {
        let errBuf = '';
        const probe = spawn(ffmpegPath, ['-i', sourcePath]);
        probe.stderr.on('data', (d) => { errBuf += d.toString(); });
        probe.on('close', () => res2(errBuf));
        probe.on('error', () => res2(errBuf));
        setTimeout(() => { try { probe.kill(); } catch (e) {} res2(errBuf); }, 5000);
      });
      const durMatch = probeOut.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
      if (durMatch) totalSecs = parseInt(durMatch[1], 10) * 3600 + parseInt(durMatch[2], 10) * 60 + parseFloat(durMatch[3]);
      const dimMatch = probeOut.match(/Video:[^\n]*?(\d{2,5})x(\d{2,5})/);
      if (dimMatch) { sourceWidth = parseInt(dimMatch[1], 10); sourceHeight = parseInt(dimMatch[2], 10); }
    } catch (e) {}

    // El modo de reencuadre que el usuario elige en el modal
    // ('smart-crop', 'blur-fill', 'split-stack') viaja en cropMode
    // ('smart-crop' sigue siendo recorte central — no hay detección de
    // sujeto; 'blur-fill' conserva el cuadro completo sobre fondo
    // difuminado y 'split-stack' apila las dos mitades del cuadro).
    // Filtros y argumentos salen de las funciones PURAS de
    // electron/export-args.js (probadas en scripts/export-args.test.mjs).
    const mode = cropMode || 'smart-crop';
    const fInfo = filtroParaFormato(formatKey, mode);
    const filter = fInfo.filter;
    const suffix = fInfo.suffix;

    const baseName = path.basename(sourcePath, '.mp4');
    const outFilename = `${baseName}_${suffix}.mp4`;
    const outPath = path.join(projectDir, outFilename);

    // Hito 3: los argumentos los construye buildExportArgs (pura):
    // 16:9 al tamaño del máster = copia de flujos + faststart (segundos);
    // el resto = filtro + codificador de la escalera de hardware con el
    // bitrate por área del motor nativo (1080p→12 Mbps en los presets).
    const built = buildExportArgs({
      sourcePath, outPath, formatKey, cropMode: mode,
      encoder: getExportEncoder(), sourceWidth, sourceHeight,
    });
    const args = built.args;

    // v1.5.0 (Frente B): dedupe por firma de parámetros. Si este mismo encode
    // ya se produjo (p. ej. el gemelo Facebook/YouTube 16:9, parámetros
    // idénticos), se copia el archivo en vez de codificar por segunda vez.
    const exportSig = computeExportSignature({
      sourcePath,
      sourceSize: fs.statSync(sourcePath).size,
      filter,
      mode,
      codecKey: built.codecKey,
    });
    {
      const siblingSuffix = siblingSuffixFor(suffix);
      const siblingPath = siblingSuffix ? path.join(projectDir, `${baseName}_${siblingSuffix}.mp4`) : null;
      let dedupeSource = null;
      const cachedPath = exportEncodeSignatures.get(exportSig);
      if (cachedPath && cachedPath !== outPath && fs.existsSync(cachedPath)) dedupeSource = cachedPath;
      else if (siblingPath && siblingPath !== outPath && fs.existsSync(siblingPath) && fs.statSync(siblingPath).mtimeMs >= fs.statSync(sourcePath).mtimeMs) dedupeSource = siblingPath;
      if (dedupeSource) {
        try {
          fs.copyFileSync(dedupeSource, outPath);
          exportEncodeSignatures.set(exportSig, outPath);
          // Hito 3: el dedupe ya NO copia el «_Thumbnail.jpg» hermano:
          // ningún JPG automático (la miniatura es solo su botón).
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('export-progress', { formatKey, percent: 100 });
          }
          console.log(`[Export] Dedupe: ${outFilename} copiado desde ${path.basename(dedupeSource)} (mismos parámetros).`);
          return resolve({ success: true, path: outPath, dedupedFrom: dedupeSource });
        } catch (e) {
          console.warn('[Export] Dedupe falló, se codifica normalmente:', e.message);
        }
      }
    }

    // (La sonda de duración/dimensiones ya corrió arriba, antes de
    // construir los argumentos — Hito 3.)
    const convertProc = spawn(ffmpegPath, args);
    let stderrTail = '';

    convertProc.stderr.on('data', (data) => {
      const msg = data.toString();
      stderrTail = (stderrTail + msg).slice(-800);
      const timeMatch = msg.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
      if (timeMatch && mainWindow && !mainWindow.isDestroyed()) {
        const hours = parseInt(timeMatch[1], 10);
        const mins = parseInt(timeMatch[2], 10);
        const secs = parseFloat(timeMatch[3]);
        const currentSecs = hours * 3600 + mins * 60 + secs;
        mainWindow.webContents.send('export-progress', {
          formatKey,
          currentSecs,
          percent: totalSecs > 0
            ? Math.min(95, Math.round((currentSecs / totalSecs) * 100))
            : Math.min(95, Math.max(20, Math.round(currentSecs * 15))),
        });
      }
    });

    convertProc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
        exportEncodeSignatures.set(exportSig, outPath);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('export-progress', { formatKey, percent: 100 });
        }
        // Hito 3 — disciplina de escritura: NO se genera ningún JPG
        // automático tras exportar (antes, cada MP4 dejaba un
        // «_Thumbnail.jpg» no pedido en la carpeta del proyecto y la
        // respuesta esperaba a ese proceso). La carpeta contiene SOLO
        // los MP4 generados; la miniatura JPG sigue disponible bajo
        // demanda con su botón en el modal.
        resolve({ success: true, path: outPath });
      } else {
        // Nada de archivos a medias presentados como exportados, y nada de
        // error genérico: se devuelve el final real de la salida de FFmpeg.
        try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch (e) {}
        resolve({ success: false, error: `Error en proceso de conversión FFmpeg${stderrTail ? `: ${stderrTail.trim().split('\n').slice(-2).join(' ')}` : ''}` });
      }
    });

    convertProc.on('error', (err) => {
      try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch (e) {}
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
        const thumbPath = outPath.replace(/\.mp4$/i, '_Thumbnail.jpg');
        try {
          const tProc = spawn(ffmpegPath, ['-y', '-ss', '00:00:00.800', '-i', outPath, '-vframes', '1', '-q:v', '2', thumbPath]);
          tProc.on('close', () => {
            resolve({ success: true, path: outPath, thumbnailPath: thumbPath });
          });
          setTimeout(() => resolve({ success: true, path: outPath }), 1200);
          return;
        } catch (e) {}

        resolve({ success: true, path: outPath });
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
  const recPath = currentRecordingPath;
  const partialPath = currentRecordingPartialPath;
  currentRecordingPath = null;
  currentRecordingPartialPath = null;
  recordingProbe = null;
  coreRecordingFailure = null;
  // v2.0.0: el consumidor de grabación vive en el núcleo; se desengancha
  // y se mata sin finalizar (el archivo parcial se elimina abajo).
  const hadRecording = !!programCore.getRecordingState();
  programCore.detachRecording();
  if (!hadRecording && !isStoppingRecording) {
    return { success: true };
  }
  isStoppingRecording = false;
  releasePowerSaveBlocker('recording');
  if (recPath) {
    try { await fs.promises.unlink(recPath); } catch (error) {
      if (error.code !== 'ENOENT') return { success: false, error: error.message };
    }
  }
  // La grabación en curso vive en el .partial.mp4: cancelar también lo
  // elimina, para no dejar parciales huérfanos en el proyecto.
  if (partialPath && partialPath !== recPath) {
    try { await fs.promises.unlink(partialPath); } catch (error) {
      if (error.code !== 'ENOENT') return { success: false, error: error.message };
    }
  }
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
      const projectsRoot = getProjectsRootDir();
      if (!fs.existsSync(projectsRoot)) {
        try { fs.mkdirSync(projectsRoot, { recursive: true }); } catch (e) {}
      }
      dest = path.join(projectsRoot, `${cleanProjectName}_Thumbnail_${Date.now()}.jpg`);
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
// v2.0.0: cada destino corre en su propio worker de COPIA (sin recodificar)
// alimentado por el grafo único del núcleo (electron/program-core.js).
// ============================================================================
// ============================================================================
// STREAMING — el grafo vive en el núcleo v2.0.0 (electron/program-core.js).
// Lo que la v1.5.0–v1.7.x hacía en esta sección (un worker FFmpeg POR
// destino transcodificando el WebM del renderer, cabecera EBML compartida
// streamInitHeader, reconexión por destino) se conserva como disciplina
// — backoff 5/10/20/40/60, cola con tope de 32 MB, stderr con memoria,
// telemetría real parseada sin valores de relleno, log persistente —
// pero la ejecuta el núcleo sobre trabajadores de COPIA: la única
// codificación del programa ocurre una sola vez y se reparte.
// La sonda de codificador (v1.7.0: h264_mf primero, libx264 cacheado de
// respaldo, volteo si el arranque real muere por encoder) alimenta SOLO
// el modo WebM de respaldo del núcleo.
// ============================================================================
let streamingSessionActive = false;

// v1.6.1: powerSaveBlocker acotado a streaming/grabación en curso (antes se
// activaba al arrancar la app y nunca se liberaba). El id se guarda en una
// variable de módulo, el arranque es idempotente y el conteo por motivo
// evita que detener el streaming libere el bloqueo si la grabación sigue
// activa (y viceversa).
let powerSaveBlockerId = null;
const powerSaveBlockerReasons = new Set();
function acquirePowerSaveBlocker(reason) {
  powerSaveBlockerReasons.add(reason);
  if (powerSaveBlockerId == null) {
    try { powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension'); }
    catch (e) { powerSaveBlockerId = null; }
  }
}
function releasePowerSaveBlocker(reason) {
  powerSaveBlockerReasons.delete(reason);
  if (powerSaveBlockerReasons.size === 0 && powerSaveBlockerId != null) {
    try { powerSaveBlocker.stop(powerSaveBlockerId); } catch (e) {}
    powerSaveBlockerId = null;
  }
}
// La reconexión con backoff, la cola con tope y el timeout de arranque
// viven ahora en electron/program-core.js (mismos valores históricos).
const STREAM_HEADER_WAIT_MS = 4000;

function appendStreamLog(line) {
  try {
    const logPath = path.join(app.getPath('userData'), 'logs', 'streaming.log');
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${line}\n`);
  } catch (e) {}
}

// ============================================================================
// INSTRUMENTO DE DIAGNÓSTICO DE VENTANA (build diagnóstica post-v3.2.4; NO
// es una release ni un arreglo). La v3.2.4 no quitó en vivo ni la traba al
// cambiar de ventana ni el fallo del teleprompter: a partir de aquí manda la
// MEDICIÓN en la máquina de Luis. Este instrumento escribe
// userData/logs/ventana-diag.log siguiendo el mismo patrón que
// appendStreamLog (appendFileSync línea a línea: cada línea queda en disco
// en el acto, también si la app se cuelga justo después):
//   [main]     latido del proceso principal cada 500 ms — si el latido
//              sigue y los pings no, se colgó SOLO el renderer; si el
//              latido también se detiene, se colgó todo el proceso.
//   [ping]     agregado 1 Hz: retraso máximo de llegada de los pings del
//              renderer en el último segundo (ritmo esperado 500 ms).
//   [foco]     blur/focus/hide/show/minimize/restore de la ventana y
//              visibilitychange del renderer, con marca de tiempo.
//   [muestra]  foto del renderer cada 5 s (la manda él por IPC): ticks y
//              composiciones del motor de ventana, modo del gobernador,
//              cámaras activas, grabando/transmitiendo.
//   [prompter] estado real del teleprompter (la manda el renderer).
// El instrumento NO cambia ningún comportamiento: ni gobernadores nuevos
// ni toques al overlay; solo observa y anota.
// ============================================================================
const DIAG_PING_PREFIXES = new Set(['foco', 'muestra', 'prompter']);
let ventanaDiagStarted = false;
let ventanaDiagHeartbeat = null;
let ventanaDiagPingFlush = null;
let ventanaDiagLatidoN = 0;
const ventanaDiagPings = createPingAggregator(500);

function ventanaDiagPath() {
  return path.join(app.getPath('userData'), 'logs', 'ventana-diag.log');
}

function appendVentanaDiag(prefix, text) {
  try {
    const logPath = ventanaDiagPath();
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, `${formatDiagLine(new Date().toISOString(), prefix, text)}\n`);
  } catch (e) {}
}

function startVentanaDiag() {
  if (ventanaDiagStarted) return;
  ventanaDiagStarted = true;
  appendVentanaDiag('main', `=== ventana-diag INICIO version=${app.getVersion()} fecha=${new Date().toISOString()} plataforma=${process.platform} ruta=${ventanaDiagPath()} ===`);
  ventanaDiagHeartbeat = setInterval(() => {
    ventanaDiagLatidoN += 1;
    appendVentanaDiag('main', `latido n=${ventanaDiagLatidoN}`);
  }, 500);
  ventanaDiagPingFlush = setInterval(() => {
    const s = ventanaDiagPings.flush();
    appendVentanaDiag('ping', `retrasoMaxUltimoSegundo=${s.maxDelayMs == null ? 'sin-datos' : `${s.maxDelayMs}ms`} pingsUltimoSegundo=${s.pings}`);
  }, 1000);
  ipcMain.on('ventana-diag-ping', () => {
    ventanaDiagPings.push(Date.now());
  });
  ipcMain.on('ventana-diag-event', (event, payload) => {
    try {
      if (!payload || !DIAG_PING_PREFIXES.has(payload.prefix)) return;
      appendVentanaDiag(payload.prefix, String(payload.text || ''));
    } catch (e) {}
  });
}

function stopVentanaDiag() {
  if (!ventanaDiagStarted) return;
  ventanaDiagStarted = false;
  if (ventanaDiagHeartbeat) { clearInterval(ventanaDiagHeartbeat); ventanaDiagHeartbeat = null; }
  if (ventanaDiagPingFlush) { clearInterval(ventanaDiagPingFlush); ventanaDiagPingFlush = null; }
  appendVentanaDiag('main', '=== ventana-diag CIERRE LIMPIO ===');
}
app.on('before-quit', () => { try { stopVentanaDiag(); } catch (e) {} });

function redactStreamUrl(text, destUrl) {
  let out = String(text || '');
  try {
    const parsed = new URL(destUrl);
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length) segments[segments.length - 1] = '[clave oculta]';
    parsed.pathname = `/${segments.join('/')}`;
    parsed.search = '';
    out = out.replaceAll(destUrl, parsed.toString());
  } catch (e) {
    out = out.replaceAll(destUrl, '[URL RTMP oculta]');
  }
  return out;
}

// classifyStreamError y STREAM_ERROR_USER_MESSAGES viven en
// electron/stream-error.js (v1.5.1, Frente D1): módulo puro testeable que
// suma el kind 'url' ("Publish Rejected: Invalid URL") a los previos.
function sendStreamDestinationStatus(entry, status, extra = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    // Junto al error técnico viaja su clasificación y el mensaje accionable
    // en español (campos nuevos; los existentes no cambian).
    const kind = extra.kind || (extra.error ? classifyStreamError(extra.error) : null);
    mainWindow.webContents.send('stream-destination-status', {
      targetId: entry.id,
      targetName: entry.name,
      status,
      attempt: entry.reconnectAttempts || 0,
      ...extra,
      ...(kind ? { kind, userMessage: STREAM_ERROR_USER_MESSAGES[kind] || STREAM_ERROR_USER_MESSAGES.unknown } : {}),
    });
  }
}

function streamFailureFields(kind) {
  const k = kind || 'unknown';
  return { kind: k, userMessage: STREAM_ERROR_USER_MESSAGES[k] || STREAM_ERROR_USER_MESSAGES.unknown };
}

// ============================================================================
// NÚCLEO EN VIVO v2.0.0 (Raíz A, reemplazo): el grafo de programa vive en
// electron/program-core.js — UN proceso codificador/mezclador y reparto
// con copia a destinos y grabación. Aquí quedan: la sesión de codificador
// (sonda), la instancia del núcleo con sus puentes a la UI, y los handlers
// IPC. Los workers por destino que transcodificaban (v1.5.0–v1.7.x) y la
// cabecera EBML compartida (streamInitHeader) desaparecen: el núcleo une
// a cada consumidor en el último keyframe con etiquetas re-selladas.
// ============================================================================
const { createProgramCore } = require('./program-core');
const { createNativeEngine } = require('./native-engine');

// Sesión de codificador de streaming (v1.7.0, Raíz A): la sonda corre
// perezosa al arrancar el primer destino y su resultado queda cacheado
// para toda la sesión (electron/stream-encoder.js). En el núcleo v2.0.0
// la usa SOLO el modo WebM de respaldo (la única transcodificación).
const streamEncoderSession = createStreamEncoderSession({
  spawnImpl: spawn,
  ffmpegPath,
  log: (line) => appendStreamLog(line),
});

// Destinos vivos según el núcleo, para reenviar la telemetría del ÚNICO
// proceso de programa a cada destino conectado (la telemetría es del
// programa; se etiqueta por destino para no cambiar el contrato de la UI).
const liveDestinationEntries = new Map();

// Perfil de programa activo (v3.0.0): lo fija el renderer vía el IPC
// 'set-program-profile'; null hasta entonces (el núcleo usa su perfil
// por defecto, 1080p, y el nombre del máster cae a '1080p').
let currentProgramProfile = null;

const programCore = createProgramCore({
  spawnImpl: spawn,
  ffmpegPath,
  sessionEncoder: streamEncoderSession,
  // El núcleo espera classifyError(texto) -> kind (string), que es
  // exactamente lo que devuelve el clasificador compartido.
  classifyError: classifyStreamError,
  log: (line) => appendStreamLog(line),
  onDestinationStatus: (entry, status, extra = {}) => {
    if (status === 'live') liveDestinationEntries.set(entry.id, entry);
    if (status === 'failed') liveDestinationEntries.delete(entry.id);
    sendStreamDestinationStatus(entry, status, {
      ...extra,
      ...(extra.error ? { error: redactStreamUrl(extra.error, entry.url) } : {}),
      ...(extra.stderrTail ? { stderrTail: redactStreamUrl(extra.stderrTail, entry.url) } : {}),
    });
    if (status === 'live' && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('stream-status', {
        active: true,
        destinations: [...liveDestinationEntries.values()].map(e => e.target),
      });
    }
  },
  onTelemetry: ({ fps, bitrate, droppedFrames }) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    for (const entry of liveDestinationEntries.values()) {
      mainWindow.webContents.send('stream-telemetry', {
        targetId: entry.id,
        targetName: entry.name,
        fps,
        bitrate,
        droppedFrames,
        health: droppedFrames > 15 ? 'warning' : 'excellent',
      });
    }
  },
  onRecordingStderr: (text) => { feedRecordingProbe(text); },
  onRecordingFailed: (message) => {
    coreRecordingFailure = message;
    appendStreamLog(`Grabación: ${message}`);
    if (mainWindow && !mainWindow.isDestroyed() && !isStoppingRecording) {
      mainWindow.webContents.send('recording-process-error', { error: message });
    }
  },
  sessionsDir: path.join(app.getPath('userData'), 'program-sessions'),
  selfTestDir: path.join(app.getPath('userData'), 'program-selftest'),
  onSelfTestResult: (v) => { appendStreamLog('Autoprueba del Motor PodcastStudio: ' + (v.ok ? `OK — modo ${v.mode}, codificador ${v.encoderLabel}, ${v.width}×${v.height} a ${v.fpsMeasured} fps medidos` : `FALLO — ${v.error || 'sin detalle'}`)); if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('program-selftest-result', v); },
  onSelfTestFlowNeeded: () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('program-selftest-request', {}); },
});

// ============================================================================
// MOTOR NATIVO HOSPEDADO (Hito 2, v3.1.0): la app gobierna la tubería de
// GStreamer de electron/native-engine.js (vista previa nativa, grabación
// y transmisión LOCAL de prueba). Su estado viaja al renderer por el
// evento 'native-engine-state' y sus órdenes por los IPC de abajo.
// ============================================================================
const nativeEngineHost = createNativeEngine({
  ffmpegPath,
  log: (line) => appendStreamLog(line),
  onState: (state) => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('native-engine-state', state); },
});

// ----------------------------------------------------------------------------
// COLISIÓN IPC del Hito 2 (verificada y resuelta aquí, sin tocar bridge.js):
// electron/media-engine/bridge.js ya registró al arrancar (setupNativeEngineIPC)
// handlers ipcMain para 'native-engine:start' y 'native-engine:stop' con el
// payload LEGADO { destinations, config } del media-engine histórico, y
// también 'native-engine:write-frame', 'native-engine:write-audio' y
// 'native-engine:status', guardados por su bandera interna de «corriendo».
// Electron no admite dos handlers para el mismo canal, así que registrar
// los canales del Hito 2 sin más rompería el arranque o el legado.
//
// Resolución: se retiran SOLO los cinco handlers que bridge.js registró y
// se re-registran aquí como ENRUTADORES equivalentes:
//   - 'native-engine:start': si el payload trae `session` (string no
//     vacío) es una sesión del Hito 2 y va al anfitrión GStreamer; si no,
//     es el payload legado y va a electron/media-engine (index.js), tal
//     cual lo hacía bridge.js.
//   - write-frame / write-audio / status delegan en media-engine/index
//     con la bandera local legacyMediaEngineRunning, que reproduce la
//     semántica de la bandera interna de bridge.js (solo escribe si el
//     motor legado está corriendo, y start/stop legados la actualizan).
//   - 'native-engine:stop': si el anfitrión del Hito 2 no está «apagado»
//     se detiene él; si está apagado, la parada es la legada.
//   - 'native-engine:get-state' (nuevo): estado del anfitrión del Hito 2.
// bridge.js NO se modifica: su setup queda sustituido por esta
// re-registración equivalente más el enrutador, y por eso los
// removeHandler de abajo van en try/catch (si bridge.js no llegó a
// registrar, no pasa nada).
// ----------------------------------------------------------------------------
const legacyMediaEngine = require('./media-engine');
let legacyMediaEngineRunning = false;
for (const canalLegado of ['native-engine:start', 'native-engine:stop', 'native-engine:write-frame', 'native-engine:write-audio', 'native-engine:status']) {
  try { ipcMain.removeHandler(canalLegado); } catch (e) {}
}
ipcMain.handle('native-engine:start', async (_event, payload) => {
  try {
    if (payload && typeof payload.session === 'string' && payload.session) {
      // Hito 3: con projectName (los botones reales de la app) el máster
      // nativo cae en la carpeta del proyecto con el esquema del máster
      // de la app — <Proyecto>_<AAAA-MM-DD_HH-MM-SS> — y el motor añade
      // «_Master_<alto>p.mp4». El saneado del nombre es el MISMO del
      // handler start-recording y la raíz la de getProjectsRootDir().
      // Sin projectName ni outDir (panel de prueba) se conserva el
      // destino histórico en userData/motor-nativo.
      let outDir = payload.outDir;
      let outFileBase = payload.outFileBase;
      if (!outDir && payload.projectName) {
        const cleanProjectName = String(payload.projectName).replace(/^PodcaStudio_/i, '').replace(/_\d{10,}$/, '').replace(/[/\\?%*:|"<>]/g, '_').trim() || 'Proyecto_General';
        outDir = path.join(getProjectsRootDir(), cleanProjectName);
        if (!outFileBase) {
          const now = new Date();
          const pad2 = (n) => String(n).padStart(2, '0');
          outFileBase = `${cleanProjectName}_${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}_${pad2(now.getHours())}-${pad2(now.getMinutes())}-${pad2(now.getSeconds())}`;
        }
      }
      if (!outDir) outDir = path.join(app.getPath('userData'), 'motor-nativo');
      return await nativeEngineHost.start({ ...payload, outDir, ...(outFileBase ? { outFileBase } : {}) });
    }
    const result = legacyMediaEngine.start(payload || {});
    legacyMediaEngineRunning = !!result.success;
    return result;
  } catch (e) {
    return { success: false, error: e.message };
  }
});
ipcMain.handle('native-engine:stop', async () => {
  try {
    if (nativeEngineHost.getState().phase !== 'apagado') {
      await nativeEngineHost.stop();
      return { success: true };
    }
    const result = legacyMediaEngine.stop();
    legacyMediaEngineRunning = false;
    return result;
  } catch (e) {
    legacyMediaEngineRunning = false;
    return { success: false, error: e.message };
  }
});
ipcMain.handle('native-engine:write-frame', async (_event, buffer) => {
  try {
    if (!legacyMediaEngineRunning) return false;
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    return legacyMediaEngine.writeFrame(buf);
  } catch (e) {
    return false;
  }
});
ipcMain.handle('native-engine:write-audio', async (_event, buffer) => {
  try {
    if (!legacyMediaEngineRunning) return false;
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    return legacyMediaEngine.writeAudio(buf);
  } catch (e) {
    return false;
  }
});
ipcMain.handle('native-engine:status', async () => {
  try {
    return legacyMediaEngine.getStatus();
  } catch (e) {
    return { running: false, connected: false, error: e.message };
  }
});
ipcMain.handle('native-engine:get-state', async () => nativeEngineHost.getState());
ipcMain.handle('native-engine:set-preview-text', async (_event, payload) => {
  try {
    return await nativeEngineHost.setPreviewText(String(payload?.text ?? ''));
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('start-streaming', async (_event, payload = {}) => {
  const targets = typeof payload === 'string'
    ? [{ id: 'custom', name: 'Stream', url: payload.trim() }]
    : Array.isArray(payload.destinations)
      ? payload.destinations.filter(target => target?.url && target.url.trim())
      : [];

  if (!targets.length) return { success: false, error: 'No se proporcionaron destinos con una clave de transmisión.' };

  // Cadena sana: cerrar la sesión anterior antes de abrir la nueva.
  programCore.setSessionActive(false);
  await programCore.removeAllDestinations();
  liveDestinationEntries.clear();
  streamDestinations = targets;

  programCore.setSessionActive(true);
  streamingSessionActive = true;

  // Sin flujo no hay nada que repartir: el motor del renderer ya está
  // alimentando el núcleo; se espera a que el flujo tenga cabecera y
  // keyframe (unión posible) con el mismo presupuesto de 4 s de antes.
  const flowReady = await programCore.waitForFlow(STREAM_HEADER_WAIT_MS);
  if (!flowReady) {
    programCore.setSessionActive(false);
    streamingSessionActive = false;
    streamDestinations = [];
    appendStreamLog('Arranque abortado: el núcleo no recibió flujo de programa en 4 s.');
    return { success: false, error: 'El motor de vídeo no entregó la cabecera inicial en 4 segundos: no hay fotogramas del programa para transmitir. Revisa que la cámara de programa esté activa.' };
  }

  const startupResults = await Promise.all(targets.map(async (target) => {
    const result = await programCore.addDestination({
      id: target.id,
      name: target.name,
      url: target.url.trim(),
    });
    if (!result.success) {
      appendStreamLog(`${target.name}: NO conectó. ${result.error || ''}`);
      const entryForStatus = result.entry || { id: target.id, name: target.name, url: target.url.trim(), target };
      sendStreamDestinationStatus(entryForStatus, 'failed', {
        error: redactStreamUrl(result.error || 'Error de conexión RTMP/RTMPS.', entryForStatus.url),
        kind: result.kind,
      });
      return { target, success: false, error: redactStreamUrl(result.error || 'Error de conexión RTMP/RTMPS.', entryForStatus.url), ...streamFailureFields(result.kind) };
    }
    return { target, success: true };
  }));

  const connectedDestinations = startupResults.filter(r => r.success).map(r => r.target);
  const failures = startupResults.filter(r => !r.success).map(r => ({ name: r.target.name, error: r.error, kind: r.kind, userMessage: r.userMessage }));
  if (!connectedDestinations.length) {
    programCore.setSessionActive(false);
    streamingSessionActive = false;
    await programCore.removeAllDestinations();
    liveDestinationEntries.clear();
    streamDestinations = [];
    return { success: false, error: failures.map(f => `${f.name}: ${f.error}`).join('\n') || 'No se pudo conectar con el servidor de transmisión.', failures };
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('stream-status', { active: true, destinations: connectedDestinations });
  }
  acquirePowerSaveBlocker('streaming');
  return { success: true, connectedDestinations, failures };
});

// Entradas del flujo de programa (núcleo v2.0.0). 'stream-chunk' es la
// ruta WebM de respaldo; 'program-video-chunk'/'program-audio-chunk' son
// la ruta WebCodecs (H.264 elemental + audio WebM/Opus).
ipcMain.on('stream-chunk', (event, chunkBuffer) => {
  if (!chunkBuffer) return;
  const buf = toSafeBuffer(chunkBuffer);
  if (buf && buf.length) programCore.writeWebmChunk(buf);
});

ipcMain.on('program-video-chunk', (event, chunkBuffer) => {
  if (!chunkBuffer) return;
  const buf = toSafeBuffer(chunkBuffer);
  if (buf && buf.length) programCore.writeVideoChunk(buf);
});

ipcMain.on('program-audio-chunk', (event, chunkBuffer) => {
  if (!chunkBuffer) return;
  const buf = toSafeBuffer(chunkBuffer);
  if (buf && buf.length) programCore.writeAudioChunk(buf);
});

// v3.0.1: el renderer anuncia el modo EFECTIVO del flujo de programa y
// queda en el registro. Sin esta línea, un flujo que no entrega bytes
// no deja rastro de qué camino tomó la ventana (así fue indiagnosticable
// el «sin flujo del renderer» de la v3.0.0 hasta leer el código).
ipcMain.on('program-flow-mode', (event, mode) => {
  appendStreamLog(`Núcleo v3: flujo de programa en modo ${mode || 'desconocido'} (anunciado por el renderer).`);
});

// Pausa de grabación del núcleo: el reparto deja de alimentar al
// consumidor de grabación (equivalente a la pausa real del MediaRecorder
// dedicado que esto reemplaza); el directo no se toca.
ipcMain.handle('set-recording-paused', async (_event, paused) => {
  programCore.setRecordingPaused(!!paused);
  return { success: true };
});

ipcMain.handle('stop-streaming', async () => {
  programCore.setSessionActive(false);
  streamingSessionActive = false;
  await programCore.removeAllDestinations();
  liveDestinationEntries.clear();
  streamDestinations = [];
  releasePowerSaveBlocker('streaming');
  appendStreamLog('Sesión de streaming detenida por el usuario.');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('stream-status', {
      active: false,
      destinations: []
    });
  }
  return { success: true };
});

// ===========================================================================
// PERFIL DE PROGRAMA Y AUTOPRUEBA DEL MOTOR PODCASTUDIO (v3.0.0)
// ===========================================================================
ipcMain.handle('set-program-profile', async (_event, profile) => {
  const isValidProfile = !!profile && typeof profile === 'object'
    && typeof profile.id === 'string' && profile.id.trim() !== ''
    && Number.isFinite(Number(profile.width)) && Number(profile.width) > 0
    && Number.isFinite(Number(profile.height)) && Number(profile.height) > 0;
  if (isValidProfile) {
    currentProgramProfile = {
      id: profile.id,
      width: Number(profile.width),
      height: Number(profile.height),
      masterBitrateBps: profile.masterBitrateBps,
      streamWidth: profile.streamWidth,
      streamHeight: profile.streamHeight,
      streamBitrateBps: profile.streamBitrateBps,
    };
    programCore.setProgramProfile({
      id: profile.id,
      width: profile.width,
      height: profile.height,
      masterBitrateBps: profile.masterBitrateBps,
      streamWidth: profile.streamWidth,
      streamHeight: profile.streamHeight,
      streamBitrateBps: profile.streamBitrateBps,
    });
  }
  return { success: true };
});

ipcMain.handle('run-program-selftest', async () => {
  const verdict = await programCore.runSelfTest({ durationMs: 3000 });
  return verdict;
});
