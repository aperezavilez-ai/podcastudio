let ffmpegInstance = null

async function getFfmpeg() {
  if (ffmpegInstance) return ffmpegInstance
  const { FFmpeg } = await import('@ffmpeg/ffmpeg')
  const { toBlobURL } = await import('@ffmpeg/util')
  const ffmpeg = new FFmpeg()
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  })
  ffmpegInstance = ffmpeg
  return ffmpeg
}

export async function convertWebmToMp4(webmBlob, onProgress) {
  const ffmpeg = await getFfmpeg()
  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => onProgress(Math.round(progress * 100)))
  }
  const { fetchFile } = await import('@ffmpeg/util')
  await ffmpeg.writeFile('input.webm', await fetchFile(webmBlob))
  await ffmpeg.exec(['-i', 'input.webm', '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-b:a', '192k', 'output.mp4'])
  const data = await ffmpeg.readFile('output.mp4')
  return new Blob([data.buffer], { type: 'video/mp4' })
}

export function isMp4Recording(mimeType) {
  return mimeType?.includes('mp4')
}
