// ============================================================================
// Presupuesto de bus USB por formato (v2.0.0, Raíz B).
//
// La segunda cámara se moría de hambre: dos (o más) cámaras pidiendo
// 1080p a la vez sobre el mismo bus/controlador USB sin ningún
// presupuesto. La v1.6.0 lo «resolvía» midiendo fps bajo carga durante
// ~900 ms y PERSISTIENDO el escalón resultante por deviceId — medir bajo
// carga degradó cámaras sanas y el perfil guardado fijó la principal en
// 854×480. Eso está prohibido y NO vuelve.
//
// Esto es otra cosa: una decisión ESTÁTICA y previa a la apertura, sin
// medir nada y sin persistir nada. La plataforma web no expone elección
// de códec de captura (no existe constraint de códec en getUserMedia),
// así que el presupuesto actúa sobre la única dimensión de formato que
// la app controla — resolución × fps — con la regla de bus que el
// hardware impone: a 1080p30 un flujo UVC solo cabe en USB 2.0 si va
// comprimido (MJPEG, del orden de 120 Mbps); sin compresión (YUY2)
// serían ~995 Mbps, imposibles en ese bus. Limitar a 2 las cámaras que abren
// a 1080p simultáneamente y abrir la tercera en adelante a 720p acota el
// peor caso del bus compartido. La decisión se recalcula en CADA
// apertura desde el conjunto de cámaras vivas en ese momento: si una
// 1080p se desconecta, la siguiente apertura vuelve a poder ser 1080p.
// Un solo reintento: si la apertura en el escalón decidido muere por
// OverconstrainedError, se reintenta UNA vez en el escalón inferior.
// ============================================================================

export const MAX_SIMULTANEOUS_1080P_USB = 2;

export const USB_OPEN_TIERS = {
  '1080p': { width: { ideal: 1920, min: 320 }, height: { ideal: 1080, min: 240 }, frameRate: { ideal: 30, min: 15 } },
  '720p': { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
  '480p': { width: { ideal: 854 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
};

export function nextUsbTierDown(tier) {
  if (tier === '1080p') return '720p';
  if (tier === '720p') return '480p';
  return '480p';
}

// liveFormats: formatos YA negociados por las cámaras vivas
// ({ width, height } de getSettings() de sus pistas). Sin medición de
// rendimiento: es el estado declarado por las pistas existentes.
export function decideUsbOpenTier(liveFormats = []) {
  const at1080 = (liveFormats || []).filter(f => (f?.height || 0) >= 1000).length;
  return at1080 >= MAX_SIMULTANEOUS_1080P_USB ? '720p' : '1080p';
}
