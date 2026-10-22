const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  startRecording: () => ipcRenderer.invoke('start-recording'),
  sendRecordChunk: (chunk) => ipcRenderer.send('record-chunk', chunk),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),

  startStreaming: (payload) => ipcRenderer.invoke('start-streaming', payload),
  sendStreamChunk: (chunk) => ipcRenderer.send('stream-chunk', chunk),
  stopStreaming: () => ipcRenderer.invoke('stop-streaming'),
  onStreamStatus: (cb) => ipcRenderer.on('stream-status', (e, data) => cb(data)),

  getQrUrl: () => ipcRenderer.invoke('get-qr-url'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  openRecordingsFolder: () => ipcRenderer.send('open-recordings-folder'),

  onMobileWsConnected: (cb) => ipcRenderer.on('mobile-ws-connected', (e, id) => cb(id)),
  onRemoteOffer: (cb) => ipcRenderer.on('remote-offer', (e, data) => cb(data)),
  onRemoteCandidate: (cb) => ipcRenderer.on('remote-candidate', (e, data) => cb(data)),
  onRemoteDisconnected: (cb) => ipcRenderer.on('remote-disconnected', (e, id) => cb(id)),
  sendAnswer: (id, answer) => ipcRenderer.send('send-answer', { id, answer }),
  sendCandidate: (id, candidate) => ipcRenderer.send('send-candidate', { id, candidate })
});