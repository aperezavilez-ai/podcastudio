const { app, BrowserWindow, session, ipcMain, shell } = require('electron')
const path = require('path')
const http = require('http')
const fs = require('fs')

// ============================================================================
// ACELERACIÓN POR HARDWARE DIRECTX / GPU BROADCAST (WINDOWS D3D11)
// ============================================================================
app.commandLine.appendSwitch('enable-gpu-rasterization')
app.commandLine.appendSwitch('enable-accelerated-video-decode')
app.commandLine.appendSwitch('enable-accelerated-mjpeg-decode')
app.commandLine.appendSwitch('use-angle', 'd3d11')
app.commandLine.appendSwitch(
  'enable-features',
  'MediaFoundationVideoCapture,CanvasOopRasterization,WebRtcHWDecoding,WebRtcHWEncoding'
)
app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('high-dpi-support', '1')

let mainWindow = null
let localServer = null

function createStaticServer(distPath) {
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
    '.wasm': 'application/wasm',
  }

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        // Cabeceras CORS universales para streaming de video y WebAssembly acelerado
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', '*')
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
        res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless')

        if (req.method === 'OPTIONS') {
          res.writeHead(204)
          res.end()
          return
        }

        const decodedUrl = decodeURIComponent(req.url.split('?')[0])
        let filePath = path.join(distPath, decodedUrl === '/' ? 'index.html' : decodedUrl)

        // Fallback SPA para React Router
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          filePath = path.join(distPath, 'index.html')
        }

        const stat = fs.statSync(filePath)
        const ext = path.extname(filePath).toLowerCase()
        const contentType = mimeTypes[ext] || 'application/octet-stream'

        // Soporte Range Requests para streaming fluido de video de sets (.mp4/.webm)
        const range = req.headers.range
        if (range && (ext === '.mp4' || ext === '.webm')) {
          const parts = range.replace(/bytes=/, '').split('-')
          const start = parseInt(parts[0], 10)
          const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1
          const chunksize = end - start + 1
          const file = fs.createReadStream(filePath, { start, end })

          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'credentialless',
          })
          file.pipe(res)
          return
        }

        res.writeHead(200, {
          'Content-Length': stat.size,
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'credentialless',
        })
        fs.createReadStream(filePath).pipe(res)
      } catch (err) {
        res.writeHead(500)
        res.end('Error: ' + (err.message || 'Server error'))
      }
    })

    const FIXED_PORT = 24180
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // Si otra instancia previa sigue abierta, asignar puerto efímero como fallback
        const fallbackServer = http.createServer(server.listeners('request')[0])
        fallbackServer.listen(0, '127.0.0.1', () => {
          resolve({ port: fallbackServer.address().port, server: fallbackServer })
        })
        fallbackServer.on('error', reject)
      } else {
        reject(err)
      }
    })

    server.listen(FIXED_PORT, '127.0.0.1', () => {
      resolve({ port: FIXED_PORT, server })
    })
  })
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1100,
    minHeight: 700,
    title: 'PodcastStudio — Estudio profesional de podcast',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#07070a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      webgl: true,
    },
  })

  // Permisos directos de hardware para cámaras y micrófonos sin avisos
  const ses = session.defaultSession
  ses.setPermissionCheckHandler((webContents, permission) => {
    return true
  })
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true)
  })
  if (ses.setDevicePermissionHandler) {
    ses.setDevicePermissionHandler(() => true)
  }

  // Atajo F12 para abrir DevTools si se requiere inspeccionar
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools()
    }
  })

  // Abrir enlaces externos (WhatsApp, mailto, etc.) en el navegador predeterminado del sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('mailto:') || url.startsWith('https://wa.me') || url.includes('podcastudio.mx') || !url.includes('127.0.0.1')) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  const isDev = process.env.NODE_ENV === 'development' && !app.isPackaged

  if (isDev) {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000'
    mainWindow.loadURL(devServerUrl)
  } else {
    try {
      const distPath = path.join(__dirname, '../dist')
      const { port, server } = await createStaticServer(distPath)
      localServer = server
      mainWindow.loadURL(`http://127.0.0.1:${port}`)
    } catch (err) {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null
    if (localServer) {
      localServer.close()
      localServer = null
    }
  })
}

// IPC para abrir enlaces externos desde cualquier componente de React
ipcMain.on('open-external', (event, url) => {
  if (url && typeof url === 'string') {
    shell.openExternal(url)
  }
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (localServer) {
    localServer.close()
    localServer = null
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
