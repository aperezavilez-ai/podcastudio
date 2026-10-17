import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'

const SETS_DIR = path.resolve('public/sets')

const sets = [
  {
    id: 'news-prime',
    img: 'news-prime.jpg',
    out: 'news-prime.mp4',
    // 8s loop at 30fps = 240 frames
    // subtle studio breathing + glowing LED screen pulse
    filter: `scale=2048:1152,crop=1920:1080:'(in_w-out_w)/2+18*sin(2*PI*t/8)':'(in_h-out_h)/2+8*cos(2*PI*t/8)',eq=contrast='1.03+0.03*sin(2*PI*t/8)':brightness='0.01+0.015*sin(2*PI*t/4)':saturation=1.06,format=yuv420p`
  },
  {
    id: 'talkshow-late',
    img: 'talkshow-late.jpg',
    out: 'talkshow-late.mp4',
    // warm studio lamp flicker + subtle city drift
    filter: `scale=2048:1152,crop=1920:1080:'(in_w-out_w)/2+14*cos(2*PI*t/8)':'(in_h-out_h)/2+6*sin(2*PI*t/8)',eq=contrast='1.02+0.02*sin(2*PI*t/8)':brightness='0.008*sin(2*PI*t/2)':saturation=1.05,format=yuv420p`
  },
  {
    id: 'corporate-stage',
    img: 'corporate-stage.jpg',
    out: 'corporate-stage.mp4',
    // keynote stage slow crane pan + LED screen glow
    filter: `scale=2048:1152,crop=1920:1080:'(in_w-out_w)/2+22*sin(2*PI*t/8)':'(in_h-out_h)/2+5*cos(2*PI*t/8)',eq=contrast='1.04+0.03*cos(2*PI*t/8)':brightness='0.015*sin(2*PI*t/8)':saturation=1.08,format=yuv420p`
  },
  {
    id: 'tech-cyber',
    img: 'tech-cyber.jpg',
    out: 'tech-cyber.mp4',
    // cyber neon pulse + RGB glow
    filter: `scale=2048:1152,crop=1920:1080:'(in_w-out_w)/2+16*sin(2*PI*t/8)':'(in_h-out_h)/2+7*cos(2*PI*t/8)',eq=contrast='1.05+0.04*sin(2*PI*t/4)':brightness='0.02*sin(2*PI*t/4)':saturation='1.12+0.06*sin(2*PI*t/8)',format=yuv420p`
  },
  {
    id: 'concert-arena',
    img: 'concert-arena.jpg',
    out: 'concert-arena.mp4',
    // stage spotlight sweeps + haze pulse
    filter: `scale=2048:1152,crop=1920:1080:'(in_w-out_w)/2+20*cos(2*PI*t/8)':'(in_h-out_h)/2+10*sin(2*PI*t/8)',eq=contrast='1.06+0.05*sin(2*PI*t/4)':brightness='0.025*sin(2*PI*t/2)':saturation=1.1,format=yuv420p`
  }
]

for (const s of sets) {
  const inPath = path.join(SETS_DIR, s.img)
  const outPath = path.join(SETS_DIR, s.out)
  if (!fs.existsSync(inPath)) {
    console.log(`Falta ${inPath}, saltando...`)
    continue
  }
  console.log(`Renderizando loop broadcast para ${s.id}...`)
  const cmd = `ffmpeg -y -loop 1 -i "${inPath}" -t 8 -vf "${s.filter}" -c:v libx264 -preset veryfast -pix_fmt yuv420p -movflags +faststart "${outPath}"`
  try {
    execSync(cmd, { stdio: 'inherit' })
    console.log(`✅ Creado: ${s.out}`)
  } catch (err) {
    console.error(`❌ Error en ${s.id}:`, err.message)
  }
}
