import React, { useState, useEffect } from 'react';
import { Tag, X, Check, Trash2, Eye, EyeOff, LayoutTemplate } from 'lucide-react';

export default function CameraNameBadgeModal({
  isOpen,
  onClose,
  camId,
  badge = null,
  onSave
}) {
  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [position, setPosition] = useState('bottom-left');
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setName(badge?.name || '');
      setSubtitle(badge?.subtitle || '');
      setPosition(badge?.position || 'bottom-left');
      setEnabled(badge?.enabled !== false);
    }
  }, [isOpen, badge, camId]);

  if (!isOpen) return null;

  const handleSave = (e) => {
    if (e) e.preventDefault();
    if (onSave) {
      onSave(camId, {
        name: name.trim(),
        subtitle: subtitle.trim(),
        position,
        enabled: enabled && name.trim().length > 0
      });
    }
    onClose();
  };

  const handleClear = () => {
    setName('');
    setSubtitle('');
    setEnabled(false);
    if (onSave) {
      onSave(camId, {
        name: '',
        subtitle: '',
        position: 'bottom-left',
        enabled: false
      });
    }
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        className="bg-[#0e1118] border border-[#232838] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f2433] bg-gradient-to-r from-orange-950/20 to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
              <Tag size={16} />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-wide text-white uppercase flex items-center gap-2">
                Rótulo de Nombre
                <span className="text-orange-400 font-mono text-xs px-2 py-0.5 rounded bg-orange-950/60 border border-orange-500/30">
                  CAM {camId}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 m-0">
                Identificador personal pegado a la toma (Estilo Restream / Clases)
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/60 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* BODY */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* SWITCH MOSTRAR RÓTULO */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center gap-2.5">
              {enabled ? (
                <Eye size={16} className="text-emerald-400" />
              ) : (
                <EyeOff size={16} className="text-slate-500" />
              )}
              <div>
                <div className="text-xs font-bold text-white">Mostrar Rótulo en Vivo</div>
                <div className="text-[10px] text-slate-400">Visible en Master, grabación y stream</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                enabled ? 'bg-orange-600' : 'bg-slate-800'
              }`}
            >
              <div 
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* NOMBRE */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Nombre de Persona / Dispositivo <span className="text-orange-400">*</span>
            </label>
            <input 
              type="text" 
              placeholder="Ej. Alexandre Pesant / Dra. Sofía / Alumno 1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
              autoFocus
            />
          </div>

          {/* SUBTÍTULO / ROL */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Rol / Título / Materia (Opcional)
            </label>
            <input 
              type="text" 
              placeholder="Ej. Product / Invitado Especial / Conductor"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
            />
            {/* PRESETS RÁPIDOS */}
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {['Invitado', 'Profesor', 'Alumno', 'Conductor', 'Panelista'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setSubtitle(preset)}
                  className="px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                >
                  +{preset}
                </button>
              ))}
            </div>
          </div>

          {/* POSICIÓN EN PANTALLA */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
              <LayoutTemplate size={13} className="text-orange-400" />
              Posición del Rótulo en la Toma
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'bottom-left', label: '↙️ Abajo Izquierda', desc: 'Recomendado (Estilo Restream)' },
                { id: 'bottom-right', label: '↘️ Abajo Derecha', desc: 'Esquina inferior derecha' },
                { id: 'top-left', label: '↖️ Arriba Izquierda', desc: 'Esquina superior izquierda' },
                { id: 'top-right', label: '↗️ Arriba Derecha', desc: 'Esquina superior derecha' }
              ].map((pos) => (
                <button
                  key={pos.id}
                  type="button"
                  onClick={() => setPosition(pos.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    position === pos.id 
                      ? 'bg-orange-950/40 border-orange-500 text-white shadow-sm ring-1 ring-orange-500/30' 
                      : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="text-xs font-black">{pos.label}</div>
                  <div className="text-[9.5px] opacity-70 mt-0.5">{pos.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* PREVISUALIZACIÓN EN TIEMPO REAL */}
          <div className="p-3 bg-black/60 rounded-xl border border-slate-800 relative aspect-video flex items-center justify-center overflow-hidden">
            <span className="text-slate-600 font-mono text-[11px] font-bold select-none">
              ENCUADRE CAM {camId}
            </span>

            {/* BADGE SIMULADO */}
            {name.trim() && enabled && (
              <div 
                className={`absolute p-1.5 px-2.5 rounded-md bg-slate-950/90 border border-white/20 shadow-lg text-left select-none pointer-events-none ${
                  position === 'bottom-left' ? 'bottom-2 left-2' :
                  position === 'bottom-right' ? 'bottom-2 right-2' :
                  position === 'top-left' ? 'top-2 left-2' : 'top-2 right-2'
                }`}
              >
                <div className="text-[11px] font-black text-white leading-tight">
                  {name}
                </div>
                {subtitle.trim() && (
                  <div className="text-[9px] font-medium text-slate-400 leading-tight">
                    {subtitle}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* BOTONES DE ACCIÓN */}
          <div className="flex items-center justify-between pt-2 border-t border-[#1f2433]">
            {badge?.name ? (
              <button
                type="button"
                onClick={handleClear}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-colors flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                Quitar Rótulo
              </button>
            ) : <div />}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 shadow-lg shadow-orange-950/40 transition-all flex items-center gap-1.5"
              >
                <Check size={14} />
                Guardar Rótulo
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
