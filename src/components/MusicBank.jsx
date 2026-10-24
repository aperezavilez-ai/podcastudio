import React, { useMemo, useState } from 'react'
import { 
  Play, Pause, Square, Music, Wand2, Sparkles, Loader2, 
  Volume2, VolumeX, Filter, Disc, CircleSlash, AlertCircle, Zap 
} from 'lucide-react'
import { MUSIC_GENRES, SFX_CATEGORIES } from '../config/musicTracks.js'
import styles from './MusicBank.module.css'

export default function MusicBank({
  tracks,
  sfxList,
  currentTrack,
  playing,
  loading,
  error,
  volume,
  onVolumeChange,
  duckingEnabled = true,
  onToggleDucking,
  onSelectTrack,
  onTogglePlay,
  onPlaySfx,
  playingSfxId,
  sfxError,
  podcastGenre,
}) {
  const [tab, setTab] = useState('songs')
  const [genreFilter, setGenreFilter] = useState('all')
  const [sfxFilter, setSfxFilter] = useState('all')

  const filteredTracks = useMemo(() => {
    if (genreFilter === 'all') return tracks
    return tracks.filter((t) => t.genre === genreFilter)
  }, [tracks, genreFilter])

  const filteredSfx = useMemo(() => {
    if (sfxFilter === 'all') return sfxList
    return sfxList.filter((s) => s.category === sfxFilter)
  }, [sfxList, sfxFilter])

  const genreOptions = useMemo(() => {
    const used = new Set(tracks.map((t) => t.genre))
    return ['all', ...Object.keys(MUSIC_GENRES).filter((g) => used.has(g))]
  }, [tracks])

  const sfxOptions = useMemo(() => {
    const used = new Set(sfxList.map((s) => s.category))
    return ['all', ...Object.keys(SFX_CATEGORIES).filter((c) => used.has(c))]
  }, [sfxList])

  return (
    <div className={styles.bank}>
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'songs' ? styles.tabActive : ''}`}
          onClick={() => setTab('songs')}
        >
          <Music size={13} style={{ marginRight: 5 }} /> Canciones
        </button>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'sfx' ? styles.tabActive : ''}`}
          onClick={() => setTab('sfx')}
        >
          <Sparkles size={13} style={{ marginRight: 5 }} /> Efectos
        </button>
      </div>

      {tab === 'songs' && (
        <>
          <div className={styles.nowPlaying}>
            <div className={`${styles.nowIcon} ${playing ? styles.nowIconActive : ''}`}>
              {loading ? (
                <Loader2 size={16} className="animate-spin text-orange-400" />
              ) : (
                <Music size={16} className={playing ? "text-emerald-400" : "text-gray-400"} />
              )}
            </div>
            <div className={styles.nowInfo}>
              <div className={styles.nowTitle}>{currentTrack?.name}</div>
              <div className={styles.nowSub}>
                {podcastGenre && `${MUSIC_GENRES[podcastGenre] || podcastGenre} · `}
                {playing ? 'Reproduciendo fondo…' : error || currentTrack?.sub}
              </div>
            </div>
            {/* BOTÓN PLAY / PAUSE CON DIBUJO SVG NÍTIDO */}
            <button 
              type="button" 
              className={styles.iconBtn} 
              onClick={onTogglePlay} 
              title={playing ? 'Pausar música' : 'Reproducir música'}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: playing ? '#4ade80' : '#ea580c',
                border: playing ? '1px solid rgba(74, 222, 128, 0.4)' : '1px solid rgba(234, 88, 12, 0.4)',
                background: playing ? 'rgba(74, 222, 128, 0.15)' : 'rgba(234, 88, 12, 0.15)',
              }}
            >
              {playing ? (
                <Pause size={17} fill="currentColor" strokeWidth={0} />
              ) : (
                <Play size={17} fill="currentColor" strokeWidth={0} style={{ marginLeft: 2 }} />
              )}
            </button>
          </div>

          <div className={styles.filterRow}>
            <Filter size={13} style={{ color: '#888' }} />
            <select value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)} aria-label="Filtrar por género">
              <option value="all">Todos los géneros</option>
              {genreOptions.filter((g) => g !== 'all').map((g) => (
                <option key={g} value={g}>{MUSIC_GENRES[g]}</option>
              ))}
            </select>
          </div>

          <div className={styles.list}>
            {filteredTracks.map((track) => {
              const active = currentTrack?.id === track.id
              return (
                <button
                  key={track.id}
                  type="button"
                  className={`${styles.item} ${active ? styles.itemActive : ''}`}
                  onClick={() => onSelectTrack(track.id, true)}
                >
                  <span className={styles.itemIcon}>
                    {active && playing ? (
                      <Volume2 size={16} className="text-emerald-400" />
                    ) : (
                      <Disc size={16} className={active ? "text-orange-400" : "text-gray-500"} />
                    )}
                  </span>
                  <span className={styles.itemText}>
                    <strong>{track.name}</strong>
                    <span>{track.sub} · {MUSIC_GENRES[track.genre] || track.genre}</span>
                  </span>
                  {active && <span className={styles.itemBadge}>Activa</span>}
                </button>
              )
            })}
          </div>

          <div className={styles.volumeRow}>
            <Volume2 size={15} style={{ color: '#888' }} />
            <input type="range" min={0} max={100} step={1} value={volume} onChange={(e) => onVolumeChange(+e.target.value)} />
            <span>{volume}%</span>
          </div>

          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              type="button"
              onClick={onToggleDucking}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                border: duckingEnabled ? '1px solid rgba(232, 97, 42, 0.4)' : '1px solid var(--border, #2a2a35)',
                background: duckingEnabled ? 'rgba(232, 97, 42, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                color: duckingEnabled ? '#f97316' : 'var(--text-secondary, #94a3b8)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title="Atenúa la música automáticamente mientras el conductor habla para que la voz se entienda nítida"
            >
              {duckingEnabled ? <Wand2 size={13} /> : <CircleSlash size={13} />}
              <span>Auto-Ducking de voz {duckingEnabled ? 'ON (-12dB)' : 'OFF'}</span>
            </button>
            <span style={{ fontSize: 10, color: 'var(--text-muted, #64748b)' }}>
              {duckingEnabled ? 'Baja con la voz' : 'Volumen fijo'}
            </span>
          </div>
        </>
      )}

      {tab === 'sfx' && (
        <>
          <p className={styles.sfxHint}>
            Aplausos, risas, ovaciones, choques, autos y más. Clic para preescuchar en el estudio.
          </p>

          <div className={styles.filterRow}>
            <Filter size={13} style={{ color: '#888' }} />
            <select value={sfxFilter} onChange={(e) => setSfxFilter(e.target.value)} aria-label="Filtrar efectos">
              <option value="all">Todos los efectos</option>
              {sfxOptions.filter((c) => c !== 'all').map((c) => (
                <option key={c} value={c}>{SFX_CATEGORIES[c]}</option>
              ))}
            </select>
          </div>

          {sfxError && (
            <div className={styles.sfxError}>
              <AlertCircle size={14} style={{ marginRight: 4 }} /> {sfxError}
            </div>
          )}

          <div className={styles.list}>
            {filteredSfx.map((sfx) => {
              const playingThis = playingSfxId === sfx.id
              return (
                <button
                  key={sfx.id}
                  type="button"
                  className={`${styles.item} ${styles.itemSfx} ${playingThis ? styles.itemPlaying : ''}`}
                  onClick={() => onPlaySfx(sfx)}
                >
                  <span className={styles.itemIcon}>
                    {playingThis ? (
                      <Loader2 size={15} className="animate-spin text-orange-400" />
                    ) : (
                      <Zap size={15} className="text-yellow-400" />
                    )}
                  </span>
                  <span className={styles.itemText}>
                    <strong>{sfx.name}</strong>
                    <span>{sfx.sub} · {SFX_CATEGORIES[sfx.category]}</span>
                  </span>
                  <span className={styles.previewLabel}>{playingThis ? 'Sonando…' : 'Escuchar'}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
