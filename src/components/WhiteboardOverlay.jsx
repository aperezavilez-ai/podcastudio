import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  Pencil, Highlighter, MoveRight, Square, Circle, Sparkles, 
  RotateCcw, Trash2, Eye, EyeOff, X, Palette, MousePointer
} from 'lucide-react';
import { updateBroadcastState } from '../utils/masterBroadcastEngine.js';

const COLORS = [
  { id: 'red', hex: '#ef4444', label: 'Rojo' },
  { id: 'yellow', hex: '#facc15', label: 'Amarillo' },
  { id: 'cyan', hex: '#06b6d4', label: 'Cian' },
  { id: 'green', hex: '#22c55e', label: 'Verde' },
  { id: 'purple', hex: '#a855f7', label: 'Morado' },
  { id: 'white', hex: '#ffffff', label: 'Blanco' },
];

const STROKE_SIZES = [
  { id: 'fine', size: 3, label: 'Fino' },
  { id: 'medium', size: 6, label: 'Medio' },
  { id: 'thick', size: 14, label: 'Grueso' }
];

export default function WhiteboardOverlay({ isActive, onClose }) {
  const containerRef = useRef(null);
  const displayCanvasRef = useRef(null);
  const masterCanvasRef = useRef(null); // Canvas de 1920x1080 para composición broadcast

  const [tool, setTool] = useState('pen'); // 'pen' | 'highlighter' | 'laser' | 'arrow' | 'rect'
  const [color, setColor] = useState('#ef4444');
  const [strokeWidth, setStrokeWidth] = useState(6);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [strokes, setStrokes] = useState([]);
  const [laserPoints, setLaserPoints] = useState([]); // Estela del puntero láser

  // Inicializar canvas broadcast de 1920x1080
  useEffect(() => {
    if (!masterCanvasRef.current) {
      const c = document.createElement('canvas');
      c.width = 1920;
      c.height = 1080;
      masterCanvasRef.current = c;
    }
  }, []);

  // Redimensionar canvas de visualización interactiva al tamaño del contenedor
  const syncCanvasSize = useCallback(() => {
    if (containerRef.current && displayCanvasRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      displayCanvasRef.current.width = rect.width;
      displayCanvasRef.current.height = rect.height;
      redrawAll();
    }
  }, [strokes]);

  useEffect(() => {
    syncCanvasSize();
    window.addEventListener('resize', syncCanvasSize);
    return () => window.removeEventListener('resize', syncCanvasSize);
  }, [syncCanvasSize]);

  // Redibujar todos los trazos tanto en el canvas visual como en el canvas broadcast 1920x1080
  const redrawAll = useCallback(() => {
    const dispCanvas = displayCanvasRef.current;
    const mastCanvas = masterCanvasRef.current;
    if (!dispCanvas || !mastCanvas) return;

    const dispCtx = dispCanvas.getContext('2d');
    const mastCtx = mastCanvas.getContext('2d');

    // Limpiar ambos lienzos transparentes
    dispCtx.clearRect(0, 0, dispCanvas.width, dispCanvas.height);
    mastCtx.clearRect(0, 0, 1920, 1080);

    const scaleX = 1920 / dispCanvas.width;
    const scaleY = 1080 / dispCanvas.height;

    // Dibujar trazos guardados
    strokes.forEach(stroke => {
      // 1. En lienzo visual
      drawSingleStroke(dispCtx, stroke, 1, 1);
      // 2. En lienzo broadcast
      drawSingleStroke(mastCtx, stroke, scaleX, scaleY);
    });

    // Enviar lienzo broadcast al compositor principal
    updateBroadcastState({ whiteboardCanvas: mastCanvas });
  }, [strokes]);

  useEffect(() => {
    redrawAll();
  }, [redrawAll]);

  // Dibujar un trazo individual
  function drawSingleStroke(ctx, stroke, sx, sy) {
    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width * sx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (stroke.tool === 'highlighter') {
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = (stroke.width * 2.5) * sx;
    } else {
      ctx.globalAlpha = 1.0;
    }

    if (stroke.type === 'path' && stroke.points?.length > 1) {
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x * sx, stroke.points[0].y * sy);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x * sx, stroke.points[i].y * sy);
      }
      ctx.stroke();
    } else if (stroke.type === 'rect') {
      ctx.strokeRect(
        stroke.startX * sx,
        stroke.startY * sy,
        (stroke.endX - stroke.startX) * sx,
        (stroke.endY - stroke.startY) * sy
      );
    } else if (stroke.type === 'arrow') {
      const fromX = stroke.startX * sx;
      const fromY = stroke.startY * sy;
      const toX = stroke.endX * sx;
      const toY = stroke.endY * sy;

      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();

      // Cabeza de la flecha
      const headlen = 20 * sx;
      const angle = Math.atan2(toY - fromY, toX - fromX);
      ctx.beginPath();
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    }
    ctx.restore();
  }

  // Gestión de Eventos del Ratón
  const handleMouseDown = (e) => {
    if (!isActive) return;
    const rect = displayCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    setStartPos({ x, y });

    if (tool === 'pen' || tool === 'highlighter') {
      setStrokes(prev => [
        ...prev,
        {
          id: Date.now(),
          type: 'path',
          tool,
          color,
          width: strokeWidth,
          points: [{ x, y }]
        }
      ]);
    } else if (tool === 'laser') {
      addLaserPoint(x, y);
    }
  };

  const handleMouseMove = (e) => {
    const rect = displayCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === 'laser') {
      addLaserPoint(x, y);
      return;
    }

    if (!isDrawing) return;

    if (tool === 'pen' || tool === 'highlighter') {
      setStrokes(prev => {
        if (prev.length === 0) return prev;
        const last = { ...prev[prev.length - 1] };
        last.points = [...last.points, { x, y }];
        return [...prev.slice(0, -1), last];
      });
    } else if (tool === 'rect' || tool === 'arrow') {
      // Dibujado temporal sobre el canvas visual
      redrawAll();
      const dispCtx = displayCanvasRef.current.getContext('2d');
      drawSingleStroke(dispCtx, {
        type: tool,
        tool,
        color,
        width: strokeWidth,
        startX: startPos.x,
        startY: startPos.y,
        endX: x,
        endY: y
      }, 1, 1);
    }
  };

  const handleMouseUp = (e) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (tool === 'rect' || tool === 'arrow') {
      const rect = displayCanvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setStrokes(prev => [
        ...prev,
        {
          id: Date.now(),
          type: tool,
          tool,
          color,
          width: strokeWidth,
          startX: startPos.x,
          startY: startPos.y,
          endX: x,
          endY: y
        }
      ]);
    }
  };

  // Puntero láser con estela temporal
  const addLaserPoint = (x, y) => {
    const pt = { x, y, timestamp: Date.now() };
    setLaserPoints(prev => [...prev.slice(-25), pt]);
  };

  // Animación continua de desvanecimiento del láser
  useEffect(() => {
    if (tool !== 'laser' || laserPoints.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setLaserPoints(prev => prev.filter(p => now - p.timestamp < 600));
    }, 50);
    return () => clearInterval(interval);
  }, [tool, laserPoints]);

  // Dibujar puntero láser
  useEffect(() => {
    if (tool !== 'laser') return;
    const dispCtx = displayCanvasRef.current?.getContext('2d');
    if (!dispCtx) return;

    redrawAll();
    const now = Date.now();
    laserPoints.forEach((pt, i) => {
      const age = now - pt.timestamp;
      const alpha = Math.max(0, 1 - age / 600);
      dispCtx.save();
      dispCtx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
      dispCtx.shadowColor = '#ef4444';
      dispCtx.shadowBlur = 12;
      dispCtx.beginPath();
      dispCtx.arc(pt.x, pt.y, (10 - (i / laserPoints.length) * 4), 0, Math.PI * 2);
      dispCtx.fill();
      dispCtx.restore();
    });
  }, [laserPoints, tool, redrawAll]);

  const handleUndo = () => {
    setStrokes(prev => prev.slice(0, -1));
  };

  const handleClearAll = () => {
    setStrokes([]);
    setLaserPoints([]);
    if (masterCanvasRef.current) {
      const ctx = masterCanvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, 1920, 1080);
      updateBroadcastState({ whiteboardCanvas: masterCanvasRef.current });
    }
  };

  if (!isActive) return null;

  return (
    <div 
      ref={containerRef} 
      className="absolute inset-0 z-30 pointer-events-auto cursor-crosshair select-none"
    >
      {/* Lienzo transparente de dibujo interactivo */}
      <canvas
        ref={displayCanvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="w-full h-full block"
      />

      {/* Barra de Herramientas Flotante de la Pizarra */}
      <div 
        className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#12131a]/95 backdrop-blur-xl border border-[#2b2d3d] rounded-2xl shadow-2xl p-2 flex items-center gap-2 pointer-events-auto z-40 animate-in fade-in slide-in-from-top-4 duration-150"
      >
        {/* Selector de Herramientas */}
        <div className="flex items-center gap-1 bg-[#1a1b26] p-1 rounded-xl border border-[#2a2c3a]">
          {[
            { id: 'pen', icon: Pencil, label: 'Lápiz' },
            { id: 'highlighter', icon: Highlighter, label: 'Resaltador' },
            { id: 'laser', icon: Sparkles, label: 'Láser' },
            { id: 'arrow', icon: MoveRight, label: 'Flecha' },
            { id: 'rect', icon: Square, label: 'Caja' },
          ].map(t => {
            const Icon = t.icon;
            const isSel = tool === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTool(t.id)}
                className={`p-2 rounded-lg transition-all cursor-pointer ${
                  isSel 
                    ? 'bg-purple-600 text-white shadow-md' 
                    : 'text-gray-400 hover:text-white hover:bg-[#252736]'
                }`}
                title={t.label}
              >
                <Icon size={15} />
              </button>
            );
          })}
        </div>

        {/* Separador */}
        <div className="w-[1px] h-6 bg-[#2b2d3d]" />

        {/* Selector de Color */}
        <div className="flex items-center gap-1 bg-[#1a1b26] p-1 rounded-xl border border-[#2a2c3a]">
          {COLORS.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => setColor(c.hex)}
              className={`w-5 h-5 rounded-full transition-transform cursor-pointer border ${
                color === c.hex ? 'scale-125 border-white shadow-md' : 'border-transparent opacity-80 hover:opacity-100'
              }`}
              style={{ backgroundColor: c.hex }}
              title={c.label}
            />
          ))}
        </div>

        {/* Separador */}
        <div className="w-[1px] h-6 bg-[#2b2d3d]" />

        {/* Selector de Grosor */}
        <div className="flex items-center gap-1 bg-[#1a1b26] p-1 rounded-xl border border-[#2a2c3a]">
          {STROKE_SIZES.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStrokeWidth(s.size)}
              className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
                strokeWidth === s.size 
                  ? 'bg-purple-600/40 text-purple-200 border border-purple-500' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Separador */}
        <div className="w-[1px] h-6 bg-[#2b2d3d]" />

        {/* Botones de Acción (Deshacer, Borrar, Cerrar) */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleUndo}
            disabled={strokes.length === 0}
            className="p-2 rounded-lg bg-[#1a1b26] hover:bg-[#252736] text-gray-300 disabled:opacity-30 disabled:pointer-events-none border border-[#2a2c3a] transition-all cursor-pointer"
            title="Deshacer último trazo (Ctrl+Z)"
          >
            <RotateCcw size={14} />
          </button>

          <button
            type="button"
            onClick={handleClearAll}
            disabled={strokes.length === 0}
            className="p-2 rounded-lg bg-[#1a1b26] hover:bg-red-950/60 hover:text-red-300 text-gray-300 disabled:opacity-30 disabled:pointer-events-none border border-[#2a2c3a] transition-all cursor-pointer"
            title="Borrar toda la pizarra"
          >
            <Trash2 size={14} />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-red-600/80 hover:bg-red-700 text-white transition-all cursor-pointer ml-1"
            title="Cerrar modo pizarra"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
