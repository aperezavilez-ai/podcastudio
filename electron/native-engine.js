'use strict';
// ============================================================================
// Motor Nativo hospedado — Hito 2 (v3.1.0).
//
// La app gobierna una tubería de GStreamer FUERA de la ventana: captura
// (mfvideosrc) → conversión/composición D3D11 → tee de programa →
// vista previa nativa (d3d11videosink) y, según la sesión, codificación
// H.264 por hardware → MP4 fragmentado y/o FLV hacia un RTMP LOCAL de
// prueba. Electron solo arranca, observa y detiene esa tubería; ningún
// fotograma pasa por el canvas ni por el proceso de la ventana.
//
// Este módulo NO importa Electron: todas sus dependencias llegan por
// inyección (createNativeEngine(deps)), igual que electron/program-core.js,
// para poder probarlo en Node puro con stubs.
// ============================================================================

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Destino LOCAL de prueba de la sesión 'recordStream': el destino real se conecta en un hito posterior.
const RTMP_PRUEBA_URL = 'rtmp://127.0.0.1:1935/live/prueba';

// Escalera de codificadores H.264, de mejor a peor: hardware primero.
const ENCODER_LADDER = ['nvh264enc', 'qsvh264enc', 'mfh264enc', 'x264enc'];

function pad2(n) { return String(n).padStart(2, '0'); }

function marcaDeTiempoLocal(fecha) {
  const d = fecha || new Date();
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

// ----------------------------------------------------------------------------
// Localización de las herramientas de GStreamer.
// Orden de búsqueda declarado:
//   1) env.PODCASTUDIO_GST_BIN (directorio explícito)
//   2) cada directorio de env.PATH, en orden
//   3) %LOCALAPPDATA%\Programs\gstreamer\1.0\msvc_x86_64\bin
//   4) C:\gstreamer\1.0\msvc_x86_64\bin
//   5) C:\Program Files\gstreamer\1.0\msvc_x86_64\bin
// Devuelve { launch, inspect, monitor } o null si falta alguna herramienta.
// ----------------------------------------------------------------------------
function locateGstTools(opciones) {
  const opts = opciones || {};
  const env = opts.env || process.env;
  const platform = opts.platform || process.platform;
  const fsExists = typeof opts.fsExists === 'function' ? opts.fsExists : (p) => fs.existsSync(p);
  const log = typeof opts.log === 'function' ? opts.log : () => {};
  const ext = platform === 'win32' ? '.exe' : '';
  const nombres = {
    launch: `gst-launch-1.0${ext}`,
    inspect: `gst-inspect-1.0${ext}`,
    monitor: `gst-device-monitor-1.0${ext}`,
  };
  const directorios = [];
  if (env.PODCASTUDIO_GST_BIN) directorios.push(env.PODCASTUDIO_GST_BIN);
  if (env.PATH) {
    for (const dir of String(env.PATH).split(path.delimiter)) {
      if (dir) directorios.push(dir);
    }
  }
  if (env.LOCALAPPDATA) {
    directorios.push(path.join(env.LOCALAPPDATA, 'Programs', 'gstreamer', '1.0', 'msvc_x86_64', 'bin'));
  }
  directorios.push('C:\\gstreamer\\1.0\\msvc_x86_64\\bin');
  directorios.push('C:\\Program Files\\gstreamer\\1.0\\msvc_x86_64\\bin');

  const buscar = (nombreArchivo) => {
    for (const dir of directorios) {
      // Los directorios fijos de Windows (C:\...) se unen con '\'; el resto
      // con el separador de la plataforma anfitriona de este proceso.
      const candidato = /^[A-Za-z]:\\/.test(dir) && !dir.includes('/') && path.sep !== '\\'
        ? `${dir}\\${nombreArchivo}`
        : path.join(dir, nombreArchivo);
      try { if (fsExists(candidato)) return candidato; } catch (e) {}
    }
    return null;
  };

  const launch = buscar(nombres.launch);
  const inspect = buscar(nombres.inspect);
  const monitor = buscar(nombres.monitor);
  if (!launch || !inspect || !monitor) {
    const faltan = [
      !launch ? nombres.launch : null,
      !inspect ? nombres.inspect : null,
      !monitor ? nombres.monitor : null,
    ].filter(Boolean).join(', ');
    log(`[motor-nativo] GStreamer no instalado o incompleto: falta ${faltan}. Instala el runtime MSVC x86_64 completo de GStreamer.`);
    return null;
  }
  return { launch, inspect, monitor };
}

// ----------------------------------------------------------------------------
// Parseo de UN caps de GStreamer. Acepta los valores CON tipo de la sintaxis
// GstCaps (width=(int)1920, framerate=(fraction)30/1) y SIN tipo, que es
// como gst-device-monitor-1.0 imprime la enumeración real en Windows
// (width=1920, framerate=30/1: verificado contra la salida real de la
// máquina de Luis, 2026-11-12 — con la sintaxis tipada obligatoria TODOS
// los caps reales parseaban a null). Devuelve null si no hay ancho/alto
// enteros simples (p. ej. rangos width=(int)[ 640, 1920 ]): esa entrada se
// ignora, nunca se inventa una resolución.
// ----------------------------------------------------------------------------
function parseUnCaps(crudo) {
  const raw = String(crudo || '').trim().replace(/;$/, '').trim();
  if (!raw) return null;
  const mW = raw.match(/width=(?:\(int\))?(\d+)/);
  const mH = raw.match(/height=(?:\(int\))?(\d+)/);
  if (!mW || !mH) return null;
  const mFmt = raw.match(/format=\(string\)([A-Za-z0-9_]+)/) || raw.match(/format=([A-Za-z0-9_]+)/);
  let framerate = null;
  const mLista = raw.match(/framerate=(?:\(fraction\))?\{([^}]+)\}/);
  if (mLista) {
    const primero = mLista[1].split(',')[0].trim();
    const mFrac = primero.match(/(\d+)\s*\/\s*(\d+)/);
    if (mFrac && Number(mFrac[2]) !== 0) framerate = Number(mFrac[1]) / Number(mFrac[2]);
    else if (/^\d+$/.test(primero)) framerate = Number(primero);
  } else {
    const mFrac = raw.match(/framerate=(?:\(fraction\))?(\d+)\s*\/\s*(\d+)/);
    if (mFrac && Number(mFrac[2]) !== 0) framerate = Number(mFrac[1]) / Number(mFrac[2]);
  }
  return {
    raw,
    format: mFmt ? mFmt[1] : null,
    width: Number(mW[1]),
    height: Number(mH[1]),
    framerate,
  };
}

function agregarCapsDesdeTexto(lista, texto) {
  for (const parte of String(texto || '').split(';')) {
    // Tolerancia a contaminación: el monitor mezcla stderr con la salida y
    // una línea de ERROR/WARNING de un proveedor (en la máquina de Luis, la
    // del proveedor NDI) puede quedar incrustada DENTRO de un caps y
    // corromperlo (su «framerate=30/1» pegado a la marca de tiempo parseaba
    // como 30/10 = 3 fps). Ese fragmento se descarta entero.
    if (parte.includes(' ERROR ') || parte.includes(' WARNING ') || parte.includes('ndideviceprovider')) continue;
    const caps = parseUnCaps(parte);
    if (caps) lista.push(caps);
  }
}

// ----------------------------------------------------------------------------
// Parser puro de la salida de gst-device-monitor-1.0.
// Bloques que empiezan con «Device found:»; dentro, líneas
// `name : X`, `class : Video/Source`, `caps : <caps>` y líneas de
// continuación indentadas que siguen a caps (cada una es otro caps).
// También captura `device-path = valor` si aparece en el bloque, y la
// sección «properties:» de las entradas MediaFoundation, que declara
// `device.path = <ruta>` (el selector que usa mfvideosrc) y
// `device.api = mediafoundation`.
// La clase llega como «Video/Source» en las entradas KS/DirectShow y como
// «Source/Video» (invertida) en las de MediaFoundation — son las que usa
// mfvideosrc —: se aceptan AMBAS; cualquier otra clase se descarta.
// ----------------------------------------------------------------------------
function parseDeviceMonitorOutput(texto) {
  const dispositivos = [];
  const bloques = String(texto || '').split(/Device found:/);
  // El primer trozo es lo anterior al primer «Device found:»: se descarta.
  for (let i = 1; i < bloques.length; i += 1) {
    const lineas = bloques[i].split(/\r?\n/);
    const disp = { name: null, class: null, caps: [], devicePath: null, api: null, deviceIndex: dispositivos.length };
    let enCaps = false;
    for (const linea of lineas) {
      const recortada = linea.trim();
      if (!recortada) { continue; }
      let m;
      if ((m = recortada.match(/^name\s*:\s*(.+)$/))) { disp.name = m[1].trim(); enCaps = false; continue; }
      if ((m = recortada.match(/^class\s*:\s*(.+)$/))) { disp.class = m[1].trim(); enCaps = false; continue; }
      if ((m = recortada.match(/^caps\s*:\s*(.+)$/))) { agregarCapsDesdeTexto(disp.caps, m[1]); enCaps = true; continue; }
      if ((m = recortada.match(/^device-path\s*=\s*(.+)$/))) { disp.devicePath = m[1].trim(); continue; }
      if ((m = recortada.match(/^device\.path\s*=\s*(.+)$/))) { disp.devicePath = m[1].trim(); continue; }
      if ((m = recortada.match(/^device\.api\s*=\s*(.+)$/))) { disp.api = m[1].trim(); continue; }
      if ((m = recortada.match(/^gst-launch-1\.0\s/))) { enCaps = false; continue; }
      if (/^[A-Za-z0-9_-]+\s*:/.test(recortada) || /^[A-Za-z0-9_-]+\s*=/.test(recortada)) {
        // Otra propiedad con nombre: cierra la sección de caps. Aun así,
        // un device-path suelto dentro de «properties:» ya quedó cubierto
        // por la regla anterior (device-path va ANTES de esta en el orden
        // de comprobación cuando la línea empieza por «device-path»).
        enCaps = false;
        continue;
      }
      if (enCaps && (recortada.startsWith('video/') || recortada.startsWith('image/') || recortada.includes('width='))) {
        agregarCapsDesdeTexto(disp.caps, recortada);
        continue;
      }
    }
    // Solo interesan las fuentes de vídeo; si el bloque declara otra clase
    // se conserva igual cuando no hay clase (robustez ante variantes),
    // pero las clases que no son de fuente de vídeo se descartan si vienen
    // dadas. OJO: MediaFoundation declara «Source/Video» (invertida).
    if (disp.class && disp.class !== 'Video/Source' && disp.class !== 'Source/Video') continue;
    if (!disp.name && disp.caps.length === 0 && !disp.devicePath) continue;
    disp.deviceIndex = dispositivos.length;
    dispositivos.push(disp);
  }
  return dispositivos;
}

// Elección de cámara (determinista):
//  - Con nombre pedido: entre las entradas cuyo nombre lo contiene (sin
//    distinguir mayúsculas) se prefiere la que trae devicePath — la de
//    MediaFoundation, que es la que mfvideosrc selecciona por ruta — y si
//    ninguna lo trae, la primera coincidencia. Sin coincidencias, la
//    primera enumerada (el llamador declara la sustitución).
//  - Sin nombre: (a) la primera cuyo caps elegido alcance AL MENOS
//    1920x1080 (el piso del producto), prefiriendo la de devicePath en
//    empates; (b) la primera con algún caps utilizable, con la misma
//    preferencia; (c) la primera enumerada (el llamador declara el error
//    si tampoco hay caps). Antes se devolvía dispositivos[0] a ciegas: en
//    la máquina de Luis eso es la EasyCamera KS, no su cámara de programa.
function chooseDevice(dispositivos, cameraName) {
  if (!Array.isArray(dispositivos) || dispositivos.length === 0) return null;
  if (cameraName) {
    const buscado = String(cameraName).toLowerCase();
    const coincidencias = dispositivos.filter((d) => d.name && d.name.toLowerCase().includes(buscado));
    if (coincidencias.length > 0) {
      return coincidencias.find((d) => d.devicePath) || coincidencias[0];
    }
    return dispositivos[0];
  }
  const alcanzaElPiso = (d) => {
    const c = chooseCapsForDevice(d);
    return !!c && c.width >= 1920 && c.height >= 1080;
  };
  const conPiso = dispositivos.filter(alcanzaElPiso);
  if (conPiso.length > 0) return conPiso.find((d) => d.devicePath) || conPiso[0];
  const conCaps = dispositivos.filter((d) => chooseCapsForDevice(d) !== null);
  if (conCaps.length > 0) return conCaps.find((d) => d.devicePath) || conCaps[0];
  return dispositivos[0];
}

// Elección de caps — el motor soporta CUALQUIER cámara desde el piso de
// 1080p hasta 4K (directiva de Luis, 2026-11-12): no hay techo en 1080p.
// Solo cuentan los caps video/x-raw: son los que alimentan la tubería
// (mfvideosrc → d3d11upload); un caps image/jpeg exigiría otra rama de
// decodificación y NUNCA se elige. Regla, entre los crudos:
//   1) con framerate ≈30 (29–31) y área ≤ 3840x2160 (4K): el de MAYOR
//      área; desempate por formato NV12 > YUY2 > otro;
//   2) si ninguno llega a ≈30 fps: el de mayor área ≤ 4K, mismo desempate;
//   3) si TODOS exceden 4K: el menor de ellos (nunca descartar la cámara).
// Si el elegido queda bajo 1920x1080, se usa igual y el llamador lo
// declara «por debajo del piso 1080 del producto» (la verdad declarada,
// nunca silenciosa). Sin caps crudos utilizables: null.
function chooseCapsForDevice(dispositivo) {
  const caps = Array.isArray(dispositivo) ? dispositivo : (dispositivo && dispositivo.caps);
  if (!Array.isArray(caps) || caps.length === 0) return null;
  const crudos = caps.filter((c) => c && typeof c.raw === 'string' && c.raw.startsWith('video/x-raw'));
  if (crudos.length === 0) return null;
  const AREA_4K = 3840 * 2160;
  const rangoFormato = (f) => (f === 'NV12' ? 0 : f === 'YUY2' ? 1 : 2);
  const porMayorArea = (a, b) => {
    const area = (b.width * b.height) - (a.width * a.height);
    if (area !== 0) return area;
    return rangoFormato(a.format) - rangoFormato(b.format);
  };
  const bajoTecho = crudos.filter((c) => c.width * c.height <= AREA_4K);
  if (bajoTecho.length > 0) {
    const a30 = bajoTecho.filter((c) => c.framerate != null && c.framerate >= 29 && c.framerate <= 31);
    if (a30.length > 0) return [...a30].sort(porMayorArea)[0];
    return [...bajoTecho].sort(porMayorArea)[0];
  }
  return [...crudos].sort((a, b) => {
    const area = (a.width * a.height) - (b.width * b.height);
    if (area !== 0) return area;
    return rangoFormato(a.format) - rangoFormato(b.format);
  })[0];
}
const chooseCaps = chooseCapsForDevice;

function esCapsExacto1080p30(caps) {
  return !!caps && caps.width === 1920 && caps.height === 1080 && caps.framerate != null && Math.abs(caps.framerate - 30) < 0.01;
}

// Bitrate según la resolución negociada (kbit/s): la escalera de perfiles
// del producto — 1080p → 12000, 1440p → 20000, 4K → 40000 — para que una
// cámara 4K no se codifique con el presupuesto de una 1080p.
function bitrateParaCaps(caps) {
  const area = caps && caps.width && caps.height ? caps.width * caps.height : 0;
  if (area >= 3840 * 2160) return 40000;
  if (area >= 2560 * 1440) return 20000;
  return 12000;
}

// Propiedades del codificador. ¡OJO!: la propiedad bitrate de los cuatro
// codificadores se expresa en kbit/s (12000 = 12 Mbit/s).
function encoderProps(encoder, conPreset, caps) {
  const bitrate = `bitrate=${bitrateParaCaps(caps)}`;
  if (encoder === 'nvh264enc') {
    return conPreset ? ['preset=hq', bitrate] : [bitrate];
  }
  if (encoder === 'qsvh264enc' || encoder === 'mfh264enc') return [bitrate];
  if (encoder === 'x264enc') return [bitrate, 'speed-preset=veryfast'];
  return [];
}

// Elección del codificador con una función de inspección inyectable:
// inspectFn(elemento) -> Promise<boolean> (true si gst-inspect sale con 0).
async function chooseEncoder(inspectFn) {
  if (typeof inspectFn !== 'function') return null;
  for (const elemento of ENCODER_LADDER) {
    try { if (await inspectFn(elemento)) return elemento; } catch (e) {}
  }
  return null;
}

// ----------------------------------------------------------------------------
// buildPipelineArgs(opts) PURO: devuelve el array de tokens para
// spawn(gstLaunch, tokens) SIN '-e' (el cierre elegante llega en un hito
// posterior; el MP4 fragmentado hace válido el cierre forzado, probado en
// el Hito 1). El array lleva además la propiedad usedDeviceIndexFallback
// para que el llamador pueda loguear esa rebaja declarada.
// opts: { session, deviceIndex, devicePath, caps, encoder, withPreset,
//         encoderProps, withAudio, audioSrc, outFile }
// ----------------------------------------------------------------------------
function buildPipelineArgs(opts) {
  const o = opts || {};
  const session = o.session || 'preview';
  const caps = o.caps || { width: 1920, height: 1080, framerate: 30 };
  const fps = caps.framerate != null ? Math.round(caps.framerate) : 30;
  const capsElegido = `video/x-raw,width=${caps.width},height=${caps.height},framerate=${fps}/1`;
  const conPreset = o.withPreset !== false;
  const props = Array.isArray(o.encoderProps) ? o.encoderProps : encoderProps(o.encoder, conPreset, caps);
  const outFileFwd = o.outFile ? String(o.outFile).replace(/\\/g, '/') : '';
  const audioSrc = o.audioSrc || 'wasapi2src';
  const conAudio = !!o.withAudio && session !== 'preview';

  const tokens = [];
  tokens.push('mfvideosrc');
  const usedDeviceIndexFallback = !o.devicePath;
  tokens.push(o.devicePath ? `device-path=${o.devicePath}` : `device-index=${o.deviceIndex != null ? o.deviceIndex : 0}`);
  tokens.push('!', capsElegido, '!', 'd3d11upload', '!', 'd3d11convert', '!', 'd3d11compositor', 'name=mix', 'mix.', '!', 'queue', '!', 'd3d11convert', '!', 'video/x-raw(memory:D3D11Memory),format=NV12,colorimetry=bt709', '!', 'tee', 'name=tprog');

  // Rama de vista previa: SIEMPRE (ventana nativa fuera de la app).
  tokens.push('tprog.', '!', 'queue', '!', 'd3d11videosink', 'sync=false');

  if (session === 'record') {
    tokens.push('tprog.', '!', 'queue', '!', o.encoder, ...props, '!', 'h264parse', '!', 'mp4mux', 'fragment-duration=2000', 'name=mp4', '!', 'filesink', `location=${outFileFwd}`);
    if (conAudio) {
      tokens.push(audioSrc, '!', 'audioconvert', '!', 'audioresample', '!', 'avenc_aac', '!', 'mp4.');
    }
  } else if (session === 'recordStream') {
    tokens.push('tprog.', '!', 'queue', '!', o.encoder, ...props, '!', 'h264parse', '!', 'tee', 'name=tenc',
      'tenc.', '!', 'queue', '!', 'mp4mux', 'fragment-duration=2000', 'name=mp4', '!', 'filesink', `location=${outFileFwd}`,
      'tenc.', '!', 'queue', '!', 'flvmux', 'name=flv', '!', 'rtmpsink', `location=${RTMP_PRUEBA_URL}`);
    if (conAudio) {
      tokens.push(audioSrc, '!', 'audioconvert', '!', 'audioresample', '!', 'avenc_aac', '!', 'tee', 'name=ta',
        'ta.', '!', 'queue', '!', 'mp4.', 'ta.', '!', 'queue', '!', 'flv.');
    }
  }

  tokens.usedDeviceIndexFallback = usedDeviceIndexFallback;
  return tokens;
}

// Parseo de la sonda `ffmpeg -i <archivo>` (stderr): duración y vídeo.
function parseFfmpegInfo(texto) {
  const t = String(texto || '');
  let durationSec = null;
  const mDur = t.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (mDur) durationSec = Number(mDur[1]) * 3600 + Number(mDur[2]) * 60 + Number(mDur[3]);
  let width = null; let height = null; let hayVideo = false;
  const mStream = t.match(/Stream[^\n]*Video:[^\n]*?(\d{2,5})x(\d{2,5})/);
  if (mStream) { hayVideo = true; width = Number(mStream[1]); height = Number(mStream[2]); }
  else if (/Stream[^\n]*Video:/.test(t)) hayVideo = true;
  return { durationSec, width, height, hayVideo };
}

function sleepMs(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ============================================================================
// createNativeEngine(deps) — anfitrión de sesiones del motor nativo.
// deps: { ffmpegPath, log(line), onState(state), spawnImpl?, env?,
//         platform?, fsExists? }
// ============================================================================
function createNativeEngine(deps) {
  const d = deps || {};
  const ffmpegPath = d.ffmpegPath;
  const spawnImpl = typeof d.spawnImpl === 'function' ? d.spawnImpl : require('node:child_process').spawn;
  const env = d.env || process.env;
  const platform = d.platform || process.platform;
  const fsExists = typeof d.fsExists === 'function' ? d.fsExists : (p) => fs.existsSync(p);
  const onState = typeof d.onState === 'function' ? d.onState : () => {};
  const logBase = typeof d.log === 'function' ? d.log : () => {};
  const log = (linea) => { try { logBase(`[motor-nativo] ${linea}`); } catch (e) {} };

  let state = {
    phase: 'apagado',
    session: null,
    cameraName: null,
    caps: null,
    encoder: null,
    presetUsed: null,
    outFile: null,
    streamFile: null,
    validation: null,
    streamValidation: null,
    streamBytes: 0,
    lastError: null,
    logTail: [],
    gstInstalled: null,
  };

  let gstProc = null;
  let listenerProc = null;
  let listenerExited = false;
  let streamInterval = null;
  let intentionalStop = false;
  let gstStartedAt = 0;
  let stderrAcumulado = '';
  let contexto = null; // contexto de la sesión para el reintento sin preset
  let reintentoSinPresetHecho = false;
  let gstCloseWaiters = [];

  function emitir() {
    try { onState({ ...state, logTail: [...state.logTail] }); } catch (e) {}
  }
  function fijar(parcial) {
    state = { ...state, ...parcial };
    emitir();
  }
  function agregarLogTail(linea) {
    const tail = [...state.logTail, linea];
    while (tail.length > 12) tail.shift();
    state = { ...state, logTail: tail };
  }

  function getState() {
    return { ...state, logTail: [...state.logTail] };
  }

  // Ejecuta un proceso capturando stdout/stderr con tiempo límite.
  function ejecutar(cmd, args, timeoutMs) {
    return new Promise((resolve) => {
      let proc;
      try { proc = spawnImpl(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }); }
      catch (e) { resolve({ code: -1, stdout: '', stderr: '', error: e.message }); return; }
      let stdout = ''; let stderr = ''; let cerrado = false;
      const temporizador = setTimeout(() => {
        if (cerrado) return;
        cerrado = true;
        try { proc.kill('SIGKILL'); } catch (e) {}
        resolve({ code: -1, stdout, stderr, error: `Tiempo agotado (${timeoutMs} ms).` });
      }, timeoutMs);
      if (proc.stdout) proc.stdout.on('data', (c) => { stdout += c.toString(); });
      if (proc.stderr) proc.stderr.on('data', (c) => { stderr += c.toString(); });
      proc.once('error', (e) => {
        if (cerrado) return; cerrado = true; clearTimeout(temporizador);
        resolve({ code: -1, stdout, stderr, error: e.message });
      });
      proc.once('close', (code) => {
        if (cerrado) return; cerrado = true; clearTimeout(temporizador);
        resolve({ code: code != null ? code : -1, stdout, stderr });
      });
    });
  }

  async function inspeccionarElemento(tools, elemento) {
    const r = await ejecutar(tools.inspect, [elemento], 10000);
    return r.code === 0;
  }

  function matarProceso(proc) {
    if (!proc) return;
    if (platform === 'win32' && proc.pid) {
      try { spawnImpl('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) {}
    } else {
      try { proc.kill('SIGKILL'); } catch (e) {}
    }
  }

  function esperarCierreGst(timeoutMs) {
    if (!gstProc) return Promise.resolve();
    return new Promise((resolve) => {
      const temporizador = setTimeout(() => resolve(), timeoutMs);
      gstCloseWaiters.push(() => { clearTimeout(temporizador); resolve(); });
    });
  }

  function lanzarGst(tokens) {
    stderrAcumulado = '';
    gstStartedAt = Date.now();
    const tools = contexto.tools;
    let proc;
    try {
      proc = spawnImpl(tools.launch, tokens, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      fijar({ phase: 'error', lastError: `No se pudo lanzar gst-launch-1.0: ${e.message}` });
      log(`No se pudo lanzar gst-launch-1.0: ${e.message}`);
      return false;
    }
    gstProc = proc;
    if (proc.stderr) {
      proc.stderr.on('data', (chunk) => {
        const texto = chunk.toString();
        stderrAcumulado += texto;
        let cambio = false;
        for (const cruda of texto.split(/\r?\n/)) {
          const linea = cruda.trim();
          if (!linea) continue;
          log(linea);
          agregarLogTail(linea);
          cambio = true;
        }
        if (cambio) emitir();
      });
    }
    proc.once('error', (e) => {
      if (gstProc !== proc) return;
      gstProc = null;
      const camareros = gstCloseWaiters; gstCloseWaiters = [];
      camareros.forEach((fn) => { try { fn(); } catch (err) {} });
      if (!intentionalStop) {
        fijar({ phase: 'error', lastError: `Error del proceso GStreamer: ${e.message}` });
      }
    });
    proc.once('close', (code) => {
      if (gstProc !== proc) return;
      gstProc = null;
      const camareros = gstCloseWaiters; gstCloseWaiters = [];
      camareros.forEach((fn) => { try { fn(); } catch (err) {} });
      if (intentionalStop) return;
      const transcurrido = Date.now() - gstStartedAt;
      // Reintento declarado: una sesión con nvh264enc + preset=hq que muere
      // en menos de 2500 ms nombrando al codificador en su stderr se
      // reintenta UNA vez sin preset, y la rebaja queda logueada.
      const nombraCodificador = /nvh264enc|encoder|codificador/i.test(stderrAcumulado);
      if (!reintentoSinPresetHecho && contexto && contexto.encoder === 'nvh264enc'
        && contexto.withPreset && transcurrido < 2500 && nombraCodificador
        && (contexto.session === 'record' || contexto.session === 'recordStream')) {
        reintentoSinPresetHecho = true;
        contexto.withPreset = false;
        log('El codificador nvh264enc con preset=hq murió al arrancar; reintento declarado SIN preset (presetUsed pasa a «sin preset (reintento declarado)»).');
        fijar({ presetUsed: 'sin preset (reintento declarado)' });
        const nuevosTokens = buildPipelineArgs(contextoParaBuilder());
        if (nuevosTokens.usedDeviceIndexFallback) {
          log('La cámara se selecciona por device-index (no se pudo parsear device-path del monitor).');
        }
        lanzarGst(nuevosTokens);
        return;
      }
      const ultimas = state.logTail.slice(-4).join(' | ');
      fijar({ phase: 'error', lastError: `GStreamer se cerró sin orden de parada (código ${code != null ? code : 'desconocido'}).${ultimas ? ` Últimas líneas: ${ultimas}` : ''}` });
      log(`GStreamer se cerró sin orden de parada (código ${code != null ? code : 'desconocido'}).`);
    });
    return true;
  }

  function contextoParaBuilder() {
    return {
      session: contexto.session,
      deviceIndex: contexto.device ? contexto.device.deviceIndex : 0,
      devicePath: contexto.device ? contexto.device.devicePath : null,
      caps: contexto.caps,
      encoder: contexto.encoder,
      withPreset: contexto.withPreset,
      withAudio: contexto.withAudio,
      audioSrc: 'wasapi2src',
      outFile: contexto.outFile,
    };
  }

  async function validarArchivo(file) {
    if (!file) return null;
    let bytes = 0; let existe = false;
    try { const st = fs.statSync(file); existe = true; bytes = st.size; } catch (e) {}
    if (!existe) {
      return { valid: false, durationSec: null, width: null, height: null, bytes: 0, path: file, error: 'El archivo no existe al validar.' };
    }
    const r = await ejecutar(ffmpegPath, ['-hide_banner', '-i', file], 30000);
    const info = parseFfmpegInfo(r.stderr || '');
    const valid = bytes > 0 && info.durationSec != null && info.durationSec > 0 && info.hayVideo;
    return {
      valid,
      durationSec: info.durationSec,
      width: info.width,
      height: info.height,
      bytes,
      path: file,
      ...(valid ? {} : { error: 'La sonda no confirmó duración y pista de vídeo válidas.' }),
    };
  }

  // start(session, opts) o start({ session, cameraName, outDir }).
  async function start(arg1, arg2) {
    let session; let opts;
    if (typeof arg1 === 'string') { session = arg1; opts = arg2 || {}; }
    else { opts = arg1 || {}; session = opts.session; }
    const cameraName = opts.cameraName || null;
    const outDir = opts.outDir || path.join(os.tmpdir(), 'podcastudio-motor-nativo');

    if (!['preview', 'record', 'recordStream'].includes(session)) {
      return { success: false, error: `Sesión no válida: ${session || '(vacía)'}.` };
    }
    if (gstProc || ['encendiendo', 'vista-previa', 'grabando', 'grabando-transmitiendo', 'validando'].includes(state.phase)) {
      return { success: false, error: 'Ya hay una sesión del motor nativo en curso.' };
    }

    intentionalStop = false;
    reintentoSinPresetHecho = false;
    fijar({
      phase: 'encendiendo', session, cameraName, caps: null, encoder: null,
      presetUsed: null, outFile: null, streamFile: null, validation: null,
      streamValidation: null, streamBytes: 0, lastError: null, logTail: [],
    });

    // 1) Herramientas.
    const tools = locateGstTools({ env, platform, fsExists, log });
    if (!tools) {
      fijar({ phase: 'error', gstInstalled: false, lastError: 'GStreamer no instalado: no se encontró gst-launch-1.0, gst-inspect-1.0 y gst-device-monitor-1.0.' });
      return { success: false, error: 'GStreamer no instalado: no se encontró gst-launch-1.0, gst-inspect-1.0 y gst-device-monitor-1.0.' };
    }
    fijar({ gstInstalled: true });
    log(`Herramientas GStreamer: ${tools.launch}`);

    // 2) Enumeración de cámaras (tiempo límite 15 s).
    const rMon = await ejecutar(tools.monitor, ['Video/Source'], 15000);
    if (rMon.error && !rMon.stdout) {
      fijar({ phase: 'error', lastError: `gst-device-monitor-1.0 falló: ${rMon.error}` });
      return { success: false, error: `gst-device-monitor-1.0 falló: ${rMon.error}` };
    }
    const dispositivos = parseDeviceMonitorOutput(rMon.stdout || '');
    if (dispositivos.length === 0) {
      fijar({ phase: 'error', lastError: 'gst-device-monitor-1.0 no encontró ninguna cámara Video/Source.' });
      log('gst-device-monitor-1.0 no encontró ninguna cámara Video/Source.');
      return { success: false, error: 'gst-device-monitor-1.0 no encontró ninguna cámara Video/Source.' };
    }
    const device = chooseDevice(dispositivos, cameraName);
    if (cameraName && device && device.name && !device.name.toLowerCase().includes(String(cameraName).toLowerCase())) {
      log(`No se encontró la cámara pedida «${cameraName}»; se usa la primera enumerada: «${device.name}» (declarado).`);
    }
    const caps = chooseCapsForDevice(device);
    if (!caps) {
      fijar({ phase: 'error', lastError: `La cámara «${device.name || ''}» no declaró ningún caps usable.` });
      return { success: false, error: `La cámara «${device.name || ''}» no declaró ningún caps usable.` };
    }
    const bajoElPiso = caps.width < 1920 || caps.height < 1080;
    log(`Cámara «${device.name || ''}»: formato negociado ${caps.width}x${caps.height} a ${caps.framerate != null ? caps.framerate : '?'} fps (${caps.format || 'formato sin declarar'})${bajoElPiso ? ' — por debajo del piso 1080 del producto (declarado)' : ''}.`);
    if (!device.devicePath) {
      log('La cámara se selecciona por device-index (no se pudo parsear device-path del monitor).');
    }

    // 3) Codificador (la vista previa también lo declara en el panel).
    const inspectFn = (el) => inspeccionarElemento(tools, el);
    const encoder = await chooseEncoder(inspectFn);
    if (!encoder && session !== 'preview') {
      fijar({ phase: 'error', lastError: 'No hay codificador H.264 disponible (nvh264enc/qsvh264enc/mfh264enc/x264enc).' });
      log('No hay codificador H.264 disponible (escalera completa agotada).');
      return { success: false, error: 'No hay codificador H.264 disponible (nvh264enc/qsvh264enc/mfh264enc/x264enc).' };
    }
    const withPreset = encoder === 'nvh264enc';
    const presetUsed = encoder === 'nvh264enc' ? 'hq' : null;
    if (encoder) log(`Codificador elegido: ${encoder}${withPreset ? ' con preset=hq' : ''} (bitrate=${bitrateParaCaps(caps)} kbit/s).`);

    // 4) Audio: se inspecciona antes de construir; si falta algo, la
    // sesión va SIN rama de audio y queda declarado.
    let withAudio = false;
    if (session !== 'preview') {
      const hayFuente = await inspeccionarElemento(tools, 'wasapi2src');
      if (!hayFuente) {
        log('Sin audio: falta wasapi2src. La sesión graba solo vídeo (declarado).');
      } else {
        const hayAac = await inspeccionarElemento(tools, 'avenc_aac');
        if (!hayAac) log('Sin audio: falta avenc_aac. La sesión graba solo vídeo (declarado).');
        else withAudio = true;
      }
    }

    // 5) Carpeta y nombres de archivo.
    try { fs.mkdirSync(outDir, { recursive: true }); } catch (e) {}
    const nombre = `PodcastStudio_motor_${marcaDeTiempoLocal(new Date())}.mp4`;
    const outFile = session === 'preview' ? null : path.join(outDir, nombre);
    const streamFile = session === 'recordStream' ? path.join(outDir, 'motor-stream-recibido.flv') : null;

    contexto = {
      tools, session, device, caps, encoder, withPreset, withAudio, outFile, streamFile,
    };

    // 6) Oyente RTMP local (recordStream): ANTES de lanzar GStreamer.
    if (session === 'recordStream') {
      if (streamFile) { try { if (fs.existsSync(streamFile)) fs.unlinkSync(streamFile); } catch (e) {} }
      listenerExited = false;
      try {
        listenerProc = spawnImpl(ffmpegPath, ['-listen', '1', '-i', RTMP_PRUEBA_URL, '-c', 'copy', streamFile], { stdio: ['ignore', 'ignore', 'ignore'] });
        listenerProc.once('close', () => { listenerExited = true; });
        listenerProc.once('error', () => { listenerExited = true; });
        log(`Oyente local del stream en ${RTMP_PRUEBA_URL} → ${streamFile}`);
      } catch (e) {
        listenerProc = null; listenerExited = true;
        log(`No se pudo lanzar el oyente local del stream: ${e.message}`);
      }
      streamInterval = setInterval(() => {
        let bytes = 0;
        try { if (streamFile && fs.existsSync(streamFile)) bytes = fs.statSync(streamFile).size; } catch (e) {}
        if (bytes !== state.streamBytes) fijar({ streamBytes: bytes });
      }, 1000);
    }

    fijar({
      cameraName: device.name || cameraName,
      caps: { raw: caps.raw, format: caps.format, width: caps.width, height: caps.height, framerate: caps.framerate },
      encoder, presetUsed, outFile, streamFile,
    });

    // 7) Lanzamiento de la tubería.
    const tokens = buildPipelineArgs(contextoParaBuilder());
    if (tokens.usedDeviceIndexFallback) {
      log('Construcción de la sesión: selector por device-index (respaldo declarado).');
    }
    log(`Tubería: ${tokens.join(' ')}`);
    const lanzado = lanzarGst(tokens);
    if (!lanzado) return { success: false, error: state.lastError || 'No se pudo lanzar GStreamer.' };

    fijar({ phase: session === 'preview' ? 'vista-previa' : session === 'record' ? 'grabando' : 'grabando-transmitiendo' });
    return { success: true };
  }

  async function stop() {
    intentionalStop = true;
    if (streamInterval) { clearInterval(streamInterval); streamInterval = null; }
    const sesionPrevia = state.session;
    const eraGrabacion = sesionPrevia === 'record' || sesionPrevia === 'recordStream';

    if (gstProc) {
      const proc = gstProc;
      matarProceso(proc);
      await esperarCierreGst(5000);
      if (gstProc === proc) {
        // No cerró ni matándolo: se suelta la referencia (declarado).
        gstProc = null;
        log('GStreamer no confirmó su cierre en 5 s tras la orden de parada; se suelta su referencia (declarado).');
      }
    }

    // Oyente: espera su salida hasta 15 s (sondeo de 250 ms); si no, se mata.
    if (listenerProc && !listenerExited) {
      const inicio = Date.now();
      while (!listenerExited && Date.now() - inicio < 15000) await sleepMs(250);
      if (!listenerExited) {
        log('El oyente local del stream no cerró en 15 s: se le termina el proceso (limpieza declarada).');
        matarProceso(listenerProc);
        const inicio2 = Date.now();
        while (!listenerExited && Date.now() - inicio2 < 3000) await sleepMs(100);
      }
    }
    listenerProc = null;

    if (eraGrabacion && (state.outFile || state.streamFile)) {
      fijar({ phase: 'validando' });
      // Última lectura de bytes del stream antes de validar.
      if (state.streamFile) {
        try { if (fs.existsSync(state.streamFile)) fijar({ streamBytes: fs.statSync(state.streamFile).size }); } catch (e) {}
      }
      const validation = state.outFile ? await validarArchivo(state.outFile) : null;
      const streamValidation = state.streamFile ? await validarArchivo(state.streamFile) : null;
      if (validation) log(`Validación de la grabación: ${validation.valid ? 'VÁLIDA' : 'NO válida'} (${validation.durationSec != null ? validation.durationSec : '?'} s, ${validation.width || '?'}x${validation.height || '?'}, ${validation.bytes} bytes).`);
      if (streamValidation) log(`Validación del stream local: ${streamValidation.valid ? 'VÁLIDA' : 'NO válida'} (${streamValidation.durationSec != null ? streamValidation.durationSec : '?'} s, ${streamValidation.bytes} bytes).`);
      fijar({ phase: 'apagado', validation, streamValidation });
    } else {
      fijar({ phase: 'apagado' });
    }
    contexto = null;
    return { success: true };
  }

  return { start, stop, getState };
}

module.exports = {
  createNativeEngine,
  parseDeviceMonitorOutput,
  chooseCapsForDevice,
  chooseCaps,
  chooseDevice,
  buildPipelineArgs,
  locateGstTools,
  parseFfmpegInfo,
  encoderProps,
  bitrateParaCaps,
  chooseEncoder,
  ENCODER_LADDER,
  RTMP_PRUEBA_URL,
};
