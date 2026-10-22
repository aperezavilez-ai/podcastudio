/**
 * Pure JavaScript WebM Duration & Header Injector
 * Resuelve el problema fundamental de Chromium MediaRecorder donde los archivos WebM
 * carecen de cabecera de duración fija, provocando pantalla blanca al abrir en Windows,
 * imposibilidad de adelantar/atrasar en reproductores y falta de miniaturas.
 *
 * Basado en la especificación EBML y adaptado para ES Modules sin dependencias externas.
 */

const SECTIONS = {
  0xa45dfa3: { name: 'EBML', type: 'Container' },
  0x286: { name: 'EBMLVersion', type: 'Uint' },
  0x2f7: { name: 'EBMLReadVersion', type: 'Uint' },
  0x2f2: { name: 'EBMLMaxIDLength', type: 'Uint' },
  0x2f3: { name: 'EBMLMaxSizeLength', type: 'Uint' },
  0x282: { name: 'DocType', type: 'String' },
  0x287: { name: 'DocTypeVersion', type: 'Uint' },
  0x285: { name: 'DocTypeReadVersion', type: 'Uint' },
  0x6c: { name: 'Void', type: 'Binary' },
  0x3f: { name: 'CRC-32', type: 'Binary' },
  0x8538067: { name: 'Segment', type: 'Container' },
  0x14d9b74: { name: 'SeekHead', type: 'Container' },
  0x549a966: { name: 'Info', type: 'Container' },
  0xad7b1: { name: 'TimecodeScale', type: 'Uint' },
  0x489: { name: 'Duration', type: 'Float' },
  0x654ae6b: { name: 'Tracks', type: 'Container' },
}

function padHex(hex) {
  return hex.length % 2 === 1 ? '0' + hex : hex
}

class WebmBase {
  constructor(name, type) {
    this.name = name || 'Unknown'
    this.type = type || 'Unknown'
    this.source = null
    this.data = null
  }
  updateBySource() {}
  setSource(source) {
    this.source = source
    this.updateBySource()
  }
  updateByData() {}
  setData(data) {
    this.data = data
    this.updateByData()
  }
}

class WebmUint extends WebmBase {
  constructor(name, type) {
    super(name, type || 'Uint')
  }
  updateBySource() {
    this.data = ''
    for (let i = 0; i < this.source.length; i++) {
      this.data += padHex(this.source[i].toString(16))
    }
  }
  updateByData() {
    const length = this.data.length / 2
    this.source = new Uint8Array(length)
    for (let i = 0; i < length; i++) {
      this.source[i] = parseInt(this.data.substr(i * 2, 2), 16)
    }
  }
  getValue() {
    return parseInt(this.data, 16)
  }
  setValue(value) {
    this.setData(padHex(value.toString(16)))
  }
}

class WebmFloat extends WebmBase {
  constructor(name, type) {
    super(name, type || 'Float')
  }
  getFloatArrayType() {
    return this.source && this.source.length === 4 ? Float32Array : Float64Array
  }
  updateBySource() {
    const byteArray = new Uint8Array(this.source).reverse()
    const floatArrayType = this.getFloatArrayType()
    const floatArray = new floatArrayType(byteArray.buffer)
    this.data = floatArray[0]
  }
  updateByData() {
    const floatArrayType = this.getFloatArrayType()
    const floatArray = new floatArrayType([this.data])
    const byteArray = new Uint8Array(floatArray.buffer)
    this.source = byteArray.reverse()
  }
  getValue() {
    return this.data
  }
  setValue(value) {
    this.setData(value)
  }
}

class WebmContainer extends WebmBase {
  constructor(name, type) {
    super(name, type || 'Container')
    this.offset = 0
    this.data = []
  }
  readByte() {
    return this.source[this.offset++]
  }
  readUint() {
    const firstByte = this.readByte()
    const bytes = 8 - firstByte.toString(2).length
    let value = firstByte - (1 << (7 - bytes))
    for (let i = 0; i < bytes; i++) {
      value *= 256
      value += this.readByte()
    }
    return value
  }
  updateBySource() {
    this.data = []
    for (this.offset = 0; this.offset < this.source.length; ) {
      const id = this.readUint()
      const len = this.readUint()
      const end = Math.min(this.offset + len, this.source.length)
      const data = this.source.slice(this.offset, end)

      const info = SECTIONS[id] || { name: 'Unknown', type: 'Unknown' }
      let ctr = WebmBase
      switch (info.type) {
        case 'Container':
          ctr = WebmContainer
          break
        case 'Uint':
          ctr = WebmUint
          break
        case 'Float':
          ctr = WebmFloat
          break
      }
      const section = new ctr(info.name, info.type)
      section.setSource(data)
      this.data.push({ id, data: section })
      this.offset = end
    }
  }
  writeUint(x, draft) {
    let bytes = 1
    let flag = 0x80
    for (; x >= flag && bytes < 8; bytes++, flag *= 0x80) {}
    if (!draft) {
      let value = flag + x
      for (let i = bytes - 1; i >= 0; i--) {
        const c = value % 256
        this.source[this.offset + i] = c
        value = (value - c) / 256
      }
    }
    this.offset += bytes
  }
  writeSections(draft) {
    this.offset = 0
    for (let i = 0; i < this.data.length; i++) {
      const section = this.data[i]
      const content = section.data.source
      const contentLength = content.length
      this.writeUint(section.id, draft)
      this.writeUint(contentLength, draft)
      if (!draft) {
        this.source.set(content, this.offset)
      }
      this.offset += contentLength
    }
    return this.offset
  }
  updateByData() {
    const length = this.writeSections(true)
    this.source = new Uint8Array(length)
    this.writeSections(false)
  }
  getSectionById(id) {
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i].id === id) return this.data[i].data
    }
    return null
  }
}

class WebmFile extends WebmContainer {
  constructor(source) {
    super('File', 'File')
    this.setSource(source)
  }
  fixDuration(durationInMs) {
    const segmentSection = this.getSectionById(0x8538067)
    if (!segmentSection) return false

    const infoSection = segmentSection.getSectionById(0x549a966)
    if (!infoSection) return false

    const timeScaleSection = infoSection.getSectionById(0xad7b1)
    if (!timeScaleSection) return false

    let durationSection = infoSection.getSectionById(0x489)
    if (durationSection) {
      durationSection.setValue(durationInMs)
    } else {
      durationSection = new WebmFloat('Duration', 'Float')
      durationSection.setValue(durationInMs)
      infoSection.data.push({ id: 0x489, data: durationSection })
    }

    timeScaleSection.setValue(1000000) // 1ms scale
    infoSection.updateByData()
    segmentSection.updateByData()
    this.updateByData()
    return true
  }
  toBlob(mimeType) {
    return new Blob([this.source.buffer], { type: mimeType || 'video/webm' })
  }
}

/**
 * Corrige e inyecta la duración precisa en milisegundos en el encabezado EBML de un Blob WebM.
 * @param {Blob} blob - Blob WebM generado por MediaRecorder
 * @param {number} durationMs - Duración total en milisegundos
 * @returns {Promise<Blob>} Blob reparado con duración seekable
 */
export async function fixWebmDuration(blob, durationMs) {
  if (!blob || !(blob instanceof Blob) || !durationMs || durationMs <= 0) {
    return blob
  }
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      try {
        const file = new WebmFile(new Uint8Array(reader.result))
        if (file.fixDuration(durationMs)) {
          resolve(file.toBlob(blob.type))
          return
        }
      } catch (err) {
        console.warn('[fixWebmDuration] Advertencia al parsear cabecera EBML:', err)
      }
      resolve(blob)
    }
    reader.onerror = () => resolve(blob)
    reader.readAsArrayBuffer(blob)
  })
}
