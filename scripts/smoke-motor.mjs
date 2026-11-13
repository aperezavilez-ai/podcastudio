// ============================================================================
// SMOKE DEL MOTOR NATIVO — COMPUERTA DE PUBLICACIÓN (v3.2.1)
//
// Nació del fallo en vivo de la v3.2.0: la suite en verde NO prueba que
// la tubería de GStreamer enlace y viva en la máquina real («could not
// link queue2 to nvh264enc0» con 118 tests en verde). Este script corre
// las sesiones REALES del motor contra la cámara REAL, sin Electron:
//
//   node scripts/smoke-motor.mjs
//
// Orden: herramientas → enumeración de cámaras → preview (6 s vivo) →
// record (6 s + máster VALIDADO) → recordStream local (6 s + máster
// VALIDADO). Cada paso imprime «SMOKE <paso>: OK|FALLA — <detalle>» y al
// final «SMOKE RESULTADO: PASA|NO PASA» (código de salida 0/1).
//
// REGLA DE PUBLICACIÓN: con la app CERRADA, si este smoke no dice PASA,
// NO se publica la versión y se reporta su salida textual completa.
// ============================================================================
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const require = createRequire(import.meta.url);
const {
  createNativeEngine,
  locateGstTools,
  parseDeviceMonitorOutput,
  chooseDevice,
  chooseCapsForDevice,
} = require('../electron/native-engine.js');

let ffmpegPath = null;
try { ffmpegPath = require('ffmpeg-static'); } catch (e) { ffmpegPath = null; }
if (typeof ffmpegPath !== 'string' || !ffmpegPath) ffmpegPath = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let todoOk = true;
function registrar(paso, ok, detalle) {
  console.log(`SMOKE ${paso}: ${ok ? 'OK' : 'FALLA'} — ${detalle}`);
  if (!ok) todoOk = false;
}

// Ejecuta un proceso capturando su salida, con tiempo límite.
function ejecutar(cmd, args, timeoutMs) {
  return new Promise((resolve) => {
    let proc;
    try { proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }); }
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

const engine = createNativeEngine({
  ffmpegPath,
  log: (linea) => console.log(linea),
  onState: () => {},
});

async function esperarFase(fase, timeoutMs) {
  const t0 = Date.now();
  let st = engine.getState();
  while (Date.now() - t0 < timeoutMs) {
    st = engine.getState();
    if (st.phase === fase || st.phase === 'error') return st;
    await sleep(250);
  }
  return st;
}

// Exige que la fase se sostenga el tiempo dado: si el proceso muere al
// nacer (el fallo de la v3.2.0), la fase cae a «error» y esto lo caza.
async function vigilarVivo(ms, fase) {
  const t0 = Date.now();
  let st = engine.getState();
  while (Date.now() - t0 < ms) {
    st = engine.getState();
    if (st.phase !== fase) return { ok: false, state: st };
    await sleep(250);
  }
  return { ok: true, state: engine.getState() };
}

async function sesionDePrueba(nombre, faseEsperada, exigeValidacion, outDir) {
  const res = await engine.start({ session: nombre, outDir });
  if (!res?.success) {
    registrar(nombre, false, res?.error || 'start() no tuvo éxito.');
    try { await engine.stop(); } catch (e) {}
    return;
  }
  const st = await esperarFase(faseEsperada, 20000);
  if (!st || st.phase !== faseEsperada) {
    registrar(nombre, false, `no llegó la fase «${faseEsperada}» en 20 s (fase: ${st?.phase || '—'}; error del motor: ${st?.lastError || '—'}).`);
    try { await engine.stop(); } catch (e) {}
    return;
  }
  const vivo = await vigilarVivo(6000, faseEsperada);
  if (!vivo.ok) {
    registrar(nombre, false, `el proceso NO se sostuvo 6 s en «${faseEsperada}» (fase al caer: ${vivo.state?.phase || '—'}; error del motor: ${vivo.state?.lastError || '—'}).`);
    try { await engine.stop(); } catch (e) {}
    return;
  }
  await engine.stop();
  const fin = engine.getState();
  if (exigeValidacion) {
    const v = fin?.validation;
    if (v?.valid === true) {
      const sv = fin?.streamValidation;
      const detalleStream = sv ? ` Stream local: ${sv.valid ? 'VÁLIDO' : 'NO válido'} (${sv.bytes} bytes).` : '';
      registrar(nombre, true, `fase «${faseEsperada}» sostenida 6 s y máster VÁLIDO (${v.durationSec} s, ${v.width}x${v.height}, ${v.bytes} bytes).${detalleStream}`);
    } else {
      registrar(nombre, false, `tras la parada el máster NO superó la validación (error: ${fin?.lastError || v?.error || '—'}).`);
    }
  } else {
    registrar(nombre, true, `fase «${faseEsperada}» sostenida 6 s con el proceso vivo.`);
  }
}

async function main() {
  console.log('SMOKE DEL MOTOR NATIVO — sesiones reales contra la cámara real (la app debe estar CERRADA).');
  let puedeSeguir = true;

  // 1) Herramientas de GStreamer (la misma localización del motor: PATH
  // y %LOCALAPPDATA%\Programs\gstreamer\1.0\msvc_x86_64\bin incluidos).
  const tools = locateGstTools({});
  if (!tools) {
    registrar('herramientas', false, 'GStreamer no localizado: falta gst-launch-1.0, gst-inspect-1.0 o gst-device-monitor-1.0 (PATH / PODCASTUDIO_GST_BIN / instalación MSVC x86_64).');
    puedeSeguir = false;
  } else if (!ffmpegPath) {
    registrar('herramientas', false, 'ffmpeg-static no resolvió un binario ffmpeg: sin sonda no se puede validar el máster.');
    puedeSeguir = false;
  } else {
    registrar('herramientas', true, `gst-launch-1.0 en ${tools.launch}`);
  }

  // 2) Enumeración de cámaras con los helpers puros del propio motor.
  if (puedeSeguir) {
    const rMon = await ejecutar(tools.monitor, ['Video/Source'], 15000);
    const dispositivos = parseDeviceMonitorOutput(rMon.stdout || '');
    if (dispositivos.length === 0) {
      registrar('camaras', false, `gst-device-monitor-1.0 no enumeró ninguna cámara Video/Source${rMon.error ? ` (${rMon.error})` : ''}.`);
      puedeSeguir = false;
    } else {
      const device = chooseDevice(dispositivos);
      const caps = device ? chooseCapsForDevice(device) : null;
      registrar('camaras', true, `${dispositivos.length} entrada(s) enumerada(s); la elección por defecto del motor es «${device?.name || '—'}»${caps ? ` a ${caps.width}x${caps.height}@${caps.framerate != null ? caps.framerate : '?'} (${caps.format || 'formato sin declarar'})` : ' sin caps usable'}.`);
      if (!caps) puedeSeguir = false;
    }
  }

  // 3) Sesiones reales, en orden, 6 s vivas cada una.
  if (puedeSeguir) {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'podcastudio-smoke-'));
    console.log(`SMOKE carpeta temporal de grabación: ${outDir}`);
    await sesionDePrueba('preview', 'vista-previa', false, outDir);
    await sesionDePrueba('record', 'grabando', true, outDir);
    // recordStream SIN streamUrls: la prueba local interna del motor
    // (oyente RTMP en 127.0.0.1:1935 y FLV recibido en la carpeta).
    await sesionDePrueba('recordStream', 'grabando-transmitiendo', true, outDir);
  }
}

main()
  .catch((e) => {
    todoOk = false;
    console.log(`SMOKE excepción: ${e?.message || String(e)}`);
  })
  .finally(async () => {
    // La cámara queda libre pase lo que pase.
    try { await engine.stop(); } catch (e) {}
    console.log(`SMOKE RESULTADO: ${todoOk ? 'PASA' : 'NO PASA'}`);
    process.exit(todoOk ? 0 : 1);
  });
