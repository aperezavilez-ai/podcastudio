import { useState, useEffect, useRef } from 'react';

/**
 * Hook para monitorear en tiempo real los niveles de audio de cada cámara conectada (VU meter),
 * detectar si la cámara cuenta con micrófono activo y reflejar el estado de silencio (Mute).
 */
export function useCameraAudioLevels(camStreamsMap = {}, camMutedMap = {}) {
  const [levels, setLevels] = useState({});
  const audioCtxRef = useRef(null);
  const analysersRef = useRef(new Map()); // camId -> { source, analyser, dataArray }
  const animFrameRef = useRef(null);
  const streamSignaturesRef = useRef('');

  useEffect(() => {
    // Generar firma de streams para reconectar solo si cambian los streams o tracks
    const signature = Object.entries(camStreamsMap)
      .map(([id, s]) => `${id}:${s?.id || 'none'}:${s?.getAudioTracks?.().length || 0}`)
      .join('|');

    // Inicializar AudioContext una sola vez
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx({ latencyHint: 'interactive' });
      }
    }

    const ctx = audioCtxRef.current;
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const currentAnalysers = analysersRef.current;

    // Desconectar ranuras que ya no existen o cuyo stream cambió
    currentAnalysers.forEach((entry, id) => {
      const newStream = camStreamsMap[id];
      if (!newStream || newStream.id !== entry.streamId) {
        try {
          entry.source.disconnect();
        } catch (e) {}
        currentAnalysers.delete(id);
      }
    });

    // Conectar nuevas fuentes de audio
    Object.entries(camStreamsMap).forEach(([idStr, stream]) => {
      const id = Number(idStr);
      const audioTracks = stream?.getAudioTracks?.() || [];
      const hasAudio = audioTracks.length > 0 && audioTracks[0].readyState === 'live';

      if (hasAudio && ctx) {
        if (!currentAnalysers.has(id)) {
          try {
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 128;
            analyser.smoothingTimeConstant = 0.5;
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            currentAnalysers.set(id, {
              source,
              analyser,
              dataArray,
              streamId: stream.id,
            });
          } catch (e) {
            console.warn(`[useCameraAudioLevels] No se pudo analizar audio para CAM ${id}:`, e);
          }
        }
      } else {
        if (currentAnalysers.has(id)) {
          try {
            currentAnalysers.get(id).source.disconnect();
          } catch (e) {}
          currentAnalysers.delete(id);
        }
      }
    });

    streamSignaturesRef.current = signature;
  }, [camStreamsMap]);

  // Bucle de medición en tiempo real
  useEffect(() => {
    let active = true;

    const measureLoop = () => {
      if (!active) return;

      const currentAnalysers = analysersRef.current;
      const nextLevels = {};

      Object.entries(camStreamsMap).forEach(([idStr, stream]) => {
        const id = Number(idStr);
        const audioTracks = stream?.getAudioTracks?.() || [];
        const hasMic = audioTracks.length > 0;
        const isMuted = Boolean(camMutedMap[id]);

        if (!hasMic) {
          nextLevels[id] = { hasMic: false, level: 0, isMuted };
        } else if (isMuted) {
          nextLevels[id] = { hasMic: true, level: 0, isMuted: true };
        } else {
          const entry = currentAnalysers.get(id);
          if (entry && entry.analyser) {
            entry.analyser.getByteFrequencyData(entry.dataArray);
            let sum = 0;
            for (let i = 0; i < entry.dataArray.length; i++) {
              sum += entry.dataArray[i];
            }
            const avg = sum / entry.dataArray.length;
            // Normalizar a porcentaje 0..100 con curva perceptual
            const normalized = Math.min(100, Math.round((avg / 110) * 100));
            nextLevels[id] = { hasMic: true, level: normalized, isMuted: false };
          } else {
            nextLevels[id] = { hasMic: true, level: 0, isMuted: false };
          }
        }
      });

      setLevels(nextLevels);
      animFrameRef.current = requestAnimationFrame(measureLoop);
    };

    animFrameRef.current = requestAnimationFrame(measureLoop);

    return () => {
      active = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [camStreamsMap, camMutedMap]);

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      analysersRef.current.forEach((entry) => {
        try { entry.source.disconnect(); } catch (e) {}
      });
      analysersRef.current.clear();
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try { audioCtxRef.current.close(); } catch (e) {}
      }
    };
  }, []);

  return levels;
}
