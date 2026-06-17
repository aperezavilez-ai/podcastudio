import React, { useState } from 'react'
import styles from './CameraConnectPanel.module.css'

const METHODS = [
  { id: 'usb', icon: 'ti-plug', label: 'USB' },
  { id: 'wifi', icon: 'ti-wifi', label: 'WiFi' },
  { id: 'bluetooth', icon: 'ti-bluetooth', label: 'BT' },
]

const TYPE_ICONS = { usb: 'ti-plug', wifi: 'ti-wifi', bluetooth: 'ti-bluetooth' }
const TYPE_LABELS = { usb: 'USB', wifi: 'WiFi', bluetooth: 'Bluetooth' }

export default function CameraConnectPanel({
  slotIndex,
  devices,
  cameraMeta,
  autoConnecting,
  connectedCount,
  onReconnectAll,
  bluetoothSupported,
  wifiConnecting,
  btScanning,
  wifiPresets,
  onSelectSlot,
  onUsbConnect,
  onWifiConnect,
  onBluetoothScan,
  onBluetoothWifiConnect,
  onDisconnect,
}) {
  const [method, setMethod] = useState('usb')
  const [usbDeviceId, setUsbDeviceId] = useState('')
  const [wifiUrl, setWifiUrl] = useState('')
  const [btWifiUrl, setBtWifiUrl] = useState('')

  const meta = cameraMeta[slotIndex]
  const hasStream = meta && !meta.awaitingWifi

  const handleUsb = async () => {
    const id = usbDeviceId || devices.cameras[0]?.deviceId
    if (!id) return
    await onUsbConnect(id, slotIndex)
  }

  const handleWifi = async () => {
    await onWifiConnect(wifiUrl, slotIndex)
  }

  const handleBluetooth = async () => {
    const result = await onBluetoothScan(slotIndex)
    if (result?.suggestedUrl) setBtWifiUrl(result.suggestedUrl)
  }

  const handleBtWifi = async () => {
    await onBluetoothWifiConnect(slotIndex, btWifiUrl)
  }

  return (
    <div className={styles.panel}>
      <div className={styles.autoStatus}>
        {autoConnecting ? (
          <span className={styles.autoStatusLoading}>
            <i className="ti ti-loader" style={{ animation: 'spin 1s linear infinite' }} />
            Conectando cámaras...
          </span>
        ) : (
          <span className={styles.autoStatusOk}>
            <i className="ti ti-plug-connected" />
            {connectedCount > 0
              ? `${connectedCount} cámara${connectedCount > 1 ? 's' : ''} conectada${connectedCount > 1 ? 's' : ''} automáticamente`
              : `${devices.cameras.length} detectada${devices.cameras.length !== 1 ? 's' : ''} — conecta manualmente`}
          </span>
        )}
        {onReconnectAll && devices.cameras.length > 0 && !autoConnecting && (
          <button type="button" className={styles.reconnectBtn} onClick={onReconnectAll} title="Reconectar todas">
            <i className="ti ti-refresh" />
          </button>
        )}
      </div>

      <div className={styles.slotRow}>
        {[0, 1, 2].map(i => (
          <button
            key={i}
            type="button"
            className={`${styles.slotBtn} ${slotIndex === i ? styles.slotActive : ''}`}
            onClick={() => onSelectSlot(i)}
          >
            Cam {i + 1}
            {cameraMeta[i] && <span className={styles.slotDot} />}
          </button>
        ))}
      </div>

      {hasStream && (
        <div className={styles.connected}>
          <i className={`ti ${TYPE_ICONS[meta.type] || 'ti-video'}`} />
          <div className={styles.connectedInfo}>
            <span className={styles.connectedType}>{TYPE_LABELS[meta.type] || meta.type}</span>
            <span className={styles.connectedLabel}>{meta.label}</span>
          </div>
          <button type="button" className={styles.disconnectBtn} onClick={() => onDisconnect(slotIndex)} title="Desconectar">
            <i className="ti ti-plug-off" />
          </button>
        </div>
      )}

      {meta?.awaitingWifi && (
        <div className={styles.btPaired}>
          <i className="ti ti-bluetooth" />
          <span>{meta.label} emparejado — conecta el stream WiFi</span>
        </div>
      )}

      <div className={styles.methodTabs}>
        {METHODS.map(m => (
          <button
            key={m.id}
            type="button"
            className={`${styles.methodTab} ${method === m.id ? styles.methodActive : ''}`}
            onClick={() => setMethod(m.id)}
          >
            <i className={`ti ${m.icon}`} />
            {m.label}
          </button>
        ))}
      </div>

      {method === 'usb' && (
        <div className={styles.methodBody}>
          <label className={styles.fieldLabel}>Cámara USB</label>
          <select
            className={styles.select}
            value={usbDeviceId || devices.cameras[0]?.deviceId || ''}
            onChange={e => setUsbDeviceId(e.target.value)}
          >
            {devices.cameras.length === 0
              ? <option value="">Sin cámaras USB detectadas</option>
              : devices.cameras.map((cam, i) => (
                <option key={cam.deviceId} value={cam.deviceId}>
                  {cam.label || `Cámara USB ${i + 1}`}
                </option>
              ))
            }
          </select>
          <button type="button" className={styles.connectBtn} onClick={handleUsb} disabled={!devices.cameras.length}>
            <i className="ti ti-plug" /> Conectar USB
          </button>
        </div>
      )}

      {method === 'wifi' && (
        <div className={styles.methodBody}>
          <label className={styles.fieldLabel}>URL del stream (MJPEG / video)</label>
          <input
            className={styles.input}
            value={wifiUrl}
            onChange={e => setWifiUrl(e.target.value)}
            placeholder="http://192.168.1.100:8080/video"
            onKeyDown={e => e.key === 'Enter' && handleWifi()}
          />
          <div className={styles.presets}>
            {wifiPresets.map(p => (
              <button
                key={p.label}
                type="button"
                className={styles.presetBtn}
                onClick={() => setWifiUrl(p.url)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className={styles.hint}>
            La cámara debe estar en la misma red WiFi. Usa la IP que muestra la app de la cámara.
          </p>
          <button type="button" className={styles.connectBtn} onClick={handleWifi} disabled={wifiConnecting || !wifiUrl.trim()}>
            <i className={`ti ${wifiConnecting ? 'ti-loader' : 'ti-wifi'}`} style={wifiConnecting ? { animation: 'spin 1s linear infinite' } : {}} />
            {wifiConnecting ? 'Conectando...' : 'Conectar WiFi'}
          </button>
        </div>
      )}

      {method === 'bluetooth' && (
        <div className={styles.methodBody}>
          {!bluetoothSupported && (
            <div className={styles.warn}>
              <i className="ti ti-alert-triangle" />
              Bluetooth requiere Chrome o Edge en HTTPS o localhost.
            </div>
          )}
          <p className={styles.hint}>
            Empareja la cámara por Bluetooth. Muchas cámaras inalámbricas transmiten el video por WiFi después del emparejamiento.
          </p>
          <button
            type="button"
            className={styles.connectBtn}
            onClick={handleBluetooth}
            disabled={!bluetoothSupported || btScanning}
          >
            <i className={`ti ${btScanning ? 'ti-loader' : 'ti-bluetooth'}`} style={btScanning ? { animation: 'spin 1s linear infinite' } : {}} />
            {btScanning ? 'Buscando...' : 'Buscar dispositivo BT'}
          </button>

          {(meta?.awaitingWifi || meta?.type === 'bluetooth') && (
            <>
              <label className={styles.fieldLabel}>URL WiFi del dispositivo</label>
              <input
                className={styles.input}
                value={btWifiUrl || meta?.suggestedUrl || ''}
                onChange={e => setBtWifiUrl(e.target.value)}
                placeholder="http://10.5.5.9:8080/..."
                onKeyDown={e => e.key === 'Enter' && handleBtWifi()}
              />
              <button
                type="button"
                className={`${styles.connectBtn} ${styles.connectBtnSecondary}`}
                onClick={handleBtWifi}
                disabled={wifiConnecting}
              >
                <i className="ti ti-wifi" /> Activar stream WiFi
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
