const { ipcMain } = require('electron');
const nativeEngine = require('./index');

let nativeEngineRunning = false;

function setupNativeEngineIPC() {
  ipcMain.handle('native-engine:start', async (_event, opts) => {
    try {
      const result = nativeEngine.start(opts || {});
      nativeEngineRunning = result.success;
      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('native-engine:write-frame', async (_event, buffer) => {
    try {
      if (!nativeEngineRunning) return false;
      // buffer puede venir como ArrayBuffer/Uint8Array
      const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
      return nativeEngine.writeFrame(buf);
    } catch (e) {
      return false;
    }
  });

  ipcMain.handle('native-engine:write-audio', async (_event, buffer) => {
    try {
      if (!nativeEngineRunning) return false;
      const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
      return nativeEngine.writeAudio(buf);
    } catch (e) {
      return false;
    }
  });

  ipcMain.handle('native-engine:stop', async () => {
    try {
      const result = nativeEngine.stop();
      nativeEngineRunning = false;
      return result;
    } catch (e) {
      nativeEngineRunning = false;
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('native-engine:status', async () => {
    try {
      return nativeEngine.getStatus();
    } catch (e) {
      return { running: false, connected: false, error: e.message };
    }
  });
}

module.exports = { setupNativeEngineIPC };
