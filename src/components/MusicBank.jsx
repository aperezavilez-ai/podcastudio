import React, { useMemo, useState } from 'react'
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
          <i className="ti ti-music" /> Canciones
        </button>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'sfx' ? styles.tabActive : ''}`}
          onClick={() => setTab('sfx')}
        >
          <i className="ti ti-wand" /> Efectos
        </button>
      </div>

      {tab === 'songs' && (
        <>
          <div className={styles.nowPlaying}>
            <div className={`${styles.nowIcon} ${playing ? styles.nowIconActive : ''}`}>
              <i className={`ti ${loading ? 'ti-loader' : 'ti-music'}`} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            </div>
            <div className={styles.nowInfo}>
              <div className={styles.nowTitle}>{currentTrack?.name}</div>
              <div className={styles.nowSub}>
                {podcastGenre && `${MUSIC_GENRES[podcastGenre] || podcastGenre} · `}
                {playing ? 'Reproduciendo fondo…' : error || currentTrack?.sub}
              </div>
            </div>
            <button type="button" className={styles.iconBtn} onClick={onTogglePlay} title={playing ? 'Pausar' : 'Reproducir fondo'}>
              <i className={`ti ${playing ? 'ti-player-pause' : 'ti-player-play'}`} />
            </button>
          </div>

          <div className={styles.filterRow}>
            <i className="ti ti-filter" />
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
                    <i className={`ti ${active && playing ? 'ti-volume' : 'ti-disc'}`} />
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
            <i className="ti ti-volume" />
            <input type="range" min={0} max={100} step={1} value={volume} onChange={(e) => onVolumeChange(+e.target.value)} />
            <span>{volume}%</span>
          </div>
        </>
      )}

      {tab === 'sfx' && (
        <>
          <p className={styles.sfxHint}>
            Aplausos, risas, ovaciones, choques, autos y más. Clic para preescuchar en el estudio.
          </p>

          <div className={styles.filterRow}>
            <i className="ti ti-filter" />
            <select value={sfxFilter} onChange={(e) => setSfxFilter(e.target.value)} aria-label="Filtrar efectos">
              <option value="all">Todos los efectos</option>
              {sfxOptions.filter((c) => c !== 'all').map((c) => (
                <option key={c} value={c}>{SFX_CATEGORIES[c]}</option>
              ))}
            </select>
          </div>

          {sfxError && (
            <div className={styles.sfxError}><i className="ti ti-alert-circle" /> {sfxError}</div>
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
                    <i className={`ti ${playingThis ? 'ti-loader' : 'ti-bolt'}`} style={playingThis ? { animation: 'spin 1s linear infinite' } : {}} />
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
