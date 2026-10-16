import React from 'react'
import { getSlotLabel } from '../config/cameraSlots.js'
import styles from './SwitcherMasterBar.module.css'

function SwitcherMasterBar({
  programCamera = 0,
  previewCamera = null,
  cameraMeta = {},
  streams = {},
  slotsCount = 4,
  masterCameraSlot = 0,
  proSwitcherMode = false, // false = 1-click Direct Cut, true = PGM/PVW Broadcast
  screenLayout = 'full', // 'full' | 'pip' | 'split' | 'triple'
  onSelectLayout = () => {},
  pipCameraSlot = 0,
  onSelectPipSlot = () => {},
  splitSecondarySlot = 1,
  onSelectSplitSecondarySlot = () => {},
  tripleTertiarySlot = 2,
  onSelectTripleTertiarySlot = () => {},
  quadQuaternarySlot = 3,
  onSelectQuadQuaternarySlot = () => {},
  onSwapPipMaster = () => {},
  onSwapSplitSlots = () => {},
  onSelectProgramCamera = () => {},
  onToggleProSwitcherMode,
  onCut,
  onAutoTransition,
  onOpenConnectModal,
  cintillosEnabled = false,
  onToggleCintillos = () => {},
  showMasterGrid = false,
  onToggleMasterGrid = () => {},
  switchMode = 'off',
  onToggleAiSwitchMode = () => {},
  directorStatus = '',
  transitionMode = 'cut',
  onSelectTransitionMode = () => {},
  pipAudioMuted = true,
  onTogglePipAudio = () => {},
  splitAudioMuted = true,
  onToggleSplitAudio = () => {},
  tripleAudioMuted = true,
  onToggleTripleAudio = () => {},
  quadAudioMuted = true,
  onToggleQuadAudio = () => {},
  speakerMonitoring = false,
  onToggleSpeakerMonitoring = () => {},
}) {
  const pgmMeta = cameraMeta[programCamera]
  const pgmLabel = getSlotLabel(programCamera, pgmMeta?.customLabel, programCamera === masterCameraSlot)

  const pvwMeta = previewCamera !== null ? cameraMeta[previewCamera] : null
  const pvwLabel = previewCamera !== null
    ? getSlotLabel(previewCamera, pvwMeta?.customLabel, previewCamera === masterCameraSlot)
    : null

  const connectedCount = Object.values(streams || {}).filter(Boolean).length

  return (
    <div className={styles.switcherBar}>
      <div className={styles.tallySection}>
        {/* PGM (Program / En Vivo) */}
        <div className={`${styles.tallyBox} ${styles.tallyPgm}`} title="Cámara en Vivo en Programa">
          <span className={styles.tallyDot} />
          <span>PGM: {pgmLabel}</span>
        </div>

        {/* PVW (Preview) solo si hay una cámara diferente seleccionada para salir */}
        {previewCamera !== null && previewCamera !== programCamera && (
          <div className={`${styles.tallyBox} ${styles.tallyPvw}`} title="Cámara en Previo (Próxima a salir)">
            <span className={styles.tallyDot} />
            <span>PVW: {pvwLabel}</span>
          </div>
        )}

        {/* Selector de Composición / Layout */}
        <div className={styles.layoutGroup} title="Composición de pantalla al aire">
          <button
            type="button"
            className={`${styles.layoutBtn} ${screenLayout === 'full' ? styles.layoutBtnActive : ''}`}
            onClick={() => onSelectLayout('full')}
            title="1 Cámara (Solo pantalla completa)"
          >
            <i className="ti ti-square" />
            <span>1</span>
          </button>
          <button
            type="button"
            className={`${styles.layoutBtn} ${screenLayout === 'pip' ? styles.layoutBtnActive : ''}`}
            onClick={() => onSelectLayout('pip')}
            title="PiP (Master de fondo + Recuadro miniatura)"
          >
            <i className="ti ti-picture-in-picture" />
            <span>PiP</span>
          </button>
          <button
            type="button"
            className={`${styles.layoutBtn} ${screenLayout === 'split' ? styles.layoutBtnActive : ''}`}
            onClick={() => onSelectLayout('split')}
            title="2 Cámaras (Doble pantalla 50/50)"
          >
            <i className="ti ti-layout-columns" />
            <span>2</span>
          </button>
          <button
            type="button"
            className={`${styles.layoutBtn} ${screenLayout === 'triple' ? styles.layoutBtnActive : ''}`}
            onClick={() => onSelectLayout('triple')}
            title="3 Cámaras (Triple pantalla)"
          >
            <i className="ti ti-layout-grid" />
            <span>3</span>
          </button>
          <button
            type="button"
            className={`${styles.layoutBtn} ${screenLayout === 'quad' ? styles.layoutBtnActive : ''}`}
            onClick={() => onSelectLayout('quad')}
            title="4 Cámaras (Cuádruple 2x2)"
          >
            <i className="ti ti-grid-dots" />
            <span>4</span>
          </button>
          <button
            type="button"
            className={`${styles.layoutBtn} ${screenLayout === 'classroom' ? styles.layoutBtnActive : ''}`}
            onClick={() => onSelectLayout('classroom')}
            title="Aula Virtual: Profesor en Master (arriba al centro) + Todos los alumnos alrededor"
            style={{
              background: screenLayout === 'classroom' ? '#e8612a' : 'transparent',
              color: screenLayout === 'classroom' ? '#fff' : 'inherit',
              borderColor: screenLayout === 'classroom' ? '#e8612a' : undefined,
              gap: 4,
            }}
          >
            <i className="ti ti-school" />
            <span>Aula</span>
          </button>
        </div>

        {/* Asignación compacta de canales según el layout activo (no altera la altura del master) */}
        {screenLayout === 'pip' && (
          <div className={styles.layoutConfigBar} style={{ padding: '2px 6px', gap: 4 }}>
            <span className={styles.slotTagMini} style={{ color: '#60a5fa' }}>PiP:</span>
            <select
              value={pipCameraSlot}
              onChange={(e) => onSelectPipSlot(Number(e.target.value))}
              className={styles.slotSelectMini}
              title="Cámara en recuadro miniatura flotante"
            >
              {Array.from({ length: slotsCount })
                .map((_, i) => i)
                .filter((i) => i !== masterCameraSlot)
                .map((i) => (
                  <option key={i} value={i}>
                    {getSlotLabel(i, cameraMeta[i]?.customLabel, false)} {streams[i] ? '●' : ''}
                  </option>
                ))}
            </select>
            <button
              type="button"
              className={`${styles.audioSlotBtn} ${!pipAudioMuted ? styles.audioSlotBtnActive : ''}`}
              onClick={onTogglePipAudio}
              title={pipAudioMuted ? 'Audio PiP silenciado — Clic para activar' : 'Audio PiP en vivo — Clic para silenciar'}
            >
              <i className={`ti ${pipAudioMuted ? 'ti-microphone-off' : 'ti-microphone'}`} />
              <span>{pipAudioMuted ? 'Mute' : 'Audio'}</span>
            </button>
          </div>
        )}

        {screenLayout === 'split' && (
          <div className={styles.layoutConfigBar} style={{ padding: '2px 6px', gap: 4 }}>
            <span className={styles.slotTagMini} style={{ color: '#f59e0b' }}>2ª:</span>
            <select
              value={splitSecondarySlot}
              onChange={(e) => onSelectSplitSecondarySlot(Number(e.target.value))}
              className={styles.slotSelectMini}
              title="Segunda cámara en pantalla dividida"
            >
              {Array.from({ length: slotsCount })
                .map((_, i) => i)
                .filter((i) => i !== masterCameraSlot)
                .map((i) => (
                  <option key={i} value={i}>
                    {getSlotLabel(i, cameraMeta[i]?.customLabel, false)} {streams[i] ? '●' : ''}
                  </option>
                ))}
            </select>
            <button
              type="button"
              className={`${styles.audioSlotBtn} ${!splitAudioMuted ? styles.audioSlotBtnActive : ''}`}
              onClick={onToggleSplitAudio}
              title={splitAudioMuted ? 'Audio 2ª cámara silenciado — Clic para activar' : 'Audio 2ª cámara en vivo — Clic para silenciar'}
            >
              <i className={`ti ${splitAudioMuted ? 'ti-microphone-off' : 'ti-microphone'}`} />
              <span>{splitAudioMuted ? 'Mute' : 'Audio'}</span>
            </button>
          </div>
        )}

        {screenLayout === 'triple' && (
          <div className={styles.layoutConfigBar} style={{ padding: '2px 6px', gap: 4 }}>
            <span className={styles.slotTagMini} style={{ color: '#60a5fa' }}>2ª:</span>
            <select
              value={splitSecondarySlot}
              onChange={(e) => onSelectSplitSecondarySlot(Number(e.target.value))}
              className={styles.slotSelectMini}
            >
              {Array.from({ length: slotsCount })
                .map((_, i) => i)
                .filter((i) => i !== masterCameraSlot)
                .map((i) => (
                  <option key={i} value={i} disabled={i === tripleTertiarySlot}>
                    {getSlotLabel(i, cameraMeta[i]?.customLabel, false)} {streams[i] ? '●' : ''}
                  </option>
                ))}
            </select>
            <button
              type="button"
              className={`${styles.audioSlotBtn} ${!splitAudioMuted ? styles.audioSlotBtnActive : ''}`}
              onClick={onToggleSplitAudio}
              title={splitAudioMuted ? 'Audio 2ª cámara silenciado — Clic para activar' : 'Audio 2ª en vivo — Clic para silenciar'}
            >
              <i className={`ti ${splitAudioMuted ? 'ti-microphone-off' : 'ti-microphone'}`} />
            </button>
            <span className={styles.slotTagMini} style={{ color: '#a78bfa' }}>3ª:</span>
            <select
              value={tripleTertiarySlot}
              onChange={(e) => onSelectTripleTertiarySlot(Number(e.target.value))}
              className={styles.slotSelectMini}
            >
              {Array.from({ length: slotsCount })
                .map((_, i) => i)
                .filter((i) => i !== masterCameraSlot)
                .map((i) => (
                  <option key={i} value={i} disabled={i === splitSecondarySlot}>
                    {getSlotLabel(i, cameraMeta[i]?.customLabel, false)} {streams[i] ? '●' : ''}
                  </option>
                ))}
            </select>
            <button
              type="button"
              className={`${styles.audioSlotBtn} ${!tripleAudioMuted ? styles.audioSlotBtnActive : ''}`}
              onClick={onToggleTripleAudio}
              title={tripleAudioMuted ? 'Audio 3ª cámara silenciado — Clic para activar' : 'Audio 3ª en vivo — Clic para silenciar'}
            >
              <i className={`ti ${tripleAudioMuted ? 'ti-microphone-off' : 'ti-microphone'}`} />
            </button>
          </div>
        )}

        {screenLayout === 'quad' && (
          <div className={styles.layoutConfigBar} style={{ padding: '2px 6px', gap: 4 }}>
            <span className={styles.slotTagMini} style={{ color: '#d97706' }}>2ª:</span>
            <select
              value={splitSecondarySlot}
              onChange={(e) => onSelectSplitSecondarySlot(Number(e.target.value))}
              className={styles.slotSelectMini}
            >
              {Array.from({ length: slotsCount })
                .map((_, i) => i)
                .filter((i) => i !== masterCameraSlot)
                .map((i) => (
                  <option key={i} value={i} disabled={i === tripleTertiarySlot || i === quadQuaternarySlot}>
                    {getSlotLabel(i, cameraMeta[i]?.customLabel, false)} {streams[i] ? '●' : ''}
                  </option>
                ))}
            </select>
            <button
              type="button"
              className={`${styles.audioSlotBtn} ${!splitAudioMuted ? styles.audioSlotBtnActive : ''}`}
              onClick={onToggleSplitAudio}
              title={splitAudioMuted ? 'Audio 2ª silenciado' : 'Audio 2ª activo'}
            >
              <i className={`ti ${splitAudioMuted ? 'ti-microphone-off' : 'ti-microphone'}`} />
            </button>
            <span className={styles.slotTagMini} style={{ color: '#a855f7' }}>3ª:</span>
            <select
              value={tripleTertiarySlot}
              onChange={(e) => onSelectTripleTertiarySlot(Number(e.target.value))}
              className={styles.slotSelectMini}
            >
              {Array.from({ length: slotsCount })
                .map((_, i) => i)
                .filter((i) => i !== masterCameraSlot)
                .map((i) => (
                  <option key={i} value={i} disabled={i === splitSecondarySlot || i === quadQuaternarySlot}>
                    {getSlotLabel(i, cameraMeta[i]?.customLabel, false)} {streams[i] ? '●' : ''}
                  </option>
                ))}
            </select>
            <button
              type="button"
              className={`${styles.audioSlotBtn} ${!tripleAudioMuted ? styles.audioSlotBtnActive : ''}`}
              onClick={onToggleTripleAudio}
              title={tripleAudioMuted ? 'Audio 3ª silenciado' : 'Audio 3ª activo'}
            >
              <i className={`ti ${tripleAudioMuted ? 'ti-microphone-off' : 'ti-microphone'}`} />
            </button>
            <span className={styles.slotTagMini} style={{ color: '#10b981' }}>4ª:</span>
            <select
              value={quadQuaternarySlot}
              onChange={(e) => onSelectQuadQuaternarySlot(Number(e.target.value))}
              className={styles.slotSelectMini}
            >
              {Array.from({ length: slotsCount })
                .map((_, i) => i)
                .filter((i) => i !== masterCameraSlot)
                .map((i) => (
                  <option key={i} value={i} disabled={i === splitSecondarySlot || i === tripleTertiarySlot}>
                    {getSlotLabel(i, cameraMeta[i]?.customLabel, false)} {streams[i] ? '●' : ''}
                  </option>
                ))}
            </select>
            <button
              type="button"
              className={`${styles.audioSlotBtn} ${!quadAudioMuted ? styles.audioSlotBtnActive : ''}`}
              onClick={onToggleQuadAudio}
              title={quadAudioMuted ? 'Audio 4ª silenciado' : 'Audio 4ª activo'}
            >
              <i className={`ti ${quadAudioMuted ? 'ti-microphone-off' : 'ti-microphone'}`} />
            </button>
          </div>
        )}

        {/* Botón Activar / Desactivar Cintillos */}
        <button
          type="button"
          className={`${styles.cintilloBarBtn} ${cintillosEnabled ? styles.cintilloBarBtnActive : ''}`}
          onClick={onToggleCintillos}
          title={cintillosEnabled ? 'Cintillos ACTIVADOS (Al Aire) - Clic para apagar' : 'Cintillos DESACTIVADOS - Clic para activar'}
        >
          <i className={`ti ${cintillosEnabled ? 'ti-typography' : 'ti-typography-off'}`} />
          <span>{cintillosEnabled ? 'Cintillos ON' : 'Cintillos OFF'}</span>
        </button>

        {/* Botón Activar / Desactivar Cuadrícula y Guías de Encuadre */}
        <button
          type="button"
          className={`${styles.cintilloBarBtn} ${showMasterGrid ? styles.gridBarBtnActive : ''}`}
          onClick={onToggleMasterGrid}
          title={showMasterGrid ? 'Cuadrícula y guías ACTIVADAS en Master — Clic para ocultar' : 'Activar Cuadrícula de Centrado (Regla de Tercios + Margen Seguro)'}
        >
          <i className="ti ti-border-all" />
          <span>{showMasterGrid ? 'Cuadrícula ON' : 'Cuadrícula'}</span>
        </button>

        {/* Botón Salida a Bocinas / Altavoces de la PC */}
        <button
          type="button"
          className={`${styles.speakerBarBtn} ${speakerMonitoring ? styles.speakerBarBtnActive : ''}`}
          onClick={onToggleSpeakerMonitoring}
          title={speakerMonitoring ? 'Salida de audio a bocinas de la PC: ACTIVADA — Clic para apagar' : 'Escuchar salida de audio en bocinas de la computadora — Clic para activar'}
        >
          <i className={`ti ${speakerMonitoring ? 'ti-volume' : 'ti-volume-off'}`} />
          <span>{speakerMonitoring ? 'Bocinas: ON' : 'Bocinas PC'}</span>
        </button>
      </div>

      <div className={styles.actionsSection}>
        {/* Botón Auto Switcher IA (Conmutador Inteligente) */}
        <button
          type="button"
          className={`${styles.aiSwitcherBtn} ${switchMode === 'ai' ? styles.aiSwitcherActive : ''}`}
          onClick={onToggleAiSwitchMode}
          title={switchMode === 'ai'
            ? `Auto Switcher IA ACTIVO: Conmutando cámaras inteligentemente ${directorStatus ? `(${directorStatus})` : ''} — Clic para pausar`
            : 'Activar Auto Switcher IA (Conmutación automática de cámaras por voz y ritmo)'}
        >
          <i className="ti ti-wand" />
          <span>{switchMode === 'ai' ? 'Auto Switcher IA: ON' : 'Auto Switcher IA'}</span>
          {switchMode === 'ai' && <span className={styles.aiLivePulse} />}
        </button>

        {/* Selector de Transición Profesional */}
        <div className={styles.transitionSelectorWrap} title="Efecto de transición entre cámaras al cambiar">
          <i className="ti ti-transform" style={{ fontSize: 13, color: 'var(--text-muted, #94a3b8)' }} />
          <select
            className={styles.transitionSelect}
            value={transitionMode}
            onChange={(e) => onSelectTransitionMode(e.target.value)}
            title="Efecto de transición entre cámaras"
          >
            <option value="cut">Corte limpio (Cut)</option>
            <option value="crossfade">Disolución (Suave)</option>
            <option value="push">Barrido (Push)</option>
            <option value="dip">Fundido a negro (Dip)</option>
          </select>
        </div>

        {/* Controles CUT y AUTO siempre disponibles y operativos */}
        <button
          type="button"
          className={styles.cutBtn}
          onClick={onCut}
          disabled={connectedCount < 2}
          title="Corte Directo (Espacio) - Cambia inmediatamente a la siguiente cámara o cámara en previo"
        >
          <i className="ti ti-switch-horizontal" />
          <span>CUT</span>
          <span className={styles.shortcutHint}>[Espacio]</span>
        </button>

        <button
          type="button"
          className={styles.autoBtn}
          onClick={onAutoTransition}
          disabled={connectedCount < 2}
          title="Transición Suave (Enter) - Conmuta con disolución/efecto entre cámaras"
        >
          <i className="ti ti-arrows-exchange" />
          <span>AUTO</span>
          <span className={styles.shortcutHint}>[Enter]</span>
        </button>

        {/* Botón Gestión y Conexión de Cámaras */}
        <button
          type="button"
          className={styles.configBtn}
          onClick={onOpenConnectModal}
          title="Conectar o configurar cámaras USB, WiFi o remotas"
        >
          <i className="ti ti-settings" />
          <span>Gestionar Cámaras</span>
        </button>
      </div>
    </div>
  )
}

export default React.memo(SwitcherMasterBar)
