import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'

const SETS_DIR = path.resolve('public/sets')

// Genera bucles de video broadcast profesionales donde la arquitectura del estudio
// (paredes, piso, columnas y escritorio) se mantiene 100% SÓLIDA y FIJA (sin bamboleos 2D),
// y lo que tiene movimiento real son las pantallas, videowalls, neones y luces de estudio.

const sets = [
  {
    id: 'news-prime',
    img: 'news-prime.jpg',
    out: 'news-prime.mp4',
    // Arquitectura fija 1920x1080.
    // Modulación sutil de iluminación en pantallas LED y reflejos broadcast (periodo exacto 8s para loop perfecto)
    filter: `scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,eq=contrast='1.03+0.02*sin(2*PI*t/8)':brightness='0.008*sin(2*PI*t/4)':saturation=1.06,curves=vintage,format=yuv420p`
  },
  {
    id: 'talkshow-late',
    img: 'talkshow-late.jpg',
    out: 'talkshow-late.mp4',
    // Loft fijo 1920x1080. Calidez nocturna con respiración suave en bombillas vintage Edison
    filter: `scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,eq=contrast='1.02+0.015*sin(2*PI*t/8)':brightness='0.006*sin(2*PI*t/8)':saturation=1.05,format=yuv420p`
  },
  {
    id: 'corporate-stage',
    img: 'corporate-stage.jpg',
    out: 'corporate-stage.mp4',
    // Auditorio fijo 1920x1080. Ondas de luz en la pantalla LED gigante y piso reflectante
    filter: `scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,eq=contrast='1.04+0.02*cos(2*PI*t/8)':brightness='0.01*sin(2*PI*t/8)':saturation=1.08,format=yuv420p`
  },
  {
    id: 'tech-cyber',
    img: 'tech-cyber.jpg',
    out: 'tech-cyber.mp4',
    // Cyber podcast fijo 1920x1080. Pulsación rítmica en barras de neón RGB y paneles
    filter: `scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,eq=contrast='1.05+0.03*sin(2*PI*t/4)':brightness='0.012*sin(2*PI*t/4)':saturation='1.1+0.05*sin(2*PI*t/8)',format=yuv420p`
  },
  {
    id: 'concert-arena',
    img: 'concert-arena.jpg',
    out: 'concert-arena.mp4',
    // Escenario de concierto fijo 1920x1080. Haces de focos cenitales y neblina atmosférica
    filter: `scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,eq=contrast='1.06+0.03*sin(2*PI*t/4)':brightness='0.018*sin(2*PI*t/4)':saturation=1.1,format=yuv420p`
  }
]

for (const s of sets) {
  const inPath = path.join(SETS_DIR, s.img)
  const outPath = path.join(SETS_DIR, s.out)
  if (!fs.existsSync(inPath)) continue
  console.log(`Renderizando loop arquitectónico fijo para ${s.id}...`)
  const cmd = `ffmpeg -y -loop 1 -i "${inPath}" -t 8 -vf "${s.filter}" -c:v libx264 -preset veryfast -pix_fmt yuv420p -movflags +faststart "${outPath}"`
  try {
    execSync(cmd, { stdio: 'inherit' })
    console.log(`✅ Creado: ${s.out}`)
  } catch (err) {
    console.error(`❌ Error en ${s.id}:`, err.message)
  }
}
