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
  '2160p': { width: { ideal: 3840, min: 1920 }, height: { ideal: 2160, min: 1080 }, frameRate: { ideal: 30, min: 15 } },
  '1440p': { width: { ideal: 2560, min: 1280 }, height: { ideal: 1440, min: 720 }, frameRate: { ideal: 30, min: 15 } },
  '1080p': { width: { ideal: 1920, min: 320 }, height: { ideal: 1080, min: 240 }, frameRate: { ideal: 30, min: 15 } },
  '720p': { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
  '480p': { width: { ideal: 854 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
};

export function nextUsbTierDown(tier) {
  if (tier === '2160p') return '1440p';
  if (tier === '1440p') return '1080p';
  if (tier === '1080p') return '720p';
  if (tier === '720p') return '480p';
  return '480p';
}

// Presupuesto de bus en equivalentes 1080p (v3.0.0): el bus admite el
// equivalente a 2 cámaras 1080p (presupuesto 2). Costes por formato
// negociado: 2160p = 2, 1440p = 1.5, 1080p = 1, 720p o menos = 0
// (válvula de alivio: siempre cabe).
export const USB_BUS_BUDGET = MAX_SIMULTANEOUS_1080P_USB;

export function usbTierCost(tier) {
  if (tier === '2160p') return 2;
  if (tier === '1440p') return 1.5;
  if (tier === '1080p') return 1;
  return 0;
}

export function usbFormatCost(format) {
  const h = format?.height || 0;
  if (h >= 2000) return 2;
  if (h >= 1300) return 1.5;
  if (h >= 1000) return 1;
  return 0;
}

// liveFormats: formatos YA negociados por las cámaras vivas
// ({ width, height } de getSettings() de sus pistas). Sin medición de
// rendimiento: es el estado declarado por las pistas existentes.
// requestedTier: escalón pedido (perfil de programa para la cámara
// principal; '1080p' por defecto = comportamiento histórico exacto).
// Mientras el coste del candidato supere el presupuesto restante Y el
// candidato sea superior a 720p, baja un escalón; 720p se concede
// siempre.
export function decideUsbOpenTier(liveFormats = [], requestedTier = '1080p') {
  const used = (liveFormats || []).reduce((acc, f) => acc + usbFormatCost(f), 0);
  const remaining = USB_BUS_BUDGET - used;
  let candidate = USB_OPEN_TIERS[requestedTier] ? requestedTier : '1080p';
  while (candidate !== '720p' && candidate !== '480p' && usbTierCost(candidate) > remaining) {
    candidate = nextUsbTierDown(candidate);
  }
  return candidate;
}
