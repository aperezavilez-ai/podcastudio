/**
 * streamTransport.js - Capa de Transporte Modular WebRTC / SFU Ready
 *
 * Desacopla el transporte de video de la UI del estudio.
 * Permite alternar entre P2P (malla para pocas cámaras) y SFU (LiveKit / Mediasoup para 15+ cámaras)
 * sin romper ningún componente ni hook de la interfaz.
 */

import { supabase } from '../lib/supabase.js'
import { getConfiguredWebRtcConfig } from './rtcConfig.js'

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
    this.recoveryTimers = new Map()
    this.iceTimers = new Map()
    this.offerVersions = new Map()
    this.connectionIds = new Map()
    this.connectionStartedAt = new Map()
    this.lastInbound = new Map()
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
        const activeStartedAt = this.connectionStartedAt.get(slotIndex) || 0
        if (payload.connectionStartedAt && payload.connectionStartedAt < activeStartedAt) return
        const connectionId = payload.connectionId || this.connectionIds.get(slotIndex)
        if (payload.connectionId) {
          this.connectionIds.set(slotIndex, payload.connectionId)
          this.connectionStartedAt.set(slotIndex, payload.connectionStartedAt || Date.now())
        }
        try {
          await channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: { type: 'studio-ready', slotIndex, connectionId, sender: 'studio' },
          })
        } catch {}
        return
      }

      if (payload.type === 'offer') {
        try {
          const previousConnectionId = this.connectionIds.get(slotIndex)
          const activeStartedAt = this.connectionStartedAt.get(slotIndex) || 0
          if (payload.connectionStartedAt && payload.connectionStartedAt < activeStartedAt) return
          if (payload.connectionId) {
            this.connectionIds.set(slotIndex, payload.connectionId)
            this.connectionStartedAt.set(slotIndex, payload.connectionStartedAt || Date.now())
          }
          const queuedCandidates = this.iceQueues.get(slotIndex) || []
          this.iceQueues.set(slotIndex, payload.connectionId && previousConnectionId !== payload.connectionId
            ? queuedCandidates.filter(item => item.connectionId === payload.connectionId).map(item => item.candidate)
            : queuedCandidates.map(item => item.candidate || item))
          const offerVersion = (this.offerVersions.get(slotIndex) || 0) + 1
          this.offerVersions.set(slotIndex, offerVersion)
          const previousIceTimer = this.iceTimers.get(slotIndex)
          if (previousIceTimer) clearTimeout(previousIceTimer)
          this.iceTimers.delete(slotIndex)
          const previousRecoveryTimer = this.recoveryTimers.get(slotIndex)
          if (previousRecoveryTimer) clearTimeout(previousRecoveryTimer)
          this.recoveryTimers.delete(slotIndex)
          const previousStatsTimer = this.statsTimers.get(slotIndex)
          if (previousStatsTimer) clearInterval(previousStatsTimer)
          this.statsTimers.delete(slotIndex)

          const existingPc = this.peerConnections.get(slotIndex)
          if (existingPc) {
            this.peerConnections.delete(slotIndex)
            try { existingPc.close() } catch {}
          }

          const stableStream = this.compoundStreams.get(slotIndex) || new MediaStream()
          this.compoundStreams.set(slotIndex, stableStream)
          stableStream.getTracks().forEach((track) => {
            track.onended = null
            track.onunmute = null
            try { stableStream.removeTrack(track); track.stop() } catch {}
          })

          const callerLabel = payload.guestName
            ? (payload.sessionRole === 'student' ? `Alumno: ${payload.guestName}` : payload.guestName)
            : `Cámara ${slotIndex + 1}`

          const rtcConfig = await getConfiguredWebRtcConfig()
          if (this.offerVersions.get(slotIndex) !== offerVersion) return
          const newPc = new RTCPeerConnection(rtcConfig)
          this.peerConnections.set(slotIndex, newPc)
          const trackMap = new Map()
          this.activeTracks.set(slotIndex, trackMap)

          // MediaStream estable para evitar reinicios continuos de video en React/Electron
          const clearIceTimeout = () => {
            const timer = this.iceTimers.get(slotIndex)
            if (timer) clearTimeout(timer)
            this.iceTimers.delete(slotIndex)
          }
          const startIceTimeout = () => {
            clearIceTimeout()
            const timer = setTimeout(() => {
              this.iceTimers.delete(slotIndex)
              if (this.peerConnections.get(slotIndex) === newPc && (newPc.iceGatheringState === 'gathering' || newPc.iceConnectionState === 'checking' || newPc.iceConnectionState === 'new')) {
                console.warn(`[P2PTransport] ICE gathering/connection timeout for slot ${slotIndex}, requesting new offer`)
                try {
                  channel.send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: { type: 'request-offer', slotIndex, connectionId: payload.connectionId, sender: 'studio' },
                  }).catch(() => {})
                } catch {}
              }
            }, 8000)
            this.iceTimers.set(slotIndex, timer)
          }
          const scheduleOfferRecovery = (delay = 4000) => {
            if (this.recoveryTimers.has(slotIndex)) return
            const timer = setTimeout(() => {
              this.recoveryTimers.delete(slotIndex)
              if (this.peerConnections.get(slotIndex) !== newPc) return
              if (newPc.connectionState === 'connected' || ['connected', 'completed'].includes(newPc.iceConnectionState)) return
              channel.send({
                type: 'broadcast',
                event: 'signal',
                payload: { type: 'request-offer', slotIndex, connectionId: payload.connectionId, sender: 'studio' },
              }).catch(() => {})
            }, delay)
            this.recoveryTimers.set(slotIndex, timer)
          }

          const dispatchStreamUpdate = () => {
            const liveTracks = Array.from(trackMap.values()).filter(t => t && t.readyState !== 'ended')
            const hasLiveVideo = liveTracks.some(t => t.kind === 'video' && !t.muted)
            if (!hasLiveVideo) {
              this.emit('statusChanged', slotIndex, 'waiting')
              return
            }

            liveTracks.forEach((t) => {
              try {
                if (t.kind === 'video') t.contentHint = 'motion'
                if (t.kind === 'audio') {
                  t.contentHint = 'speech'
                  t.enabled = true
                }
              } catch {}
              if (!stableStream.getTracks().some(existing => existing.id === t.id)) {
                stableStream.addTrack(t)
              }
            })

            stableStream.getTracks().forEach(existing => {
              if (!liveTracks.some(t => t.id === existing.id)) {
                try { stableStream.removeTrack(existing) } catch {}
              }
            })

            this.emit('statusChanged', slotIndex, 'connected')
            this.emit('streamConnected', slotIndex, stableStream, callerLabel)
          }

          newPc.ontrack = (trackEvent) => {
            const track = trackEvent.track
            if (!track) return

            // Reducir latencia de buffer del decodificador Chromium/Electron a tiempo real (cero retraso acumulativo)
            if (trackEvent.receiver) {
              try {
                if ('playoutDelayHint' in trackEvent.receiver) {
                  trackEvent.receiver.playoutDelayHint = 0; // 0 indica reproducción inmediata sin retraso de búfer
                }
                if ('jitterBufferTarget' in trackEvent.receiver) {
                  trackEvent.receiver.jitterBufferTarget = 20; // 20ms de jitter buffer mínimo
                }
              } catch (e) {}
            }

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
                payload: { type: 'candidate', candidate: iceEvent.candidate.toJSON(), connectionId: payload.connectionId, sender: 'studio' },
              }).catch(() => {})
            } else {
              clearIceTimeout()
            }
          }

          newPc.onicegatheringstatechange = () => {
            if (newPc.iceGatheringState === 'gathering') {
              startIceTimeout()
            } else if (newPc.iceGatheringState === 'complete') {
              clearIceTimeout()
            }
          }

          newPc.oniceconnectionstatechange = () => {
            if (this.peerConnections.get(slotIndex) !== newPc) return
            const iceState = newPc.iceConnectionState
            if (iceState === 'checking') {
              startIceTimeout()
            } else if (iceState === 'connected' || iceState === 'completed') {
              clearIceTimeout()
              const recoveryTimer = this.recoveryTimers.get(slotIndex)
              if (recoveryTimer) clearTimeout(recoveryTimer)
              this.recoveryTimers.delete(slotIndex)
            } else if (iceState === 'failed' || iceState === 'disconnected') {
              clearIceTimeout()
              this.emit('statusChanged', slotIndex, 'waiting')
              scheduleOfferRecovery(iceState === 'failed' ? 1000 : 4000)
            }
          }

          newPc.onconnectionstatechange = () => {
            if (this.peerConnections.get(slotIndex) !== newPc) return
            const state = newPc.connectionState
            if (state === 'connected') {
              clearIceTimeout()
              const recoveryTimer = this.recoveryTimers.get(slotIndex)
              if (recoveryTimer) clearTimeout(recoveryTimer)
              this.recoveryTimers.delete(slotIndex)
              this.emit('statusChanged', slotIndex, 'connected')
              dispatchStreamUpdate()
              this.startInboundStatsMonitor(slotIndex, newPc, () => scheduleOfferRecovery(0))
            } else if (state === 'disconnected' || state === 'failed') {
              clearIceTimeout()
              this.emit('statusChanged', slotIndex, 'waiting')
              scheduleOfferRecovery(state === 'failed' ? 1000 : 4000)
            } else if (state === 'closed') {
              clearIceTimeout()
              this.emit('statusChanged', slotIndex, 'disconnected')
            }
          }

          await newPc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
          if (this.peerConnections.get(slotIndex) !== newPc) { newPc.close(); return }

          const initialQueue = this.iceQueues.get(slotIndex) || []
          this.iceQueues.set(slotIndex, [])
          for (const cand of initialQueue) {
            try { await newPc.addIceCandidate(cand) } catch {}
          }

          const answer = await newPc.createAnswer()
          let ansSdp = answer.sdp
          if (ansSdp && ansSdp.includes('m=video')) {
            ansSdp = ansSdp.replace(/(a=fmtp:\d+ .*)/g, '$1;x-google-min-bitrate=3000;x-google-start-bitrate=6000;x-google-max-bitrate=8000')
          }
          await newPc.setLocalDescription({ type: answer.type, sdp: ansSdp })
          if (this.peerConnections.get(slotIndex) !== newPc) { newPc.close(); return }

          const postQueue = this.iceQueues.get(slotIndex) || []
          this.iceQueues.set(slotIndex, [])
          for (const cand of postQueue) {
            try { await newPc.addIceCandidate(cand) } catch {}
          }

          await channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: { type: 'answer', sdp: answer, connectionId: payload.connectionId, sender: 'studio' },
          })
        } catch (err) {
          console.error('[P2PTransport] Error handling offer:', err)
        }
        return
      }

      if (payload.type === 'candidate' && payload.candidate) {
        const activeConnectionId = this.connectionIds.get(slotIndex)
        if (activeConnectionId && payload.connectionId && payload.connectionId !== activeConnectionId) return
        const currentPc = this.peerConnections.get(slotIndex)
        const iceCandidate = new RTCIceCandidate(payload.candidate)
        if (currentPc && currentPc.remoteDescription && currentPc.remoteDescription.type) {
          try { await currentPc.addIceCandidate(iceCandidate) } catch {}
        } else {
          const q = this.iceQueues.get(slotIndex) || []
          q.push({ candidate: iceCandidate, connectionId: payload.connectionId })
          this.iceQueues.set(slotIndex, q)
        }
        return
      }

      if (payload.type === 'phone-disconnect') {
        const activeConnectionId = this.connectionIds.get(slotIndex)
        if (activeConnectionId && payload.connectionId && payload.connectionId !== activeConnectionId) return
        const pc = this.peerConnections.get(slotIndex)
        if (pc) {
          this.peerConnections.delete(slotIndex)
          try { pc.close() } catch {}
        }
        this.offerVersions.set(slotIndex, (this.offerVersions.get(slotIndex) || 0) + 1)
        const recoveryTimer = this.recoveryTimers.get(slotIndex)
        if (recoveryTimer) clearTimeout(recoveryTimer)
        this.recoveryTimers.delete(slotIndex)
        const iceTimer = this.iceTimers.get(slotIndex)
        if (iceTimer) clearTimeout(iceTimer)
        this.iceTimers.delete(slotIndex)
        this.iceQueues.delete(slotIndex)
        this.activeTracks.delete(slotIndex)
        this.compoundStreams.delete(slotIndex)
        this.connectionIds.delete(slotIndex)
        this.connectionStartedAt.delete(slotIndex)

        const timer = this.statsTimers.get(slotIndex)
        if (timer) {
          clearInterval(timer)
          this.statsTimers.delete(slotIndex)
        }

        this.emit('statusChanged', slotIndex, 'waiting')
        this.emit('streamDisconnected', slotIndex)
        return
      }
    })

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'signal',
          payload: { type: 'studio-ready', slotIndex, connectionId: this.connectionIds.get(slotIndex), sender: 'studio' },
        }).catch(() => {})
      }
    })
    this.channels.set(slotIndex, channel)
  }

  startInboundStatsMonitor(slotIndex, pc, onVideoStall) {
    if (this.statsTimers.has(slotIndex)) {
      clearInterval(this.statsTimers.get(slotIndex))
    }
    this.lastInbound.set(slotIndex, { bytes: 0, frames: 0, ts: performance.now(), stalledIntervals: 0 })

    const timer = setInterval(async () => {
      const current = this.peerConnections.get(slotIndex)
      if (!current || current !== pc || current.connectionState !== 'connected') return

      try {
        const stats = await current.getStats()
        let bytes = 0, frames = 0, packetsLost = 0
        stats.forEach((r) => {
          if (r.type === 'inbound-rtp' && r.kind === 'video' && !r.isRemote) {
            bytes += r.bytesReceived || 0
            frames += r.framesDecoded || 0
            packetsLost += r.packetsLost || 0
          }
        })
        const prev = this.lastInbound.get(slotIndex) || { bytes: 0, frames: 0, ts: 0, stalledIntervals: 0 }
        const dtSec = (performance.now() - prev.ts) / 1000
        if (dtSec > 0 && prev.bytes > 0) {
          const fps = Math.round((frames - prev.frames) / dtSec)
          const bitrateKbps = Math.round(((bytes - prev.bytes) * 8) / dtSec / 1000)
          this.emit('statsUpdate', slotIndex, { fps, bitrateKbps, packetsLost })
        }
        const madeProgress = bytes > prev.bytes || frames > prev.frames
        const stalledIntervals = madeProgress ? 0 : prev.stalledIntervals + 1
        if (stalledIntervals === 5) onVideoStall?.()
        this.lastInbound.set(slotIndex, { bytes, frames, ts: performance.now(), stalledIntervals })
      } catch {}
    }, 2000)

    this.statsTimers.set(slotIndex, timer)
  }

  async disconnectSlot(slotIndex) {
    const pc = this.peerConnections.get(slotIndex)
    if (pc) {
      this.peerConnections.delete(slotIndex)
      try { pc.close() } catch {}
    }
    this.offerVersions.set(slotIndex, (this.offerVersions.get(slotIndex) || 0) + 1)
    const recoveryTimer = this.recoveryTimers.get(slotIndex)
    if (recoveryTimer) clearTimeout(recoveryTimer)
    this.recoveryTimers.delete(slotIndex)
    const iceTimer = this.iceTimers.get(slotIndex)
    if (iceTimer) clearTimeout(iceTimer)
    this.iceTimers.delete(slotIndex)
    this.iceQueues.delete(slotIndex)
    this.activeTracks.delete(slotIndex)
    this.compoundStreams.delete(slotIndex)
    this.connectionIds.delete(slotIndex)
    this.connectionStartedAt.delete(slotIndex)

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
        try { await channel.unsubscribe(); } catch (e) { console.warn('unsubscribe failed:', e); }
      } catch (e) { console.warn('channel cleanup failed:', e); }
      this.channels.delete(slotIndex)
    }

    this.emit('statusChanged', slotIndex, 'disconnected')
    this.emit('streamDisconnected', slotIndex)
  }

  destroy() {
    this.channels.forEach((ch) => { try { ch.unsubscribe() } catch {} })
    this.peerConnections.forEach((pc) => { try { pc.close() } catch {} })
    this.statsTimers.forEach((t) => { try { clearInterval(t) } catch {} })
    this.recoveryTimers.forEach((t) => { try { clearTimeout(t) } catch {} })
    this.iceTimers.forEach((t) => { try { clearTimeout(t) } catch {} })
    this.channels.clear()
    this.peerConnections.clear()
    this.statsTimers.clear()
    this.recoveryTimers.clear()
    this.iceTimers.clear()
    this.offerVersions.clear()
    this.connectionIds.clear()
    this.connectionStartedAt.clear()
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
