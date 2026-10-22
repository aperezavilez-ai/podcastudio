let ffmpegInstance = null

async function getFfmpeg() {
  if (ffmpegInstance) return ffmpegInstance
  const { FFmpeg } = await import('@ffmpeg/ffmpeg')
  const { toBlobURL } = await import('@ffmpeg/util')
  const ffmpeg = new FFmpeg()

  const cdnList = [
    'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm',
    'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm',
  ]
  let loaded = false
  let lastErr = null

  const loadWithTimeout = async () => {
    for (const baseURL of cdnList) {
      try {
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        })
        loaded = true
        break
      } catch (e) { lastErr = e }
    }
    if (!loaded) throw (lastErr || new Error('No se pudo cargar FFmpeg'))
    ffmpegInstance = ffmpeg
    return ffmpeg
  }

  const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout FFmpeg')), 60000))
  return Promise.race([loadWithTimeout(), timeoutPromise])
}

const inputSyncFlags = ['-fflags', '+genpts+discardcorrupt', '-avoid_negative_ts', 'make_zero']
const VIDEO_PTS_ANCHOR = ',setpts=PTS-STARTPTS'
const audioSyncArgs = ['-af', 'aresample=async=1:first_pts=0,asetpts=PTS-STARTPTS', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000']
const videoEncodeArgs = [
  '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
  '-fps_mode', 'cfr', '-r', '30', // CORREGIDO: 30 FPS CFR para evitar duplicación y peso excesivo
  '-g', '30', '-keyint_min', '15', '-force_key_frames', 'expr:gte(t,n_forced*1)', '-sc_threshold', '0', '-crf', '20',
]
const OPEN_GOP_LOCK = ['-x264-params', 'keyint=30:min-keyint=15']

export async function finalizeUniversalMp4(sourceBlob, options = {}) {
  const { format = 'original', mode = 'smart-crop', onProgress = () => {} } = options

  // FASE 1: Si estamos en Electron Desktop, usar FFmpeg nativo de Node.js (Sin WASM ni consumo de RAM)
  if (typeof window !== 'undefined' && window.electronAPI?.isDesktop && window.electronAPI?.transcodeVideo) {
    try {
      const cleanup = window.electronAPI.onFfmpegProgress?.(() => {
        onProgress(50)
      })
      const isBufferBlob = sourceBlob instanceof Blob
      let inputBuffer = null
      let inputPath = null
      let ext = 'webm'

      if (sourceBlob?.filePath) {
        inputPath = sourceBlob.filePath
      } else if (isBufferBlob) {
        inputBuffer = await sourceBlob.arrayBuffer()
        ext = sourceBlob.type?.includes('mp4') ? 'mp4' : 'webm'
      }

      const res = await window.electronAPI.transcodeVideo({
        inputPath,
        inputBuffer,
        ext,
        format,
        mode,
      })
      cleanup?.()
      if (res?.success && res.outputPath) {
        onProgress(100)
        return new Blob(['PODCASTUDIO_NATIVE_EXPORT:' + res.outputPath], { type: 'video/mp4' })
      }
    } catch (err) {
      console.warn('[exportVideo] Fallo transcodificador nativo, recurriendo a WASM:', err)
    }
  }

  const ffmpeg = await getFfmpeg()

  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => {
      const pct = Math.min(99, Math.max(1, Math.round(progress * 100)))
      onProgress(pct)
    })
  }

  const { fetchFile } = await import('@ffmpeg/util')
  const isSourceMp4 = Boolean(sourceBlob.type && sourceBlob.type.includes('mp4'))
  const inputExt = isSourceMp4 ? 'mp4' : 'webm'
  const inputFilename = `input_${Date.now()}.${inputExt}`
  const outputFilename = `output_${Date.now()}.mp4`

  await ffmpeg.writeFile(inputFilename, await fetchFile(sourceBlob))

  const cleanup = async () => {
    await ffmpeg.deleteFile(inputFilename).catch(() => {})
    await ffmpeg.deleteFile(outputFilename).catch(() => {})
  }

  const runWithAudioFallback = async (baseArgs) => {
    try {
      await ffmpeg.exec(baseArgs)
    } catch (err) {
      if (baseArgs.includes('-c:a')) {
        const strippedArgs = []
        for (let i = 0; i < baseArgs.length; i++) {
          if (['-c:a', '-b:a', '-ar', '-af'].includes(baseArgs[i])) { i++ } 
          else { strippedArgs.push(baseArgs[i]) }
        }
        await ffmpeg.exec(strippedArgs)
      } else {
        throw err
      }
    }
  }

  const anchor = (filterStr) => `${filterStr}${VIDEO_PTS_ANCHOR}`

  try {
    if (format === 'original') {
      if (isSourceMp4) {
        try {
          await ffmpeg.exec([...inputSyncFlags, '-i', inputFilename, '-c', 'copy', '-movflags', '+faststart', outputFilename])
          const fastData = await ffmpeg.readFile(outputFilename)
          if (fastData && fastData.byteLength > 1000) {
            onProgress(100)
            return new Blob([fastData.buffer], { type: 'video/mp4' })
          }
        } catch {}
      }
      await runWithAudioFallback([
        ...inputSyncFlags, '-i', inputFilename,
        '-vf', anchor('scale=trunc(iw/2)*2:trunc(ih/2)*2'),
        ...videoEncodeArgs, ...OPEN_GOP_LOCK, ...audioSyncArgs,
        '-movflags', '+faststart', outputFilename,
      ])
    } 
    else if (format === '9:16') {
      let filterArgs = []
      if (mode === 'blur-fill') {
        filterArgs = ['-filter_complex', `[0:v]split[bg][fg];[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:5[blurred];[fg]scale=1080:1920:force_original_aspect_ratio=decrease[scaled];[blurred][scaled]overlay=(W-w)/2:(H-h)/2,setsar=1${VIDEO_PTS_ANCHOR}`]
      } else if (mode === 'fit') {
        filterArgs = ['-vf', anchor('scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1')]
      } else {
        filterArgs = ['-vf', anchor('crop=w=trunc(ih*9/16/2)*2:h=trunc(ih/2)*2:x=trunc((iw-out_w)/4)*2:y=0,scale=1080:1920:flags=lanczos,setsar=1')]
      }
      await runWithAudioFallback([...inputSyncFlags, '-i', inputFilename, ...filterArgs, ...videoEncodeArgs, ...OPEN_GOP_LOCK, ...audioSyncArgs, '-movflags', '+faststart', outputFilename])
    } 
    else if (format === '1:1') {
      let filterArgs = []
      if (mode === 'blur-fill') {
        filterArgs = ['-filter_complex', `[0:v]split[bg][fg];[bg]scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080,boxblur=20:5[blurred];[fg]scale=1080:1080:force_original_aspect_ratio=decrease[scaled];[blurred][scaled]overlay=(W-w)/2:(H-h)/2,setsar=1${VIDEO_PTS_ANCHOR}`]
      } else if (mode === 'fit') {
        filterArgs = ['-vf', anchor('scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1')]
      } else {
        filterArgs = ['-vf', anchor('crop=w=trunc(ih/2)*2:h=trunc(ih/2)*2:x=trunc((iw-out_w)/4)*2:y=0,scale=1080:1080:flags=lanczos,setsar=1')]
      }
      await runWithAudioFallback([...inputSyncFlags, '-i', inputFilename, ...filterArgs, ...videoEncodeArgs, ...OPEN_GOP_LOCK, ...audioSyncArgs, '-movflags', '+faststart', outputFilename])
    }
    // CASO 16:9 CORREGIDO: Ahora respeta el aspect ratio (evita estiramientos)
    else if (format === '16:9') {
      let filterArgs = []
      if (mode === 'blur-fill') {
        filterArgs = ['-filter_complex', `[0:v]split[bg][fg];[bg]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=20:5[blurred];[fg]scale=1920:1080:force_original_aspect_ratio=decrease[scaled];[blurred][scaled]overlay=(W-w)/2:(H-h)/2,setsar=1${VIDEO_PTS_ANCHOR}`]
      } else if (mode === 'fit') {
        // 'fit' añade bordes negros para mostrar TODO el encuadre sin cortar
        filterArgs = ['-vf', anchor('scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1')]
      } else {
        // 'smart-crop' recorta los lados para llenar la pantalla sin estirar
        filterArgs = ['-vf', anchor('scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1')]
      }
      await runWithAudioFallback([...inputSyncFlags, '-i', inputFilename, ...filterArgs, ...videoEncodeArgs, ...OPEN_GOP_LOCK, ...audioSyncArgs, '-movflags', '+faststart', outputFilename])
    }
    else {
      // Fallback general
      await runWithAudioFallback([
        ...inputSyncFlags, '-i', inputFilename,
        '-vf', anchor('scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1'),
        ...videoEncodeArgs, ...OPEN_GOP_LOCK, ...audioSyncArgs,
        '-movflags', '+faststart', outputFilename,
      ])
    }

    const data = await ffmpeg.readFile(outputFilename)
    onProgress(100)
    return new Blob([data.buffer], { type: 'video/mp4' })
  } finally {
    await cleanup()
  }
}

export async function convertWebmToMp4(webmBlob, onProgress) {
  return finalizeUniversalMp4(webmBlob, { format: 'original', onProgress })
}

export function isMp4Recording(mimeType) {
  return Boolean(mimeType && mimeType.includes('mp4'))
}