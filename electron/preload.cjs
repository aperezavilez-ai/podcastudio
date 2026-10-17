const { contextBridge, ipcRenderer } = require('electron')

// Exponer capacidades nativas de escritorio si se necesitan en React
contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  platform: process.platform,
})
