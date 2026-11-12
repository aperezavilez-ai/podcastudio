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
  ENCODER_LADDER,
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
  assert.equal(dispositivos[0].deviceIndex, 0);
  assert.equal(dispositivos[1].deviceIndex, 1);
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

test('tubería: preview contiene compositor, sink nativo y bt709, sin rtmp', () => {
  const unida = argsDe('preview').join(' ');
  assert.ok(unida.includes('d3d11compositor'));
  assert.ok(unida.includes('d3d11videosink'));
  assert.ok(unida.includes('colorimetry=bt709'));
  assert.ok(unida.includes('1920'));
  assert.ok(!unida.includes('rtmpsink'));
  assert.ok(!unida.includes('fragment-duration=2000'));
});

test('tubería: record contiene preset=hq, bitrate=12000 y MP4 fragmentado', () => {
  const tokens = argsDe('record');
  const unida = tokens.join(' ');
  assert.ok(unida.includes('d3d11compositor'));
  assert.ok(unida.includes('d3d11videosink'));
  assert.ok(unida.includes('colorimetry=bt709'));
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

test('tubería: sin device-path se marca el respaldo por device-index', () => {
  const tokens = buildPipelineArgs({ session: 'preview', deviceIndex: 2, devicePath: null, caps: CAPS_1080, encoder: 'nvh264enc' });
  assert.equal(tokens.usedDeviceIndexFallback, true);
  assert.ok(tokens.join(' ').includes('device-index=2'));
  const conPath = argsDe('preview');
  assert.equal(conPath.usedDeviceIndexFallback, false);
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
