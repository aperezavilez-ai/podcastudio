// ============================================================================
// Teleprompter — decisiones puras (v3.3.2, reconstrucción ordenada por Luis:
// «reconstruye todo eso de teleprompter, hazlo realmente funcional»).
//
// La evidencia que manda (ventana-diag.log de la sesión en vivo con la
// v3.3.0): en las 551 muestras [prompter] el HUD estuvo OFF y el overlay
// AUSENTE el 100 % del tiempo, mientras el reloj de desplazamiento corría
// de y=0 a y=12437 sin ninguna superficie que lo mostrara. El motor de
// scroll no era el problema: lo eran las decisiones alrededor — el montaje
// del overlay tenía una segunda compuerta invisible y el reloj avanzaba
// sin cota ni superficie. Estas tres funciones son TODA la decisión:
//
//   1) debeMontarOverlayPrompter(estado): el overlay se monta si y solo
//      si el estado HUD del teleprompter está encendido. No recibe — ni
//      le importa — la sección activa del panel, si el panel está
//      colapsado, la fase del motor nativo ni si se está grabando.
//   2) maximoDesplazamientoPrompter(superficies): el recorrido REAL del
//      guion según las superficies MONTADAS (el overlay termina cuando el
//      texto cruzó su región — la de la cámara de programa, en cualquier
//      modalidad: franja + texto, donde franja es la altura de ESA
//      región; la caja del panel termina en su scrollHeight −
//      clientHeight). Sin superficies montadas devuelve null: no hay
//      recorrido y el reloj no avanza a ciegas.
//   3) acotarDesplazamientoPrompter(y, maximo): el desplazamiento nunca
//      pasa del final real del texto en la superficie que lo muestra.
// ============================================================================

// (1) Montaje del overlay sobre el contenedor del programa: SOLO el HUD.
export function debeMontarOverlayPrompter(estado) {
  return Boolean(estado && estado.hudOn);
}

// (2) Recorrido real del guion con las superficies montadas.
//     superficies = {
//       overlay: { franjaPx, textoPx } | null,   // overlay sobre el programa
//       panel:   { scrollPx, clientePx } | null, // caja de lectura del panel
//     }
//     Devuelve el mayor recorrido entre las montadas, o null si no hay
//     ninguna montada (el reloj no tiene a quién mostrarse: no avanza).
export function maximoDesplazamientoPrompter(superficies = {}) {
  const { overlay, panel } = superficies || {};
  let maximo = null;
  if (overlay) {
    const recorrido = Math.max(0, (Number(overlay.franjaPx) || 0) + (Number(overlay.textoPx) || 0));
    maximo = maximo === null ? recorrido : Math.max(maximo, recorrido);
  }
  if (panel) {
    const recorrido = Math.max(0, (Number(panel.scrollPx) || 0) - (Number(panel.clientePx) || 0));
    maximo = maximo === null ? recorrido : Math.max(maximo, recorrido);
  }
  return maximo;
}

// (3) El desplazamiento, acotado al recorrido real: al llegar al final
//     del texto, se detiene en el final (nada de correr a 12437 con un
//     guion de 29 palabras). Sin máximo medible (null) solo se sanea el
//     signo: la decisión de no avanzar sin superficie es del bucle.
export function acotarDesplazamientoPrompter(desplazamiento, maximo) {
  const y = Math.max(0, Number(desplazamiento) || 0);
  if (maximo == null) return y;
  return Math.min(y, Math.max(0, Number(maximo) || 0));
}
