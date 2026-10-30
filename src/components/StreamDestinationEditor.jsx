import { useEffect, useState } from 'react';

export default function StreamDestinationEditor({ destinationId, config, active, onCommit, onToggle, showKey, onToggleKey }) {
  const [server, setServer] = useState(config.server || '');
  const [key, setKey] = useState(config.key || '');

  useEffect(() => setServer(config.server || ''), [config.server]);
  useEffect(() => setKey(config.key || ''), [config.key]);

  if (!active) return null;

  return (
    <div className="border border-[#2a2b30] rounded-lg p-5 bg-[#161920]">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-md font-bold text-white capitalize">{destinationId === 'custom' ? 'RTMP Personalizado' : `${destinationId} Live`}</h3>
        <button type="button" onClick={onToggle} className={`px-3 py-1 rounded-full text-xs font-bold ${config.enabled ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
          {config.enabled ? 'Destino habilitado' : 'Destino deshabilitado'}
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-[11px] font-bold text-gray-400 mb-1 block">URL del Servidor RTMP / RTMPS:</label>
          <input
            type="url"
            autoComplete="url"
            value={server}
            onChange={(event) => setServer(event.target.value)}
            onBlur={() => onCommit('server', server)}
            className="w-full bg-[#0a0c10] border border-[#333] rounded p-2 text-xs text-white outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="text-[11px] font-bold text-gray-400 mb-1 flex justify-between">
            <span>Clave de Transmisión (Stream Key):</span>
            <button type="button" onClick={onToggleKey} className="text-gray-500 hover:text-white">{showKey ? 'Ocultar' : 'Mostrar'}</button>
          </label>
          <input
            type={showKey ? 'text' : 'password'}
            autoComplete="new-password"
            spellCheck="false"
            placeholder="Pega aquí tu Stream Key secreta..."
            value={key}
            onChange={(event) => setKey(event.target.value)}
            onBlur={() => onCommit('key', key)}
            className="w-full bg-[#0a0c10] border border-[#333] rounded p-2 text-xs text-white outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="mt-4 p-3 bg-[#0a0c10] border border-[#222] rounded text-[10px] text-gray-400 leading-relaxed">
        {destinationId === 'facebook'
          ? 'En Meta Business Suite > Live Producer, copia la URL RTMPS y la clave de transmisión activa.'
          : destinationId === 'youtube'
            ? 'En YouTube Studio > Emitir en directo, copia la clave de emisión activa.'
            : destinationId === 'tiktok'
              ? 'Usa la URL RTMP y la clave disponibles en TikTok Live Studio o en el Centro de Creadores Live.'
              : 'Compatible con plataformas que proporcionan una URL RTMP o RTMPS y una clave de publicación.'}
      </div>
    </div>
  );
}
