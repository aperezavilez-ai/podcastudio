/**
 * streamTransport.js - Capa de Transporte Modular WebRTC / SFU Ready
 *
 * Desacopla el transporte de video de la UI del estudio.
 * Permite alternar entre P2P (malla para pocas cámaras) y SFU (LiveKit / Mediasoup para 15+ cámaras)
 * sin romper ningún componente ni hook de la interfaz.
 */

import { supabase } from '../lib/supabase.js'
import { getWebRtcConfig } from './rtcConfig.js'

export class BaseStreamTransport {
  constructor(options = {}) {
    this.options = options
    this.listeners = {
      streamConnected: new Map(),
      streamDisconnected: new Map(),
      statusChanged: new Map(),
      statsUpdate: new Map(),
    }
  }

  on(event, slotIndex, handler) {
    if (!this.listeners[event]) this.listeners[event] = new Map()
    this.listeners[event].set(slotIndex, handler)
  }

  emit(event, slotIndex, ...args) {
    const handler = this.listeners[event]?.get(slotIndex)
    if (handler) handler(...args)
  }

  connectSlot(slotIndex, roomCode) {
    throw new Error('connectSlot() must be implemented by transport adapter')
  }

  disconnectSlot(slotIndex) {
    throw new Error('disconnectSlot() must be implemented by transport adapter')
  }

  destroy() {
    this.listeners = {}
  }
}

/**
 * Adaptador P2P WebRTC con señalización Supabase Broadcast
 */
export class P2PStreamTransport extends BaseStreamTransport {
  constructor(options = {}) {
    super(options)
    this.channels = new Map()
    this.peerConnections = new Map()
    this.iceQueues = new Map()
    this.activeTracks = new Map()
    this.compoundStreams = new Map()
    this.statsTimers = new Map()
    this.lastInbound = new Map()
    this.rtcConfig = getWebRtcConfig()
  }

  connectSlot(slotIndex, roomCode) {
    if (!supabase) return
    const channelName = `remotecam_${roomCode}`
    if (this.channels.has(slotIndex)) return

    this.emit('statusChanged', slotIndex, 'waiting')
    this.iceQueues.set(slotIndex, [])
    this.activeTracks.set(slotIndex, new Map())

    const channel = supabase.channel(channelName, { config: { broadcast: { self: false } } })

    channel.on('broadcast', { event: 'signal' }, async (event) => {
      const payload = event?.payload
      if (!payload || payload.sender === 'studio') return

      if (payload.type === 'phone-ready' || payload.type === 'request-offer') {
        this.emit('statusChanged', slotIndex, 'waiting')
        try {
          await channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: { type: 'studio-ready', slotIndex, sender: 'studio' },
          })
        } catch {}
        return
      }

      if (payload.type === 'offer') {
        try {
          const existingPc = this.peerConnections.get(slotIndex)
          if (existingPc && (existingPc.connectionState === 'connected' || existingPc.iceConnectionState === 'connected')) {
            return
          }
          if (existingPc) {
            try { existingPc.close() } catch {}
          }

          const callerLabel = payload.guestName
            ? (payload.sessionRole === 'student' ? `Alumno: ${payload.guestName}` : payload.guestName)
            : `Cámara ${slotIndex + 1}`

          const newPc = new RTCPeerConnection(this.rtcConfig)
          this.peerConnections.set(slotIndex, newPc)
          const trackMap = new Map()
          this.activeTracks.set(slotIndex, trackMap)

          const dispatchStreamUpdate = () => {
            const liveTracks = Array.from(trackMap.values()).filter(t => t && t.readyState !== 'ended')
            if (liveTracks.length === 0) return
            let stream = this.compoundStreams.get(slotIndex)
            if (!stream) {
              stream = new MediaStream(liveTracks)
              this.compoundStreams.set(slotIndex, stream)
            } else {
              const currentIds = new Set(stream.getTracks().map(t => t.id))
              const desiredIds = new Set(liveTracks.map(t => t.id))
              stream.getTracks().forEach((t) => {
                if (!desiredIds.has(t.id)) { try { stream.removeTrack(t) } catch {} }
              })
              liveTracks.forEach((t) => {
                if (!currentIds.has(t.id)) { try { stream.addTrack(t) } catch {} }
              })
            }
            liveTracks.forEach((t) => {
              try {
                if (t.kind === 'video') t.contentHint = 'motion';
                if (t.kind === 'audio') {
                  t.contentHint = 'speech';
                  t.enabled = true;
                }
              } catch {}
            })
            this.emit('statusChanged', slotIndex, 'connected')
            this.emit('streamConnected', slotIndex, stream, callerLabel)
          }

          newPc.ontrack = (trackEvent) => {
            if (trackEvent.receiver) {
              try {
                if ('jitterBufferTarget' in trackEvent.receiver) trackEvent.receiver.jitterBufferTarget = 0;
                if ('playoutDelayHint' in trackEvent.receiver) trackEvent.receiver.playoutDelayHint = 0;
              } catch {}
            }
            const track = trackEvent.track
            if (!track) return
            trackMap.set(track.id, track)
            track.onunmute = () => dispatchStreamUpdate()
            track.onended = () => { trackMap.delete(track.id); dispatchStreamUpdate() }
            if (trackEvent.streams && trackEvent.streams[0]) {
              trackEvent.streams[0].getTracks().forEach(t => {
                trackMap.set(t.id, t)
                t.onunmute = () => dispatchStreamUpdate()
              })
            }
            dispatchStreamUpdate()
          }

          newPc.onicecandidate = (iceEvent) => {
            if (iceEvent.candidate) {
              channel.send({
                type: 'broadcast',
                event: 'signal',
                payload: { type: 'candidate', candidate: iceEvent.candidate.toJSON(), sender: 'studio' },
              }).catch(() => {})
            }
          }

          newPc.onconnectionstatechange = () => {
            const state = newPc.connectionState
            if (state === 'connected') {
              this.emit('statusChanged', slotIndex, 'connected')
              dispatchStreamUpdate()
              this.startInboundStatsMonitor(slotIndex, newPc)
            } else if (state === 'disconnected' || state === 'failed') {
              this.emit('statusChanged', slotIndex, 'waiting')
              try {
                channel.send({
                  type: 'broadcast',
                  event: 'signal',
                  payload: { type: 'request-offer', slotIndex, sender: 'studio' },
                }).catch(() => {})
              } catch {}
            } else if (state === 'closed') {
              this.emit('statusChanged', slotIndex, 'disconnected')
            }
          }

          await newPc.setRemoteDescription(new RTCSessionDescription(payload.sdp))

          // Minimizar jitter buffer para broadcast ultra bajo retardo
          newPc.getReceivers().forEach((receiver) => {
            try {
              if ('jitterBufferTarget' in receiver) receiver.jitterBufferTarget = 0
              if ('playoutDelayHint' in receiver) receiver.playoutDelayHint = 0
            } catch {}
          })

          const initialQueue = this.iceQueues.get(slotIndex) || []
          this.iceQueues.set(slotIndex, [])
          for (const cand of initialQueue) {
            try { await newPc.addIceCandidate(cand) } catch {}
          }

          const answer = await newPc.createAnswer()
          await newPc.setLocalDescription(answer)

          const postQueue = this.iceQueues.get(slotIndex) || []
          this.iceQueues.set(slotIndex, [])
          for (const cand of postQueue) {
            try { await newPc.addIceCandidate(cand) } catch {}
          }

          await channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: { type: 'answer', sdp: answer, sender: 'studio' },
          })
        } catch (err) {
          console.error('[P2PTransport] Error handling offer:', err)
        }
        return
      }

      if (payload.type === 'candidate' && payload.candidate) {
        const currentPc = this.peerConnections.get(slotIndex)
        const iceCandidate = new RTCIceCandidate(payload.candidate)
        if (currentPc && currentPc.remoteDescription && currentPc.remoteDescription.type) {
          try { await currentPc.addIceCandidate(iceCandidate) } catch {}
        } else {
          const q = this.iceQueues.get(slotIndex) || []
          q.push(iceCandidate)
          this.iceQueues.set(slotIndex, q)
        }
        return
      }

      if (payload.type === 'phone-disconnect') {
        this.disconnectSlot(slotIndex)
      }
    })

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'signal',
          payload: { type: 'studio-ready', slotIndex, sender: 'studio' },
        }).catch(() => {})
      }
    })
    this.channels.set(slotIndex, channel)
  }

  startInboundStatsMonitor(slotIndex, pc) {
    if (this.statsTimers.has(slotIndex)) {
      clearInterval(this.statsTimers.get(slotIndex))
    }
    this.lastInbound.set(slotIndex, { bytes: 0, frames: 0, ts: performance.now() })

    const timer = setInterval(async () => {
      const current = this.peerConnections.get(slotIndex)
      if (!current || current.connectionState !== 'connected') return
      try {
        const stats = await current.getStats()
        let bytes = 0, frames = 0, packetsLost = 0
        stats.forEach((r) => {
          if (r.type === 'inbound-rtp' && r.kind === 'video') {
            bytes = r.bytesReceived || 0
            frames = r.framesDecoded || 0
            packetsLost = r.packetsLost || 0
          }
        })
        const prev = this.lastInbound.get(slotIndex) || { bytes: 0, frames: 0, ts: 0 }
        const dtSec = (performance.now() - prev.ts) / 1000
        if (dtSec > 0 && prev.bytes > 0) {
          const fps = Math.round((frames - prev.frames) / dtSec)
          const bitrateKbps = Math.round(((bytes - prev.bytes) * 8) / dtSec / 1000)
          this.emit('statsUpdate', slotIndex, { fps, bitrateKbps, packetsLost })
        }
        this.lastInbound.set(slotIndex, { bytes, frames, ts: performance.now() })
      } catch {}
    }, 2000)

    this.statsTimers.set(slotIndex, timer)
  }

  disconnectSlot(slotIndex) {
    const pc = this.peerConnections.get(slotIndex)
    if (pc) {
      try { pc.close() } catch {}
      this.peerConnections.delete(slotIndex)
    }
    this.iceQueues.delete(slotIndex)
    this.activeTracks.delete(slotIndex)
    this.compoundStreams.delete(slotIndex)

    const timer = this.statsTimers.get(slotIndex)
    if (timer) {
      clearInterval(timer)
      this.statsTimers.delete(slotIndex)
    }

    const channel = this.channels.get(slotIndex)
    if (channel) {
      try {
        channel.send({
          type: 'broadcast',
          event: 'signal',
          payload: { type: 'studio-disconnect', slotIndex },
        }).catch(() => {})
        channel.unsubscribe()
      } catch {}
      this.channels.delete(slotIndex)
    }

    this.emit('statusChanged', slotIndex, 'disconnected')
    this.emit('streamDisconnected', slotIndex)
  }

  destroy() {
    this.channels.forEach((ch) => { try { ch.unsubscribe() } catch {} })
    this.peerConnections.forEach((pc) => { try { pc.close() } catch {} })
    this.statsTimers.forEach((t) => { try { clearInterval(t) } catch {} })
    this.channels.clear()
    this.peerConnections.clear()
    this.statsTimers.clear()
    super.destroy()
  }
}

/**
 * Adaptador SFU (Preparado para LiveKit / Mediasoup para 15+ cámaras concurrentes)
 */
export class SFUStreamTransport extends BaseStreamTransport {
  constructor(options = {}) {
    super(options)
    this.rooms = new Map()
    this.sfuEndpoint = options.sfuEndpoint || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SFU_URL)
  }

  connectSlot(slotIndex, roomCode) {
    this.emit('statusChanged', slotIndex, 'waiting')
    console.info(`[SFUTransport] Conectando slot ${slotIndex} a sala SFU ${roomCode} (${this.sfuEndpoint || 'local-sfu'})`)
    // Mock / Pasarela para cliente SFU externo (LiveKit Room / Mediasoup Device)
  }

  disconnectSlot(slotIndex) {
    this.emit('statusChanged', slotIndex, 'disconnected')
    this.emit('streamDisconnected', slotIndex)
  }
}

/**
 * Factory de Transporte
 */
export function createStreamTransport(preferredType = null, options = {}) {
  const envType = typeof import.meta !== 'undefined' && import.meta.env?.VITE_STREAM_TRANSPORT
  const transportType = preferredType || envType || 'p2p'

  if (transportType === 'sfu') {
    return new SFUStreamTransport(options)
  }
  return new P2PStreamTransport(options)
}
