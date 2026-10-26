import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook de Subtitulado y Transcripción en Vivo para PodcaStudio (Fase P1.3)
 * Utiliza Web Speech API local del navegador/Electron para transcribir la voz en tiempo real
 * y alimentar el generador de subtítulos en pantalla (Open Captions).
 */
export function useLiveSubtitles({
  onSubtitleUpdate,
  defaultLanguage = 'es-MX'
} = {}) {
  const [isSupported, setIsSupported] = useState(false);
  const [active, setActive] = useState(false);
  const [language, setLanguage] = useState(defaultLanguage);
  const [currentText, setCurrentText] = useState('');
  const [recentTranscripts, setRecentTranscripts] = useState([]);
  const [burnInVideo, setBurnInVideo] = useState(true); // Quemar en el video MP4/Stream

  const recognitionRef = useRef(null);
  const clearTimerRef = useRef(null);
  const isManuallyStoppedRef = useRef(false);

  useEffect(() => {
    const SpeechClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechClass) {
      setIsSupported(true);
    }
  }, []);

  const clearSubtitleAfterDelay = useCallback(() => {
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => {
      setCurrentText('');
      if (onSubtitleUpdate) onSubtitleUpdate('');
    }, 4500); // Se oculta tras 4.5 segundos sin hablar
  }, [onSubtitleUpdate]);

  const startRecognition = useCallback(() => {
    const SpeechClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechClass) {
      console.warn('[useLiveSubtitles] Web Speech API no soportada en este entorno.');
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }

      const rec = new SpeechClass();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = language;

      rec.onstart = () => {
        setActive(true);
        isManuallyStoppedRef.current = false;
      };

      rec.onresult = (event) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }

        const textToDisplay = (final || interim).trim();
        if (textToDisplay) {
          setCurrentText(textToDisplay);
          if (onSubtitleUpdate) onSubtitleUpdate(textToDisplay);
          clearSubtitleAfterDelay();

          if (final) {
            setRecentTranscripts(prev => [
              { id: Date.now(), text: final.trim(), time: new Date().toLocaleTimeString() },
              ...prev.slice(0, 49) // Guardar últimas 50 frases para bitácora
            ]);
          }
        }
      };

      rec.onerror = (event) => {
        if (event.error === 'no-speech') return;
        console.warn('[useLiveSubtitles] Error de reconocimiento:', event.error);
      };

      rec.onend = () => {
        // Reconexión automática continua si no fue detenido manualmente
        if (!isManuallyStoppedRef.current && active) {
          try {
            rec.start();
          } catch (e) {}
        } else {
          setActive(false);
        }
      };

      rec.start();
      recognitionRef.current = rec;
      setActive(true);
    } catch (err) {
      console.warn('[useLiveSubtitles] Error al inicializar SpeechRecognition:', err);
    }
  }, [language, onSubtitleUpdate, clearSubtitleAfterDelay, active]);

  const stopRecognition = useCallback(() => {
    isManuallyStoppedRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setActive(false);
    setCurrentText('');
    if (onSubtitleUpdate) onSubtitleUpdate('');
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
  }, [onSubtitleUpdate]);

  const toggleSubtitles = useCallback(() => {
    if (active) {
      stopRecognition();
    } else {
      startRecognition();
    }
  }, [active, startRecognition, stopRecognition]);

  return {
    isSupported,
    active,
    toggleSubtitles,
    startRecognition,
    stopRecognition,
    currentText,
    language,
    setLanguage,
    recentTranscripts,
    burnInVideo,
    setBurnInVideo
  };
}
