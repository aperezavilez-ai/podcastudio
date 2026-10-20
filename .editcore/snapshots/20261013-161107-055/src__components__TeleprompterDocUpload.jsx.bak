import React, { useRef, useState } from 'react'
import { extractTextFromFile } from '../utils/parseDocument.js'
import styles from './TeleprompterDocUpload.module.css'

export default function TeleprompterDocUpload({
  onScriptReady,
  onFormatWithAI,
  aiConfigured = false,
  processing = false,
  compact = false,
}) {
  const fileRef = useRef(null)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setFileName(file.name)

    try {
      const raw = await extractTextFromFile(file)
      if (onFormatWithAI && aiConfigured) {
        const formatted = await onFormatWithAI(raw)
        if (formatted) onScriptReady?.(formatted)
      } else {
        onScriptReady?.(raw)
      }
    } catch (err) {
      setError(err.message || 'No se pudo leer el documento')
      setFileName('')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className={`${styles.wrap} ${compact ? styles.compact : ''}`}>
      <input
        ref={fileRef}
        type="file"
        accept=".docx,.txt,.md"
        hidden
        onChange={handleFile}
      />
      <button
        type="button"
        className={styles.uploadBtn}
        onClick={() => fileRef.current?.click()}
        disabled={processing}
      >
        <i className={`ti ${processing ? 'ti-loader' : 'ti-file-upload'}`} style={processing ? { animation: 'spin 1s linear infinite' } : {}} />
        {processing ? 'Procesando guion...' : 'Subir Word (.docx)'}
      </button>
      {fileName && !error && (
        <span className={styles.fileName}><i className="ti ti-check" /> {fileName}</span>
      )}
      {error && <p className={styles.error}><i className="ti ti-alert-circle" /> {error}</p>}
      <p className={styles.hint}>
        {aiConfigured
          ? 'La IA corrige, adapta y formatea el texto para el teleprompter.'
          : 'Se cargará el texto tal cual. Activa la IA para corregir y formatear automáticamente.'}
      </p>
    </div>
  )
}
