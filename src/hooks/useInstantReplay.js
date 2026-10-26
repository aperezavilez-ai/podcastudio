/**
 * useInstantReplay.js
 * Hook Broadcast de Repetición Instantánea / Replay en Vivo con Búfer Circular (P4.3)
 * 
 * Almacena los últimos 10 a 30 segundos de transmisión Master limpia en un búfer circular en memoria.
 * Permite reproducir instantáneamente jugadas, momentos clave o repeticiones a velocidad variable
 * (0.25x, 0.5x, 1.0x) con distintivo broadcast en pantalla y corte limpio de retorno a EN VIVO.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  addChunkListener,
  removeChunkListener,
  getInitHeader,
  updateBroadcastState,
  setReplayOverlay
} from '../utils/masterBroadcastEngine.js';

const MAX_BUFFER_SECONDS = 30; // 30 segundos de retención circular
const CHUNK_DURATION_SEC = 0.5; // Chunks de 500ms
const MAX_CHUNKS = Math.ceil(MAX_BUFFER_SECONDS / CHUNK_DURATION_SEC); // 60 chunks

export function useInstantReplay() {
  const [isReplaying, setIsReplaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(0.5);
  const [replayDuration, setReplayDuration] = useState(5);
  const [replayProgress, setReplayProgress] = useState(0);
  const [bufferedSeconds, setBufferedSeconds] = useState(0);

  const circularBufferRef = useRef([]);
  const initHeaderRef = useRef(null);
  const activeVideoRef = useRef(null);
  const progressAnimRef = useRef(null);

  // 1. Escuchar chunks de video en tiempo real del Master Canvas
  useEffect(() => {
    const handleChunk = (arrayBuffer) => {
      if (!arrayBuffer || arrayBuffer.byteLength === 0) return;

      // Si no tenemos cabecera inicial EBML/WebM, guardarla
      if (!initHeaderRef.current) {
        initHeaderRef.current = getInitHeader() || arrayBuffer.slice(0);
      }

      const now = Date.now();
      const buffer = circularBufferRef.current;
      buffer.push({ timestamp: now, data: arrayBuffer.slice(0) });

      // Mantener tamaño máximo del búfer circular
      if (buffer.length > MAX_CHUNKS) {
        buffer.shift();
      }

      setBufferedSeconds(Math.min(MAX_BUFFER_SECONDS, Math.round(buffer.length * CHUNK_DURATION_SEC)));
    };

    addChunkListener(handleChunk);
    return () => {
      removeChunkListener(handleChunk);
    };
  }, []);

  // 2. Detener la repetición y regresar a la señal EN VIVO
  const stopReplay = useCallback(() => {
    if (progressAnimRef.current) {
      cancelAnimationFrame(progressAnimRef.current);
      progressAnimRef.current = null;
    }

    if (activeVideoRef.current) {
      try {
        activeVideoRef.current.pause();
        if (activeVideoRef.current.src && activeVideoRef.current.src.startsWith('blob:')) {
          URL.revokeObjectURL(activeVideoRef.current.src);
        }
        activeVideoRef.current.src = '';
      } catch (e) {}
      activeVideoRef.current = null;
    }

    setIsReplaying(false);
    setReplayProgress(0);

    // Restaurar el Master Broadcast Engine a señal en vivo
    updateBroadcastState({
      isReplaying: false,
      replayVideoElement: null,
      replayOverlay: { active: false, label: 'REPLAY', speed: 0.5, progress: 0 }
    });
  }, []);

  // 3. Disparar Repetición Instantánea
  const triggerReplay = useCallback(({ durationSec = 5, speed = 0.5 } = {}) => {
    const buffer = circularBufferRef.current;
    if (!buffer || buffer.length === 0) {
      console.warn('[InstantReplay] Búfer circular vacío; no hay suficientes fotogramas aún.');
      return false;
    }

    // Detener cualquier repetición previa en curso
    stopReplay();

    const selectedDuration = Math.max(2, Math.min(MAX_BUFFER_SECONDS, durationSec));
    const selectedSpeed = Math.max(0.1, Math.min(2.0, speed));
    const neededChunks = Math.ceil(selectedDuration / CHUNK_DURATION_SEC);
    const sliceChunks = buffer.slice(-neededChunks);

    const blobParts = [];
    const header = initHeaderRef.current || getInitHeader();
    if (header) {
      blobParts.push(header);
    }
    sliceChunks.forEach(item => blobParts.push(item.data));

    const replayBlob = new Blob(blobParts, { type: 'video/webm' });
    const videoUrl = URL.createObjectURL(replayBlob);

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true; // Silenciar audio en slow motion para evitar distorsión
    video.playbackRate = selectedSpeed;
    video.src = videoUrl;

    activeVideoRef.current = video;
    setIsReplaying(true);
    setReplaySpeed(selectedSpeed);
    setReplayDuration(selectedDuration);
    setReplayProgress(0);

    // Actualizar estado del motor broadcast
    updateBroadcastState({
      isReplaying: true,
      replayVideoElement: video,
      replayOverlay: {
        active: true,
        label: 'REPLAY',
        speed: selectedSpeed,
        progress: 0
      }
    });

    video.onended = () => {
      stopReplay();
    };

    video.onerror = (e) => {
      console.warn('[InstantReplay] Error al reproducir clip de repetición:', e);
      stopReplay();
    };

    // Animar progreso y sincronizar el overlay en tiempo real
    const trackProgress = () => {
      if (video && !video.paused && !video.ended && video.duration > 0) {
        const prog = Math.max(0, Math.min(1.0, video.currentTime / video.duration));
        setReplayProgress(prog);
        setReplayOverlay(true, 'REPLAY', selectedSpeed, prog);
        progressAnimRef.current = requestAnimationFrame(trackProgress);
      }
    };

    video.play().then(() => {
      progressAnimRef.current = requestAnimationFrame(trackProgress);
    }).catch(err => {
      console.warn('[InstantReplay] Error en video.play():', err);
      stopReplay();
    });

    return true;
  }, [stopReplay]);

  // 4. Atajo de teclado global [R] para Replay instantáneo de 5 segundos
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignorar si el usuario está escribiendo en inputs, textareas o modales
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return;

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        if (isReplaying) {
          stopReplay();
        } else {
          triggerReplay({ durationSec: 5, speed: 0.5 });
        }
      }
      if (e.key === 'Escape' && isReplaying) {
        stopReplay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isReplaying, stopReplay, triggerReplay]);

  return {
    isReplaying,
    replaySpeed,
    replayDuration,
    replayProgress,
    bufferedSeconds,
    maxBufferSeconds: MAX_BUFFER_SECONDS,
    triggerReplay,
    stopReplay,
    setReplaySpeed
  };
}
