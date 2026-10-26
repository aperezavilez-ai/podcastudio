import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook para reconocimiento automático de voz y activación de cintillos (Lower-Thirds)
 * según el participante que está hablando al aire en tiempo real.
 * 
 * Reglas Broadcast:
 * 1. Filtro de duración mínima (Anti-pop): Requiere 350ms de voz sostenida para evitar falsos positivos por tos o estornudos.
 * 2. Persistencia y Hold: Mantiene el cintillo visible durante la alocución y un tiempo de guarda (holdSeconds) tras el silencio.
 * 3. Conmutación Fluida: Si otro participante toma la palabra, conmuta de inmediato hacia el nuevo orador.
 * 4. Prioridad de Conductor: Si el conductor interviene, su cintillo o presencia adquiere precedencia.
 */
export function useAutoSpeakerCintillo({
  enabled = false,
  cameraLevels = {},
  cameraMeta = [],
  hostName = 'Conductor',
  hostRole = 'Conductor & Productor',
  guestName = 'Invitado Especial',
  guestRole = 'Especialista en IA & Media',
  cintillosVisible = true,
  showManual,
  showCustom,
  hide,
  sensitivityThreshold = 18,
  holdSeconds = 4.5,
  minSpeechDurationMs = 350,
}) {
  const [activeSpeakerSlot, setActiveSpeakerSlot] = useState(null);
  const [isSpeakerHolding, setIsSpeakerHolding] = useState(false);
  const [speakerLogs, setSpeakerLogs] = useState([]);

  const currentSpeakerRef = useRef(null);
  const speechStartRef = useRef(null);
  const holdTimeoutRef = useRef(null);
  const speechCandidateRef = useRef(null);
  const candidateStartRef = useRef(null);

  // Limpiar timers
  const clearHoldTimer = useCallback(() => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !cintillosVisible) {
      clearHoldTimer();
      setActiveSpeakerSlot(null);
      setIsSpeakerHolding(false);
      currentSpeakerRef.current = null;
      speechStartRef.current = null;
      speechCandidateRef.current = null;
      return;
    }

    const now = Date.now();

    // 1. Encontrar la cámara con mayor nivel de energía que supere el umbral
    let highestSlot = null;
    let highestLevel = 0;

    Object.entries(cameraLevels).forEach(([slotStr, level]) => {
      const slotNum = Number(slotStr);
      if (level >= sensitivityThreshold && level > highestLevel) {
        highestLevel = level;
        highestSlot = slotNum;
      }
    });

    if (highestSlot !== null) {
      // Hay alguien hablando
      clearHoldTimer();
      setIsSpeakerHolding(false);

      if (currentSpeakerRef.current === highestSlot) {
        // Mismo orador: mantiene activo
        speechStartRef.current = speechStartRef.current || now;
      } else {
        // Posible cambio de orador: verificar persistencia mínima
        if (speechCandidateRef.current === highestSlot) {
          const elapsed = now - (candidateStartRef.current || now);
          if (elapsed >= minSpeechDurationMs) {
            // Confirmado nuevo orador
            currentSpeakerRef.current = highestSlot;
            setActiveSpeakerSlot(highestSlot);
            speechStartRef.current = now;
            speechCandidateRef.current = null;

            // Disparar Cintillo correspondiente
            if (highestSlot === 1) {
              // CAM 1: Conductor
              if (showManual) {
                showManual('host');
              } else if (showCustom) {
                showCustom({
                  tag: 'CONDUCTOR',
                  text: hostName,
                  subtitle: hostRole,
                  color: '#e8612a',
                  presetId: 'host',
                  targetSlot: 0,
                });
              }
              setSpeakerLogs(prev => [
                { time: new Date().toLocaleTimeString(), slot: 1, name: hostName, role: 'Conductor' },
                ...prev.slice(0, 19)
              ]);
            } else {
              // CAM 2 a 10: Invitados o Alumnos
              const meta = cameraMeta && cameraMeta[highestSlot - 1];
              const resolvedName = meta?.guestName || (highestSlot === 2 ? guestName : `Invitado CAM ${highestSlot}`);
              const resolvedRole = meta?.guestRole || (highestSlot === 2 ? guestRole : 'Participante en Vivo');
              const resolvedTag = meta?.guestRole === 'student' ? 'ALUMNO' : meta?.guestRole === 'cohost' ? 'CO-HOST' : 'INVITADO';

              if (showCustom) {
                showCustom({
                  tag: resolvedTag,
                  text: resolvedName,
                  subtitle: resolvedRole,
                  color: '#06b6d4',
                  presetId: 'guest',
                  targetSlot: highestSlot - 1,
                });
              } else if (showManual) {
                showManual('guest');
              }

              setSpeakerLogs(prev => [
                { time: new Date().toLocaleTimeString(), slot: highestSlot, name: resolvedName, role: resolvedRole },
                ...prev.slice(0, 19)
              ]);
            }
          }
        } else {
          speechCandidateRef.current = highestSlot;
          candidateStartRef.current = now;
        }
      }
    } else {
      // Silencio o niveles por debajo del umbral
      speechCandidateRef.current = null;

      if (currentSpeakerRef.current !== null && !holdTimeoutRef.current) {
        setIsSpeakerHolding(true);
        holdTimeoutRef.current = setTimeout(() => {
          if (hide) hide();
          currentSpeakerRef.current = null;
          setActiveSpeakerSlot(null);
          setIsSpeakerHolding(false);
          holdTimeoutRef.current = null;
        }, holdSeconds * 1000);
      }
    }
  }, [
    enabled,
    cameraLevels,
    cameraMeta,
    hostName,
    hostRole,
    guestName,
    guestRole,
    cintillosVisible,
    sensitivityThreshold,
    holdSeconds,
    minSpeechDurationMs,
    showManual,
    showCustom,
    hide,
    clearHoldTimer
  ]);

  return {
    autoCintilloActive: enabled,
    activeSpeakerSlot,
    isSpeakerHolding,
    speakerLogs,
  };
}
