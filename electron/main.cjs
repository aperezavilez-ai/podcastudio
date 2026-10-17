const { app, BrowserWindow, session, ipcMain } = require('electron')
const path = require('path')

// ============================================================================
// ACELERACIÓN POR HARDWARE Y OPTIMIZACIÓN BROADCAST GPU
// ============================================================================
// Habilita rasterización directa por GPU, códecs de video acelerados por hardware
// y evita que Chromium congele o desacelere el renderizado cuando la app está en segundo plano.
app.commandLine.appendSwitch('enable-gpu-rasterization')
app.commandLine.appendSwitch('enable-zero-copy')
app.commandLine.appendSwitch('ignore-gpu-blocklist')
app.commandLine.appendSwitch('enable-native-gpu-memory-buffers')
app.commandLine.appendSwitch(
  'enable-features',
  'VaapiVideoDecoder,CanvasOopRasterization,WebRtcHWDecoding,WebRtcHWEncoding'
)
app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('high-dpi-support', '1')

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1100,
    minHeight: 700,
    title: 'PODCASTUDIO Broadcast Studio',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#07070a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false, // Esencial: evita caídas de FPS al enfocar otra ventana
      webgl: true,
    },
  })

  // Permisos directos de hardware para cámaras y micrófonos sin avisos emergentes
  const ses = session.defaultSession
  ses.setPermissionCheckHandler((webContents, permission) => {
    return ['media', 'camera', 'microphone', 'display-capture', 'notifications'].includes(permission)
  })
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(['media', 'camera', 'microphone', 'display-capture', 'notifications'].includes(permission))
  })

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000'

  if (isDev) {
    mainWindow.loadURL(devServerUrl)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
