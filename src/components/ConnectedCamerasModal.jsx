import React, { useState } from 'react';
import { 
  X, 
  Video, 
  Wifi, 
  Smartphone, 
  Usb, 
  Trash2, 
  Power, 
  Check, 
  RefreshCw, 
  AlertCircle,
  Radio,
  ExternalLink
} from 'lucide-react';

export default function ConnectedCamerasModal({
  open,
  onClose,
  camSlots = [],
  cameraMeta = {},
  slotStreams = {},
  savedCameras = [],
  onDisconnectSlot,
  onReconnectCamera,
  onForgetCamera,
  onOpenConnectModal
}) {
  if (!open) return null;

  // Determinar cámaras que están actualmente transmitiendo en vivo en alguna ranura
  const activeCameras = camSlots.map(slotNum => {
    const slotIdx = slotNum - 1;
    const meta = cameraMeta[slotIdx] || cameraMeta[slotNum];
    const stream = slotStreams[slotIdx] || slotStreams[slotNum];
    const hasLiveStream = Boolean(stream && stream.active && stream.getVideoTracks()?.length > 0);
    return {
      slotNum,
      slotIdx,
      meta,
      stream,
      hasLiveStream,
      label: meta?.label || `Cámara ${slotNum}`,
      type: meta?.type || 'usb',
      url: meta?.url || null,
      deviceId: meta?.deviceId || null
    };
  }).filter(c => c.hasLiveStream || c.meta);

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 select-none animate-fadeIn"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        className="bg-[#121319] border border-[#2b2e3e] rounded-2xl w-full max-w-[620px] max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-[#252837] bg-[#0c0d12]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-500/40 flex items-center justify-center">
              <Video size={17} className="text-orange-400" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white tracking-wide">
                Cámaras Conectadas y Guardadas
              </h3>
              <p className="text-[11px] text-gray-400">
                Administra tus cámaras activas, reconéctalas con un clic o elimina su conexión
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-[#252838] transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X size={18} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 [scrollbar-width:thin]">
          
          {/* SECCIÓN 1: CÁMARAS ACTIVAS EN VIVO AHORA MISMO */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                <Radio size={13} className="text-red-500 animate-pulse" />
                Cámaras en Uso al Aire ({activeCameras.length})
              </span>
              <button
                type="button"
                onClick={() => { onClose(); onOpenConnectModal?.(); }}
                className="text-[11px] font-bold text-orange-400 hover:text-orange-300 underline cursor-pointer"
              >
                + Conectar nueva cámara
              </button>
            </div>

            {activeCameras.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#171822] border border-[#262836] text-center text-xs text-gray-400">
                No hay cámaras activas en este momento. Conecta una cámara USB, Wi-Fi o teléfono remoto.
              </div>
            ) : (
              <div className="space-y-2">
                {activeCameras.map(cam => (
                  <div 
                    key={`active-cam-${cam.slotNum}`}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#181a24] border border-[#2b2e3e] hover:border-[#3d4258] transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-[#0e1017] border border-[#303446] flex flex-col items-center justify-center shrink-0">
                        <span className="text-[9px] font-black text-orange-400">CAM</span>
                        <span className="text-sm font-black text-white">{cam.slotNum}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-100 truncate">{cam.label}</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 uppercase tracking-wider">
                            EN VIVO
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5 truncate">
                          {cam.type === 'wifi' ? (
                            <span className="flex items-center gap-1 text-cyan-400"><Wifi size={11} /> Wi-Fi / RTSP</span>
                          ) : cam.type === 'remote' ? (
                            <span className="flex items-center gap-1 text-purple-400"><Smartphone size={11} /> Móvil WebRTC</span>
                          ) : (
                            <span className="flex items-center gap-1 text-amber-400"><Usb size={11} /> USB / Local</span>
                          )}
                          {cam.url && <span className="font-mono text-gray-500 truncate max-w-[200px]">({cam.url})</span>}
                        </div>
                      </div>
                    </div>

                    {/* BOTÓN X PARA DESCONECTAR / LIBERAR RANURA */}
                    <button
                      type="button"
                      onClick={() => onDisconnectSlot(cam.slotIdx)}
                      className="px-2.5 py-1.5 rounded-lg bg-red-950/50 hover:bg-red-600 border border-red-500/50 hover:border-red-400 text-red-300 hover:text-white text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shrink-0"
                      title={`Desconectar señal de CAM ${cam.slotNum} y dejar ranura vacía`}
                    >
                      <X size={14} className="stroke-[2.5]" />
                      <span>Desconectar</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECCIÓN 2: HISTORIAL DE CÁMARAS REGISTRADAS & GUARDADAS */}
          <div className="pt-3 border-t border-[#222533]">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                <Video size={13} className="text-gray-400" />
                Historial de Cámaras Guardadas ({savedCameras.length})
              </span>
              <span className="text-[10px] text-gray-500">
                Quedan guardadas para reutilizarlas sin volver a configurarlas
              </span>
            </div>

            {savedCameras.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#14151e] border border-[#222533] text-center text-xs text-gray-500">
                Aún no hay cámaras guardadas en el historial. Cualquier cámara que conectes quedará registrada aquí automáticamente.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {savedCameras.map(saved => {
                  const isCurrentlyActive = activeCameras.some(
                    ac => (ac.deviceId && ac.deviceId === saved.deviceId) || (ac.url && ac.url === saved.url)
                  );

                  return (
                    <div 
                      key={`saved-cam-${saved.id || saved.url || saved.deviceId}`}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#161720] border border-[#252836] hover:border-[#383c50] transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#1e202c] flex items-center justify-center shrink-0 text-gray-400">
                          {saved.type === 'wifi' ? <Wifi size={14} className="text-cyan-400" /> : saved.type === 'remote' ? <Smartphone size={14} className="text-purple-400" /> : <Usb size={14} className="text-amber-400" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-200 truncate">{saved.name || saved.label || 'Cámara Guardada'}</span>
                            {isCurrentlyActive && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-600/40 font-bold">
                                Conectada
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-500 truncate font-mono">
                            {saved.url || saved.deviceId || saved.type}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* BOTÓN RECONECTAR */}
                        <button
                          type="button"
                          onClick={() => onReconnectCamera(saved)}
                          className="px-2.5 py-1 rounded bg-[#202330] hover:bg-orange-600 border border-[#34384c] hover:border-orange-500 text-gray-300 hover:text-white text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                          title="Conectar esta cámara en una ranura libre"
                        >
                          <RefreshCw size={11} />
                          <span>Reconectar</span>
                        </button>

                        {/* BOTÓN X PARA ELIMINAR / OLVIDAR CÁMARA */}
                        <button
                          type="button"
                          onClick={() => onForgetCamera(saved.id || saved.url || saved.deviceId)}
                          className="p-1.5 rounded bg-[#201515] hover:bg-red-700 border border-red-900/50 hover:border-red-500 text-red-400 hover:text-white transition-all cursor-pointer"
                          title="Eliminar y olvidar esta cámara del registro permanente"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* FOOTER */}
        <div className="px-5 py-3 border-t border-[#252837] bg-[#0c0d12] flex justify-between items-center">
          <span className="text-[11px] text-gray-500">
            PodcaStudio recuerda automáticamente tus cámaras Wi-Fi, Steren, GoPro y USB.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#202330] hover:bg-[#2c3044] text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
