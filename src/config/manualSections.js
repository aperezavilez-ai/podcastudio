/** Manual de operación — contenido editable centralizado. */
export const MANUAL_SECTIONS = [
  {
    id: 'acceso',
    icon: 'ti-door-enter',
    title: 'Acceder a la app',
    summary: 'URL correcta, login y entrar al estudio.',
    steps: [
      { action: 'Abre la app en el navegador', detail: 'Usa exactamente https://www.podcastudio.mx (sin la «s» extra de «studio» en el dominio).' },
      { action: 'Inicia sesión', detail: 'Pulsa «Iniciar sesión» en la portada o ve a /auth. Escribe tu correo y contraseña.' },
      { action: 'Elige y paga tu plan', detail: 'En /plans elige Starter, Pro o Anual. El pago es con Stripe; sin plan activo no hay acceso al estudio.' },
      { action: 'Configura tu podcast (opcional)', detail: 'Tras pagar, el asistente /setup pide nombre, logo, cintillos y formato.' },
      { action: 'Abrir el estudio', detail: 'Con plan activo o cuenta admin, entra a /studio desde planes o el menú.' },
    ],
    tip: 'Si en el móvil ves «No se puede acceder», revisa que no hayas escrito podcaststudio.mx — el dominio correcto es podcastudio.mx.',
  },
  {
    id: 'pwa',
    icon: 'ti-download',
    title: 'Instalar la app (PWA)',
    summary: 'Añadir PodcastStudio a la pantalla de inicio.',
    steps: [
      { action: 'Desde la portada', detail: 'Busca la tarjeta «Instalar PodcastStudio» o el botón «Instalar» en la barra superior.' },
      { action: 'En Chrome (Android/PC)', detail: 'Pulsa «Instalar» y confirma. La app quedará como acceso directo.' },
      { action: 'En Safari (iPhone/iPad)', detail: 'Pulsa Compartir → «Añadir a pantalla de inicio». Ábrela desde el icono naranja.' },
      { action: 'Actualizar versión', detail: 'Si hay actualización, la portada o el banner te avisará. Pulsa «Actualizar» para cargar la última versión.' },
    ],
  },
  {
    id: 'estudio-layout',
    icon: 'ti-layout',
    title: 'Recorrido del estudio',
    summary: 'Dónde está cada control en pantalla.',
    steps: [
      { action: 'Barra superior', detail: 'Nombre del episodio, indicador REC al grabar, chip «IA activa» y botón Guía (libro) que abre el manual sin salir del estudio.' },
      { action: 'Barra izquierda (iconos)', detail: 'Live (cámaras), Guía (manual en popup), Posts IA, Grabaciones. Abajo: Ajustes.' },
      { action: 'Centro — visor', detail: 'Vista previa en vivo con cintillos, logo y look aplicado. Es lo que se grabará.' },
      { action: 'Miniaturas de cámaras', detail: 'Debajo del visor: haz clic en CAM 1, 2 o 3 para cambiar el plano activo.' },
      { action: 'Panel derecho', detail: 'En PC aparece fijo. En móvil pulsa el icono de panel (sidebar) arriba a la derecha para abrirlo.' },
      { action: 'Botón rojo Grabar', detail: 'Abajo en el panel derecho. Pulsa para iniciar; vuelve a pulsar para detener.' },
    ],
  },
  {
    id: 'camaras',
    icon: 'ti-video',
    title: 'Conectar cámaras',
    summary: 'USB, WiFi y Bluetooth.',
    steps: [
      { action: 'Permitir acceso', detail: 'El navegador pedirá permiso de cámara y micrófono. Acepta para que funcione el estudio.' },
      { action: 'Cámara USB / webcam', detail: 'Al entrar, la app detecta cámaras automáticamente. CAM 1 suele ser la integrada o la primera USB.' },
      { action: 'Añadir otra cámara', detail: 'En el panel «Cámaras», pulsa conectar en el slot CAM 2 o CAM 3 y elige dispositivo de la lista.' },
      { action: 'Cámara WiFi (IP Webcam)', detail: 'Panel Cámaras → WiFi → pega la URL del stream (ej. http://192.168.x.x:8080/video) y conectar.' },
      { action: 'Cámara Bluetooth', detail: 'Panel Cámaras → Bluetooth → escanear y seleccionar dispositivo compatible.' },
      { action: 'Cambiar plano en vivo', detail: 'Clic en la miniatura de la cámara que quieres al aire, o activa el cambio automático / Director IA.' },
    ],
    tip: 'En móvil normalmente solo hay una cámara frontal/trasera. Para podcast multipersona usa PC con varias USB.',
  },
  {
    id: 'microfono',
    icon: 'ti-microphone',
    title: 'Micrófono y audio',
    summary: 'Elegir mic, niveles y música.',
    steps: [
      { action: 'Selector de micrófono', detail: 'En el panel derecho, desplegable «Micrófono». Elige el dispositivo externo si lo conectaste.' },
      { action: 'Medidor VU', detail: 'Las barras verdes muestran el nivel. Habla y comprueba que sube; si no, cambia de micrófono.' },
      { action: 'Mic externo prioritario', detail: 'Al conectar un mic USB o Bluetooth, selecciónalo en el desplegable. El audio de la laptop/móvil queda en segundo plano.' },
      { action: 'Música de fondo', detail: 'Sección Música: elige género y pista, ajusta volumen. Se mezcla en la grabación.' },
    ],
  },
  {
    id: 'cintillos',
    icon: 'ti-layout-bottombar',
    title: 'Cintillos en pantalla',
    summary: 'Textos, estilos e IA.',
    steps: [
      { action: 'Activar un cintillo', detail: 'Panel Cintillos → cada preset va a su cámara: conductor CAM 1 (izq.), invitado CAM 3 (der.), centrales en MASTER.' },
      { action: 'Generar con IA', detail: 'Botón «Generar cintillo IA (invitado)» crea texto para CAM 3 según tu episodio e invitado.' },
      { action: 'Cintillo personalizado', detail: '«+ Personalizado»: elige cámara, etiqueta y texto.' },
      { action: 'Estilo y esquina', detail: 'Diseño global + en cada bloque de cámara elige esquina (9 posiciones).' },
      { action: 'Rotación automática', detail: 'Tema (MASTER) → Invitado (CAM 3) → Conductor (CAM 1) → Redes → Contacto → Promo.' },
    ],
  },
  {
    id: 'teleprompter',
    icon: 'ti-script',
    title: 'Teleprompter',
    summary: 'Guion en pantalla y documento Word.',
    steps: [
      { action: 'Abrir teleprompter', detail: 'Panel Teleprompter → activar visibilidad. El texto aparece sobre el visor.' },
      { action: 'Escribir o pegar guion', detail: 'Edita el texto en el panel. Ajusta velocidad y tamaño de letra.' },
      { action: 'Subir Word (.docx)', detail: 'Botón «Subir documento». La IA corrige y formatea el texto para leerlo en pantalla.' },
      { action: 'Control en vivo', detail: 'Pluma o teclado: Av. Pág / Enter / → = play-pausa · Re. Pág / Inicio = reiniciar. Haz clic en el estudio antes de empezar.' },
    ],
  },
  {
    id: 'look',
    icon: 'ti-palette',
    title: 'Look Pro (imagen)',
    summary: 'Color, viñeta, LUTs y transiciones.',
    steps: [
      { action: 'Abrir Look Pro', detail: 'Panel derecho → sección Look Pro (preset, brillo, contraste, viñeta).' },
      { action: 'Elegir preset', detail: 'Pulsa un preset (Estudio cálido, Cine frío, etc.). Los cambios se ven al instante en el visor.' },
      { action: 'Ajustes finos', detail: 'Sliders de brillo, contraste, saturación, calidez y viñeta.' },
      { action: 'LUT y transiciones', detail: 'Elige un LUT de color y modo de transición al cambiar de cámara (crossfade, cut, etc.).' },
      { action: 'Se graba en el video', detail: 'Todo el look se aplica dentro del archivo exportado, no es solo filtro de preview.' },
    ],
  },
  {
    id: 'director',
    icon: 'ti-wand',
    title: 'Director IA y cambio auto',
    summary: 'Cambio automático de cámaras.',
    steps: [
      { action: 'Modo manual', detail: 'Por defecto tú eliges la cámara con las miniaturas CAM 1/2/3.' },
      { action: 'Cambio automático', detail: 'Activa «Auto switch» y define intervalo en segundos entre planos.' },
      { action: 'Director IA', detail: 'Modo «Director IA»: detecta caras y movimiento para elegir plano y encuadre. Requiere plan Pro.' },
    ],
  },
  {
    id: 'grabar',
    icon: 'ti-player-record',
    title: 'Grabar y descargar',
    summary: 'Exportar tu episodio.',
    steps: [
      { action: 'Iniciar grabación', detail: 'Pulsa el botón rojo «Grabar» en el panel derecho. Aparece REC y el cronómetro arriba.' },
      { action: 'Detener', detail: 'Pulsa de nuevo «Detener». La grabación se guarda en la pestaña Grabaciones (icono archivos a la izquierda).' },
      { action: 'Descargar WebM', detail: 'Pestaña Grabaciones → icono descarga en el clip. Formato rápido, ideal para editar.' },
      { action: 'Descargar MP4', detail: 'Botón MP4 convierte el archivo (tarda un poco). Mejor para subir a redes.' },
      { action: 'Qué incluye el video', detail: 'Cámaras, cintillos, logo, look, música y mezcla de micrófono van dentro del archivo.' },
    ],
  },
  {
    id: 'publicar',
    icon: 'ti-upload',
    title: 'Publicar en redes',
    summary: 'Posts IA y YouTube opcional.',
    steps: [
      { action: 'Abrir Publicar', detail: 'Panel derecho → sección Publicar, o pestaña Posts IA en la barra izquierda.' },
      { action: 'Generar posts', detail: 'Posts IA → genera textos e hashtags para Instagram, TikTok, YouTube y Facebook.' },
      { action: 'Copiar y subir', detail: 'Copia el texto generado y sube manualmente el MP4 en cada red (Instagram, TikTok, etc.).' },
      { action: 'YouTube (opcional)', detail: 'Conecta tu canal Google en Publicar → YouTube. Permite publicar la grabación en tu canal.' },
    ],
    tip: 'No necesitas Restream ni OBS para el flujo actual: graba, descarga y sube el archivo.',
  },
  {
    id: 'problemas',
    icon: 'ti-tool',
    title: 'Solución de problemas',
    summary: 'Errores frecuentes.',
    steps: [
      { action: 'Pantalla negra en móvil', detail: 'Usa www.podcastudio.mx, borra caché o reinstala la PWA. Prueba ventana privada.' },
      { action: 'Dominio no carga', detail: 'ERR_NAME_NOT_RESOLVED = URL incorrecta. Debe ser podcastudio.mx, no podcaststudio.mx.' },
      { action: 'Sin cámara / sin señal', detail: 'Revisa permisos del navegador (cámara/mic). En Chrome: candado junto a la URL → Permisos.' },
      { action: 'No puedo entrar al estudio', detail: 'Necesitas un plan activo (pago con Stripe) o cuenta de administrador. Ve a /plans para contratar.' },
      { action: 'IA no responde', detail: 'Funciones IA requieren ANTHROPIC_API_KEY en el servidor. Sin ella, cintillos y posts manuales siguen funcionando.' },
      { action: 'Login falla', detail: 'Verifica que el correo esté bien escrito. Escribe la contraseña a mano sin autocompletar del navegador.' },
    ],
  },
]

export function filterManualSections(query) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return MANUAL_SECTIONS
  return MANUAL_SECTIONS.filter((s) => {
    const hay = [
      s.title,
      s.summary,
      s.tip,
      ...(s.steps || []).flatMap((st) => [st.action, st.detail]),
    ].join(' ').toLowerCase()
    return hay.includes(q)
  })
}
