const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  startRecording: (options) => ipcRenderer.invoke('start-recording', options),
  sendRecordChunk: (chunk) => ipcRenderer.send('record-chunk', chunk),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  saveRecordingThumbnail: (payload) => ipcRenderer.invoke('save-recording-thumbnail', payload),
  saveToDownloads: (payload) => ipcRenderer.invoke('save-to-downloads', payload),
  exportSocialFormat: (payload) => ipcRenderer.invoke('export-social-format', payload),

  startStreaming: (payload) => ipcRenderer.invoke('start-streaming', payload),
  sendStreamChunk: (chunk) => ipcRenderer.send('stream-chunk', chunk),
  stopStreaming: () => ipcRenderer.invoke('stop-streaming'),
  onStreamStatus: (cb) => ipcRenderer.on('stream-status', (e, data) => cb(data)),
  onStreamTelemetry: (cb) => {
    const handler = (e, data) => cb(data);
    ipcRenderer.on('stream-telemetry', handler);
    return () => ipcRenderer.removeListener('stream-telemetry', handler);
  },

  getQrUrl: () => ipcRenderer.invoke('get-qr-url'),
  discoverNetworkCameras: () => ipcRenderer.invoke('discover-network-cameras'),
  scanNetworkCameras: () => ipcRenderer.invoke('scan-network-cameras'),
  getDesktopSources: (opts) => ipcRenderer.invoke('get-desktop-sources', opts),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  openRecordingsFolder: (projectName) => ipcRenderer.send('open-recordings-folder', projectName),

  onMobileWsConnected: (cb) => ipcRenderer.on('mobile-ws-connected', (e, id) => cb(id)),
  onRemoteOffer: (cb) => ipcRenderer.on('remote-offer', (e, data) => cb(data)),
  onRemoteCandidate: (cb) => ipcRenderer.on('remote-candidate', (e, data) => cb(data)),
  onRemoteDisconnected: (cb) => ipcRenderer.on('remote-disconnected', (e, id) => cb(id)),
  sendAnswer: (id, answer) => ipcRenderer.send('send-answer', { id, answer }),
  sendCandidate: (id, candidate) => ipcRenderer.send('send-candidate', { id, candidate }),
  signalReady: () => ipcRenderer.send('app-ui-ready'),

  // Control Remoto iPad / Red Local
  getLocalControlUrl: () => ipcRenderer.invoke('get-local-control-url'),
  onRemoteStudioCommand: (cb) => {
    const handler = (e, cmd) => cb(cmd);
    ipcRenderer.on('remote-studio-command', handler);
    return () => ipcRenderer.removeListener('remote-studio-command', handler);
  },
  sendStudioState: (state) => ipcRenderer.send('studio-state-update', state),

  // Hardware & LAN Tally Light (P2.4)
  getTallyUrl: () => ipcRenderer.invoke('get-tally-url'),
  getTallyState: () => ipcRenderer.invoke('get-tally-state'),
  listSerialPorts: () => ipcRenderer.invoke('list-serial-ports'),
  sendTallySerial: (payload) => ipcRenderer.invoke('send-tally-serial', payload),
  onTallyStateChange: (cb) => {
    const handler = (e, data) => cb(data);
    ipcRenderer.on('tally-state-change', handler);
    return () => ipcRenderer.removeListener('tally-state-change', handler);
  },

  // Exportador de Clips de Momentos Destacados (P3.1)
  exportHighlightClip: (payload) => ipcRenderer.invoke('export-highlight-clip', payload),

  // Teleprompter Tablet & LAN (P3.2)
  getPrompterUrl: () => ipcRenderer.invoke('get-prompter-url'),
  getPrompterText: () => ipcRenderer.invoke('get-prompter-text'),
  setPrompterText: (text) => ipcRenderer.invoke('set-prompter-text', text),

  // Sala Multi-Invitados & Retorno Mix-Minus (P3.3)
  getGuestRoomUrl: () => ipcRenderer.invoke('get-guest-room-url'),

  // Grabación ISO Multicanal de Pistas Independientes (P4.1)
  startIsoRecording: (payload) => ipcRenderer.invoke('start-iso-recording', payload),
  sendIsoChunk: (payload) => ipcRenderer.send('record-iso-chunk', payload),
  stopIsoRecording: () => ipcRenderer.invoke('stop-iso-recording'),
  getIsoStatus: () => ipcRenderer.invoke('get-iso-status'),

  // Salida LAN Program & OBS Virtual Feed (P4.4)
  getProgramFeedUrl: () => ipcRenderer.invoke('get-program-feed-url'),
  getProgramStatus: () => ipcRenderer.invoke('get-program-status'),
  sendProgramFeedFrame: (frameData) => ipcRenderer.send('program-feed-frame', frameData),
  sendCamThumbnails: (thumbnails) => ipcRenderer.send('cam-thumbnails', thumbnails)
});