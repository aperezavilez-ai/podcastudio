import React from 'react'
import { getSlotLabel } from '../config/cameraSlots.js'
import styles from './SwitcherMasterBar.module.css'

export default function SwitcherMasterBar({
  programCamera = 0,
  previewCamera = null,
  cameraMeta = {},
  masterCameraSlot = 1,
  proSwitcherMode = false, // false = 1-click Direct Cut, true = PGM/PVW Broadcast
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
