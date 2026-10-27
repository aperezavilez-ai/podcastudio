import React, { useRef, useEffect } from 'react';

/**
 * PgmFeedCanvas
 * Visor de fotogramas PGM remoto de ultra alto rendimiento.
 * Dibuja fotogramas directos en Canvas 2D mediante eventos personalizados sin causar re-renderizados
 * en la raíz de React (<App />), eliminando 100% el parpadeo negro y la intermitencia.
 */
const PgmFeedCanvas = React.memo(function PgmFeedCanvas({ className, style }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const framePendingRef = useRef(false);

  useEffect(() => {
    if (!imgRef.current) {
      imgRef.current = new Image();
    }
    const img = imgRef.current;

    const onFrameReceived = (e) => {
      const dataUrl = e?.detail;
      if (!dataUrl) return;

      img.onload = () => {
        framePendingRef.current = false;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        if (canvas.width !== img.naturalWidth && img.naturalWidth > 0) {
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };

      if (!framePendingRef.current) {
        framePendingRef.current = true;
        img.src = dataUrl;
      }
    };

    window.addEventListener('podcastudio_pgm_feed_frame', onFrameReceived);

    return () => {
      window.removeEventListener('podcastudio_pgm_feed_frame', onFrameReceived);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={1920}
      height={1080}
      className={className || "w-full h-full object-contain pointer-events-none select-none bg-black"}
      style={style}
    />
  );
});

export default PgmFeedCanvas;
