const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  startRecording: (options) => ipcRenderer.invoke('start-recording', options),
  sendRecordChunk: (chunk) => ipcRenderer.send('record-chunk', chunk),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  saveRecordingThumbnail: (payload) => ipcRenderer.invoke('save-recording-thumbnail', payload),

  startStreaming: (payload) => ipcRenderer.invoke('start-streaming', payload),
  sendStreamChunk: (chunk) => ipcRenderer.send('stream-chunk', chunk),
  stopStreaming: () => ipcRenderer.invoke('stop-streaming'),
  onStreamStatus: (cb) => ipcRenderer.on('stream-status', (e, data) => cb(data)),

  getQrUrl: () => ipcRenderer.invoke('get-qr-url'),
  scanNetworkCameras: () => ipcRenderer.invoke('scan-network-cameras'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  openRecordingsFolder: (projectName) => ipcRenderer.send('open-recordings-folder', projectName),

  onMobileWsConnected: (cb) => ipcRenderer.on('mobile-ws-connected', (e, id) => cb(id)),
  onRemoteOffer: (cb) => ipcRenderer.on('remote-offer', (e, data) => cb(data)),
  onRemoteCandidate: (cb) => ipcRenderer.on('remote-candidate', (e, data) => cb(data)),
  onRemoteDisconnected: (cb) => ipcRenderer.on('remote-disconnected', (e, id) => cb(id)),
  sendAnswer: (id, answer) => ipcRenderer.send('send-answer', { id, answer }),
  sendCandidate: (id, candidate) => ipcRenderer.send('send-candidate', { id, candidate }),
  signalReady: () => ipcRenderer.send('app-ui-ready')
});