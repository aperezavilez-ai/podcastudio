// ============================================================================
// v3.3.3 (defecto B) — selección de LENTE de la cámara del teléfono para
// la cámara remota (src/pages/RemoteCam.jsx).
//
// El defecto (captura image-134 de Luis): la toma remota se veía con
// efecto OJO DE PEZ — las paredes y el piso curvados —. La causa en
// código: la página NUNCA elegía lente; pedía solo
// `facingMode: { ideal: 'environment' }` con 720p, y con esa petición
// laxa el navegador/SO del teléfono puede satisfacerla con la lente
// ULTRA GRAN ANGULAR (0,5×), que es exactamente la que curva así.
// Tampoco se registraba la etiqueta de la lente servida, así que ni
// siquiera se podía comprobar cuál había entrado.
//
// La corrección: tras el permiso, se enumeran los dispositivos de
// vídeo y se elige la cámara ESTÁNDAR (1×) del facing pedido:
//   - se excluyen las etiquetas de ultra gran angular («ultra»,
//     «gran angular», «0.5»/«0,5») y de teleobjetivo («telephoto»,
//     «tele», «zoom», «2x»…), que también falsean el encuadre;
//   - entre las restantes del facing manda la principal (la que el
//     sistema nombra como cámara trasera/frontal a secas, o la
//     primera sin marcadores especiales);
//   - la elegida se pide por deviceId EXACTO; si el sistema no
//     etiqueta o el exact falla, la página cae — declarado — a la
//     petición por facingMode de siempre.
// Y la lente realmente servida queda registrada y visible
// (track.label): la aceptación en vivo pasa a ser verificable.
// ============================================================================

// Marcadores de lente NO estándar en las etiquetas de dispositivo
// (iOS/Android, inglés y español). «wide» a secas NO se excluye: la
// cámara principal de muchos teléfonos se etiqueta «wide» (es la 1×);
// la ultra siempre trae además «ultra» o el «0.5».
const MARCADORES_NO_ESTANDAR = [
  'ultra',
  'gran angular',
  '0.5', '0,5',
  'telephoto', 'telefoto', 'tele ',
  'zoom',
  'macro',
  'depth', 'profundidad',
  'infrared', 'infrarrojo',
  'tof',
];

const MARCADORES_FACING = {
  environment: ['back', 'trasera', 'rear', 'environment', 'posterior'],
  user: ['front', 'frontal', 'user', 'delantera', 'selfie'],
};

function normalizarEtiqueta(label) {
  return String(label || '').toLowerCase();
}

// ¿La etiqueta anuncia una lente que NO es la estándar (1×)?
export function esEtiquetaLenteNoEstandar(label) {
  const l = normalizarEtiqueta(label);
  if (!l) return false;
  return MARCADORES_NO_ESTANDAR.some((m) => l.includes(m));
}

// Puntuación de preferencia de la cámara principal: las etiquetas del
// sistema que nombran «la» cámara de ese lado (p. ej. «Back Camera»,
// «Cámara trasera») mandan sobre variantes con apellidos.
function puntajePrincipal(label, facing) {
  const l = normalizarEtiqueta(label);
  const marcadores = MARCADORES_FACING[facing] || MARCADORES_FACING.environment;
  let p = 0;
  if (marcadores.some((m) => l.includes(m))) p += 2;
  if (/\b(camera|cámara|camara)\b/.test(l)) p += 1;
  return p;
}

// Elige la cámara ESTÁNDAR del facing pedido entre los dispositivos
// enumerados (lista de MediaDeviceInfo o de objetos {deviceId, kind,
// label}). Devuelve { deviceId, label, via } o null si no hay una
// elección segura (la página entonces usa facingMode, declarado):
//   via 'deviceid-trasera-estandar' / 'deviceid-frontal-estandar' —
//   se eligió por etiqueta entre las del facing;
//   via 'deviceid-unica-candidata' — solo quedaba una candidata sin
//   marcadores en toda la lista (sin etiquetas de facing fiables).
export function elegirCamaraEstandar(devices, facing = 'environment') {
  const lista = (Array.isArray(devices) ? devices : [])
    .filter((d) => d && (d.kind === 'videoinput' || d.kind === undefined) && (d.deviceId || d.id));
  if (lista.length === 0) return null;
  const idDe = (d) => d.deviceId || d.id;
  const candidatas = lista.filter((d) => !esEtiquetaLenteNoEstandar(d.label));
  if (candidatas.length === 0) return null;
  const marcadores = MARCADORES_FACING[facing] || MARCADORES_FACING.environment;
  const delFacing = candidatas.filter((d) => marcadores.some((m) => normalizarEtiqueta(d.label).includes(m)));
  if (delFacing.length > 0) {
    const ordenadas = [...delFacing].sort((a, b) => puntajePrincipal(b.label, facing) - puntajePrincipal(a.label, facing));
    const e = ordenadas[0];
    return {
      deviceId: idDe(e),
      label: e.label || '',
      via: facing === 'user' ? 'deviceid-frontal-estandar' : 'deviceid-trasera-estandar',
    };
  }
  // Sin etiquetas de facing aprovechables: si solo queda UNA candidata
  // limpia, es seguro pedirla por deviceId; si hay varias y no se sabe
  // de qué lado es cada una, NO se adivina (null ⇒ facingMode).
  if (candidatas.length === 1) {
    const e = candidatas[0];
    return { deviceId: idDe(e), label: e.label || '', via: 'deviceid-unica-candidata' };
  }
  return null;
}

// ¿La lente REALMENTE servida (track.label / deviceId servido) es una
// no estándar? Para el registro honesto: si entró la ultra gran
// angular pese a la selección (el SO la impuso), la página lo declara
// en vez de ocultarlo.
export function lenteServidaEsNoEstandar(label) {
  return esEtiquetaLenteNoEstandar(label);
}
