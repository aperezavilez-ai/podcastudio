/** Presets de imagen — valores relativos (100 = neutro). */
export const LOOK_PRESETS = [
  {
    id: 'none',
    name: 'Original',
    desc: 'Sin corrección',
    starter: true,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    warmth: 0,
    vignette: 0,
    vignetteSoft: 60,
    sharpness: 0,
    lutId: 'none',
  },
  {
    id: 'studio-warm',
    name: 'Estudio cálido',
    desc: 'Piel natural, luz ambarina',
    starter: true,
    brightness: 104,
    contrast: 108,
    saturation: 105,
    warmth: 18,
    vignette: 22,
    vignetteSoft: 65,
    sharpness: 8,
    lutId: 'none',
  },
  {
    id: 'studio-cool',
    name: 'Estudio frío',
    desc: 'Corporativo / tech',
    starter: false,
    brightness: 102,
    contrast: 112,
    saturation: 92,
    warmth: -12,
    vignette: 18,
    vignetteSoft: 58,
    sharpness: 10,
    lutId: 'none',
  },
  {
    id: 'broadcast',
    name: 'Contraste TV',
    desc: 'Negros profundos, texto legible',
    starter: false,
    brightness: 98,
    contrast: 118,
    saturation: 100,
    warmth: 0,
    vignette: 28,
    vignetteSoft: 50,
    sharpness: 14,
    lutId: 'none',
  },
  {
    id: 'podcast-soft',
    name: 'Podcast suave',
    desc: 'Look entrevista YouTube',
    starter: true,
    brightness: 106,
    contrast: 102,
    saturation: 98,
    warmth: 8,
    vignette: 32,
    vignetteSoft: 72,
    sharpness: 6,
    lutId: 'none',
  },
  {
    id: 'cinematic',
    name: 'Cinematográfico',
    desc: 'Teal & orange suave',
    starter: false,
    brightness: 100,
    contrast: 115,
    saturation: 108,
    warmth: 5,
    vignette: 38,
    vignetteSoft: 68,
    sharpness: 12,
    lutId: 'teal-orange',
  },
  {
    id: 'film-noir',
    name: 'Film noir',
    desc: 'Desaturado con viñeta fuerte',
    starter: false,
    brightness: 95,
    contrast: 125,
    saturation: 65,
    warmth: -5,
    vignette: 48,
    vignetteSoft: 45,
    sharpness: 8,
    lutId: 'mono-warm',
  },
]

export const LUT_PRESETS = [
  { id: 'none', name: 'Sin LUT', desc: 'Color natural' },
  { id: 'teal-orange', name: 'Teal & Orange', desc: 'Cine blockbuster' },
  { id: 'golden-hour', name: 'Golden hour', desc: 'Atardecer cálido' },
  { id: 'mono-warm', name: 'Mono cálido', desc: 'Blanco y negro suave' },
  { id: 'vibrant', name: 'Vibrante', desc: 'Colores vivos para redes' },
]

export const TRANSITION_MODES = [
  { id: 'cut', name: 'Corte', desc: 'Cambio instantáneo' },
  { id: 'crossfade', name: 'Crossfade', desc: 'Fundido suave 450ms' },
  { id: 'dip', name: 'Dip to black', desc: 'Estilo noticiero' },
  { id: 'push', name: 'Push lateral', desc: 'Deslizamiento horizontal' },
]

export const DEFAULT_LOOK = {
  presetId: 'podcast-soft',
  brightness: 106,
  contrast: 102,
  saturation: 98,
  warmth: 8,
  vignette: 32,
  vignetteSoft: 72,
  sharpness: 6,
  lutId: 'none',
  temporalVignette: true,
  transition: 'crossfade',
  cintilloMotion: true,
}

export function getLookPreset(id) {
  return LOOK_PRESETS.find(p => p.id === id) || LOOK_PRESETS[0]
}

export function applyLookPreset(presetId) {
  const p = getLookPreset(presetId)
  if (!p) return { ...DEFAULT_LOOK }
  return {
    presetId: p.id,
    brightness: p.brightness,
    contrast: p.contrast,
    saturation: p.saturation,
    warmth: p.warmth,
    vignette: p.vignette,
    vignetteSoft: p.vignetteSoft,
    sharpness: p.sharpness,
    lutId: p.lutId,
  }
}
