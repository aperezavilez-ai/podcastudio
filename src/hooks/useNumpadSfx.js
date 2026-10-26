import { useEffect } from 'react';

/**
 * Hook para disparo instantáneo de efectos de sonido (SFX) mediante teclado numérico (Numpad 0-9)
 * Diseñado para operación ágil en cabina de radio y streaming en vivo (Fase P2.3)
 */
export const NUMPAD_SFX_MAP = {
  '1': { sfxId: 'sfx-appl-01', label: 'Aplausos', key: '1' },
  '2': { sfxId: 'sfx-laugh-02', label: 'Carcajadas', key: '2' },
  '3': { sfxId: 'sfx-ovat-01', label: 'Ovación', key: '3' },
  '4': { sfxId: 'sfx-com-01', label: 'Bocina', key: '4' },
  '5': { sfxId: 'sfx-door-01', label: 'Puerta', key: '5' },
  '6': { sfxId: 'sfx-glass-01', label: 'Cristales', key: '6' },
  '7': { sfxId: 'sfx-phone-01', label: 'Teléfono', key: '7' },
  '8': { sfxId: 'sfx-com-02', label: 'Grillos', key: '8' },
  '9': { sfxId: 'sfx-appl-02', label: 'Palmas', key: '9' },
};

export function useNumpadSfx({ onPlaySfx, onStopSfx, enabled = true }) {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e) {
      // Ignorar si el usuario está escribiendo en un input, textarea o contenteditable
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) {
        return;
      }

      // Detectar teclas de Numpad o dígitos numéricos
      let digit = null;
      if (e.code && e.code.startsWith('Numpad')) {
        digit = e.code.replace('Numpad', '');
      } else if (e.code && e.code.startsWith('Digit')) {
        // También admitir Digit si no se presionan modificadores
        if (!e.ctrlKey && !e.altKey && !e.metaKey) {
          digit = e.code.replace('Digit', '');
        }
      }

      if (!digit) return;

      if (digit === '0') {
        if (onStopSfx) onStopSfx();
        return;
      }

      const match = NUMPAD_SFX_MAP[digit];
      if (match && onPlaySfx) {
        e.preventDefault();
        onPlaySfx(match.sfxId);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPlaySfx, onStopSfx, enabled]);

  return { numpadMap: NUMPAD_SFX_MAP };
}
