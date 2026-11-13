// ============================================================================
// Pruebas v3.3.2 — reconstrucción del teleprompter (orden expresa de Luis:
// «reconstruye todo eso de teleprompter, hazlo realmente funcional»).
//
// La evidencia (ventana-diag.log de su sesión en vivo con la v3.3.0, 556
// líneas [prompter]): el HUD estuvo OFF y el overlay AUSENTE en el 100 %
// de las 551 muestras, mientras el reloj corría de y=0 a y=12437 y los
// INICIAR/PAUSAR sí se registraban. El contrato que fijan estas pruebas:
//
//   (a) el interruptor HUD pone el estado único en encendido y el overlay
//       se monta sobre el contenedor del programa — la decisión de
//       montaje es la función pura debeMontarOverlayPrompter y el JSX la
//       usa como ÚNICA condición;
//   (b) el montaje NO depende de la sección activa del panel, de si el
//       panel está colapsado, de la fase del motor nativo ni de si se
//       está grabando (la segunda compuerta «ocultar al grabar», siempre
//       activa y sin control, quedó eliminada);
//   (c) el reloj se detiene en el final real del texto: el desplazamiento
//       se acota al recorrido medido de las superficies montadas (con
//       los números del log: la caja saturó en 94 px con el guion de 29
//       palabras; el reloj ya no puede correr a 12437).
// ============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  debeMontarOverlayPrompter,
  maximoDesplazamientoPrompter,
  acotarDesplazamientoPrompter,
} from '../src/utils/teleprompter.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'App.jsx'), 'utf8');

// ---------------------------------------------------------------------------
// (a) La decisión de montaje: solo el estado HUD
// ---------------------------------------------------------------------------

test('v3.3.2 (a): el overlay se monta si y solo si el estado HUD está encendido', () => {
  assert.equal(debeMontarOverlayPrompter({ hudOn: true }), true);
  assert.equal(debeMontarOverlayPrompter({ hudOn: false }), false);
  assert.equal(debeMontarOverlayPrompter({}), false);
  assert.equal(debeMontarOverlayPrompter(null), false);
  assert.equal(debeMontarOverlayPrompter(undefined), false);
});

test('v3.3.2 (b): el montaje no depende del panel, del motor ni de la grabación', () => {
  // Mismo hudOn, todo lo demás distinto → misma decisión. La función ni
  // siquiera recibe esos campos: la independencia es por construcción.
  const encendido = { hudOn: true, seccionPanel: 'teleprompter', panelColapsado: false, faseMotor: 'apagado', grabando: false };
  const encendidoEnGrabacion = { hudOn: true, seccionPanel: 'transmision', panelColapsado: true, faseMotor: 'grabando-transmitiendo', grabando: true };
  assert.equal(debeMontarOverlayPrompter(encendido), true);
  assert.equal(debeMontarOverlayPrompter(encendidoEnGrabacion), true);
  const apagado = { hudOn: false, seccionPanel: 'teleprompter', panelColapsado: false, faseMotor: 'apagado', grabando: false };
  assert.equal(debeMontarOverlayPrompter(apagado), false);
});

test('v3.3.2 (a/b): el JSX monta el overlay SOLO con esa decisión, sin segunda compuerta', () => {
  assert.ok(
    appSource.includes('debeMontarOverlayPrompter({ hudOn: showFloatingPrompter })'),
    'el JSX usa la función pura con el estado único como única condición',
  );
  assert.ok(!appSource.includes('setTeleprompterHideInRec'), 'fuera el estado de la segunda compuerta');
  assert.ok(!appSource.includes('|| !teleprompterHideInRec'), 'fuera la compuerta «ocultar al grabar» del montaje');
  const i = appSource.indexOf('debeMontarOverlayPrompter({ hudOn: showFloatingPrompter })');
  const condicion = appSource.slice(i, i + 120);
  assert.ok(!condicion.includes('isRecording'), 'la condición de montaje no mira la grabación');
  assert.ok(!condicion.includes('activePanel'), 'la condición de montaje no mira la sección del panel');
});

test('v3.3.2 (a): el overlay vive sobre el contenedor del programa, por encima del video', () => {
  const i = appSource.indexOf('TELEPROMPTER HUD SOBRE EL PROGRAMA');
  assert.ok(i >= 0, 'existe el bloque del overlay');
  const bloque = appSource.slice(i, i + 3600);
  assert.ok(bloque.includes('debeMontarOverlayPrompter({ hudOn: showFloatingPrompter })'), 'montaje dentro del contenedor del programa');
  assert.ok(bloque.includes('z-[45]'), 'z-[45]: sobre los tiles, la guía y el logo (z-30) y el video compuesto del monitor (z-40); bajo la cuenta atrás (z-50)');
  assert.ok(bloque.includes('pointer-events-none'), 'el overlay no intercepta clics');
  assert.ok(bloque.includes('ref={teleprompterOverlayRef}'), 'la franja tiene su ref para colocarla sobre la región PGM');
  assert.ok(bloque.includes('ref={teleprompterTextRef}'), 'el texto del overlay es la superficie que mide el instrumento');
});

test('v3.3.2 (a): el interruptor del panel escribe el MISMO estado que el overlay lee', () => {
  assert.ok(appSource.includes('onClick={() => setShowFloatingPrompter(p => !p)}'), 'el interruptor HUD alterna showFloatingPrompter');
  assert.ok(appSource.includes("showFloatingPrompter ? 'HUD Activo' : 'HUD Inactivo'"), 'la etiqueta dice el estado sin ambigüedad: «HUD Activo» / «HUD Inactivo»');
  assert.ok(
    appSource.includes("import { debeMontarOverlayPrompter, maximoDesplazamientoPrompter, acotarDesplazamientoPrompter } from './utils/teleprompter.mjs';"),
    'App.jsx importa las decisiones puras del módulo',
  );
});

// ---------------------------------------------------------------------------
// (c) El reloj acotado al recorrido real
// ---------------------------------------------------------------------------

test('v3.3.2 (c): el recorrido real sale de las superficies montadas (las cifras del log)', () => {
  // La caja del panel con el guion de 29 palabras saturó en 94 px.
  assert.equal(maximoDesplazamientoPrompter({ panel: { scrollPx: 246, clientePx: 152 } }), 94);
  // Solo el overlay: el texto termina de cruzar la franja en franja + texto.
  assert.equal(maximoDesplazamientoPrompter({ overlay: { franjaPx: 250, textoPx: 400 } }), 650);
  // Ambas montadas: manda el mayor recorrido (cada superficie se detiene
  // en su propio final al proyectarse).
  assert.equal(maximoDesplazamientoPrompter({ overlay: { franjaPx: 250, textoPx: 400 }, panel: { scrollPx: 246, clientePx: 152 } }), 650);
  // Texto más corto que la caja: recorrido 0, el reloj no se mueve.
  assert.equal(maximoDesplazamientoPrompter({ panel: { scrollPx: 100, clientePx: 152 } }), 0);
  // Sin superficies montadas: null — no hay recorrido y el reloj no avanza.
  assert.equal(maximoDesplazamientoPrompter({}), null);
  assert.equal(maximoDesplazamientoPrompter({ overlay: null, panel: null }), null);
  assert.equal(maximoDesplazamientoPrompter(), null);
});

test('v3.3.2 (c): el desplazamiento se detiene en el final (nunca más y=12437)', () => {
  assert.equal(acotarDesplazamientoPrompter(12437, 749), 749, 'el y del log, acotado al recorrido de un overlay montado');
  assert.equal(acotarDesplazamientoPrompter(12437, 94), 94, 'acotado al recorrido de la caja del log');
  assert.equal(acotarDesplazamientoPrompter(50, 94), 50, 'dentro del recorrido no se toca');
  assert.equal(acotarDesplazamientoPrompter(-5, 94), 0, 'nunca negativo');
  assert.equal(acotarDesplazamientoPrompter(0, 0), 0);
  assert.equal(acotarDesplazamientoPrompter(100, null), 100, 'sin máximo medible solo se sanea (no avanzar lo decide el bucle)');
});

test('v3.3.2 (c): un solo bucle, un solo reloj, sin acumuladores paralelos', () => {
  assert.ok(!appSource.includes('rightPrompterScrollPos.current'), 'retirado el acumulador propio de la caja (puerto seguro)');
  assert.ok(!appSource.includes('panelPrompterScrollRef.current'), 'retirado el acumulador zombi que se escribía y no se leía');
  assert.ok(!appSource.includes('PUERTO SEGURO DEL RECUADRO'), 'retirado el segundo rAF de la caja');
  const i = appSource.indexOf('const animate = (time) =>');
  const animate = appSource.slice(i, i + 3500);
  assert.ok(animate.includes('medirMaximoDesplazamientoPrompter()'), 'el bucle mide el recorrido real antes de avanzar');
  assert.ok(animate.includes('if (maximo !== null)'), 'sin superficie montada el reloj no avanza a ciegas');
  assert.ok(animate.includes('projectTeleprompterPanel()'), 'el bucle proyecta la caja desde el reloj único');
});

test('v3.3.2: INICIAR/PAUSAR pasa por el manejador único con guarda de fin de guion', () => {
  assert.ok(!appSource.includes('const handlePlayTeleprompter'), 'fuera el manejador muerto que nadie llamaba');
  assert.ok(!appSource.includes('onClick={() => setIsTeleprompterPlaying(p => !p)}'), 'ningún botón alterna el estado a pelo');
  const usos = appSource.split('onClick={handleToggleTeleprompterPlay}').length - 1;
  assert.equal(usos, 2, 'transporte del panel y clic en la caja comparten el manejador único');
  const i = appSource.indexOf('const handleToggleTeleprompterPlay');
  const cuerpo = appSource.slice(i, i + 900);
  assert.ok(cuerpo.includes('medirMaximoDesplazamientoPrompter()'), 'la guarda mide el recorrido real');
  assert.ok(cuerpo.includes('teleprompterYRef.current = 0;'), 'al final del guion, INICIAR vuelve al principio');
});

// ---------------------------------------------------------------------------
// Revisión de alcance (evidencia en vivo de Luis sobre la v3.3.1): el
// overlay SÍ se monta con «HUD Activo»; los blancos reales son la entrada
// desde abajo, la presencia en cualquier modalidad y nunca a la mezcla.
// ---------------------------------------------------------------------------

const engineSource = fs.readFileSync(path.join(repoRoot, 'src', 'utils', 'masterBroadcastEngine.js'), 'utf8');

test('v3.3.2 (1): el texto entra por el borde INFERIOR de la región y sube', () => {
  // Ya no existe la franja fija del 48 % (la que hacía emerger el texto
  // «desde el medio»): la franja es la región completa de la cámara.
  assert.ok(!appSource.includes('h-[48%]'), 'fuera la franja fija del 48 % del contenedor');
  // La geometría del contrato: translateY = franja − desplazamiento; con
  // desplazamiento 0 (inicio/reinicio) vale exactamente la altura de la
  // región → la primera línea está a pie de video, en su borde inferior.
  const franja = 540; // altura de una región PGM a pantalla completa
  const maximo = maximoDesplazamientoPrompter({ overlay: { franjaPx: franja, textoPx: 300 } });
  assert.equal(maximo, 840);
  assert.equal(franja - acotarDesplazamientoPrompter(0, maximo), franja, 'al inicio, la primera línea está en el borde inferior de la región');
  assert.equal(franja - acotarDesplazamientoPrompter(99999, maximo), franja - maximo, 'al final, el texto salió por arriba y el reloj se detuvo');
});

test('v3.3.2 (2): la decisión de montaje cubre las modalidades 2/3/4 (y todas)', () => {
  for (const layoutMode of ['1', 'pip', '2', 'two-shot', '3', '4', '6', '8', 'speaker', 'gallery']) {
    assert.equal(
      debeMontarOverlayPrompter({ hudOn: true, layoutMode }),
      true,
      `con HUD encendido el overlay se monta en layout ${layoutMode}`,
    );
    assert.equal(
      debeMontarOverlayPrompter({ hudOn: false, layoutMode }),
      false,
      `con HUD apagado no se monta en layout ${layoutMode}`,
    );
  }
});

test('v3.3.2 (2): la franja se coloca sobre la región PGM medida, en cualquier layout', () => {
  assert.ok(
    appSource.includes("data-pgm-tile={id === effectiveActiveCam ? '1' : undefined}"),
    'el tile de la cámara de programa lleva la marca en CUALQUIER modalidad (el map de tiles es único)',
  );
  const i = appSource.indexOf('const medirRegionPgmPrompter');
  const medida = appSource.slice(i, i + 1100);
  assert.ok(medida.includes("querySelector('[data-pgm-tile=\"1\"]')"), 'la región se busca por la marca del tile PGM dentro del monitor');
  assert.ok(medida.includes('getBoundingClientRect()'), 'la región se MIDE sobre el DOM, no se adivina por layout');
  const j = appSource.indexOf('const projectTeleprompterOverlay');
  const helper = appSource.slice(j, j + 900);
  assert.ok(helper.includes('medirRegionPgmPrompter(wrap)'), 'la proyección coloca la franja sobre la región medida');
  assert.ok(helper.includes('wrap.style.height'), 'la franja adopta la altura de la región PGM');
  assert.ok(helper.includes('wrap.style.width'), 'la franja adopta el ancho de la región PGM');
  assert.ok(
    appSource.includes('[layoutMode, activeCam, camSlots, showFloatingPrompter]'),
    'en pausa, la franja sigue a la región al cambiar layout o cámara de programa',
  );
});

test('v3.3.2 (3): NUNCA a la mezcla — el estado que recibe el motor de composición va excluido', () => {
  // El motor (archivo CONGELADO por el blindaje) dibuja el teleprompter
  // en su canvas SOLO si el estado trae texto y reproduciendo: esa es
  // la condición que la exclusión deja sin alimento, sin tocar el motor.
  assert.ok(
    engineSource.includes('currentState.isTeleprompterPlaying && currentState.teleprompterText'),
    'la condición de dibujo en el canvas del motor es texto + reproduciendo',
  );
  const i = appSource.indexOf('cintillo: engineCintillo');
  assert.ok(i >= 0, 'existe la sincronización de estado con el motor');
  const sync = appSource.slice(i, i + 1200);
  assert.ok(sync.includes("teleprompterText: ''"), 'al motor se le publica el teleprompter SIN texto');
  assert.ok(sync.includes('isTeleprompterPlaying: false'), 'al motor se le publica el teleprompter SIN reproducción');
  assert.ok(!sync.includes('\n      teleprompterText,\n'), 'el texto real ya no viaja al motor de composición');
  // Y ningún camino captura el DOM del monitor: no hay html2canvas ni
  // dom-to-image en la app ni en el motor (la captura es canvas desde
  // elementos <video>, y el máster nativo es una tubería sin DOM).
  assert.ok(!/html2canvas|dom-to-image|domToImage/.test(appSource), 'la app no captura DOM');
  assert.ok(!/html2canvas|dom-to-image|domToImage/.test(engineSource), 'el motor no captura DOM');
});

test('v3.3.2 (4): UN solo interruptor HUD en toda la app, y el instrumento registra ESE control', () => {
  const escritores = appSource.split('setShowFloatingPrompter').length - 1;
  assert.equal(escritores, 2, 'setShowFloatingPrompter aparece solo en la declaración y en el ÚNICO interruptor');
  assert.ok(!appSource.includes("'HUD Cámara'"), 'fuera la etiqueta muerta «HUD Cámara» de cualquier control');
  assert.ok(appSource.includes("showFloatingPrompter ? 'HUD Activo' : 'HUD Inactivo'"), 'el único control es «HUD Activo»/«HUD Inactivo»');
});

test('v3.3.2: el instrumento [prompter] se conserva y declara el overlay PRESENTE', () => {
  // La aceptación medible de esta versión: tras pulsar el HUD e INICIAR,
  // el ventana-diag.log debe mostrar hud=ON y muestras «overlay
  // PRESENTE». Estas dos cadenas son ese contrato.
  assert.ok(appSource.includes('overlay PRESENTE hud='), 'la muestra de 1 Hz declara el overlay montado');
  assert.ok(appSource.includes('overlay AUSENTE hud='), 'la muestra sigue declarando la ausencia cuando la haya');
  assert.ok(appSource.includes("ventanaDiagSend('prompter', `HUD=${showFloatingPrompter ? 'ON' : 'OFF'}"), 'el cambio de HUD se registra desde el estado único');
});
