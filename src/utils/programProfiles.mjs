// ============================================================================
// Perfiles de programa (v3.0.0, Motor PodcastStudio).
//
// El programa se compone y se graba al perfil elegido; la salida de
// streaming se capa SIEMPRE a 1080p (streamWidth/streamHeight nunca
// superan 1920×1080): las plataformas de destino no aceptan más y el
// núcleo deriva la salida del archivo maestro con copia/escalado según
// el perfil que el renderer anuncia con setProgramProfile.
// Módulo puro: sin DOM, sin Electron, testeable en Node.
// ============================================================================

export const PROGRAM_PROFILES = {
  '1080p': {
    id: '1080p',
    label: '1080p Full HD',
    width: 1920,
    height: 1080,
    fps: 30,
    masterBitrateBps: 10_000_000,
    streamWidth: 1920,
    streamHeight: 1080,
    streamBitrateBps: 6_000_000,
    avcCodec: 'avc1.640028',
  },
  '1440p': {
    id: '1440p',
    label: '1440p QHD',
    width: 2560,
    height: 1440,
    fps: 30,
    masterBitrateBps: 20_000_000,
    streamWidth: 1920,
    streamHeight: 1080,
    streamBitrateBps: 6_000_000,
    avcCodec: 'avc1.640032',
  },
  '2160p': {
    id: '2160p',
    label: '2160p 4K UHD',
    width: 3840,
    height: 2160,
    fps: 30,
    masterBitrateBps: 40_000_000,
    streamWidth: 1920,
    streamHeight: 1080,
    streamBitrateBps: 6_000_000,
    avcCodec: 'avc1.640033',
  },
};

export const DEFAULT_PROGRAM_PROFILE_ID = '1080p';

export const PROGRAM_PROFILE_IDS = ['1080p', '1440p', '2160p'];

export function getProgramProfile(id) {
  return PROGRAM_PROFILES[id] || PROGRAM_PROFILES[DEFAULT_PROGRAM_PROFILE_ID];
}

// true si el máster supera la salida de streaming (hay que avisar:
// «Grabas en X · transmites en 1080p»).
export function isUplinkCapped(profile) {
  if (!profile) return false;
  return profile.width > profile.streamWidth || profile.height > profile.streamHeight;
}
