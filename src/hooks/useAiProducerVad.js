import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook de IA Productora VAD (Voice Activity Detection) para PodcaStudio (Fase P1.2)
 * Detecta qué participante está hablando analizando los niveles de audio en tiempo real
 * y realiza conmutación automática inteligente entre cámaras (Auto-Director Broadcast).
 */
export function useAiProducerVad({
  audioLevels = {},
  activeCam = 1,
  layoutMode = '1',
  camSlots = [1, 2, 3, 4],
  onSwitchCam,
  onSwitchLayout
}) {
  const [enabled, setEnabled] = useState(false);
  const [sensitivity, setSensitivity] = useState('medium'); // 'low' | 'medium' | 'high'
  const [cooldownSeconds, setCooldownSeconds] = useState(3); // Tiempo mínimo entre cambios de plano (segundos)
  const [autoWideShot, setAutoWideShot] = useState(true); // Conmutar a plano general en caso de debate cruzado

  const [currentSpeakerId, setCurrentSpeakerId] = useState(null);
  const [activeSpeakers, setActiveSpeakers] = useState([]);
  const [isDebate, setIsDebate] = useState(false);
  const [statusText, setStatusText] = useState('Inactivo');

  // Referencias para control de tiempos de VAD
  const speakingSinceRef = useRef({}); // camId -> timestamp ms cuando empezó a hablar sostenido
  const lastSwitchTimeRef = useRef(0);
  const silenceStartRef = useRef(null);

  // Umbral de sensibilidad en escala 0..100
  const threshold = sensitivity === 'high' ? 10 : sensitivity === 'medium' ? 18 : 28;
  const minSpeechDurationMs = 800; // Debe hablar sostenido al menos 800ms para evitar falsos positivos por carraspeos

  useEffect(() => {
    if (!enabled) {
      setStatusText('Auto-Director Apagado');
      setIsDebate(false);
      setCurrentSpeakerId(null);
      setActiveSpeakers([]);
      speakingSinceRef.current = {};
      return;
    }

    const now = Date.now();
    const speakingCams = [];

    // 1. Evaluar qué cámaras superan el umbral acústico
    camSlots.forEach((camId) => {
      const data = audioLevels[camId];
      const level = data?.level || 0;
      const isMuted = data?.isMuted || false;

      if (!isMuted && level >= threshold) {
        if (!speakingSinceRef.current[camId]) {
          speakingSinceRef.current[camId] = now;
        }
        const duration = now - speakingSinceRef.current[camId];
        if (duration >= minSpeechDurationMs) {
          speakingCams.push(camId);
        }
      } else {
        delete speakingSinceRef.current[camId];
      }
    });

    setActiveSpeakers(speakingCams);

    // 2. Comportamiento ante silencio general
    if (speakingCams.length === 0) {
      if (!silenceStartRef.current) silenceStartRef.current = now;
      setStatusText('Escuchando ambiente...');
      return;
    }

    silenceStartRef.current = null;
    const cooldownMs = cooldownSeconds * 1000;
    const timeSinceLastSwitch = now - lastSwitchTimeRef.current;

    // 3. Caso: Múltiples personas hablando a la vez (Debate / Interrupción)
    if (speakingCams.length >= 2 && autoWideShot) {
      setIsDebate(true);
      setStatusText(`Debate activo (Cámaras: ${speakingCams.join(', ')})`);

      if (timeSinceLastSwitch >= cooldownMs) {
        // Conmutar a plano compartido
        if (speakingCams.length === 2 && (layoutMode !== 'two-shot' && layoutMode !== '2')) {
          if (onSwitchLayout) onSwitchLayout('two-shot');
          lastSwitchTimeRef.current = now;
        } else if (speakingCams.length > 2 && layoutMode !== 'gallery' && layoutMode !== '4') {
          if (onSwitchLayout) onSwitchLayout('gallery');
          lastSwitchTimeRef.current = now;
        }
      }
      return;
    }

    setIsDebate(false);

    // 4. Caso: Un solo orador predominante
    if (speakingCams.length === 1) {
      const dominantCam = speakingCams[0];
      setCurrentSpeakerId(dominantCam);
      setStatusText(`Voz detectada en CAM ${dominantCam}`);

      if (dominantCam !== activeCam && timeSinceLastSwitch >= cooldownMs) {
        // Si estábamos en plano dividido o plano de otro orador, enfocar al nuevo orador
        if (onSwitchCam) {
          onSwitchCam(dominantCam);
          lastSwitchTimeRef.current = now;
          setStatusText(`Conmutado a CAM ${dominantCam} (Voz principal)`);
        }
      }
    }
  }, [audioLevels, enabled, sensitivity, cooldownSeconds, autoWideShot, activeCam, layoutMode, camSlots, threshold, onSwitchCam, onSwitchLayout]);

  const toggleEnabled = useCallback(() => {
    setEnabled(prev => !prev);
  }, []);

  return {
    enabled,
    toggleEnabled,
    setEnabled,
    sensitivity,
    setSensitivity,
    cooldownSeconds,
    setCooldownSeconds,
    autoWideShot,
    setAutoWideShot,
    currentSpeakerId,
    activeSpeakers,
    isDebate,
    statusText
  };
}
