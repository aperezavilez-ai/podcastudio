/**
 * Configuración oficial de Espacios de Trabajo (Workspaces) para PodcaStudio (Fase P1.1)
 * Permite adaptar la interfaz, los layouts, las ranuras de cámara y los paneles contextuales
 * según el tipo de producción audiovisual.
 */

export const WORKSPACES = [
  {
    id: 'podcast',
    name: 'Podcast Studio',
    shortName: 'Podcast',
    icon: 'Mic',
    badge: 'Mesa Redonda',
    accentColor: '#f97316', // orange-500
    defaultLayout: '4',
    camSlotCount: 4,
    dualMonitorDefault: false,
    activePanelDefault: 'musica',
    cintillosVisibleDefault: false,
    description: 'Optimizado para podcast tradicional y tertulias: acceso directo a música de fondo, efectos de sonido (SFX) y 4 micrófonos.',
    suggestedLayouts: ['4', 'two-shot', '1', 'gallery']
  },
  {
    id: 'interview',
    name: 'Entrevista 1 a 1',
    shortName: 'Entrevista',
    icon: 'Users',
    badge: 'Diálogo Cara a Cara',
    accentColor: '#06b6d4', // cyan-500
    defaultLayout: 'two-shot',
    camSlotCount: 2,
    dualMonitorDefault: false,
    activePanelDefault: 'cintillos',
    cintillosVisibleDefault: false,
    description: 'Enfocado en entrevistas dinámicas: plano doble simétrico (Two-Shot), cintillos de identificación de presentador e invitado y tally visual.',
    suggestedLayouts: ['two-shot', '2', '1', 'pip']
  },
  {
    id: 'talkshow',
    name: 'Programa en Vivo',
    shortName: 'En Vivo',
    icon: 'Tv',
    badge: 'Realización Broadcast',
    accentColor: '#ef4444', // red-500
    defaultLayout: '1',
    camSlotCount: 6,
    dualMonitorDefault: false,
    activePanelDefault: 'cintillos',
    cintillosVisibleDefault: false,
    description: 'Control de emisión estilo televisión: doble monitor Preview (PVW) / Program (PGM), transiciones disueltas AUTO/T-Bar y cintillos informativos.',
    suggestedLayouts: ['1', 'two-shot', '3', '6', 'pip']
  },
  {
    id: 'webinar',
    name: 'Clase / Webinar',
    shortName: 'Clase / Webinar',
    icon: 'GraduationCap',
    badge: 'Docente + Pantalla',
    accentColor: '#8b5cf6', // purple-500
    defaultLayout: 'pip',
    camSlotCount: 2,
    pipCamDefault: 1,
    activeCamDefault: 2,
    dualMonitorDefault: false,
    activePanelDefault: 'teleprompter',
    cintillosVisibleDefault: false,
    description: 'Diseñado para formación y ponencias: presentación o pantalla compartida en grande con recuadro PiP del docente y teleprompter/apuntes.',
    suggestedLayouts: ['pip', '1', '2', 'two-shot']
  },
  {
    id: 'radio',
    name: 'Radio Virtual',
    shortName: 'Radio',
    icon: 'Radio',
    badge: 'Audio Prioritario',
    accentColor: '#10b981', // emerald-500
    defaultLayout: 'speaker',
    camSlotCount: 3,
    dualMonitorDefault: false,
    activePanelDefault: 'voz',
    cintillosVisibleDefault: false,
    description: 'Flujo de trabajo para cabina de radio visual: ecualización de voz, efectos de locutor, cartuchera de cuñas/jingles y medidores VU prominentes.',
    suggestedLayouts: ['speaker', '1', 'two-shot', 'gallery']
  },
  {
    id: 'multicam',
    name: 'Multicámara Pro',
    shortName: 'Multicámara',
    icon: 'LayoutGrid',
    badge: 'Matriz Multiview',
    accentColor: '#eab308', // yellow-500
    defaultLayout: '6',
    camSlotCount: 8,
    dualMonitorDefault: true,
    activePanelDefault: '',
    cintillosVisibleDefault: false,
    description: 'Estación de realización profesional con muro multiview de hasta 8-10 fuentes concurrentes, tally al aire y conmutación ágil.',
    suggestedLayouts: ['6', '8', '10', 'gallery', '1']
  }
];

export function getWorkspaceById(id) {
  return WORKSPACES.find(w => w.id === id) || WORKSPACES[0];
}
