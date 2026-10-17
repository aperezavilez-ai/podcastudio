import sharp from 'sharp';
import fs from 'node:fs';

async function createDeskOverlays() {
  const dir = 'public/sets';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // 1. News Prime Desk Overlay
  if (fs.existsSync('public/sets/news-prime.jpg')) {
    const meta = await sharp('public/sets/news-prime.jpg').metadata();
    const w = meta.width;
    const h = meta.height;

    // The desk surface in news-prime is at Y ~ 610 in center, 560 at sides
    const svgMask = `
      <svg width="${w}" height="${h}">
        <defs>
          <linearGradient id="edgeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fff" stop-opacity="0" />
            <stop offset="1.5%" stop-color="#fff" stop-opacity="1" />
            <stop offset="100%" stop-color="#fff" stop-opacity="1" />
          </linearGradient>
        </defs>
        <path d="M 0 ${h} L 0 680 Q ${w * 0.5} 570 ${w} 680 L ${w} ${h} Z" fill="url(#edgeGrad)" />
      </svg>
    `;

    const maskBuffer = Buffer.from(svgMask);
    await sharp('public/sets/news-prime.jpg')
      .ensureAlpha()
      .composite([{ input: maskBuffer, blend: 'dest-in' }])
      .png()
      .toFile('public/sets/news-prime-desk.png');

    console.log('Created news-prime-desk.png');
  }

  // 2. Talkshow Late Night Desk Overlay
  if (fs.existsSync('public/sets/talkshow-late.jpg')) {
    const meta = await sharp('public/sets/talkshow-late.jpg').metadata();
    const w = meta.width;
    const h = meta.height;

    // Talk show desk is in the center-bottom:
    // Left at ~28%, Right at ~72%, top of desk at Y ~ 590
    const svgDesk = `
      <svg width="${w}" height="${h}">
        <defs>
          <linearGradient id="woodGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fff" stop-opacity="0" />
            <stop offset="1.5%" stop-color="#fff" stop-opacity="1" />
            <stop offset="100%" stop-color="#fff" stop-opacity="1" />
          </linearGradient>
        </defs>
        <path d="M ${w * 0.28} ${h} L ${w * 0.28} 640 Q ${w * 0.5} 580 ${w * 0.72} 640 L ${w * 0.72} ${h} Z" fill="url(#woodGrad)" />
      </svg>
    `;

    const maskBuffer = Buffer.from(svgDesk);
    await sharp('public/sets/talkshow-late.jpg')
      .ensureAlpha()
      .composite([{ input: maskBuffer, blend: 'dest-in' }])
      .png()
      .toFile('public/sets/talkshow-late-desk.png');

    console.log('Created talkshow-late-desk.png');
  }
}

createDeskOverlays().catch(console.error);
