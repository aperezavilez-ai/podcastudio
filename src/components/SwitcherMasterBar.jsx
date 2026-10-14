import React from 'react'
import { getSlotLabel } from '../config/cameraSlots.js'
import styles from './SwitcherMasterBar.module.css'

export default function SwitcherMasterBar({
  programCamera = 0,
  previewCamera = null,
  cameraMeta = {},
  streams = {},
  slotsCount = 3,
  masterCameraSlot = 1,
  proSwitcherMode = false, // false = 1-click Direct Cut, true = PGM/PVW Broadcast
  screenLayout = 'full', // 'full' | 'pip' | 'split' | 'triple'
  onSelectLayout = () => {},
  pipCameraSlot = 0,
  onSelectPipSlot = () => {},
  splitSecondarySlot = 2,
  onSelectSplitSecondarySlot = () => {},
  tripleTertiarySlot = 0,
  onSelectTripleTertiarySlot = () => {},
  onSwapPipMaster = () => {},
  onSwapSplitSlots = () => {},
  onSelectProgramCamera = () => {},
  onToggleProSwitcherMode,
  onCut,
  onAutoTransition,
  onOpenConnectModal,
}) {
  const pgmMeta = cameraMeta[programCamera]
  const pgmLabel = getSlotLabel(programCamera, pgmMeta?.customLabel, programCamera === masterCameraSlot)

  const pvwMeta = previewCamera !== null ? cameraMeta[previewCamera] : null
  const pvwLabel = previewCamera !== null
    ? getSlotLabel(previewCamera, pvwMeta?.customLabel, previewCamera === masterCameraSlot)
    : null

  return (
    <div className={styles.switcherBar}>
      <div className={styles.tallySection}>
        {/* PGM (Program / En Vivo) */}
        <div className={`${styles.tallyBox} ${styles.tallyPgm}`} title="Cámara en Vivo en Programa">
          <span className={styles.tallyDot} />
          <span>PGM: {pgmLabel}</span>
        </div>

        {/* PVW (Preview) en modo Studio Pro */}
        {proSwitcherMode && (
          <div className={`${styles.tallyBox} ${styles.tallyPvw}`} title="Cámara en Previo (Próxima a salir)">
            <span className={styles.tallyDot} />
            <span>PVW: {pvwLabel || 'Ninguna'}</span>
          </div>
        )}

        {/* Selector de Composición / Layout */}
        <div className={styles.layoutGroup} title="Composición de pantalla al aire">
          <button
            type="button"
            className={`${styles.layoutBtn} ${screenLayout === 'full' ? styles.layoutBtnActive : ''}`}
            onClick={() => onSelectLayout('full')}
            title="1 Cámara Pantalla Completa"
          >
            <i className="ti ti-square" />
            <span>Solo</span>
          </button>
          <button
            type="button"
            className={`${styles.layoutBtn} ${screenLayout === 'pip' ? styles.layoutBtnActive : ''}`}
            onClick={() => onSelectLayout('pip')}
            title="Picture-in-Picture: Master de fondo + Recuadro miniatura flotante"
          >
            <i className="ti ti-picture-in-picture" />
            <span>PiP</span>
          </button>
          <button
            type="button"
            className={`${styles.layoutBtn} ${screenLayout === 'split' ? styles.layoutBtnActive : ''}`}
            onClick={() => onSelectLayout('split')}
            title="Doble Cámara: Pantalla dividida 50/50"
          >
            <i className="ti ti-layout-columns" />
            <span>Doble</span>
          </button>
          <button
            type="button"
            className={`${styles.layoutBtn} ${screenLayout === 'triple' ? styles.layoutBtnActive : ''}`}
            onClick={() => onSelectLayout('triple')}
            title="Triple Cámara: 1 Master principal + 2 secundarias"
          >
            <i className="ti ti-layout-grid" />
            <span>Triple</span>
          </button>
        </div>

        {/* Asignación de canales según el layout activo */}
        {screenLayout === 'pip' && (
          <div className={styles.layoutConfigBar}>
            <div className={styles.layoutMasterFixed} title="Cámara Master siempre de fondo principal">
              <span className={styles.layoutMasterTag}>★ MASTER:</span>
              <span className={styles.layoutMasterName}>{getSlotLabel(masterCameraSlot, cameraMeta[masterCameraSlot]?.customLabel, true)}</span>
            </div>
            <div className={styles.layoutSelectorItem}>
              <span className={styles.layoutSelectorTag} style={{ color: '#60a5fa' }}>Recuadro PiP:</span>
              <select
                value={pipCameraSlot}
                onChange={(e) => onSelectPipSlot(Number(e.target.value))}
                className={styles.slotSelect}
                title="Cámara en recuadro miniatura flotante"
              >
                {Array.from({ length: slotsCount })
                  .map((_, i) => i)
                  .filter((i) => i !== masterCameraSlot)
                  .map((i) => (
                    <option key={i} value={i}>
                      {getSlotLabel(i, cameraMeta[i]?.customLabel, false)} {streams[i] ? '●' : '(sin señal)'}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        )}

        {screenLayout === 'split' && (
          <div className={styles.layoutConfigBar}>
            <div className={styles.layoutMasterFixed} title="Cámara Master siempre principal">
              <span className={styles.layoutMasterTag}>★ MASTER:</span>
              <span className={styles.layoutMasterName}>{getSlotLabel(masterCameraSlot, cameraMeta[masterCameraSlot]?.customLabel, true)}</span>
            </div>
            <div className={styles.layoutSelectorItem}>
              <span className={styles.layoutSelectorTag} style={{ color: '#f59e0b' }}>2ª Cámara:</span>
              <select
                value={splitSecondarySlot}
                onChange={(e) => onSelectSplitSecondarySlot(Number(e.target.value))}
                className={styles.slotSelect}
                title="Segunda cámara en pantalla dividida"
              >
                {Array.from({ length: slotsCount })
                  .map((_, i) => i)
                  .filter((i) => i !== masterCameraSlot)
                  .map((i) => (
                    <option key={i} value={i}>
                      {getSlotLabel(i, cameraMeta[i]?.customLabel, false)} {streams[i] ? '●' : '(sin señal)'}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        )}

        {screenLayout === 'triple' && (
          <div className={styles.layoutConfigBar}>
            <div className={styles.layoutMasterFixed} title="Cámara Master siempre central grande">
              <span className={styles.layoutMasterTag}>★ MASTER:</span>
              <span className={styles.layoutMasterName}>{getSlotLabel(masterCameraSlot, cameraMeta[masterCameraSlot]?.customLabel, true)}</span>
            </div>
            <div className={styles.layoutSelectorItem}>
              <span className={styles.layoutSelectorTag} style={{ color: '#60a5fa' }}>Arriba:</span>
              <select
                value={splitSecondarySlot}
                onChange={(e) => onSelectSplitSecondarySlot(Number(e.target.value))}
                className={styles.slotSelect}
              >
                {Array.from({ length: slotsCount })
                  .map((_, i) => i)
                  .filter((i) => i !== masterCameraSlot)
                  .map((i) => (
                    <option key={i} value={i} disabled={i === tripleTertiarySlot}>
                      {getSlotLabel(i, cameraMeta[i]?.customLabel, false)} {streams[i] ? '●' : '(sin señal)'}
                    </option>
                  ))}
              </select>
            </div>
            <div className={styles.layoutSelectorItem}>
              <span className={styles.layoutSelectorTag} style={{ color: '#a78bfa' }}>Abajo:</span>
              <select
                value={tripleTertiarySlot}
                onChange={(e) => onSelectTripleTertiarySlot(Number(e.target.value))}
                className={styles.slotSelect}
              >
                {Array.from({ length: slotsCount })
                  .map((_, i) => i)
                  .filter((i) => i !== masterCameraSlot)
                  .map((i) => (
                    <option key={i} value={i} disabled={i === splitSecondarySlot}>
                      {getSlotLabel(i, cameraMeta[i]?.customLabel, false)} {streams[i] ? '●' : '(sin señal)'}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className={styles.actionsSection}>
        {/* Controles CUT y AUTO en modo Studio Pro */}
        {proSwitcherMode ? (
          <>
            <button
              type="button"
              className={styles.cutBtn}
              onClick={onCut}
              disabled={previewCamera === null || previewCamera === programCamera}
              title="Corte Directo (Espacio)"
            >
              <i className="ti ti-switch-horizontal" />
              <span>CUT</span>
              <span className={styles.shortcutHint}>[Espacio]</span>
            </button>

            <button
              type="button"
              className={styles.autoBtn}
              onClick={onAutoTransition}
              disabled={previewCamera === null || previewCamera === programCamera}
              title="Transición Suave (Enter)"
            >
              <i className="ti ti-arrows-exchange" />
              <span>AUTO</span>
              <span className={styles.shortcutHint}>[Enter]</span>
            </button>
          </>
        ) : null}

        {/* Toggle de Modo: Directo vs PGM/PVW */}
        <button
          type="button"
          className={`${styles.modeToggleBtn} ${proSwitcherMode ? styles.modeToggleActive : ''}`}
          onClick={onToggleProSwitcherMode}
          title="Alternar entre Corte Directo al hacer clic y Modo PGM/PVW estilo ATEM"
        >
          <i className="ti ti-layout-board-split" />
          <span>{proSwitcherMode ? 'Modo PGM/PVW' : 'Corte Directo (1-click)'}</span>
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
