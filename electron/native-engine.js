'use strict';
// ============================================================================
// Motor Nativo hospedado — Hito 2 (v3.1.0); Hito 3 (v3.2.0): los botones
// reales de la app gobiernan el motor.
//
// La app gobierna una tubería de GStreamer FUERA de la ventana: captura
// (mfvideosrc) → conversión/composición D3D11 → tee de programa →
// rama de sesión a fakesink (v3.3.6: la sesión NO abre ventana; la
// vista previa nativa con d3d11videosink vive SOLO fuera de sesión,
// en buildPreviewArgs) y, según la sesión, codificación
// H.264 por hardware → MP4 fragmentado y/o FLV hacia los destinos RTMP
// REALES guardados (sesiones 'stream'/'recordStream' con streamUrls) o
// hacia el RTMP LOCAL de prueba (recordStream sin destinos: el botón de
// prueba del panel). Electron solo arranca, observa y detiene esa
// tubería; ningún fotograma pasa por el canvas ni por el proceso de la
// ventana.
//
// Este módulo NO importa Electron: todas sus dependencias llegan por
// inyección (createNativeEngine(deps)), igual que electron/program-core.js,
// para poder probarlo en Node puro con stubs.
// ============================================================================

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Destino LOCAL de prueba de la sesión 'recordStream' SIN destinos
// reales (el botón «Grabar + Transmitir (prueba local)» del panel). Con
// streamUrls, recordStream transmite a los destinos reales y esta
// constante no se usa.
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
// v3.2.3 — deviceIndex: para las fuentes de VÍDEO MediaFoundation es su
// posición (0-based) entre las entradas de SU clase («Source/Video»), en
// el orden en que el monitor las imprime: ese es el índice que entiende
// la propiedad device-index de mfvideosrc (la forma probada del Hito 1 B).
// Antes era la posición global entre TODAS las entradas aceptadas (KS y
// MF mezcladas), que NO coincide con la enumeración de MediaFoundation.
// Las entradas que no son MF de vídeo llevan deviceIndex null.
// ----------------------------------------------------------------------------
function parseDeviceMonitorOutput(texto, opciones) {
  // Hito 3: con { audio: true } el parser acepta las fuentes de AUDIO
  // (clases «Audio/Source»/«Source/Audio») para la regla de coincidencia
  // del micrófono; sin la opción conserva el comportamiento del Hito 2
  // (solo vídeo) y descarta cualquier bloque de audio.
  const esAudio = !!(opciones && opciones.audio);
  const dispositivos = [];
  let indiceMF = 0;
  const bloques = String(texto || '').split(/Device found:/);
  // El primer trozo es lo anterior al primer «Device found:»: se descarta.
  for (let i = 1; i < bloques.length; i += 1) {
    const lineas = bloques[i].split(/\r?\n/);
    const disp = { name: null, class: null, caps: [], devicePath: null, deviceId: null, api: null, deviceIndex: null };
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
      if ((m = recortada.match(/^device\.id\s*=\s*(.+)$/))) { disp.deviceId = m[1].trim(); continue; }
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
      if (enCaps && (recortada.startsWith('video/') || recortada.startsWith('image/') || recortada.includes('width=') || (esAudio && recortada.startsWith('audio/')))) {
        agregarCapsDesdeTexto(disp.caps, recortada);
        continue;
      }
    }
    // Solo interesan las fuentes del tipo pedido (vídeo por defecto, o
    // audio con { audio: true }); si el bloque declara otra clase se
    // conserva igual cuando no hay clase (robustez ante variantes),
    // pero las clases que no son del tipo pedido se descartan si vienen
    // dadas. OJO: MediaFoundation declara «Source/Video» (invertida) y
    // WASAPI2 puede declarar «Source/Audio».
    const clasesAceptadas = esAudio ? ['Audio/Source', 'Source/Audio'] : ['Video/Source', 'Source/Video'];
    if (disp.class && !clasesAceptadas.includes(disp.class)) continue;
    if (!disp.name && disp.caps.length === 0 && !disp.devicePath) continue;
    // v3.2.3: el índice MF solo lo consumen las entradas aceptadas de la
    // clase «Source/Video», en el orden en que el monitor las imprime.
    if (!esAudio && disp.class === 'Source/Video') {
      disp.deviceIndex = indiceMF;
      indiceMF += 1;
    }
    dispositivos.push(disp);
  }
  return dispositivos;
}

// v3.3.1 (defecto 3) — normalización de nombres para el emparejamiento
// contra la enumeración. La app (Chromium) etiqueta las cámaras como
// «EasyCamera (04f2:b57e)» — nombre + sufijo VID:PID entre paréntesis —
// mientras el monitor de Media Foundation las enumera como «EasyCamera»
// a secas: con el includes de siempre, el nombre pedido (más largo) no
// estaba contenido en el enumerado y NO emparejaba nunca («No se
// encontró la cámara de programa»). La normalización quita el sufijo
// «(xxxx:xxxx)», unifica espacios y pasa a minúsculas; dos nombres
// emparejan si, ya normalizados, son iguales o uno contiene al otro.
function normalizarNombreCamara(nombre) {
  return String(nombre || '')
    .replace(/\(\s*[0-9a-fA-F]{4}:[0-9a-fA-F]{4}\s*\)/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function nombresCamaraCoinciden(pedido, enumerado) {
  const a = normalizarNombreCamara(pedido);
  const b = normalizarNombreCamara(enumerado);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

// Elección de cámara (determinista):
//  - Con nombre pedido: entre las entradas que emparejan tras la
//    normalización v3.3.1 (nombresCamaraCoinciden: sin sufijo VID:PID)
//    se prefiere la que trae devicePath — la de MediaFoundation, que
//    es la que mfvideosrc selecciona por ruta — y si ninguna lo trae,
//    la primera coincidencia. Sin coincidencias devuelve la primera
//    enumerada SOLO como valor de respaldo: desde la v3.3.1 el
//    llamador (start) comprueba el emparejamiento y, si el nombre
//    pedido no emparejó, se NIEGA a arrancar (PROGRAMA_NO_DISPONIBLE)
//    en vez de usar el respaldo — la sustitución silenciosa murió.
//  - Sin nombre: (a) la primera cuyo caps elegido alcance AL MENOS
//    1920x1080 (el piso del producto), prefiriendo la de devicePath en
//    empates; (b) la primera con algún caps utilizable, con la misma
//    preferencia; (c) la primera enumerada (el llamador declara el error
//    si tampoco hay caps). Antes se devolvía dispositivos[0] a ciegas: en
//    la máquina de Luis eso es la EasyCamera KS, no su cámara de programa.
function chooseDevice(dispositivos, cameraName) {
  if (!Array.isArray(dispositivos) || dispositivos.length === 0) return null;
  if (cameraName) {
    const coincidencias = dispositivos.filter((d) => d.name && nombresCamaraCoinciden(cameraName, d.name));
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
// Tope de transmisión (Hito 3): los destinos RTMP reciben COMO MÁXIMO
// 1920×1080. capsParaStream reduce cualquier formato mayor a exactamente
// 1920×1080 conservando fps y formato; un formato ≤1080p pasa intacto.
// Devuelve un objeto de caps nuevo (no muta el recibido).
// ----------------------------------------------------------------------------
function capsParaStream(caps) {
  if (!caps || typeof caps.width !== 'number' || typeof caps.height !== 'number') return caps;
  if (caps.width <= 1920 && caps.height <= 1080) return { ...caps };
  return { ...caps, width: 1920, height: 1080 };
}

// ----------------------------------------------------------------------------
// Regla de audio (Hito 3): el micrófono debe ser EL DE LA CÁMARA elegida
// (p. ej. «Micrófono (Steren COM-126)» para la cámara «Steren COM-126»),
// nunca el dispositivo por defecto de Windows EN SILENCIO.
//
// chooseAudioDevice(dispositivosAudio, nombreCamara) devuelve
// { matched: boolean, device } con el primer dispositivo de audio cuyo
// nombre CONTIENE el nombre de la cámara (sin distinción de mayúsculas),
// o { matched: false, device: null } si no hay coincidencia.
// ----------------------------------------------------------------------------
function chooseAudioDevice(dispositivosAudio, nombreCamara) {
  const lista = Array.isArray(dispositivosAudio) ? dispositivosAudio : [];
  const aguja = String(nombreCamara || '').trim().toLowerCase();
  if (!aguja) return { matched: false, device: null };
  const encontrado = lista.find((d) => d && d.name && d.name.toLowerCase().includes(aguja));
  return encontrado ? { matched: true, device: encontrado } : { matched: false, device: null };
}

// ----------------------------------------------------------------------------
// Direccionamiento de UNA fuente mfvideosrc (v3.3.0): lógica ÚNICA para el
// constructor de la sesión, el constructor multicámara y la vista previa
// independiente. La forma PRINCIPAL es device-index (la posición del
// dispositivo en la enumeración MediaFoundation: la que la Prueba B del
// Hito 1 usó para abrir la Steren). device-path queda SOLO como respaldo
// cuando el dispositivo no trae índice MF válido, o cuando el anfitrión
// fuerza el modo (opts.addressingMode) en su reintento declarado — y ese
// modo forzado se aplica a TODAS las fuentes de la sesión.
// ----------------------------------------------------------------------------
function resolverDireccionFuente(deviceIndex, devicePath, modoForzado) {
  const indiceValido = Number.isInteger(deviceIndex) && deviceIndex >= 0;
  let addressingMode;
  if (modoForzado === 'device-path' && devicePath) addressingMode = 'device-path';
  else if (modoForzado === 'device-index' && indiceValido) addressingMode = 'device-index';
  else if (indiceValido) addressingMode = 'device-index';
  else if (devicePath) addressingMode = 'device-path';
  else addressingMode = 'device-index'; // sin índice ni ruta: el 0 por defecto del Hito 1
  return {
    addressingMode,
    indiceValido,
    // usedDeviceIndexFallback (nombre heredado): true cuando el
    // lanzamiento NO usa el índice MF parseado del dispositivo elegido.
    usedDeviceIndexFallback: !(indiceValido && addressingMode === 'device-index'),
    token: addressingMode === 'device-path'
      ? `device-path=${devicePath}`
      : `device-index=${indiceValido ? deviceIndex : 0}`,
  };
}

function textoCaps(caps) {
  const c = caps || { width: 1920, height: 1080, framerate: 30 };
  const fps = c.framerate != null ? Math.round(c.framerate) : 30;
  return `video/x-raw,width=${c.width},height=${c.height},framerate=${fps}/1`;
}

// ----------------------------------------------------------------------------
// buildPreviewArgs(opts) PURO (v3.3.0, pata B): tokens de la VISTA PREVIA
// INDEPENDIENTE — un gst-launch aparte que abre la MISMA cámara de
// programa cuando NO hay sesión de grabación/transmisión: es la vista
// previa FUERA de sesión (si puede vivir lo decide la sonda del
// anfitrión, no esta función). Nunca se lanza en paralelo a una sesión:
// la compuerta del 2026-11-13 demostró que el driver Media Foundation
// no sirve a dos lectores de la misma cámara.
//   Sin texto: la forma probada (mfvideosrc → caps → d3d11upload →
//   d3d11convert → d3d11videosink sync=false).
//   Con texto (teleprompter, pata C): cadena de MEMORIA DE SISTEMA
//   (mfvideosrc → caps → videoconvert → textoverlay → d3d11videosink
//   sync=false); textoverlay centrado arriba, «Sans Bold 44», SIN fondo
//   sombreado (regla de Luis: solo el texto limpio sobre la imagen; el
//   shaded-background de textoverlay es false por defecto y aquí se
//   declara explícito para que nadie lo encienda en silencio).
// ----------------------------------------------------------------------------
function buildPreviewArgs(opts) {
  const o = opts || {};
  const caps = o.caps || { width: 1920, height: 1080, framerate: 30 };
  const direccion = resolverDireccionFuente(o.deviceIndex, o.devicePath, o.addressingMode);
  const capsTexto = textoCaps(caps);
  const texto = typeof o.texto === 'string' && o.texto ? o.texto : null;
  let tokens;
  if (!texto) {
    tokens = ['mfvideosrc', direccion.token, '!', capsTexto, '!', 'd3d11upload', '!', 'd3d11convert', '!', 'd3d11videosink', 'sync=false'];
  } else {
    tokens = ['mfvideosrc', direccion.token, '!', capsTexto, '!', 'videoconvert', '!', 'textoverlay', `text=${texto}`, 'halignment=center', 'valignment=top', 'font-desc=Sans Bold 44', 'shaded-background=false', '!', 'd3d11videosink', 'sync=false'];
  }
  tokens.addressingMode = direccion.addressingMode;
  tokens.usedDeviceIndexFallback = direccion.usedDeviceIndexFallback;
  return tokens;
}

// ----------------------------------------------------------------------------
// buildPipelineArgs(opts) PURO: devuelve el array de tokens para
// spawn(gstLaunch, tokens) SIN '-e' (el cierre elegante llega en un hito
// posterior; el MP4 fragmentado hace válido el cierre forzado, probado en
// el Hito 1). El array lleva además las propiedades addressingMode
// ('device-index' | 'device-path': el modo con que se abre la cámara) y
// usedDeviceIndexFallback para que el llamador pueda loguear la verdad.
// opts: { session, deviceIndex, devicePath, addressingMode, caps,
//         encoder, withPreset, encoderProps, withAudio, audioSrc,
//         audioDevice, outFile, streamUrls } — streamUrls: destinos
//         RTMP reales (Hito 3); audioDevice: identificador WASAPI para
//         wasapi2src device=…; addressingMode: fuerza el modo de
//         apertura (lo usa el reintento declarado del anfitrión, v3.2.3).
// ----------------------------------------------------------------------------
function buildPipelineArgs(opts) {
  const o = opts || {};
  const session = o.session || 'preview';
  // v3.3.0 — MULTICÁMARA: con opts.sources (array de {deviceIndex,
  // devicePath, caps}) el lienzo, el codificador, el bitrate y el tope
  // de stream se derivan de los caps de la fuente de PROGRAMA
  // (sources[programIndex], defecto 0), como hoy del caps único. Sin
  // sources, la lista se deriva de los opts actuales y la salida es
  // IDÉNTICA a la histórica (compatibilidad total: la suite vigente no
  // pasa sources y sus expectativas no cambian).
  const fuentes = Array.isArray(o.sources) && o.sources.length > 0 ? o.sources : null;
  const programIndex = fuentes
    ? (Number.isInteger(o.programIndex) && o.programIndex >= 0 && o.programIndex < fuentes.length ? o.programIndex : 0)
    : 0;
  const fuentePrograma = fuentes ? (fuentes[programIndex] || {}) : null;
  const caps = (fuentePrograma && fuentePrograma.caps) || o.caps || { width: 1920, height: 1080, framerate: 30 };
  const fps = caps.framerate != null ? Math.round(caps.framerate) : 30;
  const capsElegido = `video/x-raw,width=${caps.width},height=${caps.height},framerate=${fps}/1`;
  const conPreset = o.withPreset !== false;
  const props = Array.isArray(o.encoderProps) ? o.encoderProps : encoderProps(o.encoder, conPreset, caps);
  const outFileFwd = o.outFile ? String(o.outFile).replace(/\\/g, '/') : '';
  const audioSrc = o.audioSrc || 'wasapi2src';
  const conAudio = !!o.withAudio && session !== 'preview';
  // Hito 3 — destinos reales de transmisión: URLs completas ya
  // compuestas (servidor+clave una sola vez, en la app). Cada una es UN
  // token argv (spawn por array, sin shell) en su rtmpsink.
  const streamUrls = Array.isArray(o.streamUrls) ? o.streamUrls.filter((u) => typeof u === 'string' && u.trim()) : [];
  // Hito 3 — tope 1080 para los destinos: si el formato negociado
  // supera 1920×1080, el stream baja a 1080p con su propio
  // codificador (bitrate del peldaño 1080 de la escalera: 12000).
  const necesitaEscalaStream = caps.width > 1920 || caps.height > 1080;
  const capsStream = capsParaStream(caps);
  const propsStream = Array.isArray(o.encoderProps) ? o.encoderProps : encoderProps(o.encoder, conPreset, capsStream);
  // v3.2.1: caps de MEMORIA DE SISTEMA (sin memory:D3D11Memory) para la
  // rama con escala: la bajada va por d3d11download→videoscale→
  // videoconvert y el caps plano NV12 es el que todo codificador
  // acepta. El caps D3D11 forzado anterior compartía el riesgo que
  // mató el enlace del codificador principal en la v3.2.0.
  const capsStreamTexto = `video/x-raw,format=NV12,width=${capsStream.width},height=${capsStream.height},framerate=${fps}/1`;
  // Fuente de audio: con el dispositivo WASAPI elegido por coincidencia
  // (regla de audio del Hito 3), el token device=<id> va tras el nombre.
  const fuenteAudio = o.audioDevice ? [audioSrc, `device=${o.audioDevice}`] : [audioSrc];

  const tokens = [];
  tokens.push('mfvideosrc');
  // v3.2.3 — direccionamiento de la cámara (lógica única en
  // resolverDireccionFuente): la forma PRINCIPAL es device-index (la
  // posición del dispositivo en la enumeración MediaFoundation): es la
  // que la Prueba B del Hito 1 usó para abrir la Steren y
  // grabar/transmitir válido. La apertura por device-path NUNCA se
  // probó en vivo y murió en las dos corridas de la compuerta smoke de
  // la v3.2.2 con «Couldn't create capture object»
  // (gst_mf_video_src_start): device-path queda SOLO como respaldo
  // cuando el dispositivo no trae índice MF válido, o cuando el
  // anfitrión lo fuerza (opts.addressingMode) en su reintento declarado.
  // v3.3.0: en multicámara el direccionamiento de la PRIMERA cadena es
  // el de la fuente de programa, y el modo forzado vigente se aplica a
  // TODAS las fuentes (cada PiP resuelve el suyo con la misma regla).
  const direccionPrograma = resolverDireccionFuente(
    fuentePrograma ? fuentePrograma.deviceIndex : o.deviceIndex,
    fuentePrograma ? fuentePrograma.devicePath : o.devicePath,
    o.addressingMode,
  );
  const addressingMode = direccionPrograma.addressingMode;
  const usedDeviceIndexFallback = direccionPrograma.usedDeviceIndexFallback;
  tokens.push(direccionPrograma.token);
  // v3.2.1 — forma PROBADA del Hito 1 B: del compositor al tee de
  // programa SOLO hay una queue. El d3d11convert + caps forzado
  // (memory:D3D11Memory, NV12, colorimetry=bt709) que el Hito 2 metió
  // en este tramo NUNCA corrió en vivo y rompía el enlace
  // queue→codificador («could not link queue2 to nvh264enc0», fallo en
  // vivo de la v3.2.0): fuera. El codificador se alimenta del tee con
  // los caps que el propio compositor negocia, como en la tubería que
  // grabó y transmitió de verdad.
  tokens.push('!', capsElegido, '!', 'd3d11upload', '!', 'd3d11convert', '!', 'd3d11compositor', 'name=mix');
  // v3.3.0 — LAYOUT ESTÁTICO multicámara (solo con sources explícitas;
  // sin sources no se emite NINGÚN token nuevo y la tubería es la de
  // siempre): lienzo = caps de programa. Orden de pads: la fuente de
  // programa PRIMERO (sink_0, pantalla completa) y las PiP después, en
  // el orden de la lista, como sink_1, sink_2, … Las propiedades de
  // cada pad van como tokens sink_N::prop=valor TRAS el token del
  // compositor (la sintaxis de gst-launch para propiedades de pad).
  // Cada PiP: ancho = round(W*0.25), alto según SU relación de aspecto,
  // margen = round(W*0.02), esquina inferior derecha apiladas hacia
  // arriba (el ypos se acumula desde abajo: margen + altos + márgenes).
  let ordenPads = null;
  if (fuentes) {
    ordenPads = [{ indiceFuente: programIndex, pad: 0 }];
    fuentes.forEach((f, i) => { if (i !== programIndex) ordenPads.push({ indiceFuente: i, pad: ordenPads.length }); });
    const W = caps.width; const H = caps.height;
    const margen = Math.round(W * 0.02);
    let acumuladoDesdeAbajo = margen;
    for (const entrada of ordenPads) {
      const sufijo = `sink_${entrada.pad}::`;
      if (entrada.pad === 0) {
        tokens.push(`${sufijo}xpos=0`, `${sufijo}ypos=0`, `${sufijo}width=${W}`, `${sufijo}height=${H}`);
      } else {
        const capsPip = fuentes[entrada.indiceFuente].caps || caps;
        const anchoPip = Math.round(W * 0.25);
        const altoPip = capsPip.width > 0 && capsPip.height > 0
          ? Math.round(anchoPip * capsPip.height / capsPip.width)
          : Math.round(anchoPip * H / W);
        const xposPip = W - anchoPip - margen;
        const yposPip = H - acumuladoDesdeAbajo - altoPip;
        acumuladoDesdeAbajo += altoPip + margen;
        tokens.push(`${sufijo}xpos=${xposPip}`, `${sufijo}ypos=${yposPip}`, `${sufijo}width=${anchoPip}`, `${sufijo}height=${altoPip}`);
      }
    }
  }
  tokens.push('mix.', '!', 'queue', '!', 'tee', 'name=tprog');

  // v3.3.0 — cadenas de las fuentes PiP: cada una captura, sube a D3D11,
  // convierte y enlaza con el compositor vía «mix.» (cada enlace pide el
  // siguiente pad libre EN ORDEN: programa primero = sink_0, luego las
  // PiP en el orden de ordenPads = los sink_N de las props de arriba).
  if (fuentes && ordenPads) {
    for (const entrada of ordenPads.slice(1)) {
      const f = fuentes[entrada.indiceFuente] || {};
      const direccionPip = resolverDireccionFuente(f.deviceIndex, f.devicePath, o.addressingMode);
      tokens.push('mfvideosrc', direccionPip.token, '!', textoCaps(f.caps || caps), '!', 'd3d11upload', '!', 'd3d11convert', '!', 'mix.');
    }
  }

  // Rama de programa de la sesión: SIEMPRE presente, pero desde la
  // v3.3.6 termina en fakesink — la sesión NO abre ninguna ventana.
  // Hasta la v3.3.5 esta rama era un d3d11videosink (ventana nativa
  // fuera de la app: la vista previa DURANTE la sesión) y esa ventana
  // era un punto de muerte de la sesión entera: en la transmisión
  // real a Facebook del 2026-11-13 se cerró a los ~14 s, el sink
  // erroró («Output window was closed») y la tubería completa murió
  // con él (el rtmpsink a Facebook NO erroró). Sin ventana no hay
  // nada que cerrar: el monitor durante la sesión es la foto fija
  // que la app ya muestra en los mosaicos, y la vista previa nativa
  // con d3d11videosink queda SOLO fuera de sesión (buildPreviewArgs).
  // El constructor conserva la opción omitPreviewBranch (probada
  // como función pura), pero el anfitrión ya NO la usa desde la
  // corrección tras la compuerta del 2026-11-13: ninguna sesión nace
  // sin su rama integrada, porque el proceso de vista previa
  // independiente nunca convive con una sesión (dos lectores MF
  // mataban la grabación).
  if (!o.omitPreviewBranch) {
    tokens.push('tprog.', '!', 'queue', '!', 'fakesink', 'sync=false');
  }

  if (session === 'record') {
    tokens.push('tprog.', '!', 'queue', '!', o.encoder, ...props, '!', 'h264parse', '!', 'mp4mux', 'fragment-duration=2000', 'name=mp4', '!', 'filesink', `location=${outFileFwd}`);
    if (conAudio) {
      tokens.push(...fuenteAudio, '!', 'audioconvert', '!', 'audioresample', '!', 'avenc_aac', '!', 'mp4.');
    }
  } else if (session === 'recordStream' || session === 'stream') {
    const graba = session === 'recordStream';
    // Ramas FLV: una por destino real (flv0, flv1, …). Sin destinos,
    // recordStream conserva la rama ÚNICA a la prueba local (flv), como
    // en el Hito 2; 'stream' sin destinos no llega aquí (start lo
    // declara error antes de construir la tubería).
    const ramasFlv = [];
    if (streamUrls.length > 0) {
      streamUrls.forEach((url, i) => ramasFlv.push({ nombre: `flv${i}`, url }));
    } else if (graba) {
      ramasFlv.push({ nombre: 'flv', url: RTMP_PRUEBA_URL });
    }
    if (!necesitaEscalaStream) {
      // Formato ≤1080p: UN solo codificador y el tee tras h264parse
      // reparte el mismo H.264 a la grabación y a cada destino (la
      // forma probada en el Hito 1 B).
      tokens.push('tprog.', '!', 'queue', '!', o.encoder, ...props, '!', 'h264parse', '!', 'tee', 'name=tenc');
      if (graba) tokens.push('tenc.', '!', 'queue', '!', 'mp4mux', 'fragment-duration=2000', 'name=mp4', '!', 'filesink', `location=${outFileFwd}`);
      for (const rama of ramasFlv) {
        tokens.push('tenc.', '!', 'queue', '!', 'flvmux', `name=${rama.nombre}`, '!', 'rtmpsink', `location=${rama.url}`);
      }
    } else {
      // Formato >1080p: la grabación conserva la resolución completa
      // con su codificador; el stream nace de tprog, baja a 1080p por
      // memoria de sistema (d3d11download→videoscale→videoconvert,
      // v3.2.1) y tiene su PROPIO codificador al bitrate de 1080p.
      if (graba) tokens.push('tprog.', '!', 'queue', '!', o.encoder, ...props, '!', 'h264parse', '!', 'mp4mux', 'fragment-duration=2000', 'name=mp4', '!', 'filesink', `location=${outFileFwd}`);
      tokens.push('tprog.', '!', 'queue', '!', 'd3d11download', '!', 'videoscale', '!', 'videoconvert', '!', capsStreamTexto, '!', o.encoder, ...propsStream, '!', 'h264parse', '!', 'tee', 'name=tenc');
      for (const rama of ramasFlv) {
        tokens.push('tenc.', '!', 'queue', '!', 'flvmux', `name=${rama.nombre}`, '!', 'rtmpsink', `location=${rama.url}`);
      }
    }
    if (conAudio) {
      tokens.push(...fuenteAudio, '!', 'audioconvert', '!', 'audioresample', '!', 'avenc_aac', '!', 'tee', 'name=ta');
      if (graba) tokens.push('ta.', '!', 'queue', '!', 'mp4.');
      for (const rama of ramasFlv) {
        tokens.push('ta.', '!', 'queue', '!', `${rama.nombre}.`);
      }
    }
  }

  tokens.usedDeviceIndexFallback = usedDeviceIndexFallback;
  tokens.addressingMode = addressingMode;
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
    // Hito 3: regla de audio declarada en el estado — { name, matched }:
    // matched=true SOLO si wasapi2src recibió el device= del micrófono
    // que coincide con la cámara; si no, matched=false y el log dice
    // que se usa el dispositivo por defecto de Windows.
    audioDevice: { name: null, matched: false },
    // Hito 3: número de destinos RTMP reales de la sesión en curso
    // (las URL NUNCA entran al estado ni al registro: llevan la clave).
    streamCount: 0,
    // v3.2.3: modo de apertura de la cámara del intento vigente
    // ('device-index' | 'device-path' | null sin sesión): el estado
    // dice la verdad sobre cómo se está abriendo la fuente.
    addressingMode: null,
    // v3.3.0 — multicámara: nombres de las fuentes que entraron DE
    // VERDAD en la sesión (en orden de layout) y el índice de la de
    // programa DENTRO de esa lista.
    sourceNames: [],
    programIndex: 0,
    // v3.3.1 (defecto 4): nombre de la cámara de PROGRAMA que el último
    // arranque se NEGÓ a sustituir por no emparejar con la enumeración
    // MF (la sesión no arrancó y la fase no quedó en «error»); null si
    // el último arranque no se detuvo por ese motivo.
    programUnavailable: null,
    // v3.3.0 — sonda de concurrencia, REDEFINIDA tras la compuerta del
    // 2026-11-13: null = aún sin veredicto en este arranque del
    // anfitrión; true/false = la vista previa independiente puede
    // vivir (o no) FUERA de sesión — es la vista previa cuando no hay
    // grabación/transmisión —. NUNCA significa convivencia con una
    // sesión: la primera compuerta de la v3.3.0 demostró que dos
    // lectores Media Foundation de la misma cámara matan la sesión de
    // grabación a los ~2 s («Failed to read sample» del lector MF);
    // por eso ningún arranque de grabación/transmisión lanza ni
    // mantiene vivo el proceso independiente, y en sesión la vista
    // previa es la rama integrada de siempre. El veredicto lo fija la
    // primera sesión de VISTA PREVIA y persiste entre sesiones.
    concurrentPreview: null,
    // v3.3.0 — teleprompter sobre la vista previa: true solo mientras
    // el previewProc vivo lleva el texto puesto por setPreviewText.
    previewTextActive: false,
    // v3.3.0 — nota declarada del teleprompter: la fija el no-op de
    // setPreviewText durante una sesión de grabación/transmisión (el
    // texto sobre la vista previa es solo fuera de sesión).
    previewTextNote: null,
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
  let contexto = null; // contexto de la sesión para los reintentos declarados
  let reintentoSinPresetHecho = false;
  let reintentoDireccionHecho = false;
  let gstCloseWaiters = [];
  // v3.3.0 — vista previa independiente (pata B): proceso aparte que
  // abre la cámara de programa FUERA de sesión (nunca en paralelo a
  // una sesión de grabación/transmisión: corrección tras la compuerta
  // del 2026-11-13). previewActual describe el lanzamiento vigente
  // { proc, startedAt, texto, muerto, intencional, stderr,
  // redSeguridadHecha }; probeDone marca que la sonda ya dio su
  // veredicto en ESTE arranque del anfitrión (la sonda NO se repite
  // entre sesiones y solo corre en sesiones de vista previa).
  let previewProc = null;
  let previewActual = null;
  let previewContexto = null; // { tools, device, caps, addressingMode }
  let probeDone = false;
  // v3.3.0 — la declaración del no-op de setPreviewText en sesión se
  // registra UNA vez por sesión de grabación/transmisión (la app
  // sondea el tramo cada 600 ms: sin esta bandera el registro se
  // inundaría con la misma declaración).
  let noOpTextoEnSesionDeclarado = false;

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
    // Hito 3 — disponibilidad perezosa: la app pregunta «¿hay motor
    // nativo?» al montar, ANTES de cualquier start, para decidir qué
    // cadena gobierna los botones reales. locateGstTools es síncrono
    // (solo comprobaciones de existencia en disco) y el resultado se
    // cachea en el estado; sin GStreamer, gstInstalled queda false y la
    // app lo declara y cae a la cadena anterior.
    if (state.gstInstalled === null) {
      try {
        const tools = locateGstTools({ env, platform, fsExists });
        state = { ...state, gstInstalled: !!tools };
      } catch (e) { state = { ...state, gstInstalled: false }; }
    }
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

  // v3.3.0 — ¿Hay una sesión activa a efectos de la vista previa? La
  // sesión de GStreamer (gstProc) o la sesión 'preview' servida por el
  // propio previewProc (sonda que hace de sesión). OJO: con una sesión
  // de grabación/transmisión esto devuelve true por gstProc, pero
  // setPreviewText intercepta ese caso ANTES (no-op declarado): el
  // texto solo se pone sobre el previewProc fuera de sesión.
  function sesionActivaParaPreview() {
    if (gstProc) return true;
    return state.session === 'preview' && ['vista-previa', 'encendiendo'].includes(state.phase);
  }

  // Lanza (o relanza) el proceso de vista previa independiente con el
  // texto dado ('' = sin texto). Sin reintentos en bucle: la ÚNICA red
  // automática es la de setPreviewText (un relanzamiento con texto que
  // muere en <1500 ms se relanza SIN texto una vez, declarado).
  function lanzarPreview(texto) {
    if (!previewContexto) return null;
    const args = buildPreviewArgs({
      deviceIndex: previewContexto.device ? previewContexto.device.deviceIndex : null,
      devicePath: previewContexto.device ? previewContexto.device.devicePath : null,
      addressingMode: previewContexto.addressingMode || undefined,
      caps: previewContexto.caps,
      texto: texto || undefined,
    });
    let proc;
    try {
      proc = spawnImpl(previewContexto.tools.launch, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      log(`No se pudo lanzar la vista previa independiente: ${e.message}`);
      return null;
    }
    const info = {
      proc, startedAt: Date.now(), texto: texto || '',
      muerto: false, intencional: false, stderr: '', redSeguridadHecha: false,
    };
    previewActual = info;
    previewProc = proc;
    if (proc.stderr) {
      proc.stderr.on('data', (chunk) => {
        const t = chunk.toString();
        info.stderr += t;
        for (const cruda of t.split(/\r?\n/)) {
          const linea = cruda.trim();
          if (linea) log(`Vista previa independiente: ${linea}`);
        }
      });
    }
    proc.once('error', (e) => {
      info.muerto = true;
      if (previewActual === info) previewProc = null;
      log(`Error del proceso de vista previa independiente: ${e.message}`);
    });
    proc.once('close', () => {
      info.muerto = true;
      if (previewActual !== info) return; // un reemplazo ya tomó el relevo
      previewProc = null;
      if (info.intencional) return;
      // Red de seguridad del texto (pata C): el relanzamiento CON texto
      // murió en <1500 ms → se relanza SIN texto UNA vez, declarado, y
      // previewTextActive pasa a false. Sin bucles: el relanzamiento
      // sin texto ya no lleva texto y no puede rearmar la red.
      if (info.texto && state.concurrentPreview === true && sesionActivaParaPreview()) {
        const transcurrido = Date.now() - info.startedAt;
        if (transcurrido < 1500 && !info.redSeguridadHecha) {
          info.redSeguridadHecha = true;
          log(`La vista previa con texto murió en ${transcurrido} ms (<1500): se relanza SIN texto una vez y el texto queda desactivado (declarado).`);
          fijar({ previewTextActive: false });
          lanzarPreview('');
          return;
        }
        fijar({ previewTextActive: false });
        log('La vista previa independiente se cerró; el texto del teleprompter ya no está sobre la imagen (declarado).');
        return;
      }
      log('La vista previa independiente se cerró sin orden de parada (declarado).');
    });
    log(`Vista previa independiente lanzada${info.texto ? ' con el texto del teleprompter' : ' sin texto'}.`);
    return info;
  }

  // Mata el previewProc vigente marcándolo intencional (sus cierres no
  // disparan la red de seguridad ni ensucian el registro).
  function matarPreview() {
    if (previewActual) previewActual.intencional = true;
    if (previewProc) {
      matarProceso(previewProc);
      previewProc = null;
    }
  }

  // Espera de la sonda: hasta ms, saliendo en cuanto el proceso muere.
  async function esperarSondaPreview(info, ms) {
    const inicio = Date.now();
    while (Date.now() - inicio < ms && info && !info.muerto) await sleepMs(100);
    return !!info && !info.muerto;
  }

  // v3.3.0 (corrección tras la compuerta) — garantía de UN SOLO lector
  // de la cámara: antes de lanzar la tubería de una sesión de
  // grabación/transmisión, si quedara un proceso de vista previa
  // independiente (vivo o con el cierre aún en vuelo tras un stop),
  // se mata y se ESPERA su salida completa — su evento 'close': la
  // cámara queda liberada de verdad — con un tope de 5 s (el mismo
  // patrón declarado que stop() usa con gstProc). La confirmación
  // queda en el registro ANTES de la línea «Tubería:» de la sesión.
  async function asegurarCamaraSinPreviewIndependiente() {
    const info = previewActual;
    if (!info) return;
    if (!info.muerto) {
      matarPreview();
      const inicio = Date.now();
      while (!info.muerto && Date.now() - inicio < 5000) await sleepMs(50);
    }
    if (previewActual === info) previewActual = null;
    if (state.previewTextActive) fijar({ previewTextActive: false });
    if (info.muerto) {
      log('Vista previa independiente: detenida y con su salida confirmada ANTES de lanzar la sesión — la cámara queda con un solo lector (corrección tras la compuerta: dos lectores Media Foundation mataban la grabación a los ~2 s).');
    } else {
      log('Vista previa independiente: no se confirmó su salida en 5 s tras la orden de parada; se suelta su referencia y la sesión arranca sin ella (declarado).');
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
      // v3.2.3 — Reintento declarado de APERTURA: si la fuente muere al
      // nacer (≤4000 ms: antes de sostenerse en la fase de marcha) con
      // la firma exacta de MediaFoundation «Couldn't create capture
      // object» (gst_mf_video_src_start) y existe el modo de apertura
      // ALTERNO, la sesión se relanza UNA vez con ese modo. Es la red
      // de seguridad entre las dos formas de direccionar la cámara: la
      // principal device-index (probada en el Hito 1 B) y el respaldo
      // device-path. El intercambio queda en el registro y en el estado
      // (addressingMode). Cada intento nace con su contabilidad limpia
      // (lanzarGst reinicia el stderr acumulado y la marca de tiempo;
      // el oyente local y la validación son de la sesión, no del
      // intento, y no se duplican).
      const firmaCaptura = stderrAcumulado.includes("Couldn't create capture object");
      const dispCtx = contexto ? contexto.device : null;
      const modoVigente = contexto ? contexto.addressingMode : null;
      const modoAlterno = !dispCtx || reintentoDireccionHecho || !firmaCaptura || transcurrido > 4000
        ? null
        : modoVigente === 'device-index' && dispCtx.devicePath
          ? 'device-path'
          : modoVigente === 'device-path' && Number.isInteger(dispCtx.deviceIndex) && dispCtx.deviceIndex >= 0
            ? 'device-index'
            : null;
      if (modoAlterno) {
        reintentoDireccionHecho = true;
        contexto.addressingMode = modoAlterno;
        log(`La apertura por ${modoVigente} falló; reintentando con ${modoAlterno}…`);
        fijar({ addressingMode: modoAlterno });
        const nuevosTokens = buildPipelineArgs(contextoParaBuilder());
        log(`Tubería (reintento): ${nuevosTokens.join(' ')}`);
        lanzarGst(nuevosTokens);
        return;
      }
      // Reintento declarado: una sesión con nvh264enc + preset=hq que muere
      // en menos de 2500 ms nombrando al codificador en su stderr se
      // reintenta UNA vez sin preset, y la rebaja queda logueada.
      const nombraCodificador = /nvh264enc|encoder|codificador/i.test(stderrAcumulado);
      if (!reintentoSinPresetHecho && contexto && contexto.encoder === 'nvh264enc'
        && contexto.withPreset && transcurrido < 2500 && nombraCodificador
        && ['record', 'recordStream', 'stream'].includes(contexto.session)) {
        reintentoSinPresetHecho = true;
        contexto.withPreset = false;
        log('El codificador nvh264enc con preset=hq murió al arrancar; reintento declarado SIN preset (presetUsed pasa a «sin preset (reintento declarado)»).');
        fijar({ presetUsed: 'sin preset (reintento declarado)' });
        const nuevosTokens = buildPipelineArgs(contextoParaBuilder());
        if (nuevosTokens.addressingMode === 'device-path') {
          log('La cámara se abre por device-path (respaldo declarado).');
        }
        lanzarGst(nuevosTokens);
        return;
      }
      const ultimas = state.logTail.slice(-4).join(' | ');
      // v3.3.0: la sesión murió; si quedara un resto de vista previa
      // independiente, también se detiene (en sesión no debe existir
      // ninguno desde la corrección tras la compuerta: defensa
      // declarada, normalmente es un no-op).
      matarPreview();
      fijar({ phase: 'error', previewTextActive: false, lastError: `GStreamer se cerró sin orden de parada (código ${code != null ? code : 'desconocido'}).${ultimas ? ` Últimas líneas: ${ultimas}` : ''}` });
      log(`GStreamer se cerró sin orden de parada (código ${code != null ? code : 'desconocido'}).`);
    });
    return true;
  }

  function contextoParaBuilder() {
    return {
      session: contexto.session,
      // v3.2.3: el índice pasa TAL CUAL (null si el dispositivo no trae
      // índice MF): sustituirlo por 0 aquí haría creer al constructor
      // que el índice usado es el parseado del dispositivo.
      deviceIndex: contexto.device ? contexto.device.deviceIndex : null,
      devicePath: contexto.device ? contexto.device.devicePath : null,
      // v3.2.3: modo de apertura vigente (el reintento lo intercambia).
      addressingMode: contexto.addressingMode || undefined,
      caps: contexto.caps,
      encoder: contexto.encoder,
      withPreset: contexto.withPreset,
      withAudio: contexto.withAudio,
      audioSrc: 'wasapi2src',
      // Hito 3: el identificador WASAPI resuelto por la regla de audio
      // (null = dispositivo por defecto, ya declarado en el registro).
      audioDevice: contexto.audioDeviceId || null,
      // Hito 3: destinos reales de la sesión (vacío en la prueba local).
      streamUrls: contexto.streamUrls || [],
      outFile: contexto.outFile,
      // v3.3.0: la sesión multicámara ÍNTEGRA viaja en el contexto para
      // que los DOS reintentos declarados (dirección y preset) la
      // reconstruyan entera, con su layout y su rama de preview
      // integrada (siempre presente desde la corrección tras la
      // compuerta).
      sources: contexto.sources || undefined,
      programIndex: contexto.programIndex || 0,
      omitPreviewBranch: !!contexto.omitPreviewBranch,
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
    // v3.3.0 — multicámara: sources = NOMBRES de cámara en orden de
    // layout (la de programa va en programIndex, defecto 0); sin
    // sources manda el camino de siempre (cameraName / por defecto).
    const sourcesPedidas = Array.isArray(opts.sources)
      ? opts.sources.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim())
      : [];
    const programIndexPedido = Number.isInteger(opts.programIndex) && opts.programIndex >= 0 ? opts.programIndex : 0;
    const outDir = opts.outDir || path.join(os.tmpdir(), 'podcastudio-motor-nativo');
    // Hito 3: destinos reales (URLs completas ya compuestas; NUNCA se
    // escriben en el registro — solo cuántos son) y base del nombre del
    // máster (la compone main con el esquema del proyecto).
    const streamUrls = Array.isArray(opts.streamUrls) ? opts.streamUrls.filter((u) => typeof u === 'string' && u.trim()) : [];
    const outFileBase = typeof opts.outFileBase === 'string' && opts.outFileBase.trim() ? opts.outFileBase.trim() : null;

    if (!['preview', 'record', 'recordStream', 'stream'].includes(session)) {
      return { success: false, error: `Sesión no válida: ${session || '(vacía)'}.` };
    }
    if (session === 'stream' && streamUrls.length === 0) {
      return { success: false, error: 'La sesión de transmisión necesita al menos un destino (streamUrls vacío).' };
    }
    const sesionEnCurso = Boolean(gstProc) || ['encendiendo', 'vista-previa', 'grabando', 'grabando-transmitiendo', 'transmitiendo', 'validando'].includes(state.phase);
    if (sesionEnCurso) {
      // v3.3.3 (defecto C) — la VISTA PREVIA CEDE ante grabar/
      // transmitir: es un estado de espera, no una sesión con
      // derechos. Antes, con la vista previa abierta (fase
      // «vista-previa»), Grabar recibía «Ya hay una sesión del motor
      // nativo en curso.» y NO grababa (captura image-135 de Luis).
      // Si lo que hay en curso es SOLO una sesión 'preview' — servida
      // por el proceso independiente (gstProc nulo) o por la tubería
      // integrada —, un arranque record/recordStream la detiene
      // PRIMERO (la maquinaria de parada de siempre: stop() espera el
      // cierre real del proceso) y LUEGO arranca: orden stop→start,
      // cero errores. El error «Ya hay una sesión…» queda SOLO para
      // conflictos reales: grabar/transmitir contra
      // grabar/transmitir (las subidas ya las reinician los botones
      // reales desde la v3.2.2), transmitir solo desde la vista
      // previa (sin cambios: no pedida por nadie) y la vista previa
      // contra cualquier sesión viva.
      const esSoloVistaPrevia = state.session === 'preview' && ['vista-previa', 'encendiendo'].includes(state.phase) && (!gstProc || previewProc === gstProc);
      const pideGrabar = session === 'record' || session === 'recordStream';
      if (!(esSoloVistaPrevia && pideGrabar)) {
        return { success: false, error: 'Ya hay una sesión del motor nativo en curso.' };
      }
      log(`La vista previa cede ante el arranque de «${session}»: se detiene primero y luego arranca (orden stop→start; v3.3.3 defecto C).`);
      await stop();
    }

    intentionalStop = false;
    reintentoSinPresetHecho = false;
    reintentoDireccionHecho = false;
    noOpTextoEnSesionDeclarado = false;
    fijar({
      phase: 'encendiendo', session, cameraName, caps: null, encoder: null,
      presetUsed: null, outFile: null, streamFile: null, validation: null,
      streamValidation: null, streamBytes: 0, lastError: null, logTail: [],
      audioDevice: { name: null, matched: false }, streamCount: streamUrls.length,
      addressingMode: null,
      // v3.3.0: la sesión nueva nace sin fuentes confirmadas ni texto;
      // concurrentPreview NO se toca: es el veredicto de la sonda de
      // este arranque y persiste entre sesiones.
      sourceNames: [], programIndex: 0, previewTextActive: false, previewTextNote: null,
      programUnavailable: null,
    });
    if (streamUrls.length > 0) {
      log(`Destinos de transmisión reales: ${streamUrls.length} (las URL no se escriben en el registro: llevan la clave de transmisión).`);
    }

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
    // v3.3.0 — resolución nombre→dispositivo para multicámara: se
    // prefiere la entrada Media Foundation (clase «Source/Video») CON
    // deviceIndex cuyo nombre coincida (comparación laxa vigente); en
    // su defecto, una coincidencia con devicePath. Una entrada sin
    // índice MF ni ruta NO resuelve (abriría la cámara equivocada por
    // el índice 0 por defecto): vale más omitirla y declararlo.
    const resolverPorNombre = (nombre) => {
      // v3.3.1 (defecto 3): el emparejamiento usa la normalización
      // (sin sufijo VID:PID, sin distinguir mayúsculas/espacios); si
      // varias entradas emparejan, manda la de Media Foundation y la
      // ambigüedad queda declarada en el registro.
      const coincidencias = dispositivos.filter((dd) => dd.name && nombresCamaraCoinciden(nombre, dd.name));
      if (coincidencias.length === 0) return null;
      const elegida = coincidencias.find((dd) => dd.class === 'Source/Video' && Number.isInteger(dd.deviceIndex) && dd.deviceIndex >= 0)
        || coincidencias.find((dd) => dd.devicePath)
        || null;
      if (elegida && coincidencias.length > 1) {
        log(`«${nombre}» emparejó ${coincidencias.length} entradas de la enumeración: se elige «${elegida.name}» (${elegida.class === 'Source/Video' ? 'Media Foundation' : elegida.class || 'sin clase'}) (ambigüedad declarada).`);
      }
      return elegida;
    };
    let device;
    let resolucionFuentes = null; // { resolverPorNombre, indiceProgramaPedido }
    if (sourcesPedidas.length > 0) {
      const indiceProgramaPedido = programIndexPedido < sourcesPedidas.length ? programIndexPedido : 0;
      if (indiceProgramaPedido !== programIndexPedido) {
        log(`programIndex ${programIndexPedido} fuera de rango para ${sourcesPedidas.length} fuentes: se usa 0 (declarado).`);
      }
      const nombrePrograma = sourcesPedidas[indiceProgramaPedido];
      device = resolverPorNombre(nombrePrograma);
      if (!device) {
        // v3.3.1 (defecto 4): la de PROGRAMA sin resolver NO es un
        // «error» de una sesión que arrancó: la sesión NO arranca, no
        // se sustituye otra cámara y la fase vuelve a «apagado» con el
        // motivo en programUnavailable para que la app lo declare en
        // la banda ANTES de cualquier tubería.
        fijar({ phase: 'apagado', programUnavailable: nombrePrograma, lastError: null });
        log(`La cámara de programa «${nombrePrograma}» no está disponible para el motor (no emparejó con la enumeración de Media Foundation tras la normalización): la sesión NO arranca y no se sustituye otra cámara (declarado).`);
        return { success: false, code: 'PROGRAMA_NO_DISPONIBLE', error: `La cámara de programa «${nombrePrograma}» no está disponible para el motor nativo.` };
      }
      log(`Cámara de programa «${nombrePrograma}»: coincide la entrada «${device.name}» (${device.class === 'Source/Video' ? 'Media Foundation' : device.class || 'sin clase'}, device-index=${Number.isInteger(device.deviceIndex) ? device.deviceIndex : 'sin índice'}).`);
      resolucionFuentes = { indiceProgramaPedido };
    } else {
      device = chooseDevice(dispositivos, cameraName);
      if (cameraName && device && !nombresCamaraCoinciden(cameraName, device.name)) {
        // v3.3.1 (defecto 4): con un nombre EXPLÍCITO (la cámara de
        // programa que manda la app) ya NO se sustituye la primera
        // enumerada: si la pedida no empareja tras la normalización,
        // la sesión no arranca, la fase vuelve a «apagado» y el motivo
        // queda en programUnavailable. Sin nombre pedido manda la
        // elección por defecto de siempre.
        fijar({ phase: 'apagado', programUnavailable: cameraName, lastError: null });
        log(`La cámara de programa «${cameraName}» no está disponible para el motor (no emparejó con la enumeración de Media Foundation tras la normalización): la sesión NO arranca y no se sustituye otra cámara (declarado).`);
        return { success: false, code: 'PROGRAMA_NO_DISPONIBLE', error: `La cámara de programa «${cameraName}» no está disponible para el motor nativo.` };
      }
    }
    const caps = chooseCapsForDevice(device);
    if (!caps) {
      fijar({ phase: 'error', lastError: `La cámara «${device.name || ''}» no declaró ningún caps usable.` });
      return { success: false, error: `La cámara «${device.name || ''}» no declaró ningún caps usable.` };
    }
    // v3.3.0 — lista de fuentes PARA EL CONSTRUCTOR, en el orden de
    // layout pedido y SOLO con las que resolvieron: cada PiP que no
    // resuelve (o sin caps utilizables) se OMITE y se declara — nunca
    // tumba la sesión —; cada coincidencia también queda en el
    // registro. indiceProgramaBuilder es la posición de la de programa
    // DENTRO de la lista que de verdad entra.
    let fuentesBuilder = null;
    let indiceProgramaBuilder = 0;
    if (resolucionFuentes) {
      fuentesBuilder = [];
      const nombresQueEntran = [];
      sourcesPedidas.forEach((nombre, i) => {
        const esPrograma = i === resolucionFuentes.indiceProgramaPedido;
        const dispFuente = esPrograma ? device : resolverPorNombre(nombre);
        const capsFuente = esPrograma ? caps : (dispFuente ? chooseCapsForDevice(dispFuente) : null);
        if (!dispFuente || !capsFuente) {
          log(`Fuente PiP «${nombre}» OMITIDA: ${!dispFuente ? 'no resolvió contra la enumeración (sin entrada Media Foundation con device-index ni device-path coincidente)' : 'la entrada coincidente no declaró caps utilizables'} (declarado; la sesión continúa sin ella).`);
          return;
        }
        if (!esPrograma) {
          log(`Fuente «${nombre}»: coincide la entrada «${dispFuente.name}» (${dispFuente.class === 'Source/Video' ? 'Media Foundation' : dispFuente.class || 'sin clase'}, device-index=${Number.isInteger(dispFuente.deviceIndex) ? dispFuente.deviceIndex : 'sin índice'}) — entra como PiP.`);
        }
        if (esPrograma) indiceProgramaBuilder = fuentesBuilder.length;
        fuentesBuilder.push({ deviceIndex: Number.isInteger(dispFuente.deviceIndex) ? dispFuente.deviceIndex : null, devicePath: dispFuente.devicePath || null, caps: capsFuente });
        nombresQueEntran.push(dispFuente.name || nombre);
      });
      fijar({ sourceNames: nombresQueEntran, programIndex: indiceProgramaBuilder });
    }
    const bajoElPiso = caps.width < 1920 || caps.height < 1080;
    log(`Cámara «${device.name || ''}»: formato negociado ${caps.width}x${caps.height} a ${caps.framerate != null ? caps.framerate : '?'} fps (${caps.format || 'formato sin declarar'})${bajoElPiso ? ' — por debajo del piso 1080 del producto (declarado)' : ''}.`);
    // v3.2.3: la apertura principal es por device-index (índice MF);
    // solo se declara el caso sin índice ni ruta (índice 0 por defecto).
    // El respaldo por device-path lo declara la construcción (paso 7).
    if (!(Number.isInteger(device.deviceIndex) && device.deviceIndex >= 0) && !device.devicePath) {
      log('La cámara no trae índice MF ni device-path en el monitor: se abre con device-index=0 por defecto (declarado).');
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

    // 4-bis) Hito 3 — REGLA DE AUDIO: el micrófono debe ser EL DE LA
    // CÁMARA elegida. Se enumera Audio/Source con el mismo monitor y se
    // busca el endpoint cuyo nombre contiene el de la cámara; si trae
    // identificador (device.id del monitor), wasapi2src lo recibe como
    // su propiedad device=. Sin coincidencia UTILIZABLE se usa el
    // dispositivo por defecto de Windows Y QUEDA DECLARADO en el
    // registro y en el estado (audioDevice.matched=false) — nunca en
    // silencio.
    let audioDeviceId = null;
    let audioDeviceInfo = { name: null, matched: false };
    if (withAudio) {
      const rAud = await ejecutar(tools.monitor, ['Audio/Source'], 15000);
      const dispositivosAudio = rAud && rAud.stdout ? parseDeviceMonitorOutput(rAud.stdout, { audio: true }) : [];
      const eleccionAudio = chooseAudioDevice(dispositivosAudio, device.name);
      if (eleccionAudio.matched && eleccionAudio.device) {
        const idDisp = eleccionAudio.device.deviceId || eleccionAudio.device.devicePath || null;
        if (idDisp) {
          audioDeviceId = idDisp;
          audioDeviceInfo = { name: eleccionAudio.device.name || null, matched: true };
          log(`Audio: micrófono «${eleccionAudio.device.name}» — coincide con la cámara «${device.name || ''}» y wasapi2src lo captura por su identificador (device=…).`);
        } else {
          log(`Audio: «${eleccionAudio.device.name}» coincide por nombre con la cámara pero el monitor no le dio identificador (device.id): no se puede fijar en wasapi2src (declarado).`);
        }
      }
      if (!audioDeviceId) {
        log(`Audio: dispositivo por defecto de Windows — no se encontró micrófono utilizable que coincida con la cámara «${device.name || ''}» (declarado, nunca en silencio).`);
      }
    }

    // 5) Carpeta y nombres de archivo. Hito 3: con outFileBase (main lo
    // compone con el nombre del proyecto y la marca de tiempo, como el
    // máster de la app) el archivo se llama <base>_Master_<alto>p.mp4;
    // sin él, el nombre histórico del panel.
    try { fs.mkdirSync(outDir, { recursive: true }); } catch (e) {}
    const nombre = outFileBase
      ? `${outFileBase}_Master_${caps.height}p.mp4`
      : `PodcastStudio_motor_${marcaDeTiempoLocal(new Date())}.mp4`;
    const outFile = (session === 'preview' || session === 'stream') ? null : path.join(outDir, nombre);
    // El FLV recibido (y su oyente) existen SOLO en la prueba local del
    // panel: recordStream SIN destinos reales.
    const streamFile = session === 'recordStream' && streamUrls.length === 0 ? path.join(outDir, 'motor-stream-recibido.flv') : null;

    contexto = {
      tools, session, device, caps, encoder, withPreset, withAudio, outFile, streamFile,
      streamUrls, audioDeviceId,
      // v3.3.0: fuentes multicámara que entraron de verdad (null = la
      // sesión de una sola cámara de siempre). omitPreviewBranch queda
      // SIEMPRE en false desde la corrección tras la compuerta: la
      // sesión nace con su rama de preview integrada; el campo sigue
      // existiendo porque contextoParaBuilder lo pasa al constructor
      // (cuya opción pura conserva su prueba).
      sources: fuentesBuilder,
      programIndex: indiceProgramaBuilder,
      omitPreviewBranch: false,
      // v3.2.3: modo de apertura del intento vigente; lo fija el paso 7
      // desde los tokens construidos y el reintento puede intercambiarlo.
      addressingMode: null,
    };
    // v3.3.0 — contexto de la vista previa independiente: la cámara de
    // PROGRAMA, con el modo de apertura que resulte de la construcción.
    previewContexto = { tools, device, caps, addressingMode: null };
    fijar({ audioDevice: audioDeviceInfo });

    // 6) Oyente RTMP local (solo la prueba local): ANTES de lanzar GStreamer.
    if (streamFile) {
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

    // 6-bis) v3.3.0 — VISTA PREVIA INDEPENDIENTE Y SONDA, con la
    // semántica CORREGIDA tras la compuerta del 2026-11-13. La primera
    // versión hacía vivir el proceso independiente EN PARALELO a la
    // sesión de grabación y la compuerta lo cazó: record,
    // recordStream y multicam morían a los ~2 s con «Failed to read
    // sample» (gstmfsourcereader) porque el driver Media Foundation
    // de la Steren NO sirve a dos lectores de la misma cámara. La
    // sonda original había medido la convivencia contra la sesión de
    // vista previa (un solo lector): midió mal. Semántica corregida:
    //  - La sesión de VISTA PREVIA ('preview') ES el proceso
    //    independiente (como nació la pata B): su primer arranque hace
    //    de sonda y fija el veredicto — concurrentPreview pasa a
    //    significar «la vista previa independiente puede vivir FUERA
    //    de sesión» —. Si el proceso muere al nacer, el veredicto es
    //    false y la sesión de vista previa cae a la tubería integrada
    //    de siempre (paso 7).
    //  - Las sesiones que LEEN la cámara para grabar/transmitir
    //    (record, recordStream, stream y la multicámara) NUNCA lanzan
    //    ni mantienen vivo el proceso independiente: si al llegar
    //    aquí quedara uno (vivo o con el cierre aún en vuelo tras un
    //    stop), asegurarCamaraSinPreviewIndependiente lo detiene y
    //    ESPERA su salida completa ANTES del paso 7, y la sesión nace
    //    con su rama de preview integrada (la forma probada de la
    //    v3.2.3). Esas sesiones ya no corren sonda: el veredicto solo
    //    cambia en sesiones de vista previa.
    const tokensPrevios = buildPipelineArgs(contextoParaBuilder());
    previewContexto.addressingMode = tokensPrevios.addressingMode;
    if (session === 'preview') {
      if (!probeDone) {
        const infoSonda = lanzarPreview('');
        if (!infoSonda) {
          probeDone = true;
          fijar({ concurrentPreview: false });
          log('Sonda de la vista previa: no se pudo lanzar el proceso independiente; concurrentPreview=false (declarado) y la vista previa usa la tubería integrada.');
        } else {
          const vive = await esperarSondaPreview(infoSonda, 3000);
          probeDone = true;
          if (vive) {
            fijar({ concurrentPreview: true });
            log('Sonda de la vista previa: el proceso independiente VIVE fuera de sesión — concurrentPreview=true (declarado); ese proceso ES la sesión de vista previa.');
            contexto.addressingMode = tokensPrevios.addressingMode;
            fijar({ addressingMode: tokensPrevios.addressingMode, phase: 'vista-previa' });
            return { success: true };
          }
          const firmaSonda = infoSonda.stderr.includes("Couldn't create capture object");
          fijar({ concurrentPreview: false });
          log(`Sonda de la vista previa: el proceso independiente murió${firmaSonda ? ' con la firma «Couldn\'t create capture object»' : ''}; concurrentPreview=false (declarado) y se lanza la vista previa integrada normal.`);
          if (previewActual === infoSonda) { previewActual = null; previewProc = null; }
        }
      } else if (state.concurrentPreview === true) {
        // Veredicto conocido: la sesión de vista previa ES el proceso
        // independiente (sin repetir la sonda ni su espera).
        const infoPrevia = lanzarPreview('');
        if (infoPrevia) {
          contexto.addressingMode = tokensPrevios.addressingMode;
          fijar({ addressingMode: tokensPrevios.addressingMode, phase: 'vista-previa' });
          return { success: true };
        }
        log('No se pudo relanzar la vista previa independiente para la sesión preview; se usa la sesión integrada (declarado).');
      }
      // Veredicto false (recién medido o persistente): se cae al
      // paso 7 con la tubería de vista previa integrada de siempre.
    } else {
      await asegurarCamaraSinPreviewIndependiente();
    }

    // 7) Lanzamiento de la tubería.
    const tokens = buildPipelineArgs(contextoParaBuilder());
    contexto.addressingMode = tokens.addressingMode;
    if (tokens.addressingMode === 'device-path') {
      log('Construcción de la sesión: apertura por device-path (respaldo declarado; la forma principal es device-index y este dispositivo no trae índice MF utilizable).');
    }
    fijar({ addressingMode: tokens.addressingMode });
    log(`Tubería: ${tokens.join(' ')}`);
    const lanzado = lanzarGst(tokens);
    if (!lanzado) { matarPreview(); return { success: false, error: state.lastError || 'No se pudo lanzar GStreamer.' }; }

    fijar({ phase: session === 'preview' ? 'vista-previa' : session === 'record' ? 'grabando' : session === 'stream' ? 'transmitiendo' : 'grabando-transmitiendo' });
    return { success: true };
  }

  // v3.3.0 — setPreviewText(texto) (pata C, lado anfitrión): pone el
  // tramo visible del teleprompter SOBRE la vista previa independiente
  // relanzando SOLO previewProc con el texto recibido. Solo actúa
  // FUERA de sesión de grabación/transmisión, con
  // concurrentPreview===true y previewProc vivo sirviendo la sesión de
  // vista previa; sin concurrencia devuelve { success:false } SIN
  // tocar nada. DURANTE una sesión de grabación/transmisión es un
  // NO-OP declarado (corrección tras la compuerta: el proceso
  // independiente no convive con la sesión; la vista previa de la
  // sesión es la rama integrada y el teleprompter sigue en la ventana
  // como hasta hoy): se anota en el estado (previewTextNote) y en el
  // registro UNA vez por sesión, y la sesión no se entera. Si el
  // relanzamiento con texto muere en <1500 ms, el cierre del proceso
  // aplica la red declarada de lanzarPreview: relanza sin texto una
  // vez y previewTextActive queda en false.
  function setPreviewText(texto) {
    const tramo = typeof texto === 'string' ? texto : '';
    const enSesionDeGrabacion = !!gstProc && ['record', 'recordStream', 'stream'].includes(state.session);
    if (enSesionDeGrabacion) {
      if (!noOpTextoEnSesionDeclarado) {
        noOpTextoEnSesionDeclarado = true;
        log('Texto del teleprompter durante la sesión: NO-OP declarado — la vista previa independiente no convive con la grabación/transmisión (corrección tras la compuerta); el texto sigue en la ventana como hasta hoy y la sesión no se toca.');
      }
      const NOTA_NOOP = 'En sesión de grabación/transmisión el texto va por la ventana (la de siempre): la vista previa con texto es solo fuera de sesión (no-op declarado).';
      if (state.previewTextActive || state.previewTextNote !== NOTA_NOOP) {
        fijar({ previewTextActive: false, previewTextNote: NOTA_NOOP });
      }
      return { success: false, error: 'Durante la grabación/transmisión no hay vista previa independiente: el texto sobre ella es solo fuera de sesión (no-op declarado; la sesión no se tocó).' };
    }
    if (state.concurrentPreview !== true || !previewActual || previewActual.muerto || !previewProc || !sesionActivaParaPreview()) {
      return { success: false, error: 'Sin vista previa independiente viva (concurrencia no confirmada o sin sesión activa): no se toca nada.' };
    }
    matarPreview();
    const info = lanzarPreview(tramo);
    if (!info) return { success: false, error: 'No se pudo relanzar la vista previa independiente con el texto.' };
    fijar({ previewTextActive: !!tramo, previewTextNote: null });
    log(`Texto del teleprompter ${tramo ? 'puesto sobre' : 'retirado de'} la vista previa independiente (solo se relanzó previewProc; la sesión no se tocó).`);
    return { success: true };
  }

  async function stop() {
    intentionalStop = true;
    // v3.3.0: stop() mata la sesión Y su vista previa independiente
    // (incluida la sesión 'preview' servida por el propio previewProc).
    matarPreview();
    fijar({ previewTextActive: false, previewTextNote: null });
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

  return { start, stop, getState, setPreviewText };
}

module.exports = {
  createNativeEngine,
  parseDeviceMonitorOutput,
  chooseCapsForDevice,
  chooseCaps,
  chooseDevice,
  normalizarNombreCamara,
  nombresCamaraCoinciden,
  buildPipelineArgs,
  buildPreviewArgs,
  locateGstTools,
  parseFfmpegInfo,
  encoderProps,
  bitrateParaCaps,
  chooseEncoder,
  capsParaStream,
  chooseAudioDevice,
  ENCODER_LADDER,
  RTMP_PRUEBA_URL,
};
