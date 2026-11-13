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

test('tubería: preview contiene compositor y sink nativo, sin rtmp (v3.2.1: sin caps forzado)', () => {
  const unida = argsDe('preview').join(' ');
  assert.ok(unida.includes('d3d11compositor'));
  assert.ok(unida.includes('d3d11videosink'));
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
  assert.ok(unida.includes('d3d11videosink'));
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
  assert.ok(tokens.includes('d3d11videosink'), 'la vista previa nativa sigue presente');
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
if (process.env.PS_HITO3_ARGV_FILE) { try { fs.writeFileSync(process.env.PS_HITO3_ARGV_FILE, process.argv.slice(2).join('\\n')); } catch (e) {} }
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
