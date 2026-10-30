import { useState, useEffect, useRef } from 'react';
import { getBroadcastAudioContext } from '../utils/masterBroadcastEngine.js';

/**
 * Hook para monitorear en tiempo real los niveles de audio de cada cámara conectada (VU meter),
 * detectar si la cámara cuenta con micrófono activo y reflejar el estado de silencio (Mute).
 */
export function useCameraAudioLevels(camStreamsMap = {}, camMutedMap = {}) {
  const [levels, setLevels] = useState({});
  const levelsRef = useRef({});
  const analysersRef = useRef(new Map()); // camId -> { source, analyser, dataArray }

  useEffect(() => {
    // Compartir el contexto de audio broadcast evita abrir otro contexto por
    // hook/cámara y reduce trabajo de mezcla durante la emisión.
    const ctx = getBroadcastAudioContext();
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

  }, [camStreamsMap]);

  // El VU solo necesita muestrearse unas 5 veces por segundo. Actualizar el
  // estado de React en cada frame (60 veces por segundo por cámara) volvía a
  // renderizar toda la cabina y bloqueaba controles, audio y grabación.
  useEffect(() => {
    const measure = () => {
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
            const normalized = Math.min(100, Math.round((avg / 110) * 20) * 5);
            nextLevels[id] = { hasMic: true, level: normalized, isMuted: false };
          } else {
            nextLevels[id] = { hasMic: true, level: 0, isMuted: false };
          }
        }
      });

      const previous = levelsRef.current;
      const ids = new Set([...Object.keys(previous), ...Object.keys(nextLevels)]);
      const changed = [...ids].some((id) => {
        const before = previous[id];
        const after = nextLevels[id];
        return !before || !after || before.hasMic !== after.hasMic || before.isMuted !== after.isMuted || before.level !== after.level;
      });
      if (changed) {
        levelsRef.current = nextLevels;
        setLevels(nextLevels);
      }
    };

    measure();
    const timer = setInterval(measure, 200);

    return () => {
      clearInterval(timer);
    };
  }, [camStreamsMap, camMutedMap]);

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      analysersRef.current.forEach((entry) => {
        try { entry.source.disconnect(); } catch (e) {}
      });
      analysersRef.current.clear();
    };
  }, []);

  return levels;
}
