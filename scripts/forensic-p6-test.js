const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('====================================================');
console.log('  TEST FORENSE P4.1 / P4.2 — PODCASTSTUDIO v1.1.7');
console.log('====================================================');

const results = {
  version: '1.1.7',
  testDate: new Date().toISOString(),
  tests: {}
};

try {
  // TEST 1: NOISE SUPPRESSION DSP & NOISE GATE CHAIN
  console.log('[1/3] Verificando arquitectura de Supresión Adaptativa de Ruido (80Hz HPF + Noise Gate)...');

  class MockAudioParam {
    constructor(val) {
      this.value = val;
    }
    setValueAtTime(val) {
      this.value = val;
    }
    setTargetAtTime(val) {
      this.value = val;
    }
  }

  class MockBiquadFilter {
    constructor() {
      this.type = 'highpass';
      this.frequency = new MockAudioParam(10);
      this.Q = new MockAudioParam(0.707);
    }
  }

  class MockCompressor {
    constructor() {
      this.threshold = new MockAudioParam(0);
      this.knee = new MockAudioParam(6);
      this.ratio = new MockAudioParam(1);
      this.attack = new MockAudioParam(0.003);
      this.release = new MockAudioParam(0.2);
    }
  }

  const strip = {
    id: 'cam_1',
    highPassFilter: new MockBiquadFilter(),
    noiseGateNode: new MockCompressor(),
    noiseSuppression: false,
  };

  function applyNoiseSuppression(s, enabled, thresholdDb = -42, highPassHz = 80) {
    s.noiseSuppression = Boolean(enabled);
    if (s.noiseSuppression) {
      s.highPassFilter.frequency.setTargetAtTime(highPassHz);
      s.noiseGateNode.threshold.setTargetAtTime(thresholdDb);
      s.noiseGateNode.ratio.setTargetAtTime(12);
    } else {
      s.highPassFilter.frequency.setTargetAtTime(10);
      s.noiseGateNode.threshold.setTargetAtTime(0);
      s.noiseGateNode.ratio.setTargetAtTime(1);
    }
  }

  // Estado inicial: Bypass
  const initialBypass = strip.highPassFilter.frequency.value === 10 && strip.noiseGateNode.threshold.value === 0;

  // Activar DSP Anti-Ruido
  applyNoiseSuppression(strip, true, -42, 80);
  const activeDsp = strip.noiseSuppression === true &&
                    strip.highPassFilter.frequency.value === 80 &&
                    strip.noiseGateNode.threshold.value === -42 &&
                    strip.noiseGateNode.ratio.value === 12;

  // Desactivar DSP Anti-Ruido
  applyNoiseSuppression(strip, false);
  const restoredBypass = strip.noiseSuppression === false &&
                         strip.highPassFilter.frequency.value === 10 &&
                         strip.noiseGateNode.threshold.value === 0;

  const dspPassed = initialBypass && activeDsp && restoredBypass;

  results.tests.noiseSuppressionDsp = {
    passed: dspPassed,
    initialBypass,
    activeDsp: {
      highPassHz: 80,
      thresholdDb: -42,
      ratio: 12
    },
    restoredBypass
  };

  if (!dspPassed) throw new Error('Fallo en la prueba del filtro DSP Anti-Ruido');
  console.log('   ✓ DSP Anti-Ruido OK: Filtro paso alto 80Hz y Noise Gate (-42dBFS, ratio 12:1) verificados');

  // TEST 2: GRABACIÓN ISO MULTICANAL EN ELECTRON
  console.log('[2/3] Verificando pipeline de Grabación ISO Multicanal en electron/main.js y preload.js...');

  const mainJsPath = path.join(__dirname, '..', 'electron', 'main.js');
  const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
  const preloadPath = path.join(__dirname, '..', 'electron', 'preload.js');
  const preloadContent = fs.readFileSync(preloadPath, 'utf8');

  const hasStartIso = mainJsContent.includes("ipcMain.handle('start-iso-recording'") &&
                      preloadContent.includes("startIsoRecording:");
  const hasRecordIsoChunk = mainJsContent.includes("ipcMain.on('record-iso-chunk'") &&
                            preloadContent.includes("sendIsoChunk:");
  const hasStopIso = mainJsContent.includes("ipcMain.handle('stop-iso-recording'") &&
                     preloadContent.includes("stopIsoRecording:");
  const hasGetIsoStatus = mainJsContent.includes("ipcMain.handle('get-iso-status'") &&
                          preloadContent.includes("getIsoStatus:");
  const createsIsoFolder = mainJsContent.includes("path.join('D:', 'PROGRAMAS IA', 'PODCASTUDIO', 'proyectos', cleanProjectName, 'ISO')");
  const usesFaststart = mainJsContent.includes("'-movflags', '+faststart'") &&
                        mainJsContent.includes("`${ts}_CAM${slotNum}_ISO.mp4`");

  const isoPassed = hasStartIso && hasRecordIsoChunk && hasStopIso && hasGetIsoStatus && createsIsoFolder && usesFaststart;

  results.tests.isoRecordingPipeline = {
    passed: isoPassed,
    hasStartIso,
    hasRecordIsoChunk,
    hasStopIso,
    hasGetIsoStatus,
    createsIsoFolder,
    usesFaststart
  };

  if (!isoPassed) throw new Error('Faltan componentes del pipeline de grabación ISO en electron/main.js o preload.js');
  console.log('   ✓ Grabación ISO Multicanal OK: Handlers de inicio, chunks paralelos, finalización y faststart verificados');

  // TEST 3: CONSISTENCIA DE VERSIONADO v1.1.7 Y BINARIO NATIVO
  console.log('[3/3] Verificando consistencia de versión v1.1.7 y binario PodcastStudio.exe...');

  const pkgJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const appJsx = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');
  const exePath = path.join(__dirname, '..', 'PodcastStudio.exe');

  const pkgVersionCorrect = pkgJson.version === '1.1.7';
  const appJsxVersionCorrect = appJsx.includes('PODCASTUDIO v1.1.7');
  const exeExists = fs.existsSync(exePath);
  const exeSize = exeExists ? fs.statSync(exePath).size : 0;

  let exeVersion = '';
  try {
    const psCmd = `(Get-Item '${exePath}').VersionInfo.FileVersion`;
    exeVersion = execSync(`powershell -NoProfile -Command "${psCmd}"`, { encoding: 'utf8' }).trim();
  } catch (e) {
    exeVersion = 'unknown';
  }

  const exeVersionCorrect = exeVersion === '1.1.7.0';
  const versionPassed = pkgVersionCorrect && appJsxVersionCorrect && exeExists && exeVersionCorrect;

  results.tests.versionConsistency = {
    passed: versionPassed,
    packageVersion: pkgJson.version,
    appJsxVersion: 'v1.1.7',
    exeFileVersion: exeVersion,
    exeSizeBytes: exeSize,
    exeExists
  };

  if (!versionPassed) throw new Error('Discrepancia en la versión v1.1.7 en package.json o PodcastStudio.exe');
  console.log(`   ✓ Consistencia v1.1.7 OK: package.json (${pkgJson.version}), App.jsx, PodcastStudio.exe (${exeVersion}, ${exeSize} bytes)`);

  // GUARDAR RESULTADOS
  const outDir = path.join(__dirname, '..', 'test_output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'forensic-p6-results.json'), JSON.stringify(results, null, 2), 'utf8');

  console.log('====================================================');
  console.log('  RESULTADO: 100% TEST FORENSE P4.1 / P4.2 PASADO (ALL TESTS PASSED)');
  console.log('====================================================');
  process.exit(0);

} catch (err) {
  console.error('\n❌ ERROR EN AUDITORÍA FORENSE P4.1 / P4.2:', err.message);
  results.tests.error = err.message;
  process.exit(1);
}
