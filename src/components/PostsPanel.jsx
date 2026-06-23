import React, { useState } from 'react'
import { useAI } from '../hooks/useAI.js'
import { incrementAiPostCount } from '../lib/aiUsage.js'
import styles from './PostsPanel.module.css'

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: 'ti-brand-instagram', color: '#993556' },
  { id: 'tiktok', label: 'TikTok', icon: 'ti-brand-tiktok', color: '#ccccdd' },
  { id: 'facebook', label: 'Facebook', icon: 'ti-brand-facebook', color: '#4a90d9' },
  { id: 'youtube', label: 'YouTube', icon: 'ti-brand-youtube', color: '#e05050' },
]

export default function PostsPanel({ project, user, postsRemaining, onLimitReached, onPostsGenerated }) {
  const { generatePosts, loadingPosts, posts, error } = useAI()
  const [form, setForm] = useState({
    podcast: project?.name || '',
    topic: project?.episodeTitle || '',
    guest: project?.guestName || '',
    role: project?.guestRole || '',
    description: '',
    platforms: ['instagram', 'tiktok'],
  })
  const [copied, setCopied] = useState({})

  const togglePlatform = (id) => {
    setForm(f => ({
      ...f,
      platforms: f.platforms.includes(id) ? f.platforms.filter(p => p !== id) : [...f.platforms, id]
    }))
  }

  const handleGenerate = async () => {
    if (!form.topic) return
    if (postsRemaining === 0) {
      onLimitReached?.()
      return
    }
    const result = await generatePosts(form)
    if (result && user?.id) {
      incrementAiPostCount(user.id)
      onPostsGenerated?.()
    }
  }

  const copyPost = (id) => {
    const p = posts[id]
    const text = p.post + '\n\n' + (p.hashtags || []).join(' ')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(c => ({ ...c, [id]: true }))
      setTimeout(() => setCopied(c => ({ ...c, [id]: false })), 2000)
    })
  }

  return (
    <div className={styles.panel}>
      <div className={styles.formSection}>
        <div className={styles.sectionTitle}><i className="ti ti-sparkles" /> Generar posts con IA</div>
        {postsRemaining != null && (
          <p className={styles.limitHint}>
            {postsRemaining > 0
              ? `${postsRemaining} generaciones restantes este mes (plan Starter).`
              : 'Límite mensual alcanzado. Mejora a Pro para posts ilimitados.'}
          </p>
        )}
        <div className={styles.field}>
          <label>Podcast</label>
          <input value={form.podcast} onChange={e => setForm(f => ({ ...f, podcast: e.target.value }))} placeholder="Nombre del podcast" />
        </div>
        <div className={styles.field}>
          <label>Tema del episodio</label>
          <input value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} placeholder="Ej: IA en LATAM" />
        </div>
        <div className={styles.field}>
          <label>Invitado</label>
          <input value={form.guest} onChange={e => setForm(f => ({ ...f, guest: e.target.value }))} placeholder="Nombre del invitado" />
        </div>
        <div className={styles.field}>
          <label>Descripción breve</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="De qué habló el episodio..." rows={3} />
        </div>
        <div className={styles.field}>
          <label>Publicar en</label>
          <div className={styles.platRow}>
            {PLATFORMS.map(p => (
              <button key={p.id}
                className={`${styles.platChip} ${form.platforms.includes(p.id) ? styles.platActive : ''}`}
                onClick={() => togglePlatform(p.id)}
                style={form.platforms.includes(p.id) ? { borderColor: p.color + '80', color: p.color } : {}}
              >
                <i className={`ti ${p.icon}`} style={{ fontSize: 12 }} />
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {error && <div className={styles.errorMsg}><i className="ti ti-alert-circle" /> {error}</div>}
        <button className={styles.genBtn} onClick={handleGenerate} disabled={loadingPosts || !form.topic || postsRemaining === 0}>
          {loadingPosts
            ? <><i className="ti ti-loader" style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }} /> Generando...</>
            : <><i className="ti ti-sparkles" /> Generar posts y hashtags</>
          }
        </button>
      </div>

      {posts && (
        <div className={styles.results}>
          {PLATFORMS.filter(p => posts[p.id] && form.platforms.includes(p.id)).map(p => (
            <div key={p.id} className={styles.resultCard}>
              <div className={styles.rcHead}>
                <div className={styles.rcPlat} style={{ color: p.color }}>
                  <i className={`ti ${p.icon}`} style={{ fontSize: 14 }} />
                  {p.label}
                </div>
                <button className={styles.copyBtn} onClick={() => copyPost(p.id)}>
                  {copied[p.id] ? <><i className="ti ti-check" /> Copiado</> : <><i className="ti ti-copy" /> Copiar</>}
                </button>
              </div>
              <div className={styles.rcText}>{posts[p.id]?.post}</div>
              <div className={styles.rcTags}>
                {(posts[p.id]?.hashtags || []).map(h => (
                  <span key={h} className={styles.tag}>{h}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!posts && !loadingPosts && (
        <div className={styles.empty}>
          <i className="ti ti-sparkles" style={{ fontSize: 32, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }} />
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Completa el formulario y genera tus posts virales</div>
        </div>
      )}
    </div>
  )
}
