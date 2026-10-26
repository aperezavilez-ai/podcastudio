import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, Users, Tv, GraduationCap, Radio, LayoutGrid, Check, ChevronDown, Sparkles 
} from 'lucide-react';
import { WORKSPACES } from '../config/workspaces.js';

const ICON_MAP = {
  Mic,
  Users,
  Tv,
  GraduationCap,
  Radio,
  LayoutGrid
};

export default function WorkspaceSelector({ currentWorkspaceId, onSelectWorkspace }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const currentWorkspace = WORKSPACES.find(w => w.id === currentWorkspaceId) || WORKSPACES[0];
  const CurrentIcon = ICON_MAP[currentWorkspace.icon] || Mic;

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* Botón Principal del Selector */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#14151a] hover:bg-[#1c1d24] text-white border border-[#2a2c38] transition-all cursor-pointer shadow-sm group"
        title="Cambiar Espacio de Trabajo (Workspace): Adapta layouts, cámaras y paneles según el tipo de programa"
      >
        <span 
          className="w-2.5 h-2.5 rounded-full animate-pulse"
          style={{ backgroundColor: currentWorkspace.accentColor }}
        />
        <CurrentIcon size={14} className="text-gray-300 group-hover:text-white" />
        <span className="font-bold text-xs tracking-wide">
          {currentWorkspace.shortName}
        </span>
        <span className="hidden lg:inline text-[10px] text-gray-400 bg-[#20222c] px-1.5 py-0.5 rounded font-medium border border-[#2f3242]">
          {currentWorkspace.badge}
        </span>
        <ChevronDown 
          size={13} 
          className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-white' : ''}`} 
        />
      </button>

      {/* Menú Desplegable de Espacios de Trabajo */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 rounded-xl bg-[#111217] border border-[#262836] shadow-2xl z-50 overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          <div className="p-3 border-b border-[#20222e] bg-[#161720]/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-orange-400" />
              <span className="text-xs font-black uppercase tracking-wider text-gray-200">
                Espacios de Producción
              </span>
            </div>
            <span className="text-[10px] font-semibold text-gray-400">
              Fase P1.1
            </span>
          </div>

          <div className="p-2 space-y-1 max-h-[420px] overflow-y-auto custom-scrollbar">
            {WORKSPACES.map((ws) => {
              const Icon = ICON_MAP[ws.icon] || Mic;
              const isSelected = ws.id === currentWorkspace.id;

              return (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => {
                    onSelectWorkspace(ws);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-lg transition-all flex items-start gap-3 cursor-pointer border ${
                    isSelected
                      ? 'bg-[#1e202c] border-orange-500/50 shadow-md'
                      : 'bg-transparent hover:bg-[#181922] border-transparent hover:border-[#2a2c3a]'
                  }`}
                >
                  <div 
                    className="p-2 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ 
                      backgroundColor: isSelected ? `${ws.accentColor}25` : '#1c1e28',
                      color: isSelected ? ws.accentColor : '#9ca3af'
                    }}
                  >
                    <Icon size={16} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                        {ws.name}
                      </span>
                      {isSelected ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-orange-400 shrink-0">
                          <Check size={12} /> Activo
                        </span>
                      ) : (
                        <span className="text-[9px] font-semibold text-gray-400 bg-[#181924] px-1.5 py-0.5 rounded shrink-0 border border-[#2a2c3a]">
                          {ws.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 leading-snug line-clamp-2">
                      {ws.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="p-2.5 bg-[#0d0e13] border-t border-[#1f212c] text-[10px] text-gray-400 text-center">
            Cambiar de espacio ajusta cámaras y controles sin interrumpir la grabación ni el stream.
          </div>
        </div>
      )}
    </div>
  );
}
