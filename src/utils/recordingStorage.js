/**
 * Motor de Almacenamiento Blindado Anti-Cortes para Grabaciones (IndexedDB)
 * Guarda bloques cada segundo para evitar pérdida de datos por cierres accidentales,
 * recargas o problemas de memoria en sesiones largas de podcast.
 */

const DB_NAME = 'podcastudio_recordings_vault_v1'
const DB_VERSION = 1
const STORE_CHUNKS = 'recording_chunks'
const STORE_META = 'recording_meta'

let dbPromise = null

function openVaultDB() {
  if (dbPromise) return dbPromise
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null)
  }

  dbPromise = new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
        const chunkStore = db.createObjectStore(STORE_CHUNKS, { keyPath: ['sessionId', 'chunkIndex'] })
        chunkStore.createIndex('sessionId', 'sessionId', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'sessionId' })
      }
    }

    req.onsuccess = (e) => {
      resolve(e.target.result)
    }

    req.onerror = (e) => {
      console.warn('[VaultDB] Error al abrir IndexedDB:', e.target.error)
      resolve(null)
    }
  })

  return dbPromise
}

/**
 * Inicia una sesión de grabación blindada en la base de datos local
 */
export async function startVaultSession(sessionId, meta = {}) {
  const db = await openVaultDB()
  if (!db) return false

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_META], 'readwrite')
      const store = tx.objectStore(STORE_META)
      const record = {
        sessionId,
        status: 'recording',
        startTime: Date.now(),
        updatedAt: Date.now(),
        mimeType: meta.mimeType || 'video/webm',
        ext: meta.ext || 'webm',
        name: meta.name || `podcast-${sessionId}.${meta.ext || 'webm'}`,
        chunkCount: 0,
        totalBytes: 0,
        ...meta,
      }
      store.put(record)
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    } catch (err) {
      console.warn('[VaultDB] Error al iniciar sesión:', err)
      resolve(false)
    }
  })
}

/**
 * Guarda un fragmento (chunk) de video/audio en disco local
 */
export async function appendVaultChunk(sessionId, chunkIndex, blobChunk) {
  const db = await openVaultDB()
  if (!db || !blobChunk || blobChunk.size === 0) return false

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_CHUNKS, STORE_META], 'readwrite')
      const chunkStore = tx.objectStore(STORE_CHUNKS)
      const metaStore = tx.objectStore(STORE_META)

      chunkStore.put({
        sessionId,
        chunkIndex,
        data: blobChunk,
        size: blobChunk.size,
        timestamp: Date.now(),
      })

      const metaReq = metaStore.get(sessionId)
      metaReq.onsuccess = () => {
        const meta = metaReq.result
        if (meta) {
          meta.chunkCount = Math.max(meta.chunkCount || 0, chunkIndex + 1)
          meta.totalBytes = (meta.totalBytes || 0) + blobChunk.size
          meta.updatedAt = Date.now()
          metaStore.put(meta)
        }
      }

      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    } catch (err) {
      console.warn('[VaultDB] Error guardando chunk:', err)
      resolve(false)
    }
  })
}

/**
 * Marca la sesión como completada exitosamente
 */
export async function finalizeVaultSession(sessionId, durationSec = 0) {
  const db = await openVaultDB()
  if (!db) return false

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_META], 'readwrite')
      const store = tx.objectStore(STORE_META)
      const req = store.get(sessionId)
      req.onsuccess = () => {
        const meta = req.result
        if (meta) {
          meta.status = 'completed'
          meta.duration = durationSec
          meta.completedAt = Date.now()
          store.put(meta)
        }
      }
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

/**
 * Reconstruye el Blob completo a partir de todos los fragmentos ordenados
 */
export async function assembleVaultRecording(sessionId) {
  const db = await openVaultDB()
  if (!db) return null

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_CHUNKS, STORE_META], 'readonly')
      const metaStore = tx.objectStore(STORE_META)
      const chunkStore = tx.objectStore(STORE_CHUNKS)

      const metaReq = metaStore.get(sessionId)
      metaReq.onsuccess = () => {
        const meta = metaReq.result
        if (!meta) {
          resolve(null)
          return
        }

        const index = chunkStore.index('sessionId')
        const range = IDBKeyRange.only(sessionId)
        const chunksReq = index.getAll(range)

        chunksReq.onsuccess = () => {
          const rawChunks = chunksReq.result || []
          rawChunks.sort((a, b) => a.chunkIndex - b.chunkIndex)

          const blobs = rawChunks.map(c => c.data).filter(Boolean)
          if (blobs.length === 0) {
            resolve(null)
            return
          }

          const fullBlob = new Blob(blobs, { type: meta.mimeType || 'video/webm' })
          const url = URL.createObjectURL(fullBlob)

          resolve({
            url,
            name: meta.name || `podcast-${sessionId}.${meta.ext || 'webm'}`,
            size: fullBlob.size,
            blob: fullBlob,
            mimeType: meta.mimeType || 'video/webm',
            ext: meta.ext || 'webm',
            duration: meta.duration || 0,
            recovered: meta.status === 'recording',
            startTime: meta.startTime,
          })
        }
        chunksReq.onerror = () => resolve(null)
      }
      metaReq.onerror = () => resolve(null)
    } catch (err) {
      console.warn('[VaultDB] Error ensamblando grabación:', err)
      resolve(null)
    }
  })
}

/**
 * Busca si existe alguna grabación pendiente de recuperar (por ejemplo, si el navegador se cerró en plena grabación)
 */
export async function checkUnfinishedRecovery() {
  const db = await openVaultDB()
  if (!db) return null

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_META], 'readonly')
      const store = tx.objectStore(STORE_META)
      const req = store.getAll()
      req.onsuccess = () => {
        const all = req.result || []
        // Buscar sesiones que quedaron en status 'recording' o que tienen chunks
        const unfinished = all.find(m => m.status === 'recording' && (m.chunkCount || 0) > 3)
        resolve(unfinished || null)
      }
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

/**
 * Elimina una sesión y todos sus fragmentos del disco local
 */
export async function purgeVaultSession(sessionId) {
  const db = await openVaultDB()
  if (!db) return false

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_CHUNKS, STORE_META], 'readwrite')
      const chunkStore = tx.objectStore(STORE_CHUNKS)
      const metaStore = tx.objectStore(STORE_META)

      metaStore.delete(sessionId)

      const index = chunkStore.index('sessionId')
      const range = IDBKeyRange.only(sessionId)
      const req = index.openCursor(range)

      req.onsuccess = (e) => {
        const cursor = e.target.result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        }
      }

      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}
