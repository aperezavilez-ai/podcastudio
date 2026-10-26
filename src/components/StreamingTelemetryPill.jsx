import React, { useState, useEffect } from 'react';
import { Activity, Wifi, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';

export default function StreamingTelemetryPill({ isStreaming }) {
  const [telemetry, setTelemetry] = useState(null);

  useEffect(() => {
    if (!isStreaming) {
      setTelemetry(null);
      return;
    }

    if (window.api?.onStreamTelemetry) {
      const cleanup = window.api.onStreamTelemetry((data) => {
        setTelemetry(data);
      });
      return cleanup;
    }
  }, [isStreaming]);

  if (!isStreaming) return null;

  const isWarning = telemetry?.health === 'warning' || (telemetry?.droppedFrames || 0) > 10;

  return (
    <div 
      className={`hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-mono font-bold transition-all shadow-sm ${
        isWarning
          ? 'bg-amber-950/70 border-amber-500/70 text-amber-200 animate-pulse'
          : 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300'
      }`}
      title={`Salud de Emisión en Vivo: ${telemetry?.targetName || 'Stream'}\nVelocidad: ${telemetry?.speed || '1.0x'}\nCuadros perdidos: ${telemetry?.droppedFrames || 0}`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${isWarning ? 'bg-amber-400' : 'bg-emerald-400 animate-ping'}`} />
        <span className="font-sans text-[11px] font-extrabold uppercase tracking-wider">
          LIVE TELEMETRY:
        </span>
      </div>

      <div className="flex items-center gap-2 text-[11px]">
        <span className="text-gray-300">
          {telemetry?.bitrate || '2500 kb/s'}
        </span>
        <span className="text-gray-500">|</span>
        <span className="text-gray-300">
          {telemetry?.fps ? `${Math.round(telemetry.fps)} FPS` : '30 FPS'}
        </span>
        <span className="text-gray-500">|</span>
        <span className={telemetry?.droppedFrames > 0 ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
          {telemetry?.droppedFrames || 0} drops
        </span>
      </div>
    </div>
  );
}
