export async function extractTextFromFile(file) {
  const name = file.name.toLowerCase()

  if (name.endsWith('.docx')) {
    const { default: mammoth } = await import('mammoth')
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    const text = result.value?.trim()
    if (!text) throw new Error('El documento Word está vacío o no se pudo leer.')
    return text
  }

  if (name.endsWith('.txt') || name.endsWith('.md')) {
    const text = (await file.text()).trim()
    if (!text) throw new Error('El archivo de texto está vacío.')
    return text
  }

  throw new Error('Formato no soportado. Usa un archivo Word (.docx) o texto (.txt).')
}
