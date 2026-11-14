// ============================================================================
// Pruebas del Motor Nativo hospedado (Hito 2) — electron/native-engine.js.
//
// Qué sustituye cada sustituto (todo declarado, nada fingido):
//  - Escalera de codificadores: funciones de inspección INYECTADAS
//    (chooseEncoder recibe inspectFn). Ningún ejecutable falso: la prueba
//    es idéntica en Windows y en Linux.
//  - gst-launch-1.0 / gst-inspect-1.0 / gst-device-monitor-1.0 STUB (flujo
//    del anfitrión): scripts Node guardados como «<herramienta>.js» más el
//    archivo que locateGstTools debe encontrar: en POSIX «<herramienta>»
//    ejecutable con shebang; en Windows «<herramienta>.exe» (marcador: el
//    spawnImpl inyectado redirige esa ruta al script .js hermano vía
//    process.execPath). Los stubs POSIX con shebang y SIN extensión de la
//    primera versión de este archivo eran inejecutables en Windows: esa
//    fue la causa de los 5 fallos al aplicar la v3.1.0 en la máquina de
//    Luis (y de que un stub ausente dejara pasar la enumeración REAL).
//    - gst-launch STUB: escribe líneas a stderr, PARSEA sus argv buscando
//      location=*.mp4 y crea ese archivo con bytes > 0, y duerme hasta
//      que el anfitrión lo mata. Sustituye a la tubería real.
//    - gst-device-monitor STUB: imprime la fixture REAL de la parte (i).
//      Sustituye a la enumeración real de cámaras.
//    - gst-inspect STUB: todo elemento existe (sale con 0).
//  - ffmpeg STUB (misma técnica): ante `-i <archivo>` imprime a stderr un
//    texto tipo sonda con «Duration: 00:01:00.03» y una línea de Stream
//    de vídeo 1920x1080, y deja un marcador `<archivo>.probe-called`.
//    Sustituye a la sonda real de validación. NOTA verificada en el
//    código: validarArchivo y el oyente invocan ffmpeg a través de
//    ejecutar(), que usa el spawnImpl inyectado — el redireccionador de
//    arriba es el único punto de paso y también cubre a este stub.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  createNativeEngine,
  parseDeviceMonitorOutput,
  chooseCapsForDevice,
  chooseDevice,
  buildPipelineArgs,
  buildPreviewArgs,
  locateGstTools,
  chooseEncoder,
  capsParaStream,
  chooseAudioDevice,
  ENCODER_LADDER,
  RTMP_PRUEBA_URL,
} = require('../electron/native-engine.js');

// ---------------------------------------------------------------------------
// (i) Fixture REAL de gst-device-monitor-1.0: salida íntegra de la máquina
// de Luis (GStreamer 1.28.8.1, Windows, 2026-11-12), construida con las
// líneas VERBATIM de los bloques Steren (ambos) y EasyCamera-KS, que
// llegaron limpias, y la cabeza limpia del bloque EasyCamera-MF (sus
// primeras líneas NV12, 720p máx.). Incluye la línea contaminada por el
// stderr del proveedor NDI y las secciones «properties:» de MediaFoundation.
// String.raw: las rutas de dispositivo llevan barras invertidas literales.
// ---------------------------------------------------------------------------
const FIXTURE_MONITOR_REAL = String.raw`
Probing devices...
Device found:
	name  : EasyCamera
	class : Video/Source
	caps  : image/jpeg, width=1280, height=720, framerate=30/1, pixel-aspect-ratio=1/1
	        image/jpeg, width=800, height=600, framerate=30/1, pixel-aspect-ratio=1/1
	        image/jpeg, width=640, height=480, framerate=30/1, pixel-aspect-ratio=1/1
	        image/jpeg, width=320, height=240, framerate=30/1, pixel-aspect-ratio=1/1
	        image/jpeg, width=160, height=120, framerate=30/1, pixel-aspect-ratio=1/1
	        image/jpeg, width=640, height=360, framerate=30/10:00:01.398878900       1492      23900 ERROR      ndideviceprovider net\ndi\src\device_provider\imp.rs:76:<gstndi::device_provider::imp::DeviceProvider as gstreamer::subclass::device_provider::imp::start:<ndideviceprovider0> Failed loading NDI SDK
, pixel-aspect-ratio=1/1
	        video/x-raw, format=YUY2, width=1280, height=720, framerate=10/1, pixel-aspect-ratio=1/1
	        video/x-raw, format=YUY2, width=800, height=600, framerate=15/1, pixel-aspect-ratio=1/1
	        video/x-raw, format=YUY2, width=640, height=480, framerate=30/1, pixel-aspect-ratio=1/1
	        video/x-raw, format=YUY2, width=320, height=240, framerate=30/1, pixel-aspect-ratio=1/1
	        video/x-raw, format=YUY2, width=160, height=120, framerate=30/1, pixel-aspect-ratio=1/1
	        video/x-raw, format=YUY2, width=640, height=360, framerate=30/1, pixel-aspect-ratio=1/1
** (gst-device-monitor-1.0:1492): WARNING **: 14:28:53.142: "ksvideosrc" is deprecated and will be removedin the future. Use "mfvideosrc" element instead
	gst-launch-1.0 ksvideosrc device-path='\\?\usb#vid_04f2&pid_b57e&mi_00#6&819aaaa&0&0000#{6994ad05-93ef-11d0-a3cc-00a0c9223196}\global' ! ...
Device found:
	name  : Steren COM-126
	class : Video/Source
	caps  : image/jpeg, width=1920, height=1080, framerate=30/1, pixel-aspect-ratio=1/1
	        image/jpeg, width=1280, height=720, framerate=30/1, pixel-aspect-ratio=1/1
	        image/jpeg, width=1024, height=768, framerate=30/1, pixel-aspect-ratio=1/1
	        image/jpeg, width=800, height=600, framerate=30/1, pixel-aspect-ratio=1/1
	        image/jpeg, width=640, height=480, framerate=30/1, pixel-aspect-ratio=1/1
	        image/jpeg, width=320, height=240, framerate=30/1, pixel-aspect-ratio=1/1
	        video/x-raw, format=YUY2, width=1920, height=1080, framerate=5/1, pixel-aspect-ratio=1/1
	        video/x-raw, format=YUY2, width=1280, height=720, framerate=10/1, pixel-aspect-ratio=1/1
	        video/x-raw, format=YUY2, width=800, height=600, framerate=20/1, pixel-aspect-ratio=1/1
	        video/x-raw, format=YUY2, width=640, height=480, framerate=30/1, pixel-aspect-ratio=1/1
	        video/x-raw, format=YUY2, width=320, height=240, framerate=30/1, pixel-aspect-ratio=1/1
	gst-launch-1.0 ksvideosrc device-path='\\?\usb#vid_09da&pid_2704&mi_00#6&e81ca4b&0&0000#{6994ad05-93ef-11d0-a3cc-00a0c9223196}\global' ! ...
Device found:
	name  : Steren COM-126
	class : Source/Video
	caps  : video/x-raw, format=NV12, width=1920, height=1080, framerate=30/1, pixel-aspect-ratio=1/1, colorimetry=1:4:0:1
	        video/x-raw, format=NV12, width=1280, height=720, framerate=30/1, pixel-aspect-ratio=1/1, colorimetry=1:4:0:1
	        video/x-raw, format=NV12, width=1024, height=768, framerate=30/1, pixel-aspect-ratio=1/1, colorimetry=1:4:0:1
	        video/x-raw, format=NV12, width=800, height=600, framerate=30/1, pixel-aspect-ratio=1/1, colorimetry=1:4:0:1
	        video/x-raw, format=NV12, width=640, height=480, framerate=30/1, pixel-aspect-ratio=1/1, colorimetry=1:4:0:1
	        video/x-raw, format=NV12, width=320, height=240, framerate=30/1, pixel-aspect-ratio=1/1, colorimetry=1:4:0:1
	        video/x-raw, format=YUY2, width=1920, height=1080, framerate=5/1, pixel-aspect-ratio=1/1, colorimetry=2:4:0:1, chroma-site=dv
	        video/x-raw, format=YUY2, width=1280, height=720, framerate=10/1, pixel-aspect-ratio=1/1, colorimetry=2:4:0:1, chroma-site=dv
	        video/x-raw, format=YUY2, width=800, height=600, framerate=20/1, pixel-aspect-ratio=1/1, colorimetry=2:4:0:1, chroma-site=dv
	        video/x-raw, format=YUY2, width=640, height=480, framerate=30/1, pixel-aspect-ratio=1/1, colorimetry=2:4:0:1, chroma-site=dv
	        video/x-raw, format=YUY2, width=320, height=240, framerate=30/1, pixel-aspect-ratio=1/1, colorimetry=2:4:0:1, chroma-site=dv
	        image/jpeg, width=1920, height=1080, framerate=30/1, pixel-aspect-ratio=1/1, colorimetry=1:4:0:1
	        image/jpeg, width=1280, height=720, framerate=30/1, pixel-aspect-ratio=1/1, colorimetry=1:4:0:1
	        image/jpeg, width=1024, height=768, framerate=30/1, pixel-aspect-ratio=1/1, colorimetry=1:4:0:1
	        image/jpeg, width=800, height=600, framerate=30/1, pixel-aspect-ratio=1/1, colorimetry=1:4:0:1
	        image/jpeg, width=640, height=480, framerate=30/1, pixel-aspect-ratio=1/1, colorimetry=1:4:0:1
	        image/jpeg, width=320, height=240, framerate=30/1, pixel-aspect-ratio=1/1, colorimetry=1:4:0:1
	properties:
		device.api = mediafoundation
		device.path = \\?\usb#vid_09da&pid_2704&mi_00#6&e81ca4b&0&0000#{e5323777-f976-4f5b-9b55-b94699c46e44}\global
		device.name = Steren COM-126
	gst-launch-1.0 mfvideosrc device-path='\\?\usb#vid_09da&pid_2704&mi_00#6&e81ca4b&0&0000#{e5323777-f976-4f5b-9b55-b94699c46e44}\global' ! ...
Device found:
	name  : EasyCamera
	class : Source/Video
	caps  : video/x-raw, format=NV12, width=1280, height=720, framerate=30/1, pixel-aspect-ratio=1/1, colorimetry=1:4:0:1
	        video/x-raw, format=NV12, width=800, height=600, framerate=30/1, pixel-aspect-ratio=1/1, colorimetry=1:4:0:1
	        video/x-raw, format=NV12, width=640, height=480, framerate=30/1, pixel-aspect-ratio=1/1, colorimetry=1:4:0:1
	properties:
		device.api = mediafoundation
		device.path = \\?\usb#vid_04f2&pid_b57e&mi_00#6&819aaaa&0&0000#{e5323777-f976-4f5b-9b55-b94699c46e44}\global
		device.name = EasyCamera
	gst-launch-1.0 mfvideosrc device-path='\\?\usb#vid_04f2&pid_b57e&mi_00#6&819aaaa&0&0000#{e5323777-f976-4f5b-9b55-b94699c46e44}\global' ! ...
`;

test('monitor real: se parsean los 4 dispositivos y las entradas MF traen device.path y api', () => {
  const dispositivos = parseDeviceMonitorOutput(FIXTURE_MONITOR_REAL);
  assert.equal(dispositivos.length, 4);
  assert.deepEqual(dispositivos.map((d) => `${d.name}|${d.class}`), [
    'EasyCamera|Video/Source',
    'Steren COM-126|Video/Source',
    'Steren COM-126|Source/Video',
    'EasyCamera|Source/Video',
  ]);
  const sterenMF = dispositivos[2];
  assert.ok(String(sterenMF.devicePath || '').includes('vid_09da&pid_2704'));
  assert.equal(sterenMF.api, 'mediafoundation');
  const easyMF = dispositivos[3];
  assert.ok(String(easyMF.devicePath || '').includes('vid_04f2&pid_b57e'));
  assert.equal(easyMF.api, 'mediafoundation');
  // Las entradas KS no declaran properties: sin devicePath parseado.
  assert.equal(dispositivos[0].devicePath, null);
  assert.equal(dispositivos[1].devicePath, null);
});

test('v3.2.3 · monitor real: el deviceIndex es la posición dentro de la clase MF (Steren MF = 0, EasyCamera MF = 1)', () => {
  const dispositivos = parseDeviceMonitorOutput(FIXTURE_MONITOR_REAL);
  const sterenMF = dispositivos.find((d) => d.name === 'Steren COM-126' && d.class === 'Source/Video');
  const easyMF = dispositivos.find((d) => d.name === 'EasyCamera' && d.class === 'Source/Video');
  // El monitor imprime la Steren MF antes que la EasyCamera MF: índices
  // 0 y 1 DENTRO de la clase MediaFoundation. El 0 de la Steren es el
  // device-index=0 con el que la Prueba B del Hito 1 la abrió con éxito;
  // con la numeración global anterior la Steren MF quedaba en 2.
  assert.equal(sterenMF.deviceIndex, 0);
  assert.equal(easyMF.deviceIndex, 1);
  // Las entradas KS no son direccionables por índice MF: null.
  for (const d of dispositivos.filter((x) => x.class === 'Video/Source')) {
    assert.equal(d.deviceIndex, null);
  }
});

test('monitor real: sin nombre se elige la Steren MF; por nombre se prefiere la entrada MF', () => {
  const dispositivos = parseDeviceMonitorOutput(FIXTURE_MONITOR_REAL);
  const porDefecto = chooseDevice(dispositivos, null);
  assert.equal(porDefecto.name, 'Steren COM-126');
  assert.equal(porDefecto.class, 'Source/Video');
  assert.ok(porDefecto.devicePath);
  const steren = chooseDevice(dispositivos, 'Steren COM-126');
  assert.equal(steren.class, 'Source/Video');
  assert.ok(steren.devicePath);
  const easy = chooseDevice(dispositivos, 'EasyCamera');
  assert.equal(easy.name, 'EasyCamera');
  assert.equal(easy.class, 'Source/Video');
  assert.ok(String(easy.devicePath || '').includes('vid_04f2&pid_b57e'));
});

test('monitor real: caps elegidos NV12 y la línea contaminada no produce basura', () => {
  const dispositivos = parseDeviceMonitorOutput(FIXTURE_MONITOR_REAL);
  const sterenMF = dispositivos.find((d) => d.name === 'Steren COM-126' && d.class === 'Source/Video');
  const capsSteren = chooseCapsForDevice(sterenMF);
  assert.equal(capsSteren.format, 'NV12');
  assert.equal(capsSteren.width, 1920);
  assert.equal(capsSteren.height, 1080);
  assert.equal(capsSteren.framerate, 30);
  const easyMF = dispositivos.find((d) => d.name === 'EasyCamera' && d.class === 'Source/Video');
  const capsEasy = chooseCapsForDevice(easyMF);
  assert.equal(capsEasy.format, 'NV12');
  assert.equal(capsEasy.width, 1280);
  assert.equal(capsEasy.height, 720);
  assert.equal(capsEasy.framerate, 30);
  // La línea contaminada por el stderr de NDI («framerate=30/1» pegado a la
  // marca de tiempo) NO debe producir ningún caps con framerate 3 (30/10),
  // y el jpeg 640x360 de esa línea no debe existir en la EasyCamera KS.
  for (const d of dispositivos) {
    for (const c of d.caps) assert.notEqual(c.framerate, 3);
  }
  const easyKS = dispositivos.find((d) => d.name === 'EasyCamera' && d.class === 'Video/Source');
  assert.equal(easyKS.caps.some((c) => c.raw.startsWith('image/jpeg') && c.width === 640 && c.height === 360), false);
});

// ---------------------------------------------------------------------------
// (i-bis) Fixture HEREDADA con la sintaxis tipada de GstCaps
// (format=(string)…, width=(int)…): el parser debe seguir aceptándola.
// ---------------------------------------------------------------------------
const FIXTURE_MONITOR = `
Probing devices...

Device found:

    name  : EasyCamera
    class : Video/Source
    caps  : video/x-raw, format=(string)YUY2, width=(int)640, height=(int)480, framerate=(fraction)30/1, pixel-aspect-ratio=(fraction)1/1;
            video/x-raw, format=(string)YUY2, width=(int)1280, height=(int)720, framerate=(fraction)30/1, pixel-aspect-ratio=(fraction)1/1;
    properties:
        device-path = \\\\?\\usb#vid_04f2&pid_b57e#easycamera

Device found:

    name  : Steren COM-126
    class : Video/Source
    caps  : video/x-raw, format=(string)YUY2, width=(int)640, height=(int)480, framerate=(fraction)30/1, pixel-aspect-ratio=(fraction)1/1;
            video/x-raw, format=(string)YUY2, width=(int)1280, height=(int)720, framerate=(fraction)30/1, pixel-aspect-ratio=(fraction)1/1;
            video/x-raw, format=(string)YUY2, width=(int)1920, height=(int)1080, framerate=(fraction)30/1, pixel-aspect-ratio=(fraction)1/1;
            video/x-raw, format=(string)MJPG, width=(int)1920, height=(int)1080, framerate=(fraction)30/1, pixel-aspect-ratio=(fraction)1/1;
    properties:
        device-path = \\\\?\\usb#vid_0c45&pid_636b#steren

`;

test('monitor: el parser encuentra ambos dispositivos', () => {
  const dispositivos = parseDeviceMonitorOutput(FIXTURE_MONITOR);
  assert.equal(dispositivos.length, 2);
  assert.equal(dispositivos[0].name, 'EasyCamera');
  assert.equal(dispositivos[1].name, 'Steren COM-126');
  // v3.2.3: deviceIndex es la posición dentro de la clase MediaFoundation
  // («Source/Video»); estas entradas son KS («Video/Source»): null.
  assert.equal(dispositivos[0].deviceIndex, null);
  assert.equal(dispositivos[1].deviceIndex, null);
  assert.ok(dispositivos[0].caps.length >= 2);
  assert.ok(dispositivos[1].caps.length >= 4);
  assert.ok(String(dispositivos[1].devicePath || '').includes('usb'));
});

test('monitor: eligiendo por nombre «Steren COM-126» el caps es 1920x1080@30', () => {
  const dispositivos = parseDeviceMonitorOutput(FIXTURE_MONITOR);
  const elegida = chooseDevice(dispositivos, 'Steren COM-126');
  assert.equal(elegida.name, 'Steren COM-126');
  const caps = chooseCapsForDevice(elegida);
  assert.equal(caps.width, 1920);
  assert.equal(caps.height, 1080);
  assert.equal(caps.framerate, 30);
});

test('monitor: sin nombre se elige la cámara que alcanza 1920x1080 (la Steren)', () => {
  const dispositivos = parseDeviceMonitorOutput(FIXTURE_MONITOR);
  const elegida = chooseDevice(dispositivos, null);
  assert.equal(elegida.name, 'Steren COM-126');
  const caps = chooseCapsForDevice(elegida);
  assert.equal(caps.width, 1920);
  assert.equal(caps.height, 1080);
});

// ---------------------------------------------------------------------------
// (ii) buildPipelineArgs para preview / record / recordStream.
// ---------------------------------------------------------------------------
const CAPS_1080 = { raw: 'video/x-raw, format=(string)YUY2, width=(int)1920, height=(int)1080, framerate=(fraction)30/1', format: 'YUY2', width: 1920, height: 1080, framerate: 30 };

function argsDe(session, extra = {}) {
  return buildPipelineArgs({
    session,
    deviceIndex: 1,
    devicePath: '\\\\?\\usb#vid_0c45#steren',
    caps: CAPS_1080,
    encoder: 'nvh264enc',
    withPreset: true,
    withAudio: session !== 'preview',
    outFile: 'C:\\grabaciones\\PodcastStudio_motor_20261112_120000.mp4',
    ...extra,
  });
}

test('tubería: preview (buildPipelineArgs) contiene compositor y su rama va a fakesink, sin rtmp (v3.2.1: sin caps forzado; v3.3.6: sin ventana)', () => {
  const unida = argsDe('preview').join(' ');
  assert.ok(unida.includes('d3d11compositor'));
  // v3.3.6: la rama de buildPipelineArgs ya no abre ventana (fakesink);
  // la vista previa independiente con d3d11videosink es buildPreviewArgs.
  assert.ok(unida.includes('fakesink'));
  assert.ok(!unida.includes('d3d11videosink'));
  // v3.2.1: el caps forzado del Hito 2 (colorimetry=bt709 con
  // memory:D3D11Memory entre el compositor y el tee) rompió en vivo el
  // enlace al codificador; la forma vigente es la probada del Hito 1 B.
  assert.ok(!unida.includes('colorimetry=bt709'));
  assert.ok(!unida.includes('memory:D3D11Memory'));
  assert.ok(unida.includes('1920'));
  assert.ok(!unida.includes('rtmpsink'));
  assert.ok(!unida.includes('fragment-duration=2000'));
});

test('tubería: record contiene preset=hq, bitrate=12000 y MP4 fragmentado', () => {
  const tokens = argsDe('record');
  const unida = tokens.join(' ');
  assert.ok(unida.includes('d3d11compositor'));
  assert.ok(unida.includes('fakesink'));
  assert.ok(!unida.includes('colorimetry=bt709'));
  assert.ok(!unida.includes('memory:D3D11Memory'));
  assert.ok(unida.includes('preset=hq'));
  assert.ok(unida.includes('bitrate=12000'));
  assert.ok(unida.includes('fragment-duration=2000'));
  assert.ok(!unida.includes('rtmpsink'));
  const loc = tokens.find((t) => t.startsWith('location='));
  assert.ok(loc, 'debe haber token location=');
  assert.ok(!loc.includes('\\'), `location sin barras invertidas: ${loc}`);
  assert.ok(loc.includes('/'));
});

test('tubería: recordStream contiene el tee tras h264parse y el destino local SOLO ahí', () => {
  const unida = argsDe('recordStream').join(' ');
  assert.ok(unida.includes('name=tenc'));
  assert.ok(unida.includes('rtmpsink'));
  assert.ok(unida.includes('rtmp://127.0.0.1:1935/live/prueba'));
  assert.ok(unida.includes('fragment-duration=2000'));
  assert.ok(unida.includes('preset=hq'));
  assert.ok(unida.includes('bitrate=12000'));
  // El tee tenc va DESPUÉS de h264parse.
  assert.ok(unida.indexOf('h264parse') < unida.indexOf('name=tenc'));
});

test('v3.2.3 · tubería: con índice MF válido la apertura es device-index aunque haya device-path', () => {
  // argsDe pasa deviceIndex 1 Y devicePath: desde la v3.2.3 manda el
  // índice (la forma probada del Hito 1 B); la ruta ya no es la principal.
  const tokens = argsDe('preview');
  assert.equal(tokens.addressingMode, 'device-index');
  assert.equal(tokens.usedDeviceIndexFallback, false);
  assert.ok(tokens.includes('device-index=1'));
  assert.ok(!tokens.some((t) => t.startsWith('device-path=')));
});

test('v3.2.3 · tubería: solo índice (sin device-path) abre por ese índice sin marca de respaldo', () => {
  const tokens = buildPipelineArgs({ session: 'preview', deviceIndex: 2, devicePath: null, caps: CAPS_1080, encoder: 'nvh264enc' });
  assert.equal(tokens.addressingMode, 'device-index');
  assert.equal(tokens.usedDeviceIndexFallback, false);
  assert.ok(tokens.join(' ').includes('device-index=2'));
});

test('v3.2.3 · tubería: device-path solo aparece sin índice válido (respaldo) y el respaldo queda marcado', () => {
  const sinIndice = buildPipelineArgs({ session: 'preview', deviceIndex: null, devicePath: '\\\\?\\usb#vid_0c45#steren', caps: CAPS_1080, encoder: 'nvh264enc' });
  assert.equal(sinIndice.addressingMode, 'device-path');
  assert.equal(sinIndice.usedDeviceIndexFallback, true);
  assert.ok(sinIndice.some((t) => t.startsWith('device-path=')));
  // Sin índice ni ruta: índice 0 por defecto (la forma del Hito 1 B),
  // marcado como respaldo porque no es el índice parseado del dispositivo.
  const sinNada = buildPipelineArgs({ session: 'preview', deviceIndex: null, devicePath: null, caps: CAPS_1080, encoder: 'nvh264enc' });
  assert.equal(sinNada.addressingMode, 'device-index');
  assert.equal(sinNada.usedDeviceIndexFallback, true);
  assert.ok(sinNada.includes('device-index=0'));
});

test('v3.2.3 · tubería: el modo forzado (reintento) manda sobre el primario solo si el dato existe', () => {
  const forzadoPath = buildPipelineArgs({ session: 'preview', deviceIndex: 0, devicePath: 'RUTA', caps: CAPS_1080, encoder: 'nvh264enc', addressingMode: 'device-path' });
  assert.equal(forzadoPath.addressingMode, 'device-path');
  assert.ok(forzadoPath.includes('device-path=RUTA'));
  const forzadoIndice = buildPipelineArgs({ session: 'preview', deviceIndex: 3, devicePath: 'RUTA', caps: CAPS_1080, encoder: 'nvh264enc', addressingMode: 'device-index' });
  assert.equal(forzadoIndice.addressingMode, 'device-index');
  assert.ok(forzadoIndice.includes('device-index=3'));
  // Forzar device-path sin ruta no inventa nada: manda la lógica primaria.
  const forzadoImposible = buildPipelineArgs({ session: 'preview', deviceIndex: 3, devicePath: null, caps: CAPS_1080, encoder: 'nvh264enc', addressingMode: 'device-path' });
  assert.equal(forzadoImposible.addressingMode, 'device-index');
  assert.ok(forzadoImposible.includes('device-index=3'));
});

// ---------------------------------------------------------------------------
// (iii) Escalera de codificadores con funciones de inspección INYECTADAS.
// ---------------------------------------------------------------------------
test('escalera: con solo qsvh264enc y mfh264enc presentes elige qsvh264enc', async () => {
  const presentes = ['qsvh264enc', 'mfh264enc', 'x264enc'];
  const elegido = await chooseEncoder(async (el) => presentes.includes(el));
  assert.equal(elegido, 'qsvh264enc');
});

test('escalera: sin hardware elige x264enc', async () => {
  const elegido = await chooseEncoder(async (el) => el === 'x264enc');
  assert.equal(elegido, 'x264enc');
});

test('escalera: con nvh264enc presente elige nvh264enc y la escalera está ordenada', async () => {
  const presentes = ['nvh264enc', 'qsvh264enc', 'mfh264enc', 'x264enc'];
  const elegido = await chooseEncoder(async (el) => presentes.includes(el));
  assert.equal(elegido, 'nvh264enc');
  assert.deepEqual(ENCODER_LADDER, ['nvh264enc', 'qsvh264enc', 'mfh264enc', 'x264enc']);
});

test('localización: PODCASTUDIO_GST_BIN gana y devuelve las tres herramientas', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podcastudio-gst-bin-'));
  // locateGstTools exige la extensión de la plataforma (.exe en Windows):
  // los archivos se crean CON ella, como los reales de GStreamer.
  const ext = process.platform === 'win32' ? '.exe' : '';
  for (const nombre of ['gst-launch-1.0', 'gst-inspect-1.0', 'gst-device-monitor-1.0']) {
    fs.writeFileSync(path.join(dir, nombre + ext), '');
  }
  const tools = locateGstTools({ env: { PODCASTUDIO_GST_BIN: dir, PATH: '' }, platform: process.platform, fsExists: (p) => fs.existsSync(p), log: () => {} });
  assert.ok(tools);
  assert.equal(tools.launch, path.join(dir, `gst-launch-1.0${ext}`));
  assert.equal(tools.monitor, path.join(dir, `gst-device-monitor-1.0${ext}`));
});

// ---------------------------------------------------------------------------
// (iv) Flujo del anfitrión con stubs multiplataforma.
// ---------------------------------------------------------------------------
const EXT_HERRAMIENTA = process.platform === 'win32' ? '.exe' : '';

// Escribe una herramienta stub y devuelve la ruta que el motor localiza:
// el script Node vive en «<nombre>.js»; en POSIX «<nombre>» es el mismo
// script ejecutable con shebang; en Windows «<nombre>.exe» es un marcador
// vacío que el spawnImpl redirige al .js (ver crearSpawnParaStubs).
function escribirHerramientaStub(dir, nombre, cuerpoJs) {
  fs.writeFileSync(path.join(dir, `${nombre}.js`), cuerpoJs);
  const ruta = path.join(dir, nombre + EXT_HERRAMIENTA);
  if (process.platform === 'win32') {
    fs.writeFileSync(ruta, '');
  } else {
    fs.writeFileSync(ruta, cuerpoJs);
    fs.chmodSync(ruta, 0o755);
  }
  return ruta;
}

// spawnImpl hermético: en Windows, cualquier ruta dentro del directorio de
// stubs se ejecuta como script Node (process.execPath + el .js hermano);
// el resto de comandos (p. ej. taskkill) pasa tal cual. En POSIX devuelve
// el spawn real sin tocar nada.
function crearSpawnParaStubs(dir, spawnReal) {
  return (cmd, args, opts) => {
    if (process.platform === 'win32' && typeof cmd === 'string' && cmd.startsWith(dir + path.sep)) {
      const comoJs = cmd.endsWith('.js') ? cmd : `${cmd.replace(/\.exe$/i, '')}.js`;
      if (fs.existsSync(comoJs)) return spawnReal(process.execPath, [comoJs, ...(args || [])], opts);
    }
    return spawnReal(cmd, args, opts);
  };
}

test('anfitrión: start(record) llega a grabando y stop() valida con la sonda stub', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podcastudio-motor-stub-'));
  const outDir = path.join(dir, 'salida');
  fs.mkdirSync(outDir, { recursive: true });

  // gst-launch-1.0 STUB: crea el MP4 nombrado en sus argv y duerme.
  escribirHerramientaStub(dir, 'gst-launch-1.0', `#!/usr/bin/env node
const fs = require('node:fs');
process.stderr.write('Setting pipeline to PAUSED ...\\n');
process.stderr.write('Pipeline is PREROLLING ...\\n');
for (const a of process.argv.slice(2)) {
  if (a.startsWith('location=') && a.endsWith('.mp4')) {
    const ruta = a.slice('location='.length);
    fs.writeFileSync(ruta, Buffer.alloc(4096, 7));
  }
}
setInterval(() => {}, 1000);
`);
  // gst-inspect-1.0 STUB: todo elemento existe.
  escribirHerramientaStub(dir, 'gst-inspect-1.0', `#!/usr/bin/env node
process.exit(0);
`);
  // gst-device-monitor-1.0 STUB: imprime la fixture REAL de la parte (i).
  const fixtureEscapado = JSON.stringify(FIXTURE_MONITOR_REAL);
  escribirHerramientaStub(dir, 'gst-device-monitor-1.0', `#!/usr/bin/env node
process.stdout.write(${fixtureEscapado});
`);
  // ffmpeg STUB: sonda con duración 60.03 y vídeo 1920x1080 + marcador.
  const ffmpegStub = escribirHerramientaStub(dir, 'ffmpeg-stub', `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const i = args.indexOf('-i');
const archivo = i >= 0 ? args[i + 1] : null;
if (archivo) {
  try { fs.writeFileSync(archivo + '.probe-called', 'sonda invocada\\n'); } catch (e) {}
  process.stderr.write('Input #0, mov,mp4,m4a,3gp,3g2,mj2, from \\'' + archivo + '\\':\\n');
  process.stderr.write('  Duration: 00:01:00.03, start: 0.000000, bitrate: 12000 kb/s\\n');
  process.stderr.write('  Stream #0:0: Video: h264 (High), yuv420p, 1920x1080, 30 fps\\n');
}
process.exit(0);
`);

  const estados = [];
  const engine = createNativeEngine({
    ffmpegPath: ffmpegStub,
    log: () => {},
    onState: (s) => estados.push(s),
    env: { ...process.env, PODCASTUDIO_GST_BIN: dir, PATH: process.env.PATH || '' },
    platform: process.platform,
    fsExists: (p) => fs.existsSync(p),
    spawnImpl: crearSpawnParaStubs(dir, spawn),
  });

  let outFile = null;
  try {
    const r1 = await engine.start('record', { outDir });
    assert.equal(r1.success, true, JSON.stringify(r1));
    assert.equal(engine.getState().phase, 'grabando');
    assert.equal(engine.getState().encoder, 'nvh264enc');
    // Hermeticidad: la cámara elegida sale de la fixture del stub (la
    // Steren MF), NUNCA de una instalación real que hubiera en la máquina.
    assert.equal(engine.getState().cameraName, 'Steren COM-126');
    assert.equal(engine.getState().caps.width, 1920);
    assert.equal(engine.getState().caps.height, 1080);
    assert.equal(engine.getState().caps.format, 'NV12');
    outFile = engine.getState().outFile;
    assert.ok(outFile && outFile.endsWith('.mp4'));
    // El stub de gst-launch es un proceso Node que tarda unos ms en
    // arrancar y crear el MP4: se sondea su aparición (hasta 5 s) en vez
    // de afirmar en el mismo tick (carrera real, vista al probar).
    let existe = false;
    for (let i = 0; i < 50 && !existe; i += 1) {
      existe = fs.existsSync(outFile);
      if (!existe) await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(existe, 'el stub de gst-launch debió crear el MP4 nombrado en sus argv');

    // Un segundo start con sesión activa debe rechazarse.
    const rDup = await engine.start('record', { outDir });
    assert.equal(rDup.success, false);

    const rStop = await engine.stop();
    assert.equal(rStop.success, true);
    const final = engine.getState();
    assert.equal(final.phase, 'apagado');
    assert.ok(final.validation, 'la validación debe existir tras detener');
    // La duración 60.03 SOLO puede venir del texto del stub de ffmpeg:
    // prueba que la sonda fue invocada y su salida parseada.
    assert.equal(final.validation.durationSec, 60.03);
    assert.equal(final.validation.width, 1920);
    assert.equal(final.validation.height, 1080);
    assert.equal(final.validation.valid, true);
    assert.ok(fs.existsSync(outFile + '.probe-called'), 'el marcador de la sonda stub debe existir');
  } finally {
    // Pase lo que pase, el anfitrión se detiene: un stub de gst-launch
    // vivo mantendría abierto el proceso de pruebas (visto al probar).
    try { await engine.stop(); } catch (e) {}
  }
});

// ---------------------------------------------------------------------------
// (v) Fixtures SINTÉTICAS de resolución (declaradas: NO son salidas reales;
// Luis aún no tiene cámara 4K). El motor negocia el mejor formato de
// cualquier cámara entre 1080p y 4K y el bitrate escala con la resolución.
// ---------------------------------------------------------------------------
function capsCrudo(format, width, height, framerate) {
  return {
    raw: `video/x-raw, format=${format}, width=${width}, height=${height}, framerate=${framerate}/1`,
    format, width, height, framerate,
  };
}

test('sintética 4K: se elige 3840x2160@30 NV12 y la tubería graba con bitrate=40000', () => {
  const camara4K = {
    name: 'Cámara 4K sintética',
    caps: [capsCrudo('NV12', 1920, 1080, 30), capsCrudo('NV12', 3840, 2160, 30)],
  };
  const caps = chooseCapsForDevice(camara4K);
  assert.equal(caps.width, 3840);
  assert.equal(caps.height, 2160);
  assert.equal(caps.framerate, 30);
  assert.equal(caps.format, 'NV12');
  const unida = buildPipelineArgs({
    session: 'record', deviceIndex: 0, devicePath: 'sintetico-4k', caps,
    encoder: 'nvh264enc', withPreset: true, withAudio: false, outFile: 'C:\\x\\grabar.mp4',
  }).join(' ');
  assert.ok(unida.includes('width=3840'));
  assert.ok(unida.includes('height=2160'));
  assert.ok(unida.includes('preset=hq'));
  assert.ok(unida.includes('bitrate=40000'));
});

test('sintética 1440p: el mejor caps es 2560x1440@30 y la tubería graba con bitrate=20000', () => {
  const camara1440 = {
    name: 'Cámara 1440p sintética',
    caps: [capsCrudo('NV12', 1920, 1080, 30), capsCrudo('NV12', 2560, 1440, 30)],
  };
  const caps = chooseCapsForDevice(camara1440);
  assert.equal(caps.width, 2560);
  assert.equal(caps.height, 1440);
  const unida = buildPipelineArgs({
    session: 'record', deviceIndex: 0, devicePath: 'sintetico-1440', caps,
    encoder: 'nvh264enc', withPreset: true, withAudio: false, outFile: 'C:\\x\\grabar.mp4',
  }).join(' ');
  assert.ok(unida.includes('bitrate=20000'));
});

// ---------------------------------------------------------------------------
// (vi) HITO 3 (v3.2.0): destinos reales, tope 1080 del stream, regla de
// audio y nombre del máster. Las URL de destino son FICTICIAS (fixtures
// declaradas, no son claves reales) y la fixture de audio es SINTÉTICA
// con la forma de la salida real del monitor (clases Audio/Source y
// properties con device.id, como imprime WASAPI2 en Windows).
// ---------------------------------------------------------------------------
const URL_FB_PRUEBA = 'rtmps://live-api-s.facebook.com:443/rtmp/FB-CLAVE-DE-PRUEBA';
const URL_YT_PRUEBA = 'rtmps://a.upload.youtube.com/live2/CLAVE-DE-PRUEBA-2';
const CAPS_4K = { raw: 'video/x-raw, format=(string)NV12, width=(int)3840, height=(int)2160, framerate=(fraction)30/1', format: 'NV12', width: 3840, height: 2160, framerate: 30 };

test('Hito 3 · tubería: recordStream con 2 destinos reales crea 2 ramas rtmpsink con las URL verbatim', () => {
  const tokens = argsDe('recordStream', { streamUrls: [URL_FB_PRUEBA, URL_YT_PRUEBA] });
  const unida = tokens.join(' ');
  assert.equal(tokens.filter((t) => t === 'rtmpsink').length, 2);
  // Cada URL es UN token argv exacto (spawn por array, sin shell).
  assert.ok(tokens.includes(`location=${URL_FB_PRUEBA}`));
  assert.ok(tokens.includes(`location=${URL_YT_PRUEBA}`));
  // Con destinos reales NO aparece la URL local de prueba.
  assert.ok(!unida.includes(RTMP_PRUEBA_URL));
  assert.ok(tokens.includes('name=flv0'));
  assert.ok(tokens.includes('name=flv1'));
  // El audio se reparte al MP4 y a CADA flvmux.
  assert.ok(tokens.includes('mp4.'));
  assert.ok(tokens.includes('flv0.'));
  assert.ok(tokens.includes('flv1.'));
});

test('Hito 3 · tubería: la sesión stream transmite sin grabar', () => {
  const tokens = argsDe('stream', { streamUrls: [URL_FB_PRUEBA] });
  assert.equal(tokens.filter((t) => t === 'rtmpsink').length, 1);
  assert.ok(tokens.includes(`location=${URL_FB_PRUEBA}`));
  assert.ok(!tokens.includes('mp4mux'), 'stream no debe llevar rama de grabación');
  assert.ok(!tokens.includes('mp4.'), 'sin grabación, el audio no va a ningún mp4');
  assert.ok(tokens.includes('flv0.'));
  assert.ok(tokens.includes('fakesink'), 'la rama de sesión va a fakesink (v3.3.6: la sesión no abre ventana)');
});

test('Hito 3 · tubería: recordStream SIN destinos conserva la prueba local del Hito 2', () => {
  const tokens = argsDe('recordStream');
  const unida = tokens.join(' ');
  assert.equal(tokens.filter((t) => t === 'rtmpsink').length, 1);
  assert.ok(unida.includes(RTMP_PRUEBA_URL));
  assert.ok(tokens.includes('name=flv'));
  assert.ok(!tokens.includes('name=flv0'));
});

test('Hito 3 · tubería: con caps 4K el stream baja a 1920×1080 con su propio codificador y la grabación queda en 4K', () => {
  const tokens = argsDe('recordStream', { caps: CAPS_4K, streamUrls: [URL_FB_PRUEBA] });
  const unida = tokens.join(' ');
  // DOS codificadores: el de grabación (4K, 40 Mbps) y el del stream.
  assert.equal(tokens.filter((t) => t === 'nvh264enc').length, 2);
  assert.ok(unida.includes('bitrate=40000'), 'la grabación conserva el bitrate de 4K');
  assert.ok(unida.includes('bitrate=12000'), 'el stream usa el bitrate del peldaño 1080');
  assert.ok(tokens.some((t) => t.includes('width=1920,height=1080')), 'la rama de stream lleva el caps de bajada a 1080');
  assert.ok(tokens.includes('mp4mux'), 'la grabación sigue presente');
});

test('Hito 3 · tubería: la sesión stream con caps 4K solo codifica el peldaño 1080', () => {
  const tokens = argsDe('stream', { caps: CAPS_4K, streamUrls: [URL_FB_PRUEBA] });
  const unida = tokens.join(' ');
  assert.equal(tokens.filter((t) => t === 'nvh264enc').length, 1);
  assert.ok(unida.includes('bitrate=12000'));
  assert.ok(!unida.includes('bitrate=40000'));
  assert.ok(!tokens.includes('mp4mux'));
});

test('Hito 3 · capsParaStream: ≤1080 pasa intacto y >1080 baja a 1920×1080 conservando fps', () => {
  const c1080 = capsParaStream(CAPS_1080);
  assert.equal(c1080.width, 1920);
  assert.equal(c1080.height, 1080);
  const c720 = capsParaStream({ format: 'NV12', width: 1280, height: 720, framerate: 30 });
  assert.equal(c720.width, 1280);
  assert.equal(c720.height, 720);
  const c4k = capsParaStream(CAPS_4K);
  assert.equal(c4k.width, 1920);
  assert.equal(c4k.height, 1080);
  assert.equal(c4k.framerate, 30);
});

// ---------------------------------------------------------------------------
// v3.2.1 — Invariantes de la topología PROBADA (Hito 1 B). El Hito 2 metió
// un d3d11convert + caps forzado (memory:D3D11Memory, NV12,
// colorimetry=bt709) entre el compositor y el tee de programa; esa forma
// nunca corrió en vivo y la v3.2.0 murió al nacer en la máquina de Luis
// con «could not link queue2 to nvh264enc0». Estos invariantes blindan la
// forma que sí grabó y transmitió de verdad.
// ---------------------------------------------------------------------------
test('v3.2.1 · tubería: entre el compositor y tprog SOLO hay una queue (forma probada del Hito 1 B)', () => {
  const casos = [
    ['preview', argsDe('preview')],
    ['record', argsDe('record')],
    ['recordStream', argsDe('recordStream', { streamUrls: [URL_FB_PRUEBA] })],
    ['stream', argsDe('stream', { streamUrls: [URL_FB_PRUEBA] })],
  ];
  for (const [session, tokens] of casos) {
    const i = tokens.indexOf('name=mix');
    assert.ok(i >= 0, `${session}: falta name=mix`);
    assert.deepEqual(
      tokens.slice(i + 1, i + 7),
      ['mix.', '!', 'queue', '!', 'tee', 'name=tprog'],
      `${session}: tras el compositor solo puede ir «mix. ! queue ! tee name=tprog» (sin convert ni caps forzado)`,
    );
  }
});

test('v3.2.1 · tubería: el codificador cuelga de tprog vía queue y no existe caps forzado D3D11 en ninguna sesión', () => {
  const casos = [
    argsDe('preview'),
    argsDe('record'),
    argsDe('recordStream', { streamUrls: [URL_FB_PRUEBA] }),
    argsDe('recordStream', { caps: CAPS_4K, streamUrls: [URL_FB_PRUEBA] }),
    argsDe('stream', { caps: CAPS_4K, streamUrls: [URL_FB_PRUEBA] }),
  ];
  for (const tokens of casos) {
    const unida = tokens.join(' ');
    assert.ok(!unida.includes('memory:D3D11Memory'), 'ningún caps puede fijar memory:D3D11Memory');
    assert.ok(!unida.includes('colorimetry=bt709'), 'ningún caps puede fijar colorimetry=bt709');
  }
  assert.ok(argsDe('record').join(' ').includes('tprog. ! queue ! nvh264enc'), 'record: el codificador se alimenta de tprog vía queue');
  assert.ok(
    argsDe('recordStream', { caps: CAPS_4K, streamUrls: [URL_FB_PRUEBA] }).join(' ').includes('tprog. ! queue ! nvh264enc'),
    'recordStream 4K: la grabación alimenta su codificador desde tprog vía queue',
  );
});

test('v3.2.1 · tubería: la bajada >1080 del stream va por memoria de sistema (d3d11download→videoscale→videoconvert, caps NV12 plano)', () => {
  const tokens = argsDe('recordStream', { caps: CAPS_4K, streamUrls: [URL_FB_PRUEBA] });
  const i = tokens.indexOf('d3d11download');
  assert.ok(i >= 0, 'la rama de stream con escala debe bajar a memoria de sistema con d3d11download');
  assert.deepEqual(
    tokens.slice(i, i + 6),
    ['d3d11download', '!', 'videoscale', '!', 'videoconvert', '!'],
    'la bajada es d3d11download ! videoscale ! videoconvert ! <caps de sistema>',
  );
  assert.ok(
    tokens.includes('video/x-raw,format=NV12,width=1920,height=1080,framerate=30/1'),
    'el caps de bajada es de memoria de sistema (NV12 plano, sin memory:D3D11Memory)',
  );
});

// Fixture SINTÉTICA de «gst-device-monitor-1.0 Audio/Source» con la forma
// de la salida WASAPI2 real: el micrófono de la Steren trae su device.id.
const FIXTURE_MONITOR_AUDIO = `
Probing devices...
Device found:
\tname  : Micrófono (Steren COM-126)
\tclass : Audio/Source
\tcaps  : audio/x-raw, format=S16LE, rate=48000, channels=2
\tgst-launch-1.0 wasapi2src device="\\{0.0.0.00000000\\}.\\{11111111-2222-3333-4444-555555555555\\}" ! audioconvert ! ...
\tproperties:
\t\tdevice.id = \\{0.0.0.00000000\\}.\\{11111111-2222-3333-4444-555555555555\\}
\t\tdevice.api = wasapi2
Device found:
\tname  : Micrófono (Realtek(R) Audio)
\tclass : Audio/Source
\tcaps  : audio/x-raw, format=S16LE, rate=48000, channels=2
\tproperties:
\t\tdevice.id = \\{0.0.0.00000000\\}.\\{66666666-7777-8888-9999-000000000000\\}
\t\tdevice.api = wasapi2
`;

const FIXTURE_MONITOR_AUDIO_SIN_COINCIDENCIA = `
Probing devices...
Device found:
\tname  : Micrófono (Realtek(R) Audio)
\tclass : Audio/Source
\tcaps  : audio/x-raw, format=S16LE, rate=48000, channels=2
\tproperties:
\t\tdevice.id = \\{0.0.0.00000000\\}.\\{66666666-7777-8888-9999-000000000000\\}
\t\tdevice.api = wasapi2
`;

test('Hito 3 · parser de audio: con { audio: true } lee Audio/Source y captura device.id', () => {
  const devs = parseDeviceMonitorOutput(FIXTURE_MONITOR_AUDIO, { audio: true });
  assert.equal(devs.length, 2);
  assert.equal(devs[0].name, 'Micrófono (Steren COM-126)');
  assert.equal(devs[0].deviceId, '\\{0.0.0.00000000\\}.\\{11111111-2222-3333-4444-555555555555\\}');
  // En modo vídeo (defecto) los bloques de audio se descartan, como antes.
  assert.equal(parseDeviceMonitorOutput(FIXTURE_MONITOR_AUDIO).length, 0);
});

test('Hito 3 · chooseAudioDevice: coincide por contención de nombre y declara la no coincidencia', () => {
  const devs = parseDeviceMonitorOutput(FIXTURE_MONITOR_AUDIO, { audio: true });
  const ok = chooseAudioDevice(devs, 'Steren COM-126');
  assert.equal(ok.matched, true);
  assert.equal(ok.device.name, 'Micrófono (Steren COM-126)');
  const no = chooseAudioDevice(devs, 'EasyCamera');
  assert.equal(no.matched, false);
  assert.equal(no.device, null);
});

test('Hito 3 · tubería: con audioDevice, wasapi2src lleva el token device= adyacente', () => {
  const tokens = argsDe('record', { audioDevice: '{0.0.0.00000000}.{ABC-123}' });
  const i = tokens.indexOf('wasapi2src');
  assert.ok(i >= 0);
  assert.equal(tokens[i + 1], 'device={0.0.0.00000000}.{ABC-123}');
  // Sin audioDevice no hay token device= suelto (device-path= es otro).
  const sin = argsDe('record');
  assert.ok(!sin.some((t) => t.startsWith('device=')));
});

// Prepara un motor con stubs cuyo monitor responde vídeo o audio según
// el filtro pedido (argv[2]), como hace el monitor real.
function prepararMotorHito3(dir, fixtureAudio, logs) {
  escribirHerramientaStub(dir, 'gst-launch-1.0', `#!/usr/bin/env node
const fs = require('node:fs');
// v3.3.0: el argv que esta prueba vigila es el de la SESIÓN (con
// compositor); la vista previa independiente de la sonda, que el
// anfitrión lanza antes, no debe sobrescribirlo.
if (process.env.PS_HITO3_ARGV_FILE && process.argv.slice(2).includes('d3d11compositor')) { try { fs.writeFileSync(process.env.PS_HITO3_ARGV_FILE, process.argv.slice(2).join('\\n')); } catch (e) {} }
process.stderr.write('Setting pipeline to PAUSED ...\\n');
for (const a of process.argv.slice(2)) {
  if (a.startsWith('location=') && a.endsWith('.mp4')) {
    try { fs.writeFileSync(a.slice('location='.length), Buffer.alloc(4096, 7)); } catch (e) {}
  }
}
setInterval(() => {}, 1000);
`);
  escribirHerramientaStub(dir, 'gst-inspect-1.0', `#!/usr/bin/env node
process.exit(0);
`);
  const videoEsc = JSON.stringify(FIXTURE_MONITOR_REAL);
  const audioEsc = JSON.stringify(fixtureAudio);
  escribirHerramientaStub(dir, 'gst-device-monitor-1.0', `#!/usr/bin/env node
process.stdout.write(process.argv[2] === 'Audio/Source' ? ${audioEsc} : ${videoEsc});
`);
  const ffmpegStub = escribirHerramientaStub(dir, 'ffmpeg-stub', `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const i = args.indexOf('-i');
const archivo = i >= 0 ? args[i + 1] : null;
if (archivo) {
  try { fs.writeFileSync(archivo + '.probe-called', 'sonda invocada\\n'); } catch (e) {}
  process.stderr.write('  Duration: 00:01:00.03, start: 0.000000, bitrate: 12000 kb/s\\n');
  process.stderr.write('  Stream #0:0: Video: h264 (High), yuv420p, 1920x1080, 30 fps\\n');
}
process.exit(0);
`);
  return createNativeEngine({
    ffmpegPath: ffmpegStub,
    log: (l) => { if (Array.isArray(logs)) logs.push(l); },
    onState: () => {},
    env: { ...process.env, PODCASTUDIO_GST_BIN: dir, PATH: process.env.PATH || '' },
    platform: process.platform,
    fsExists: (p) => fs.existsSync(p),
    spawnImpl: crearSpawnParaStubs(dir, spawn),
  });
}

test('Hito 3 · anfitrión: audio coincidente, outFileBase nombra el máster y la sesión stream transmite', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podcastudio-motor-hito3-'));
  const outDir = path.join(dir, 'salida');
  fs.mkdirSync(outDir, { recursive: true });
  const argvFile = path.join(dir, 'argv-gst.txt');
  process.env.PS_HITO3_ARGV_FILE = argvFile;
  const engine = prepararMotorHito3(dir, FIXTURE_MONITOR_AUDIO, []);
  try {
    // Disponibilidad perezosa: la app decide los botones SIN start.
    assert.equal(engine.getState().gstInstalled, true);

    const r1 = await engine.start({ session: 'record', outDir, outFileBase: 'ProyectoX_2026-11-12_15-30-00' });
    assert.equal(r1.success, true, JSON.stringify(r1));
    const st1 = engine.getState();
    assert.ok(st1.outFile.endsWith('ProyectoX_2026-11-12_15-30-00_Master_1080p.mp4'), st1.outFile);
    assert.equal(st1.audioDevice.matched, true);
    assert.equal(st1.audioDevice.name, 'Micrófono (Steren COM-126)');
    // El argv REAL que recibió gst-launch lleva el device= del micrófono.
    let argvTxt = '';
    for (let i = 0; i < 50 && !argvTxt; i += 1) {
      if (fs.existsSync(argvFile)) argvTxt = fs.readFileSync(argvFile, 'utf8');
      if (!argvTxt) await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(argvTxt.includes('device=\\{0.0.0.00000000\\}.\\{11111111-2222-3333-4444-555555555555\\}'), argvTxt.slice(0, 400));
    const rStop1 = await engine.stop();
    assert.equal(rStop1.success, true);
    assert.equal(engine.getState().validation.valid, true);

    // Sesión de solo transmisión con un destino real.
    const r2 = await engine.start({ session: 'stream', outDir, streamUrls: [URL_FB_PRUEBA] });
    assert.equal(r2.success, true, JSON.stringify(r2));
    assert.equal(engine.getState().phase, 'transmitiendo');
    assert.equal(engine.getState().streamCount, 1);
    const rStop2 = await engine.stop();
    assert.equal(rStop2.success, true);
    assert.equal(engine.getState().phase, 'apagado');

    // stream sin destinos = error declarado desde el arranque.
    const r3 = await engine.start({ session: 'stream', outDir });
    assert.equal(r3.success, false);
  } finally {
    try { await engine.stop(); } catch (e) {}
    delete process.env.PS_HITO3_ARGV_FILE;
  }
});

test('Hito 3 · anfitrión: sin micrófono coincidente, el dispositivo por defecto queda DECLARADO', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podcastudio-motor-hito3b-'));
  const outDir = path.join(dir, 'salida');
  fs.mkdirSync(outDir, { recursive: true });
  const logs = [];
  const engine = prepararMotorHito3(dir, FIXTURE_MONITOR_AUDIO_SIN_COINCIDENCIA, logs);
  try {
    const r1 = await engine.start('record', { outDir });
    assert.equal(r1.success, true, JSON.stringify(r1));
    const st = engine.getState();
    assert.equal(st.audioDevice.matched, false);
    assert.equal(st.audioDevice.name, null);
    assert.ok(logs.join('\n').includes('dispositivo por defecto de Windows'), logs.join(' | ').slice(0, 500));
    await engine.stop();
  } finally {
    try { await engine.stop(); } catch (e) {}
  }
});

// ---------------------------------------------------------------------------
// (vii) v3.2.3 — Reintento declarado de apertura de la cámara. El stub de
// gst-launch es INESTABLE a propósito: su PRIMER lanzamiento muere
// enseguida con la firma pedida en PS_V323_FIRMA y los siguientes se
// comportan como el stub bueno (crean el MP4 y duermen):
//   'captura' = «Couldn't create capture object», la firma real de
//               gst_mf_video_src_start en las dos corridas de la
//               compuerta smoke en la máquina de Luis (v3.2.2);
//   'otra'    = una firma distinta (no debe disparar el reintento).
// Cada lanzamiento deja su argv en argv-<n>.txt y el contador en
// lanzamientos.txt, ambos dentro del directorio dado en PS_V323_DIR.
// ---------------------------------------------------------------------------
function prepararMotorReintento(dir) {
  escribirHerramientaStub(dir, 'gst-launch-1.0', `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const dir = process.env.PS_V323_DIR || '';
// v3.3.0: la vista previa independiente (la sonda que el anfitrión lanza
// antes de la sesión) NO es un lanzamiento de sesión: duerme como un
// proceso sano y NO entra en la contabilidad que esta prueba vigila
// (lanzamientos.txt / argv-<n>.txt cuentan SOLO sesiones, como antes).
if (!process.argv.slice(2).includes('d3d11compositor')) {
  setInterval(() => {}, 1000);
} else {
let n = 0;
try { n = parseInt(fs.readFileSync(path.join(dir, 'lanzamientos.txt'), 'utf8'), 10) || 0; } catch (e) {}
n += 1;
try { fs.writeFileSync(path.join(dir, 'lanzamientos.txt'), String(n)); } catch (e) {}
try { fs.writeFileSync(path.join(dir, 'argv-' + n + '.txt'), process.argv.slice(2).join('\\n')); } catch (e) {}
if (n === 1 && process.env.PS_V323_FIRMA === 'captura') {
  process.stderr.write("ERROR mfvideosrc gstmfvideosrc.cpp:288:gst_mf_video_src_start:<mfvideosrc0> Couldn't create capture object\\n");
  process.exit(1);
}
if (n === 1 && process.env.PS_V323_FIRMA === 'otra') {
  process.stderr.write('ERROR del arranque: fallo generico sin la firma de captura\\n');
  process.exit(1);
}
process.stderr.write('Setting pipeline to PAUSED ...\\n');
for (const a of process.argv.slice(2)) {
  if (a.startsWith('location=') && a.endsWith('.mp4')) {
    try { fs.writeFileSync(a.slice('location='.length), Buffer.alloc(4096, 7)); } catch (e) {}
  }
}
setInterval(() => {}, 1000);
}
`);
  escribirHerramientaStub(dir, 'gst-inspect-1.0', `#!/usr/bin/env node
process.exit(0);
`);
  const fixtureEscapado = JSON.stringify(FIXTURE_MONITOR_REAL);
  escribirHerramientaStub(dir, 'gst-device-monitor-1.0', `#!/usr/bin/env node
process.stdout.write(${fixtureEscapado});
`);
  const ffmpegStub = escribirHerramientaStub(dir, 'ffmpeg-stub', `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const i = args.indexOf('-i');
const archivo = i >= 0 ? args[i + 1] : null;
if (archivo) {
  process.stderr.write('  Duration: 00:01:00.03, start: 0.000000, bitrate: 12000 kb/s\\n');
  process.stderr.write('  Stream #0:0: Video: h264 (High), yuv420p, 1920x1080, 30 fps\\n');
}
process.exit(0);
`);
  const logs = [];
  const engine = createNativeEngine({
    ffmpegPath: ffmpegStub,
    log: (l) => logs.push(l),
    onState: () => {},
    env: { ...process.env, PODCASTUDIO_GST_BIN: dir, PATH: process.env.PATH || '' },
    platform: process.platform,
    fsExists: (p) => fs.existsSync(p),
    spawnImpl: crearSpawnParaStubs(dir, spawn),
  });
  return { engine, logs };
}

async function esperarV323(condicion, ms = 6000) {
  const inicio = Date.now();
  while (Date.now() - inicio < ms) {
    if (condicion()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return condicion();
}

test('v3.2.3 · anfitrión: si la apertura por índice muere con la firma de captura, reintenta UNA vez por device-path', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podcastudio-motor-v323-'));
  const outDir = path.join(dir, 'salida');
  fs.mkdirSync(outDir, { recursive: true });
  process.env.PS_V323_DIR = dir;
  process.env.PS_V323_FIRMA = 'captura';
  const { engine, logs } = prepararMotorReintento(dir);
  try {
    const r1 = await engine.start('record', { outDir });
    assert.equal(r1.success, true, JSON.stringify(r1));
    // El primer lanzamiento muere con la firma y el motor relanza solo.
    const huboSegundo = await esperarV323(() => fs.existsSync(path.join(dir, 'argv-2.txt')));
    assert.ok(huboSegundo, 'debió existir un segundo lanzamiento (el reintento)');
    const argv1 = fs.readFileSync(path.join(dir, 'argv-1.txt'), 'utf8');
    const argv2 = fs.readFileSync(path.join(dir, 'argv-2.txt'), 'utf8');
    // La fixture real da a la Steren MF índice 0 y device.path: el orden
    // de modos es índice (principal) → ruta (respaldo del reintento).
    assert.ok(argv1.includes('device-index=0'), argv1.slice(0, 200));
    assert.ok(!argv1.includes('device-path='), argv1.slice(0, 200));
    assert.ok(argv2.includes('device-path='), argv2.slice(0, 200));
    const st = engine.getState();
    assert.equal(st.phase, 'grabando');
    assert.equal(st.addressingMode, 'device-path');
    assert.ok(logs.join('\n').includes('reintentando con device-path'), logs.join(' | ').slice(0, 500));
    const rStop = await engine.stop();
    assert.equal(rStop.success, true);
    assert.equal(engine.getState().validation.valid, true);
    // Sin tercer lanzamiento: el reintento es único.
    assert.equal(fs.readFileSync(path.join(dir, 'lanzamientos.txt'), 'utf8'), '2');
  } finally {
    try { await engine.stop(); } catch (e) {}
    delete process.env.PS_V323_DIR;
    delete process.env.PS_V323_FIRMA;
  }
});

test('v3.2.3 · anfitrión: una muerte temprana con OTRA firma no dispara el reintento de apertura', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podcastudio-motor-v323b-'));
  const outDir = path.join(dir, 'salida');
  fs.mkdirSync(outDir, { recursive: true });
  process.env.PS_V323_DIR = dir;
  process.env.PS_V323_FIRMA = 'otra';
  const { engine } = prepararMotorReintento(dir);
  try {
    const r1 = await engine.start('record', { outDir });
    assert.equal(r1.success, true, JSON.stringify(r1));
    const cayo = await esperarV323(() => engine.getState().phase === 'error');
    assert.ok(cayo, 'la sesión debió caer en error');
    // Margen para un hipotético segundo lanzamiento que NO debe existir.
    await new Promise((r) => setTimeout(r, 900));
    assert.equal(fs.readFileSync(path.join(dir, 'lanzamientos.txt'), 'utf8'), '1');
    assert.equal(engine.getState().addressingMode, 'device-index');
    assert.ok(engine.getState().lastError.includes('se cerró sin orden de parada'));
  } finally {
    try { await engine.stop(); } catch (e) {}
    delete process.env.PS_V323_DIR;
    delete process.env.PS_V323_FIRMA;
  }
});

// ---------------------------------------------------------------------------
// (viii) v3.3.0 — Multicámara (A), sonda de concurrencia + vista previa
// independiente (B) y setPreviewText (C-anfitrión). El arnés de la pata
// B/C es nuevo: su stub de gst-launch distingue los lanzamientos por su
// FORMA (con d3d11compositor = sesión; sin compositor = vista previa
// independiente) y los gobiernan dos interruptores de entorno:
//   PS_V330_PREVIEW='muere-captura' → la vista previa INDEPENDIENTE
//       muere al nacer con la firma «Couldn't create capture object»
//       (la sonda de la sesión de vista previa da
//       concurrentPreview=false y la vista previa cae a la integrada);
//   PS_V330_TEXTO='muere' → todo lanzamiento con textoverlay muere al
//       nacer (para probar la red de seguridad de setPreviewText).
// Cada lanzamiento deja su argv en argv-<n>.txt y el contador en
// lanzamientos.txt, dentro de PS_V330_DIR. Lo demás duerme como el stub
// bueno y crea el MP4 de los location=*.mp4.
//
// CORRECCIÓN TRAS LA COMPUERTA (2026-11-13): la primera versión de las
// patas B/C hacía vivir la vista previa independiente EN PARALELO a la
// sesión de grabación, y la compuerta en la máquina real lo cazó
// (record/recordStream/multicam muertos a los ~2 s: dos lectores MF de
// la misma cámara). Las pruebas de sonda y de setPreviewText de esta
// sección se REESCRIBIERON a la semántica corregida: la sonda corre en
// la sesión de VISTA PREVIA (concurrentPreview = «la independiente
// puede vivir FUERA de sesión»), las sesiones de grabación nacen con
// su rama integrada y sin proceso en paralelo, y setPreviewText actúa
// sobre la vista previa fuera de sesión (en sesión es no-op
// declarado). Las expectativas viejas que codificaban la convivencia
// quedaron sustituidas — no relajadas — por las nuevas.
// ---------------------------------------------------------------------------
const CAPS_EASY_720 = { raw: 'video/x-raw, format=NV12, width=1280, height=720, framerate=30/1', format: 'NV12', width: 1280, height: 720, framerate: 30 };
const CAPS_43_768 = { raw: 'video/x-raw, format=NV12, width=1024, height=768, framerate=30/1', format: 'NV12', width: 1024, height: 768, framerate: 30 };

function propsDePad(tokens, pad) {
  const prefijo = `sink_${pad}::`;
  const salida = {};
  for (const t of tokens) {
    if (typeof t === 'string' && t.startsWith(prefijo)) {
      const [clave, valor] = t.slice(prefijo.length).split('=');
      salida[clave] = Number(valor);
    }
  }
  return salida;
}

test('v3.3.0 · tubería multicámara: 2 fuentes — programa a pantalla completa en sink_0 y PiP con la geometría del plan', () => {
  const tokens = buildPipelineArgs({
    session: 'record',
    sources: [
      { deviceIndex: 0, devicePath: 'ruta-steren', caps: CAPS_1080 },
      { deviceIndex: 1, devicePath: 'ruta-easy', caps: CAPS_EASY_720 },
    ],
    programIndex: 0,
    encoder: 'nvh264enc', withPreset: true, withAudio: false,
    outFile: 'C:\\x\\multi.mp4',
  });
  // Dos fuentes = dos mfvideosrc; la PRIMERA cadena es la de programa.
  assert.equal(tokens.filter((t) => t === 'mfvideosrc').length, 2);
  assert.equal(tokens[0], 'mfvideosrc');
  assert.equal(tokens[1], 'device-index=0');
  // Lienzo 1920x1080: sink_0 completo; PiP: ancho round(1920*.25)=480,
  // alto por SU aspecto (480*720/1280=270), margen round(1920*.02)=38,
  // x=1920-480-38=1402, y=1080-38-270=772 (acumulado desde abajo).
  assert.deepEqual(propsDePad(tokens, 0), { xpos: 0, ypos: 0, width: 1920, height: 1080 });
  assert.deepEqual(propsDePad(tokens, 1), { xpos: 1402, ypos: 772, width: 480, height: 270 });
  // Las props van TRAS el token del compositor.
  const iMix = tokens.indexOf('name=mix');
  assert.ok(tokens.indexOf('sink_0::xpos=0') > iMix);
  assert.ok(tokens.indexOf('sink_1::xpos=1402') > iMix);
  // La cadena PiP: su índice, su caps y su enlace «mix.».
  const iPip = tokens.lastIndexOf('mfvideosrc');
  assert.equal(tokens[iPip + 1], 'device-index=1');
  assert.ok(tokens.slice(iPip).includes('video/x-raw,width=1280,height=720,framerate=30/1'));
  assert.equal(tokens[iPip + 9], 'mix.');
  // El resto de la sesión se deriva de PROGRAMA (bitrate de 1080).
  assert.ok(tokens.join(' ').includes('bitrate=12000'));
});

test('v3.3.0 · tubería multicámara: 3 fuentes — las PiP se apilan hacia arriba desde la esquina inferior derecha', () => {
  const tokens = buildPipelineArgs({
    session: 'record',
    sources: [
      { deviceIndex: 0, devicePath: 'ruta-steren', caps: CAPS_1080 },
      { deviceIndex: 1, devicePath: 'ruta-easy', caps: CAPS_EASY_720 },
      { deviceIndex: 2, devicePath: 'ruta-43', caps: CAPS_43_768 },
    ],
    programIndex: 0,
    encoder: 'nvh264enc', withPreset: true, withAudio: false,
    outFile: 'C:\\x\\multi3.mp4',
  });
  assert.equal(tokens.filter((t) => t === 'mfvideosrc').length, 3);
  assert.deepEqual(propsDePad(tokens, 0), { xpos: 0, ypos: 0, width: 1920, height: 1080 });
  assert.deepEqual(propsDePad(tokens, 1), { xpos: 1402, ypos: 772, width: 480, height: 270 });
  // Segunda PiP (4:3): alto = 480*768/1024 = 360; y acumulado desde
  // abajo = 1080 - 38 - 270 - 38 - 360 = 374.
  assert.deepEqual(propsDePad(tokens, 2), { xpos: 1402, ypos: 374, width: 480, height: 360 });
});

test('v3.3.0 · tubería multicámara: la de programa manda aunque no sea la primera de la lista (programIndex)', () => {
  const tokens = buildPipelineArgs({
    session: 'record',
    sources: [
      { deviceIndex: 1, devicePath: 'ruta-easy', caps: CAPS_EASY_720 },
      { deviceIndex: 0, devicePath: 'ruta-steren', caps: CAPS_1080 },
    ],
    programIndex: 1,
    encoder: 'nvh264enc', withPreset: true, withAudio: false,
    outFile: 'C:\\x\\multi.mp4',
  });
  // La primera cadena construida es la de PROGRAMA (device-index=0) y
  // el lienzo es SU caps (1920x1080), no el de la primera de la lista.
  assert.equal(tokens[1], 'device-index=0');
  assert.deepEqual(propsDePad(tokens, 0), { xpos: 0, ypos: 0, width: 1920, height: 1080 });
  assert.deepEqual(propsDePad(tokens, 1), { xpos: 1402, ypos: 772, width: 480, height: 270 });
  const iPip = tokens.lastIndexOf('mfvideosrc');
  assert.equal(tokens[iPip + 1], 'device-index=1');
});

test('v3.3.0 · tubería: omitPreviewBranch retira SOLO la rama integrada de vista previa', () => {
  const tokens = buildPipelineArgs({
    session: 'record', deviceIndex: 0, devicePath: 'ruta', caps: CAPS_1080,
    encoder: 'nvh264enc', withPreset: true, withAudio: false,
    outFile: 'C:\\x\\sin.mp4', omitPreviewBranch: true,
  });
  assert.ok(!tokens.includes('d3d11videosink'));
  assert.ok(!tokens.includes('fakesink'), 'con omitPreviewBranch tampoco hay rama a fakesink');
  assert.ok(tokens.includes('mp4mux'), 'la grabación sigue intacta');
  const conRama = argsDe('record');
  assert.ok(conRama.includes('fakesink'), 'sin omitPreviewBranch la rama sigue, ahora a fakesink (v3.3.6)');
});

test('v3.3.6 · ninguna sesión abre ventana: record, stream, recordStream y multicámara van a fakesink; la vista previa independiente conserva d3d11videosink', () => {
  // La transmisión real a Facebook del 2026-11-13 murió a los ~14 s
  // porque la ventana del d3d11videosink de la rama de sesión se
  // cerró («Output window was closed») y ese error tumbó la tubería
  // entera (el rtmpsink a Facebook no erroró). Desde la v3.3.6 la
  // rama de sesión termina en fakesink: no hay ventana que cerrar y
  // ninguna ventana puede matar una sesión. La vista previa FUERA
  // de sesión (buildPreviewArgs) no cambia: conserva d3d11videosink.
  const sesiones = {
    record: argsDe('record'),
    stream: argsDe('stream', { streamUrls: [URL_FB_PRUEBA] }),
    recordStream: argsDe('recordStream'),
    recordStreamReal: argsDe('recordStream', { streamUrls: [URL_FB_PRUEBA] }),
  };
  for (const [nombre, tokens] of Object.entries(sesiones)) {
    assert.ok(tokens.includes('fakesink'), `${nombre}: la rama de sesión va a fakesink`);
    assert.ok(!tokens.includes('d3d11videosink'), `${nombre}: ningún token abre ventana`);
    assert.ok(tokens.join(' ').includes('tprog. ! queue ! fakesink sync=false'), `${nombre}: la rama cuelga del tee de programa tras su queue`);
  }
  // Multicámara (sources explícitas): la misma regla.
  const multi = buildPipelineArgs({
    session: 'recordStream',
    sources: [
      { deviceIndex: 0, devicePath: 'ruta-steren', caps: CAPS_1080 },
      { deviceIndex: 1, devicePath: 'ruta-easy', caps: CAPS_EASY_720 },
    ],
    programIndex: 0,
    encoder: 'nvh264enc', withPreset: true, withAudio: false,
    outFile: 'C:\\x\\multi336.mp4',
    streamUrls: [URL_FB_PRUEBA],
  });
  assert.ok(multi.includes('fakesink'), 'multicámara: la rama de sesión va a fakesink');
  assert.ok(!multi.includes('d3d11videosink'), 'multicámara: ningún token abre ventana');
  // La vista previa independiente (fuera de sesión) NO se toca.
  const previa = buildPreviewArgs({ deviceIndex: 0, devicePath: 'ruta-steren', caps: CAPS_1080 });
  assert.ok(previa.includes('d3d11videosink'), 'la vista previa independiente conserva d3d11videosink');
  assert.ok(!previa.includes('fakesink'), 'la vista previa independiente no usa fakesink');
});

test('v3.3.0 · buildPreviewArgs: sin texto es la forma probada; con texto, textoverlay limpio por memoria de sistema', () => {
  const sinTexto = buildPreviewArgs({ deviceIndex: 0, devicePath: 'ruta-steren', caps: CAPS_1080 });
  assert.deepEqual([...sinTexto], [
    'mfvideosrc', 'device-index=0', '!',
    'video/x-raw,width=1920,height=1080,framerate=30/1', '!',
    'd3d11upload', '!', 'd3d11convert', '!', 'd3d11videosink', 'sync=false',
  ]);
  assert.equal(sinTexto.addressingMode, 'device-index');
  const conTexto = buildPreviewArgs({ deviceIndex: 0, devicePath: 'ruta-steren', caps: CAPS_1080, texto: 'Línea uno del guion' });
  assert.deepEqual([...conTexto], [
    'mfvideosrc', 'device-index=0', '!',
    'video/x-raw,width=1920,height=1080,framerate=30/1', '!',
    'videoconvert', '!', 'textoverlay', 'text=Línea uno del guion',
    'halignment=center', 'valignment=top', 'font-desc=Sans Bold 44', 'shaded-background=false',
    '!', 'd3d11videosink', 'sync=false',
  ]);
  assert.ok(!conTexto.includes('d3d11upload'), 'con texto la cadena va por memoria de sistema, sin subida D3D11 previa');
  // El direccionamiento por device-path (respaldo) también se expresa.
  const porRuta = buildPreviewArgs({ deviceIndex: null, devicePath: 'ruta-x', caps: CAPS_1080 });
  assert.equal(porRuta[1], 'device-path=ruta-x');
  assert.equal(porRuta.addressingMode, 'device-path');
});

function prepararMotorV330(dir) {
  escribirHerramientaStub(dir, 'gst-launch-1.0', `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const dir = process.env.PS_V330_DIR || '';
const argv = process.argv.slice(2);
let n = 0;
try { n = parseInt(fs.readFileSync(path.join(dir, 'lanzamientos.txt'), 'utf8'), 10) || 0; } catch (e) {}
n += 1;
try { fs.writeFileSync(path.join(dir, 'lanzamientos.txt'), String(n)); } catch (e) {}
try { fs.writeFileSync(path.join(dir, 'argv-' + n + '.txt'), argv.join('\\n')); } catch (e) {}
const esSesion = argv.includes('d3d11compositor');
if (!esSesion && process.env.PS_V330_PREVIEW === 'muere-captura') {
  process.stderr.write("ERROR mfvideosrc gstmfvideosrc.cpp:288:gst_mf_video_src_start:<mfvideosrc0> Couldn't create capture object\\n");
  process.exit(1);
}
if (argv.includes('textoverlay') && process.env.PS_V330_TEXTO === 'muere') {
  process.stderr.write('ERROR textoverlay de mentira: muere al nacer\\n');
  process.exit(1);
}
process.stderr.write('Setting pipeline to PAUSED ...\\n');
for (const a of argv) {
  if (a.startsWith('location=') && a.endsWith('.mp4')) {
    try { fs.writeFileSync(a.slice('location='.length), Buffer.alloc(4096, 7)); } catch (e) {}
  }
}
setInterval(() => {}, 1000);
`);
  escribirHerramientaStub(dir, 'gst-inspect-1.0', `#!/usr/bin/env node
process.exit(0);
`);
  const fixtureEscapado = JSON.stringify(FIXTURE_MONITOR_REAL);
  escribirHerramientaStub(dir, 'gst-device-monitor-1.0', `#!/usr/bin/env node
process.stdout.write(${fixtureEscapado});
`);
  const ffmpegStub = escribirHerramientaStub(dir, 'ffmpeg-stub', `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const i = args.indexOf('-i');
const archivo = i >= 0 ? args[i + 1] : null;
if (archivo) {
  process.stderr.write('  Duration: 00:01:00.03, start: 0.000000, bitrate: 12000 kb/s\\n');
  process.stderr.write('  Stream #0:0: Video: h264 (High), yuv420p, 1920x1080, 30 fps\\n');
}
process.exit(0);
`);
  const logs = [];
  const engine = createNativeEngine({
    ffmpegPath: ffmpegStub,
    log: (l) => logs.push(l),
    onState: () => {},
    env: { ...process.env, PODCASTUDIO_GST_BIN: dir, PATH: process.env.PATH || '' },
    platform: process.platform,
    fsExists: (p) => fs.existsSync(p),
    spawnImpl: crearSpawnParaStubs(dir, spawn),
  });
  return { engine, logs };
}

async function esperarV330(condicion, ms = 15000) {
  const inicio = Date.now();
  while (Date.now() - inicio < ms) {
    if (condicion()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return condicion();
}

// Los stubs son procesos Node que tardan en arrancar y escribir su
// argv-<n>.txt: leer los archivos en el mismo tick que start() es una
// carrera real (vista al probar en la suite completa, con la CPU
// compartida). Se sondea hasta que el contenido esperado aparece.
function leerArgvV330(dir, n) {
  const ruta = path.join(dir, `argv-${n}.txt`);
  return fs.existsSync(ruta) ? fs.readFileSync(ruta, 'utf8') : '';
}

// Los lanzamientos se identifican por CONTENIDO, no por número: el
// contador argv-<n> lo asigna cada stub al ARRANCAR, y el arranque de
// un proceso Node tiene jitter (bajo carga, segundos): la sesión puede
// terminar numerada DESPUÉS que un relanzamiento posterior del preview.
// (Carrera real, cazada al probar: argv-2 era el texto y argv-3 la
// sesión.) Contenido: con d3d11compositor = sesión; con textoverlay =
// preview con texto; preview a secas = el resto con d3d11videosink.
function contenidosArgvV330(dir) {
  return fs.readdirSync(dir)
    .filter((f) => /^argv-\d+\.txt$/.test(f))
    .sort()
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'));
}
const esArgvSesion = (c) => c.includes('d3d11compositor');
const esArgvPreviewConTexto = (c) => c.includes('textoverlay');
const esArgvPreviewSinTexto = (c) => c.includes('d3d11videosink') && !c.includes('d3d11compositor') && !c.includes('textoverlay');

test('v3.3.0 · anfitrión multicámara: resuelve nombres contra MF, la PiP que no resuelve se OMITE declarada y no tumba la sesión', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podcastudio-motor-v330-multi-'));
  const outDir = path.join(dir, 'salida');
  fs.mkdirSync(outDir, { recursive: true });
  process.env.PS_V330_DIR = dir;
  // Corrección tras la compuerta: el arranque de GRABACIÓN ya no corre
  // sonda ni lanza la vista previa independiente (antes este arranque
  // fijaba PS_V330_PREVIEW='muere-captura' para que la sonda muriera
  // rápido y la sesión fuera integrada; ya no hace falta: la sesión de
  // grabación nunca toca el proceso independiente).
  const { engine, logs } = prepararMotorV330(dir);
  try {
    const r1 = await engine.start({
      session: 'record', outDir,
      sources: ['Steren COM-126', 'EasyCamera', 'Cámara Que No Existe'],
      programIndex: 0,
    });
    assert.equal(r1.success, true, JSON.stringify(r1));
    const st = engine.getState();
    assert.equal(st.phase, 'grabando');
    // Solo entraron las dos que resolvieron, en orden de layout.
    assert.deepEqual(st.sourceNames, ['Steren COM-126', 'EasyCamera']);
    assert.equal(st.programIndex, 0);
    const textoLogs = logs.join('\n');
    assert.ok(textoLogs.includes('Cámara Que No Existe') && textoLogs.includes('OMITIDA'), textoLogs.slice(0, 600));
    assert.ok(textoLogs.includes('entra como PiP'), textoLogs.slice(0, 600));
    // La sesión (la que lleva compositor; la otra fue la sonda) lleva
    // DOS mfvideosrc y las props del layout para las dos fuentes.
    await esperarV330(() => contenidosArgvV330(dir).some((c) => esArgvSesion(c) && c.includes('sink_1::')));
    const argvSesion = contenidosArgvV330(dir).find((c) => esArgvSesion(c)) || '';
    assert.equal(argvSesion.split('\n').filter((l) => l === 'mfvideosrc').length, 2, argvSesion.slice(0, 300));
    assert.ok(argvSesion.includes('sink_1::xpos=1402'), argvSesion.slice(0, 400));
    assert.ok(argvSesion.includes('device-index=1'), 'la PiP EasyCamera entra por su índice MF (1)');
    const rStop = await engine.stop();
    assert.equal(rStop.success, true);
    assert.equal(engine.getState().validation.valid, true);
  } finally {
    try { await engine.stop(); } catch (e) {}
    delete process.env.PS_V330_DIR;
    delete process.env.PS_V330_PREVIEW;
  }
});

// v3.3.1 (defecto 4) SUPERSEDE la expectativa de fase de esta prueba:
// en la v3.3.0 el arranque rechazado dejaba la fase en «error»; la
// orden de Luis es que una sesión que nunca arrancó no es un error —
// la fase vuelve a «apagado», el motivo queda en programUnavailable y
// la respuesta lleva el código PROGRAMA_NO_DISPONIBLE. Lo demás (no se
// lanza tubería, el error nombra la cámara) se mantiene intacto.
test('v3.3.0→v3.3.1 · anfitrión multicámara: si la de PROGRAMA no resuelve, la sesión no arranca (negativa declarada, sin fase de error)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podcastudio-motor-v330-prog-'));
  const outDir = path.join(dir, 'salida');
  fs.mkdirSync(outDir, { recursive: true });
  process.env.PS_V330_DIR = dir;
  const { engine } = prepararMotorV330(dir);
  try {
    const r = await engine.start({ session: 'record', outDir, sources: ['Cámara Que No Existe', 'EasyCamera'], programIndex: 0 });
    assert.equal(r.success, false);
    assert.ok(r.error.includes('Cámara Que No Existe'), r.error);
    assert.equal(r.code, 'PROGRAMA_NO_DISPONIBLE');
    assert.equal(engine.getState().phase, 'apagado');
    assert.equal(engine.getState().programUnavailable, 'Cámara Que No Existe');
    assert.ok(!fs.existsSync(path.join(dir, 'lanzamientos.txt')), 'no debió lanzarse ninguna tubería');
  } finally {
    try { await engine.stop(); } catch (e) {}
    delete process.env.PS_V330_DIR;
  }
});

// Corrección tras la compuerta: la sonda corre SOLO en la sesión de
// vista previa. Antes esta prueba arrancaba 'record' y esperaba que la
// sonda viviera en paralelo a la grabación (la semántica que la
// compuerta reprobó); ahora la sonda nace y muere dentro del arranque
// de 'preview' y la grabación queda fuera de su alcance.
test('v3.3.0 · sonda en la vista previa: si el proceso independiente muere con la firma de captura, concurrentPreview=false y la vista previa cae a la tubería integrada', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podcastudio-motor-v330-sonda-no-'));
  const outDir = path.join(dir, 'salida');
  fs.mkdirSync(outDir, { recursive: true });
  process.env.PS_V330_DIR = dir;
  process.env.PS_V330_PREVIEW = 'muere-captura';
  const { engine, logs } = prepararMotorV330(dir);
  try {
    const r1 = await engine.start('preview', { outDir });
    assert.equal(r1.success, true, JSON.stringify(r1));
    const st = engine.getState();
    assert.equal(st.concurrentPreview, false);
    assert.equal(st.phase, 'vista-previa');
    assert.ok(logs.join('\n').includes('concurrentPreview=false'), logs.join(' | ').slice(0, 500));
    // Dos lanzamientos: la sonda (proceso independiente, sin
    // compositor, con su d3d11videosink) y la tubería INTEGRADA
    // (con compositor; desde la v3.3.6 su rama va a fakesink).
    await esperarV330(() => contenidosArgvV330(dir).length >= 2);
    const argvSonda = contenidosArgvV330(dir).find((c) => esArgvPreviewSinTexto(c)) || '';
    assert.ok(argvSonda.includes('d3d11videosink'), argvSonda.slice(0, 200));
    const argvIntegrada = contenidosArgvV330(dir).find((c) => esArgvSesion(c)) || '';
    assert.ok(argvIntegrada.includes('fakesink') && !argvIntegrada.includes('d3d11videosink'), argvIntegrada.slice(0, 300));
    // Sin concurrencia, setPreviewText no toca nada.
    const rTexto = engine.setPreviewText('Texto que no debe ir a ningún lado');
    assert.equal(rTexto.success, false);
    assert.equal(fs.readFileSync(path.join(dir, 'lanzamientos.txt'), 'utf8'), '2', 'setPreviewText sin concurrencia no relanza nada');
    const rStop = await engine.stop();
    assert.equal(rStop.success, true);
  } finally {
    try { await engine.stop(); } catch (e) {}
    delete process.env.PS_V330_DIR;
    delete process.env.PS_V330_PREVIEW;
  }
});

// Corrección tras la compuerta: antes esta prueba exigía que la sesión
// de grabación naciera SIN d3d11videosink y con el proceso
// independiente vivo en paralelo (omitPreviewBranch) — exactamente lo
// que mató la grabación real a los ~2 s —. La expectativa corregida es
// la contraria: el proceso independiente ES la sesión de vista previa,
// y la grabación posterior nace CON su rama integrada y sin ningún
// proceso en paralelo.
test('v3.3.0 · sonda en la vista previa: si el proceso independiente vive, concurrentPreview=true y ÉL es la sesión de vista previa; la grabación posterior nace con su rama integrada', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podcastudio-motor-v330-sonda-si-'));
  const outDir = path.join(dir, 'salida');
  fs.mkdirSync(outDir, { recursive: true });
  process.env.PS_V330_DIR = dir;
  const { engine, logs } = prepararMotorV330(dir);
  try {
    const r1 = await engine.start('preview', { outDir });
    assert.equal(r1.success, true, JSON.stringify(r1));
    let st = engine.getState();
    assert.equal(st.concurrentPreview, true);
    assert.equal(st.phase, 'vista-previa');
    assert.ok(logs.join('\n').includes('concurrentPreview=true'), logs.join(' | ').slice(0, 500));
    // Un solo lanzamiento: la sonda ES la sesión de vista previa (la
    // forma probada de buildPreviewArgs, sin compositor).
    await esperarV330(() => contenidosArgvV330(dir).length >= 1);
    const argvPrevia = contenidosArgvV330(dir).find((c) => esArgvPreviewSinTexto(c)) || '';
    assert.ok(argvPrevia.includes('d3d11upload') && argvPrevia.includes('d3d11videosink'), argvPrevia.slice(0, 200));
    assert.equal(contenidosArgvV330(dir).filter((c) => esArgvSesion(c)).length, 0, 'la vista previa no lanzó ninguna tubería de sesión');
    const rStop1 = await engine.stop();
    assert.equal(rStop1.success, true);
    // La grabación: NINGÚN lanzamiento de vista previa nuevo y la
    // sesión CON su rama integrada (la forma probada de la v3.2.3;
    // desde la v3.3.6 esa rama termina en fakesink, sin ventana).
    const r2 = await engine.start('record', { outDir });
    assert.equal(r2.success, true, JSON.stringify(r2));
    st = engine.getState();
    assert.equal(st.phase, 'grabando');
    assert.equal(st.concurrentPreview, true, 'el veredicto persiste: la independiente puede vivir FUERA de sesión');
    await esperarV330(() => contenidosArgvV330(dir).length >= 2);
    assert.equal(fs.readFileSync(path.join(dir, 'lanzamientos.txt'), 'utf8'), '2', 'vista previa + sesión: ningún lanzamiento más');
    const argvSesion = contenidosArgvV330(dir).find((c) => esArgvSesion(c)) || '';
    assert.ok(argvSesion.includes('fakesink') && !argvSesion.includes('d3d11videosink'), 'la sesión lleva su rama integrada a fakesink (v3.3.6: sin ventana)');
    const rStop = await engine.stop();
    assert.equal(rStop.success, true);
    assert.equal(engine.getState().validation.valid, true);
  } finally {
    try { await engine.stop(); } catch (e) {}
    delete process.env.PS_V330_DIR;
  }
});

// Corrección tras la compuerta: setPreviewText actúa sobre la sesión
// de VISTA PREVIA (fuera de sesión de grabación); antes esta prueba lo
// ejercía durante un 'record', con el proceso independiente conviviendo
// con la grabación — la convivencia reprobada —.
test('v3.3.0 · setPreviewText sobre la vista previa: relanza SOLO el proceso independiente y, si el texto muere en <1500 ms, su red relanza sin texto una vez', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podcastudio-motor-v330-texto-'));
  const outDir = path.join(dir, 'salida');
  fs.mkdirSync(outDir, { recursive: true });
  process.env.PS_V330_DIR = dir;
  const { engine, logs } = prepararMotorV330(dir);
  try {
    const r1 = await engine.start('preview', { outDir });
    assert.equal(r1.success, true, JSON.stringify(r1));
    assert.equal(engine.getState().concurrentPreview, true);
    assert.equal(engine.getState().phase, 'vista-previa');
    // A partir de aquí, todo lanzamiento con textoverlay muere al nacer.
    process.env.PS_V330_TEXTO = 'muere';
    const rTexto = engine.setPreviewText('Tramo visible del teleprompter');
    assert.equal(rTexto.success, true, JSON.stringify(rTexto));
    // El relanzamiento CON texto (solo preview: sin compositor).
    const huboTexto = await esperarV330(() => contenidosArgvV330(dir).some((c) => esArgvPreviewConTexto(c)));
    assert.ok(huboTexto, 'debió existir el relanzamiento con textoverlay');
    const argvTexto = contenidosArgvV330(dir).find((c) => esArgvPreviewConTexto(c)) || '';
    assert.ok(argvTexto.includes('text=Tramo visible del teleprompter'), argvTexto.slice(0, 300));
    // La red de seguridad: aparece un SEGUNDO preview sin texto (el
    // primero fue la sonda/sesión), y previewTextActive queda en
    // false, declarado en el registro.
    const huboRed = await esperarV330(() => contenidosArgvV330(dir).filter((c) => esArgvPreviewSinTexto(c)).length >= 2
      && engine.getState().previewTextActive === false);
    assert.ok(huboRed, 'la red debió relanzar el preview sin texto y desactivar previewTextActive');
    assert.ok(logs.join('\n').includes('se relanza SIN texto una vez'), logs.join(' | ').slice(0, 600));
    // La sesión de vista previa siguió, intacta: ningún lanzamiento
    // con compositor en todo el ejercicio, y 3 lanzamientos en total
    // (vista previa + texto + red sin texto).
    assert.equal(engine.getState().phase, 'vista-previa');
    assert.equal(contenidosArgvV330(dir).filter((c) => esArgvSesion(c)).length, 0);
    assert.equal(fs.readFileSync(path.join(dir, 'lanzamientos.txt'), 'utf8'), '3');
    const rStop = await engine.stop();
    assert.equal(rStop.success, true);
  } finally {
    try { await engine.stop(); } catch (e) {}
    delete process.env.PS_V330_DIR;
    delete process.env.PS_V330_TEXTO;
  }
});

test('v3.3.0 · setPreviewText sobre la vista previa: con el proceso sano, el texto queda activo y no hay relanzamiento extra', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podcastudio-motor-v330-texto-ok-'));
  const outDir = path.join(dir, 'salida');
  fs.mkdirSync(outDir, { recursive: true });
  process.env.PS_V330_DIR = dir;
  const { engine } = prepararMotorV330(dir);
  try {
    const r1 = await engine.start('preview', { outDir });
    assert.equal(r1.success, true, JSON.stringify(r1));
    const rTexto = engine.setPreviewText('Primera línea del guion');
    assert.equal(rTexto.success, true, JSON.stringify(rTexto));
    assert.equal(engine.getState().previewTextActive, true);
    const huboTexto = await esperarV330(() => contenidosArgvV330(dir).some((c) => esArgvPreviewConTexto(c)));
    assert.ok(huboTexto);
    // Margen de sobra sobre los 1500 ms de la red: no debe aparecer un
    // tercer lanzamiento ni caerse el texto.
    await new Promise((r) => setTimeout(r, 1800));
    assert.equal(fs.readFileSync(path.join(dir, 'lanzamientos.txt'), 'utf8'), '2');
    assert.equal(engine.getState().previewTextActive, true);
    assert.equal(engine.getState().phase, 'vista-previa');
    const rStop = await engine.stop();
    assert.equal(rStop.success, true);
  } finally {
    try { await engine.stop(); } catch (e) {}
    delete process.env.PS_V330_DIR;
  }
});

// (i) Corrección tras la compuerta — la regresión exacta del smoke
// real: el primer arranque de la v3.3.0 fue un 'record' con la sonda
// viviendo en paralelo, y la sesión murió a los ~2 s. Aquí el primer
// arranque ES un record: no debe existir ningún lanzamiento con la
// forma de la vista previa independiente, ni sonda, ni veredicto.
test('v3.3.0 · un solo lector (i): el primer arranque de grabación NO lanza vista previa independiente ni sonda, y la sesión lleva su rama integrada', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podcastudio-motor-v330-unsolo-'));
  const outDir = path.join(dir, 'salida');
  fs.mkdirSync(outDir, { recursive: true });
  process.env.PS_V330_DIR = dir;
  const { engine } = prepararMotorV330(dir);
  try {
    const r1 = await engine.start('record', { outDir });
    assert.equal(r1.success, true, JSON.stringify(r1));
    const st = engine.getState();
    assert.equal(st.phase, 'grabando');
    // Sin sesión de vista previa previa no hay veredicto: la sonda
    // SOLO corre en sesiones de vista previa (corrección).
    assert.equal(st.concurrentPreview, null);
    // UN solo lanzamiento: la sesión. Nada de proceso independiente.
    await esperarV330(() => contenidosArgvV330(dir).length >= 1);
    assert.equal(fs.readFileSync(path.join(dir, 'lanzamientos.txt'), 'utf8'), '1');
    const argvSesion = contenidosArgvV330(dir).find((c) => esArgvSesion(c)) || '';
    assert.ok(argvSesion.includes('fakesink') && !argvSesion.includes('d3d11videosink'), 'la sesión lleva su rama integrada a fakesink (v3.3.6: sin ventana)');
    assert.equal(contenidosArgvV330(dir).filter((c) => esArgvPreviewSinTexto(c)).length, 0, 'ningún lanzamiento tiene la forma de la vista previa independiente');
    assert.equal(contenidosArgvV330(dir).filter((c) => esArgvPreviewConTexto(c)).length, 0);
    const rStop = await engine.stop();
    assert.equal(rStop.success, true);
    assert.equal(engine.getState().validation.valid, true);
  } finally {
    try { await engine.stop(); } catch (e) {}
    delete process.env.PS_V330_DIR;
  }
});

// (i) Corrección tras la compuerta — el ORDEN: si una vista previa
// independiente acaba de cerrarse (su 'close' aún en vuelo tras el
// stop), el arranque de grabación la detiene y ESPERA su salida ANTES
// de lanzar la tubería de la sesión: la confirmación queda en el
// registro antes que la línea «Tubería:» y no hay relanzamiento.
test('v3.3.0 · un solo lector (i): tras una vista previa, la grabación confirma la salida del proceso independiente ANTES de lanzar la tubería', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podcastudio-motor-v330-orden-'));
  const outDir = path.join(dir, 'salida');
  fs.mkdirSync(outDir, { recursive: true });
  process.env.PS_V330_DIR = dir;
  const { engine, logs } = prepararMotorV330(dir);
  try {
    const r1 = await engine.start('preview', { outDir });
    assert.equal(r1.success, true, JSON.stringify(r1));
    assert.equal(engine.getState().concurrentPreview, true);
    const rStop1 = await engine.stop();
    assert.equal(rStop1.success, true);
    // Sin pausa: la grabación arranca con el cierre de la vista
    // previa recién ordenado; el motor debe esperar su salida antes
    // de la tubería (un solo lector de la cámara).
    const r2 = await engine.start('record', { outDir });
    assert.equal(r2.success, true, JSON.stringify(r2));
    assert.equal(engine.getState().phase, 'grabando');
    const textoLogs = logs.join('\n');
    const iConfirma = textoLogs.indexOf('salida confirmada ANTES de lanzar la sesión');
    const iTuberia = textoLogs.lastIndexOf('Tubería:');
    assert.ok(iConfirma >= 0, 'debió quedar la confirmación declarada de la salida');
    assert.ok(iTuberia > iConfirma, 'la confirmación precede a la tubería de la sesión');
    await esperarV330(() => contenidosArgvV330(dir).length >= 2);
    assert.equal(fs.readFileSync(path.join(dir, 'lanzamientos.txt'), 'utf8'), '2', 'vista previa + sesión: la grabación no relanzó la vista previa');
    const argvSesion = contenidosArgvV330(dir).find((c) => esArgvSesion(c)) || '';
    assert.ok(argvSesion.includes('fakesink') && !argvSesion.includes('d3d11videosink'), 'la sesión lleva su rama integrada a fakesink (v3.3.6: sin ventana)');
    const rStop = await engine.stop();
    assert.equal(rStop.success, true);
    assert.equal(engine.getState().validation.valid, true);
  } finally {
    try { await engine.stop(); } catch (e) {}
    delete process.env.PS_V330_DIR;
  }
});

// (ii) Corrección tras la compuerta: durante una grabación,
// setPreviewText es un NO-OP declarado — queda la nota en el estado,
// la declaración se registra una sola vez por sesión, no se lanza
// ningún proceso y la sesión sigue grabando intacta.
test('v3.3.0 · un solo lector (ii): setPreviewText durante una grabación es un no-op declarado en el estado y no toca la sesión', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podcastudio-motor-v330-noop-'));
  const outDir = path.join(dir, 'salida');
  fs.mkdirSync(outDir, { recursive: true });
  process.env.PS_V330_DIR = dir;
  const { engine, logs } = prepararMotorV330(dir);
  try {
    // Veredicto true ganado FUERA de sesión (la vista previa), como
    // en la app real antes de grabar.
    const r0 = await engine.start('preview', { outDir });
    assert.equal(r0.success, true, JSON.stringify(r0));
    assert.equal(engine.getState().concurrentPreview, true);
    const rStop0 = await engine.stop();
    assert.equal(rStop0.success, true);
    const r1 = await engine.start('record', { outDir });
    assert.equal(r1.success, true, JSON.stringify(r1));
    assert.equal(engine.getState().phase, 'grabando');
    await esperarV330(() => contenidosArgvV330(dir).length >= 2);
    const lanzamientosAntes = fs.readFileSync(path.join(dir, 'lanzamientos.txt'), 'utf8');
    const rTexto = engine.setPreviewText('Texto que NO debe convivir con la grabación');
    assert.equal(rTexto.success, false);
    assert.ok(rTexto.error.includes('fuera de sesión'), rTexto.error);
    const st = engine.getState();
    assert.equal(st.previewTextActive, false);
    assert.ok(st.previewTextNote && st.previewTextNote.includes('fuera de sesión'), 'la nota declarada queda en el estado');
    // La sesión sigue grabando, intacta, y no se lanzó nada más.
    assert.equal(engine.getState().phase, 'grabando');
    assert.equal(fs.readFileSync(path.join(dir, 'lanzamientos.txt'), 'utf8'), lanzamientosAntes, 'el no-op no relanza ningún proceso');
    // La declaración se registra UNA vez aunque la app sondee de nuevo.
    const rTexto2 = engine.setPreviewText('Otro tramo más');
    assert.equal(rTexto2.success, false);
    const declaraciones = logs.join('\n').split('NO-OP declarado').length - 1;
    assert.equal(declaraciones, 1, 'la declaración del no-op se registra una sola vez por sesión');
    const rStop = await engine.stop();
    assert.equal(rStop.success, true);
  } finally {
    try { await engine.stop(); } catch (e) {}
    delete process.env.PS_V330_DIR;
  }
});

// ===========================================================================
// v3.3.1 — defecto 3 (emparejamiento con sufijo VID:PID) y defecto 4
// (la sesión sale de la cámara de programa o NO arranca; jamás la
// sustituye en silencio dejando la fase en «error»).
// ===========================================================================

test('v3.3.1 · defecto 3: la de programa «EasyCamera (04f2:b57e)» empareja con la entrada MF «EasyCamera»', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podcastudio-motor-v331-sufijo-'));
  const outDir = path.join(dir, 'salida');
  fs.mkdirSync(outDir, { recursive: true });
  process.env.PS_V330_DIR = dir;
  const { engine, logs } = prepararMotorV330(dir);
  try {
    const r = await engine.start({
      session: 'record', outDir,
      sources: ['EasyCamera (04f2:b57e)'],
      programIndex: 0,
    });
    assert.equal(r.success, true, JSON.stringify(r));
    const st = engine.getState();
    assert.equal(st.phase, 'grabando');
    assert.deepEqual(st.sourceNames, ['EasyCamera']);
    assert.ok(!logs.join('\n').includes('no está disponible'), 'no debió declararse indisponible');
    const rStop = await engine.stop();
    assert.equal(rStop.success, true);
  } finally {
    try { await engine.stop(); } catch (e) {}
    delete process.env.PS_V330_DIR;
  }
});

test('v3.3.1 · defecto 3+4: cameraName explícito con sufijo VID:PID también empareja (camino de una cámara)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podcastudio-motor-v331-nombre-'));
  const outDir = path.join(dir, 'salida');
  fs.mkdirSync(outDir, { recursive: true });
  process.env.PS_V330_DIR = dir;
  const { engine } = prepararMotorV330(dir);
  try {
    const r = await engine.start({ session: 'record', outDir, cameraName: 'EasyCamera (04f2:b57e)' });
    assert.equal(r.success, true, JSON.stringify(r));
    assert.equal(engine.getState().phase, 'grabando');
    assert.equal(engine.getState().cameraName, 'EasyCamera');
    const rStop = await engine.stop();
    assert.equal(rStop.success, true);
  } finally {
    try { await engine.stop(); } catch (e) {}
    delete process.env.PS_V330_DIR;
  }
});

test('v3.3.1 · defecto 4: programa que no empareja → NO arranca, NO sustituye y la fase NO queda en error', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podcastudio-motor-v331-noprog-'));
  const outDir = path.join(dir, 'salida');
  fs.mkdirSync(outDir, { recursive: true });
  process.env.PS_V330_DIR = dir;
  const { engine } = prepararMotorV330(dir);
  try {
    const r = await engine.start({
      session: 'record', outDir,
      sources: ['Cámara Fantasma', 'EasyCamera'],
      programIndex: 0,
    });
    assert.equal(r.success, false);
    assert.equal(r.code, 'PROGRAMA_NO_DISPONIBLE');
    assert.ok(r.error.includes('Cámara Fantasma'), r.error);
    const st = engine.getState();
    assert.equal(st.phase, 'apagado', 'la fase no puede quedar en «error»: la sesión nunca arrancó');
    assert.equal(st.programUnavailable, 'Cámara Fantasma');
    assert.ok(!fs.existsSync(path.join(dir, 'lanzamientos.txt')), 'no debió lanzarse ninguna tubería');
  } finally {
    try { await engine.stop(); } catch (e) {}
    delete process.env.PS_V330_DIR;
  }
});

test('v3.3.1 · defecto 4: cameraName explícito que no empareja → tampoco hay sustitución silenciosa', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podcastudio-motor-v331-nosust-'));
  const outDir = path.join(dir, 'salida');
  fs.mkdirSync(outDir, { recursive: true });
  process.env.PS_V330_DIR = dir;
  const { engine } = prepararMotorV330(dir);
  try {
    const r = await engine.start({ session: 'record', outDir, cameraName: 'Cámara Fantasma' });
    assert.equal(r.success, false);
    assert.equal(r.code, 'PROGRAMA_NO_DISPONIBLE');
    const st = engine.getState();
    assert.equal(st.phase, 'apagado');
    assert.equal(st.programUnavailable, 'Cámara Fantasma');
    assert.ok(!fs.existsSync(path.join(dir, 'lanzamientos.txt')), 'no debió lanzarse ninguna tubería');
  } finally {
    try { await engine.stop(); } catch (e) {}
    delete process.env.PS_V330_DIR;
  }
});

// ===========================================================================
// v3.3.3 — defecto C: la VISTA PREVIA CEDE ante grabar/transmitir.
// Reportado por Luis (2026-11-13, captura image-135): con la vista
// previa del motor abierta (fase «vista-previa»), INICIAR GRABACIÓN
// devolvía «Ya hay una sesión del motor nativo en curso.» y no grababa.
// La vista previa es un estado de espera: un arranque record/
// recordStream la detiene PRIMERO (la parada real de siempre) y luego
// arranca — orden stop→start, cero errores —. El error queda SOLO para
// conflictos reales (grabar/transmitir contra grabar/transmitir, y la
// vista previa contra cualquier sesión viva). Blindaje añadido por
// orden de Luis: estas pruebas fijan las transiciones de sesión del
// motor junto a las de la v3.2.2 (subidas renderer) y la corrección de
// un solo lector de la v3.3.0.
// ===========================================================================

test('v3.3.3 · defecto C: con la vista previa viva, start(record) CEDE — detiene la previa y graba sin error', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podcastudio-motor-v333-cede-'));
  const outDir = path.join(dir, 'salida');
  fs.mkdirSync(outDir, { recursive: true });
  process.env.PS_V330_DIR = dir;
  const { engine, logs } = prepararMotorV330(dir);
  try {
    const rPrev = await engine.start('preview', { outDir });
    assert.equal(rPrev.success, true, JSON.stringify(rPrev));
    assert.equal(engine.getState().phase, 'vista-previa');
    assert.equal(engine.getState().concurrentPreview, true);
    // SIN pulsar Detener: Grabar llega con la vista previa en curso
    // — el gesto exacto de la captura de Luis —.
    const rRec = await engine.start('record', { outDir });
    assert.equal(rRec.success, true, JSON.stringify(rRec));
    assert.notEqual(rRec.error, 'Ya hay una sesión del motor nativo en curso.');
    assert.equal(engine.getState().phase, 'grabando');
    assert.equal(engine.getState().session, 'record');
    const textoLogs = logs.join('\n');
    const iCede = textoLogs.indexOf('La vista previa cede ante el arranque');
    const iTuberia = textoLogs.lastIndexOf('Tubería:');
    assert.ok(iCede >= 0, 'la cesión quedó declarada en el registro');
    assert.ok(iTuberia > iCede, 'orden stop→start: la declaración de la cesión (con su parada) precede a la tubería de grabación');
    // La grabación nacida de la cesión lleva su rama integrada (nunca
    // el proceso independiente en paralelo: un solo lector).
    await esperarV330(() => contenidosArgvV330(dir).some((c) => esArgvSesion(c)));
    const argvSesion = contenidosArgvV330(dir).find((c) => esArgvSesion(c)) || '';
    assert.ok(argvSesion.includes('fakesink') && !argvSesion.includes('d3d11videosink'), 'la sesión lleva su rama integrada a fakesink (v3.3.6: sin ventana)');
    const rStop = await engine.stop();
    assert.equal(rStop.success, true);
    assert.equal(engine.getState().validation.valid, true, 'la grabación nacida de la cesión valida al detener');
  } finally {
    try { await engine.stop(); } catch (e) {}
    delete process.env.PS_V330_DIR;
  }
});

test('v3.3.3 · defecto C: la cesión también cubre recordStream (grabar+transmitir) desde la vista previa', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podcastudio-motor-v333-cede-rs-'));
  const outDir = path.join(dir, 'salida');
  fs.mkdirSync(outDir, { recursive: true });
  process.env.PS_V330_DIR = dir;
  const { engine } = prepararMotorV330(dir);
  try {
    const rPrev = await engine.start('preview', { outDir });
    assert.equal(rPrev.success, true, JSON.stringify(rPrev));
    const rRs = await engine.start('recordStream', { outDir });
    assert.equal(rRs.success, true, JSON.stringify(rRs));
    assert.equal(engine.getState().phase, 'grabando-transmitiendo');
    const rStop = await engine.stop();
    assert.equal(rStop.success, true);
  } finally {
    try { await engine.stop(); } catch (e) {}
    delete process.env.PS_V330_DIR;
  }
});

test('v3.3.3 · defecto C: los conflictos REALES siguen rechazados con «Ya hay una sesión» (el error no desaparece)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podcastudio-motor-v333-conflicto-'));
  const outDir = path.join(dir, 'salida');
  fs.mkdirSync(outDir, { recursive: true });
  process.env.PS_V330_DIR = dir;
  const { engine } = prepararMotorV330(dir);
  try {
    const rRec = await engine.start('record', { outDir });
    assert.equal(rRec.success, true, JSON.stringify(rRec));
    // Grabar contra grabar (directo al motor, sin los botones que
    // reinician desde la v3.2.2): conflicto real, se rechaza.
    const rDoble = await engine.start('record', { outDir });
    assert.equal(rDoble.success, false);
    assert.equal(rDoble.error, 'Ya hay una sesión del motor nativo en curso.');
    // La vista previa contra una grabación viva: también conflicto.
    const rPrev = await engine.start('preview', { outDir });
    assert.equal(rPrev.success, false);
    assert.equal(rPrev.error, 'Ya hay una sesión del motor nativo en curso.');
    // Nada de lo rechazado tocó la sesión en curso.
    assert.equal(engine.getState().phase, 'grabando');
    const rStop = await engine.stop();
    assert.equal(rStop.success, true);
  } finally {
    try { await engine.stop(); } catch (e) {}
    delete process.env.PS_V330_DIR;
  }
});
