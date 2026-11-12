'use strict';
// ===========================================================================
// Puente PodcastStudio <-> OBS Studio — Plan B, hito de prueba de vida
// (v2.1.0). OBS pasa a ser el MOTOR (captura, codificación, grabación y
// transmisión) y PodcastStudio la superficie de control, tras cuatro rondas
// del motor interno muriendo en vivo en la misma costura (la entrega de
// bytes al FFmpeg por pipe y su arranque).
//
// Protocolo: obs-websocket 5.x, INTEGRADO en OBS Studio 28+ (sin plugins),
// puerto por defecto 4455. Implementado contra la especificación pública
// del protocolo (opcodes 0/1/2/5/6/7 y el algoritmo oficial de
// autenticación); NO verificado contra un servidor OBS vivo en este
// entorno — la prueba de vida la corre Luis con el LEEME-obs-v210.md.
//
// Diseño sin puertas cerradas (nota de alcance de Luis): el
// aprovisionamiento de cámaras es una LISTA de descriptores
// {slot, deviceId, label} de longitud arbitraria (la app trabaja con hasta
// 12 ranuras); nada de campos cam1/cam2 ni constantes de dos cámaras. Las
// etapas siguientes escalan sobre este mismo puente: un invitado por
// enlace = una fuente de navegador más en la escena (mismo patrón que el
// cintillo) y el Mando iPad retransmite sus órdenes a estas mismas
// funciones (setProgramScene/startStream/startRecord/...).
//
// Aditivo por contrato: este módulo no toca el motor interno
// (electron/program-core.js ni las rutas de grabación/streaming previas);
// vive en paralelo y solo actúa cuando la UI lo invoca vía IPC `obs:*`.
// ===========================================================================

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// Opcodes del protocolo obs-websocket 5.x.
const OBS_OP = {
  Hello: 0,
  Identify: 1,
  Identified: 2,
  Reidentify: 3,
  Event: 5,
  Request: 6,
  RequestResponse: 7,
};

// eventSubscriptions: bits 0..10 (General|Config|Scenes|Inputs|Transitions|
// Filters|Outputs|SceneItems|MediaInputs|Vendors|Ui) = 2047, es decir «All»
// sin los eventos de alto volumen (métricas de volumen, transformaciones),
// que este puente no necesita.
const EVENT_SUBSCRIPTIONS_ALL = 2047;

const OBS_COLLECTION_NAME = 'PodcastStudio';
const OBS_SCENE_IN_COLLECTION = 'Programa';
// Si OBS no tiene la colección «PodcastStudio», el protocolo 5.x NO ofrece
// crear colecciones (solo listarlas y activar una existente): se
// aprovisiona en la colección activa con una escena de nombre inequívoco
// para no tocar escenas ajenas del usuario.
const OBS_SCENE_FALLBACK = 'PodcastStudio — Programa';
const OBS_CINTILLO_INPUT_NAME = 'PodcastStudio Cintillo';
const OBS_BROWSER_WIDTH = 1920;
const OBS_BROWSER_HEIGHT = 1080;

function obsCameraInputName(slot) {
  return `PodcastStudio CAM ${Number(slot) + 1}`;
}

// --- Autenticación obs-websocket 5.x (algoritmo oficial) -------------------
//   secret = base64( sha256( password + salt ) )
//   auth   = base64( sha256( secret + challenge ) )
// Los sha256 operan sobre los bytes crudos del resumen y las cadenas se
// concatenan como texto UTF-8. salt y challenge llegan en el Hello (op 0)
// cuando el servidor tiene contraseña.
function computeAuthSecret(password, salt) {
  const digest = crypto.createHash('sha256').update(`${password}${salt}`, 'utf8').digest();
  return digest.toString('base64');
}

function computeAuthentication(password, salt, challenge) {
  const secret = computeAuthSecret(password, salt);
  const digest = crypto.createHash('sha256').update(`${secret}${challenge}`, 'utf8').digest();
  return digest.toString('base64');
}

// --- Destino guardado -> ajustes de servicio RTMP de OBS -------------------
// La normalización del destino (servidor sin clave duplicada, clave
// exactamente una vez) la sigue haciendo el constructor endurecido de la
// app, src/utils/streamDestinations.mjs (buildStreamDestinations); aquí
// solo se traduce su salida { id, name, url } a SetStreamServiceSettings
// con rtmp_custom: OBS concatena server + '/' + key al publicar, así que
// la URL de publicación se parte en el ÚLTIMO '/' posterior al host.
function buildRtmpCustomSettings(destination) {
  const url = String(destination?.url || '').trim();
  if (!/^rtmps?:\/\//i.test(url)) {
    throw new Error('El destino de OBS debe ser una URL RTMP válida (la construye buildStreamDestinations).');
  }
  const hostEnd = url.indexOf('/', url.indexOf('://') + 3);
  const lastSlash = url.lastIndexOf('/');
  let server = url;
  let key = '';
  if (hostEnd >= 0 && lastSlash > hostEnd) {
    server = url.slice(0, lastSlash);
    key = url.slice(lastSlash + 1);
  }
  return {
    streamServiceType: 'rtmp_custom',
    streamServiceSettings: { server, key },
  };
}

// --- Cintillo como overlay HTML autocontenido ------------------------------
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeCssColor(value) {
  const v = String(value || '').trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(v) || /^[a-zA-Z]{3,20}$/.test(v) ? v : '#e8612a';
}

// renderCintilloHtml(cintillo): documento completo, fondo transparente,
// tarjeta inferior izquierda (misma posición fija que el drawCintillo del
// canvas interno). Si el cintillo no está activo se renderiza el cuerpo
// vacío: la fuente de navegador de OBS sigue cargada y transparente.
function renderCintilloHtml(cintillo) {
  const active = Boolean(cintillo?.active);
  const tag = escapeHtml(cintillo?.tag || 'TEMA');
  const text = escapeHtml(cintillo?.text || '');
  const subtitle = escapeHtml(cintillo?.subtitle || '');
  const color = safeCssColor(cintillo?.color);
  const card = active
    ? `<div class="card"><div class="tag">${tag}</div><div class="text">${text}</div>${subtitle ? `<div class="sub">${subtitle}</div>` : ''}</div>`
    : '';
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><style>
  html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; font-family: 'Segoe UI', Arial, sans-serif; }
  .card { position: absolute; left: 70px; bottom: 75px; min-width: 420px; max-width: 900px;
          background: rgba(12, 12, 16, 0.82); border-left: 8px solid ${color};
          border-radius: 10px; padding: 18px 26px 16px 22px; color: #fff;
          box-shadow: 0 10px 34px rgba(0,0,0,0.45); }
  .tag { display: inline-block; background: ${color}; color: #fff; font-size: 20px; font-weight: 800;
         letter-spacing: 0.12em; padding: 3px 12px; border-radius: 5px; margin-bottom: 8px; }
  .text { font-size: 40px; font-weight: 800; line-height: 1.12; }
  .sub { font-size: 24px; font-weight: 500; color: rgba(255,255,255,0.78); margin-top: 4px; }
</style></head><body>${card}</body></html>
`;
}

// Ruta de archivo -> URL file:// (OBS browser_source en Windows espera
// file:///C:/... con barras normales).
function toFileUrl(filePath) {
  const normalized = String(filePath).replace(/\\/g, '/');
  const withSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return `file://${withSlash.split('/').map((seg) => (/^[A-Za-z]:$/.test(seg) ? seg : encodeURIComponent(seg))).join('/')}`;
}

// Etiqueta de la app («EasyCamera (04f2:b57e)») vs nombre amable DirectShow
// («EasyCamera»): normalización para emparejar dispositivos.
function normalizeDeviceName(label) {
  return String(label || '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim()
    .toLowerCase();
}

// --- Cliente RPC mínimo del protocolo 5.x ----------------------------------
function createObsClient({ WebSocketImpl, log = () => {}, requestTimeoutMs = 10000 } = {}) {
  let SocketImpl = WebSocketImpl;
  if (!SocketImpl) {
    const wsModule = require('ws'); // dependencia ya presente en package.json
    SocketImpl = wsModule.WebSocket || wsModule;
  }

  let socket = null;
  let identified = false;
  let hello = null;
  let pending = new Map();
  let connectWaiters = [];
  const eventListeners = new Set();

  function emitEvent(event) {
    for (const cb of [...eventListeners]) {
      try { cb(event); } catch (e) {}
    }
  }

  function rejectAll(err) {
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(err);
    }
    pending = new Map();
    const waiters = connectWaiters;
    connectWaiters = [];
    for (const w of waiters) w.reject(err);
  }

  function handleMessage(raw) {
    let msg;
    try { msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString()); } catch (e) { return; }
    const { op, d } = msg || {};
    if (op === OBS_OP.Hello) {
      hello = d || {};
      const identify = { rpcVersion: 1, eventSubscriptions: EVENT_SUBSCRIPTIONS_ALL };
      if (hello.authentication?.challenge && hello.authentication?.salt) {
        if (!currentPassword) {
          const err = new Error('OBS pide contraseña de WebSocket y no se proporcionó ninguna.');
          err.code = 'OBS_AUTH_REQUIRED';
          rejectAll(err);
          try { socket.close(); } catch (e) {}
          return;
        }
        identify.authentication = computeAuthentication(currentPassword, hello.authentication.salt, hello.authentication.challenge);
      }
      socket.send(JSON.stringify({ op: OBS_OP.Identify, d: identify }));
      return;
    }
    if (op === OBS_OP.Identified) {
      identified = true;
      const waiters = connectWaiters;
      connectWaiters = [];
      for (const w of waiters) w.resolve(d || {});
      return;
    }
    if (op === OBS_OP.Event) {
      emitEvent({ eventType: d?.eventType, eventIntent: d?.eventIntent, eventData: d?.eventData || {} });
      return;
    }
    if (op === OBS_OP.RequestResponse) {
      const entry = pending.get(d?.requestId);
      if (!entry) return;
      pending.delete(d.requestId);
      clearTimeout(entry.timer);
      const status = d?.requestStatus || {};
      if (status.result) {
        entry.resolve(d?.responseData || {});
      } else {
        const err = new Error(`OBS rechazó la petición ${d?.requestType}: ${status.comment || 'sin detalle'} (código ${status.code}).`);
        err.requestType = d?.requestType;
        err.requestCode = status.code;
        entry.reject(err);
      }
    }
  }

  let currentPassword = '';

  function connect({ host = '127.0.0.1', port = 4455, password = '' } = {}) {
    disconnect();
    currentPassword = password || '';
    const url = `ws://${host}:${port}`;
    return new Promise((resolve, reject) => {
      connectWaiters.push({ resolve, reject });
      let settled = false;
      const fail = (err) => { if (!settled) { settled = true; rejectAll(err); } };
      try {
        socket = new SocketImpl(url);
      } catch (e) {
        reject(e);
        return;
      }
      socket.on('message', handleMessage);
      socket.on('error', (e) => {
        const err = new Error(`No se pudo conectar con OBS en ${url}: ${e.message || e}`);
        err.code = e.code || 'OBS_CONNECT_ERROR';
        err.cause = e;
        fail(err);
      });
      socket.on('close', () => {
        const wasIdentified = identified;
        identified = false;
        hello = null;
        socket = null;
        if (!wasIdentified) fail(new Error(`OBS cerró la conexión antes de identificar el cliente (${url}).`));
        rejectAll(new Error('La conexión con OBS se cerró.'));
        emitEvent({ eventType: '__obsDisconnected', eventIntent: 0, eventData: {} });
      });
      const timer = setTimeout(() => {
        fail(new Error(`OBS no respondió a tiempo en ${url}: revisa que OBS esté abierto y el servidor WebSocket activado.`));
        try { socket?.close(); } catch (e) {}
      }, requestTimeoutMs);
      const origResolve = resolve;
      connectWaiters[connectWaiters.length - 1].resolve = (v) => { clearTimeout(timer); origResolve(v); };
    });
  }

  function disconnect() {
    identified = false;
    hello = null;
    rejectAll(new Error('Cliente OBS desconectado.'));
    if (socket) {
      try { socket.close(); } catch (e) {}
      socket = null;
    }
  }

  function request(requestType, requestData = {}) {
    if (!identified || !socket) {
      const err = new Error('No hay conexión identificada con OBS: pulsa «Conectar» primero.');
      err.code = 'OBS_NOT_CONNECTED';
      return Promise.reject(err);
    }
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error(`OBS no respondió a ${requestType} en ${requestTimeoutMs} ms.`));
      }, requestTimeoutMs);
      pending.set(requestId, { resolve, reject, timer });
      socket.send(JSON.stringify({ op: OBS_OP.Request, d: { requestType, requestId, requestData } }));
    });
  }

  return {
    connect,
    disconnect,
    request,
    onEvent: (cb) => { eventListeners.add(cb); return () => eventListeners.delete(cb); },
    isIdentified: () => identified,
    getHello: () => hello,
  };
}

// --- Aprovisionamiento idempotente -----------------------------------------
// `call` es cualquier función (requestType, requestData) -> Promise<datos>;
// en producción es client.request y en los tests un cliente falso con
// estado. Correr provision() dos veces NO crea nada la segunda: antes de
// crear, lista colecciones/escenas/fuentes/ítems y solo crea lo que falta.
// config: { cameras: [{slot, deviceId, label}] (lista, 1..12 según la app),
//           cintilloUrl: 'file:///...' }
async function provisionObs(call, config = {}, { log = () => {} } = {}) {
  const created = [];
  const reused = [];
  const notes = [];

  // 1) Colección de escenas.
  let collectionFallback = false;
  let sceneName = OBS_SCENE_IN_COLLECTION;
  const collections = await call('GetSceneCollectionList');
  const collectionNames = collections?.sceneCollections || [];
  if (collectionNames.includes(OBS_COLLECTION_NAME)) {
    if (collections.currentSceneCollectionName !== OBS_COLLECTION_NAME) {
      await call('SetCurrentSceneCollection', { sceneCollectionName: OBS_COLLECTION_NAME });
      notes.push(`Colección activa cambiada a «${OBS_COLLECTION_NAME}».`);
    }
  } else {
    collectionFallback = true;
    sceneName = OBS_SCENE_FALLBACK;
    notes.push('OBS no tiene una colección «PodcastStudio» y el protocolo no permite crear colecciones: se aprovisiona en la colección actual, en la escena «PodcastStudio — Programa».');
  }

  // 2) Escena de programa.
  const sceneList = await call('GetSceneList');
  const sceneNames = (sceneList?.scenes || []).map((s) => s.sceneName);
  if (sceneNames.includes(sceneName)) {
    reused.push(`escena «${sceneName}»`);
  } else {
    await call('CreateScene', { sceneName });
    created.push(`escena «${sceneName}»`);
  }

  // 3) Fuentes existentes e ítems ya presentes en la escena.
  const inputList = await call('GetInputList');
  const inputsByName = new Map((inputList?.inputs || []).map((i) => [i.inputName, i]));
  let sceneItems = [];
  try {
    const itemsRes = await call('GetSceneItemList', { sceneName });
    sceneItems = itemsRes?.sceneItems || [];
  } catch (e) {}
  const itemSources = new Set(sceneItems.map((it) => it.sourceName));

  async function ensureInputInScene(inputName, inputKind, inputSettings) {
    if (!inputsByName.has(inputName)) {
      await call('CreateInput', { sceneName, inputName, inputKind, inputSettings, sceneItemEnabled: true });
      inputsByName.set(inputName, { inputName, inputKind });
      itemSources.add(inputName);
      created.push(`fuente «${inputName}»`);
      return true;
    }
    if (!itemSources.has(inputName)) {
      await call('CreateSceneItem', { sceneName, sourceName: inputName, sceneItemEnabled: true });
      itemSources.add(inputName);
      created.push(`ítem «${inputName}» en la escena`);
      return false;
    }
    reused.push(`fuente «${inputName}»`);
    return false;
  }

  // 4) Cámaras: LISTA de descriptores, longitud arbitraria (la app conoce
  //    hasta 12 ranuras). deviceId de la app es el identificador de
  //    getUserMedia, que NO coincide con la ruta DirectShow que OBS espera
  //    en video_device_id; por eso el dispositivo se elige enumerando los
  //    dispositivos reales de la fuente (GetInputPropertiesListPropertyItems)
  //    y emparejando por etiqueta; sin coincidencia, primer dispositivo sin
  //    usar. El mapeo que se decida queda anotado en notes.
  const cameras = Array.isArray(config.cameras) ? config.cameras : [];
  const usedDeviceIds = new Set();
  // Dispositivos ya asignados en corridas anteriores (idempotencia real).
  for (const cam of cameras) {
    const inputName = obsCameraInputName(cam.slot ?? 0);
    if (inputsByName.has(inputName)) {
      try {
        const s = await call('GetInputSettings', { inputName });
        if (s?.inputSettings?.video_device_id) usedDeviceIds.add(s.inputSettings.video_device_id);
      } catch (e) {}
    }
  }
  for (const cam of cameras) {
    const inputName = obsCameraInputName(cam.slot ?? 0);
    await ensureInputInScene(inputName, 'dshow_input', {});
    let currentSettings = {};
    try {
      const s = await call('GetInputSettings', { inputName });
      currentSettings = s?.inputSettings || {};
    } catch (e) {}
    if (currentSettings.video_device_id) {
      notes.push(`«${inputName}» ya tenía dispositivo DirectShow asignado; se conserva.`);
      continue;
    }
    let items = [];
    try {
      const res = await call('GetInputPropertiesListPropertyItems', { inputName, propertyName: 'video_device_id' });
      items = (res?.propertyItems || []).filter((it) => it.itemEnabled !== false && it.itemValue);
    } catch (e) {
      notes.push(`«${inputName}»: OBS no permitió enumerar dispositivos DirectShow (${e.message}); la fuente queda sin dispositivo y se elige a mano en OBS.`);
      continue;
    }
    if (!items.length) {
      notes.push(`«${inputName}»: OBS no reportó ningún dispositivo DirectShow disponible.`);
      continue;
    }
    const wanted = normalizeDeviceName(cam.label);
    const byLabel = items.find((it) => {
      if (usedDeviceIds.has(it.itemValue)) return false;
      const name = normalizeDeviceName(it.itemName);
      return wanted && name && (name === wanted || wanted.startsWith(name) || name.startsWith(wanted));
    });
    const chosen = byLabel || items.find((it) => !usedDeviceIds.has(it.itemValue));
    if (!chosen) {
      notes.push(`«${inputName}»: todos los dispositivos DirectShow ya están asignados a otras fuentes.`);
      continue;
    }
    usedDeviceIds.add(chosen.itemValue);
    await call('SetInputSettings', { inputName, inputSettings: { video_device_id: chosen.itemValue }, overlay: true });
    created.push(`dispositivo de «${inputName}»`);
    notes.push(`«${inputName}» → «${chosen.itemName}» (${byLabel ? 'coincide con la etiqueta que la app conoce' : 'primer dispositivo disponible sin usar'}).`);
  }

  // 5) Cintillo: fuente de navegador sobre el HTML generado por la app.
  const cintilloSettings = {
    url: config.cintilloUrl,
    width: OBS_BROWSER_WIDTH,
    height: OBS_BROWSER_HEIGHT,
    fps: 30,
  };
  const cintilloExisted = inputsByName.has(OBS_CINTILLO_INPUT_NAME);
  await ensureInputInScene(OBS_CINTILLO_INPUT_NAME, 'browser_source', cintilloSettings);
  if (cintilloExisted) {
    let currentUrl = null;
    try {
      const s = await call('GetInputSettings', { inputName: OBS_CINTILLO_INPUT_NAME });
      currentUrl = s?.inputSettings?.url || null;
    } catch (e) {}
    if (currentUrl !== config.cintilloUrl) {
      await call('SetInputSettings', { inputName: OBS_CINTILLO_INPUT_NAME, inputSettings: { url: config.cintilloUrl }, overlay: true });
      notes.push('La URL del cintillo se actualizó a la ruta actual del archivo generado.');
    }
  }

  log(`OBS provision: escena «${sceneName}», creados=${created.length}, reutilizados=${reused.length}`);
  return { sceneName, collectionFallback, created, reused, notes };
}

// --- Fachada de alto nivel (la usa electron/main.js) ------------------------
function createObsBridge({ WebSocketImpl, log = () => {}, cintilloFilePath = null, fsImpl = fs } = {}) {
  const client = createObsClient({ WebSocketImpl, log });
  const listeners = new Set();
  let lastRecordPath = null;
  let provisionResult = null;
  let lastCintillo = null;

  client.onEvent((event) => {
    if (event.eventType === 'RecordStateChanged' && event.eventData?.outputPath) {
      lastRecordPath = event.eventData.outputPath;
    }
    for (const cb of [...listeners]) {
      try { cb(event); } catch (e) {}
    }
  });

  function writeCintilloFile(cintillo) {
    lastCintillo = cintillo || null;
    if (!cintilloFilePath) return null;
    fsImpl.mkdirSync(path.dirname(cintilloFilePath), { recursive: true });
    fsImpl.writeFileSync(cintilloFilePath, renderCintilloHtml(cintillo), 'utf8');
    return toFileUrl(cintilloFilePath);
  }

  async function connect(cfg = {}) {
    await client.connect(cfg);
    return getStatus();
  }

  async function disconnect() {
    client.disconnect();
  }

  async function getStatus() {
    if (!client.isIdentified()) return { connected: false };
    const status = { connected: true };
    try {
      const v = await client.request('GetVersion');
      status.obsVersion = v.obsVersion;
      status.obsWebSocketVersion = v.obsWebSocketVersion;
    } catch (e) {}
    try {
      const r = await client.request('GetRecordStatus');
      status.recording = {
        active: Boolean(r.outputActive),
        paused: Boolean(r.outputPaused),
        durationMs: r.outputDuration ?? null,
        bytes: r.outputBytes ?? null,
      };
    } catch (e) {}
    try {
      const s = await client.request('GetStreamStatus');
      status.streaming = {
        active: Boolean(s.outputActive),
        reconnecting: Boolean(s.outputReconnecting),
        durationMs: s.outputDuration ?? null,
        bytes: s.outputBytes ?? null,
      };
    } catch (e) {}
    try {
      const scene = await client.request('GetCurrentProgramScene');
      status.currentScene = scene.currentProgramSceneName || null;
    } catch (e) {
      try {
        const list = await client.request('GetSceneList');
        status.currentScene = list.currentProgramSceneName || null;
      } catch (e2) {}
    }
    try {
      const dir = await client.request('GetRecordDirectory');
      status.recordDirectory = dir.recordDirectory || null;
    } catch (e) {}
    status.lastRecordPath = lastRecordPath;
    status.provision = provisionResult
      ? { sceneName: provisionResult.sceneName, collectionFallback: provisionResult.collectionFallback }
      : null;
    return status;
  }

  async function provision(config = {}) {
    if (!client.isIdentified()) {
      const err = new Error('Conecta con OBS antes de preparar las escenas.');
      err.code = 'OBS_NOT_CONNECTED';
      throw err;
    }
    const cintilloUrl = writeCintilloFile(config.cintillo || null) || config.cintilloUrl;
    if (!cintilloUrl) throw new Error('El puente no sabe dónde escribir el HTML del cintillo (falta cintilloFilePath).');
    provisionResult = await provisionObs((t, d) => client.request(t, d), {
      cameras: Array.isArray(config.cameras) ? config.cameras : [],
      cintilloUrl,
    }, { log });
    // El hito es una prueba de vida gobernada desde PodcastStudio: al
    // preparar, la escena aprovisionada queda como escena de programa para
    // que Grabar/Transmitir actúen sobre ella sin pasos extra en OBS.
    await client.request('SetCurrentProgramScene', { sceneName: provisionResult.sceneName });
    return { ...provisionResult, status: await getStatus() };
  }

  async function setProgramScene(name) {
    await client.request('SetCurrentProgramScene', { sceneName: name });
    return getStatus();
  }

  async function startStream(destination) {
    const settings = buildRtmpCustomSettings(destination);
    if (!settings.streamServiceSettings.key) {
      const err = new Error('El destino de Facebook no tiene clave de transmisión guardada: configúrala en el panel de Transmisión antes de emitir con OBS.');
      err.code = 'OBS_NO_STREAM_KEY';
      throw err;
    }
    await client.request('SetStreamServiceSettings', settings);
    await client.request('StartStream');
    return getStatus();
  }

  async function stopStream() {
    await client.request('StopStream');
    return getStatus();
  }

  async function startRecord() {
    await client.request('StartRecord');
    return getStatus();
  }

  async function stopRecord() {
    const res = await client.request('StopRecord');
    if (res?.outputPath) lastRecordPath = res.outputPath;
    const status = await getStatus();
    return { outputPath: res?.outputPath || lastRecordPath, status };
  }

  // Regenera el HTML del cintillo y refresca la fuente de navegador:
  // SetInputSettings con la MISMA URL + el botón oficial de la fuente
  // («refreshnocache») para forzar la recarga sin caché en OBS.
  async function updateCintillo(cintillo) {
    const url = writeCintilloFile(cintillo);
    if (!client.isIdentified() || !provisionResult || !url) {
      return { refreshed: false, reason: 'sin conexión o sin aprovisionar' };
    }
    try {
      await client.request('SetInputSettings', {
        inputName: OBS_CINTILLO_INPUT_NAME,
        inputSettings: { url },
        overlay: true,
      });
      await client.request('PressInputPropertiesButton', {
        inputName: OBS_CINTILLO_INPUT_NAME,
        propertyName: 'refreshnocache',
      });
      return { refreshed: true };
    } catch (e) {
      return { refreshed: false, reason: e.message };
    }
  }

  return {
    connect,
    disconnect,
    getStatus,
    provision,
    setProgramScene,
    startStream,
    stopStream,
    startRecord,
    stopRecord,
    updateCintillo,
    isConnected: () => client.isIdentified(),
    onEvent: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
  };
}

module.exports = {
  OBS_OP,
  EVENT_SUBSCRIPTIONS_ALL,
  OBS_COLLECTION_NAME,
  OBS_SCENE_IN_COLLECTION,
  OBS_SCENE_FALLBACK,
  OBS_CINTILLO_INPUT_NAME,
  obsCameraInputName,
  computeAuthSecret,
  computeAuthentication,
  buildRtmpCustomSettings,
  renderCintilloHtml,
  toFileUrl,
  normalizeDeviceName,
  createObsClient,
  provisionObs,
  createObsBridge,
};
