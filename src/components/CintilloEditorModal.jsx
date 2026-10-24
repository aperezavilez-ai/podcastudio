import React, { useState, useEffect } from 'react'
import { Type, X, Palette, Sparkles, Upload, Bot, Edit3, Radio, Save, Loader2 } from 'lucide-react'
import CintilloOverlay from './CintilloOverlay.jsx'
import { CINTILLO_STYLES } from '../config/cintilloStyles.js'
import styles from './CintilloEditorModal.module.css'

const QUICK_COLORS = [
  { label: 'Naranja Podcast', val: '#e8612a' },
  { label: 'Azul Meta', val: '#1877f2' },
  { label: 'Cyan Cyber', val: '#00f2fe' },
  { label: 'Rojo Breaking', val: '#ef4444' },
  { label: 'Oro VIP', val: '#fbbf24' },
  { label: 'Púrpura Neón', val: '#a855f7' },
  { label: 'Esmeralda', val: '#10b981' },
]

const QUICK_TAGS = [
  'HOST',
  'INVITADO ESPECIAL',
  'ESPECIALISTA',
  'TEMA CLAVE',
  'PREGUNTA AL AIRE',
  'REDES SOCIALES',
  'DATO CURIOSO',
  'EXCLUSIVO',
]

/**
 * Generador Inteligente Broadcast de Respaldo
 * Asegura que NUNCA falle la generación incluso si la API de IA está lenta o sin saldo.
 */
function generateBroadcastProposals({ topic, guest, role }) {
  const g = (guest || '').trim() || 'Invitado Especial'
  const r = (role || '').trim() || 'Especialista'
  const t = (topic || '').trim() || 'Tendencias y Claves del Futuro'

  return [
    {
      id: `prop_${Date.now()}_1`,
      tag: 'INVITADO ESPECIAL',
      text: g,
      subtitle: `${r} · En entrevista exclusiva`,
      color: '#1877f2',
      styleId: 'glass',
    },
    {
      id: `prop_${Date.now()}_2`,
      tag: 'TEMA DE HOY',
      text: t,
      subtitle: `Análisis a fondo con ${g}`,
      color: '#e8612a',
      styleId: 'news',
    },
    {
      id: `prop_${Date.now()}_3`,
      tag: 'PREGUNTA AL AIRE',
      text: `¿Cuál es el mayor reto para ${r.toLowerCase()}s?`,
      subtitle: `Envía tus comentarios en vivo en los comentarios`,
      color: '#00f2fe',
      styleId: 'cyber',
    },
    {
      id: `prop_${Date.now()}_4`,
      tag: 'REDES SOCIALES',
      text: `@${g.toLowerCase().replace(/\s+/g, '_')}`,
      subtitle: `Sigue el contenido oficial y proyectos`,
      color: '#fbbf24',
      styleId: 'metallic',
    },
  ]
}

export default function CintilloEditorModal({
  open,
  onClose,
  onApplyLive,
  onSaveCustom,
  initialData = null,
  project = {},
  aiGenerator = null,
}) {
  const [activeTab, setActiveTab] = useState('editor') // 'editor' | 'ai'

  // Campos del editor
  const [tag, setTag] = useState('INVITADO ESPECIAL')
  const [text, setText] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [color, setColor] = useState('#e8612a')
  const [styleId, setStyleId] = useState('glass')
  const [logoUrl, setLogoUrl] = useState(null)

  // Campos del asistente IA
  const [aiTopic, setAiTopic] = useState('')
  const [aiGuest, setAiGuest] = useState('')
  const [aiRole, setAiRole] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiProposals, setAiProposals] = useState([])

  useEffect(() => {
    if (initialData) {
      setTag(initialData.tag || 'INVITADO ESPECIAL')
      setText(initialData.text || '')
      setSubtitle(initialData.subtitle || '')
      setColor(initialData.color || '#e8612a')
      setStyleId(initialData.styleId || 'glass')
      setLogoUrl(initialData.logoUrl || null)
    } else {
      setTag('INVITADO ESPECIAL')
      setText(project.guestName || '')
      setSubtitle(project.guestRole ? `${project.guestRole} · @redes` : '')
      setColor('#1877f2')
      setStyleId('glass')
      setLogoUrl(null)
    }

    setAiTopic(project.episodeTitle || '')
    setAiGuest(project.guestName || '')
    setAiRole(project.guestRole || '')
    setAiProposals([])
  }, [open, initialData, project])

  if (!open) return null

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const url = event.target?.result
      if (url) setLogoUrl(url)
    }
    reader.readAsDataURL(file)
  }

  const handleGenerateWithAI = async () => {
    setAiGenerating(true)
    try {
      // 1. Si existe generador con IA externo, se intenta
      let customAiText = null
      if (aiGenerator) {
        customAiText = await aiGenerator({
          topic: aiTopic,
          guest: aiGuest,
          role: aiRole,
          type: 'guest',
        })
      }

      // 2. Generar el set de 4 propuestas broadcast
      const proposals = generateBroadcastProposals({
        topic: aiTopic,
        guest: aiGuest,
        role: aiRole,
      })

      if (customAiText && customAiText.trim()) {
        proposals[0].text = customAiText.trim()
      }

      setAiProposals(proposals)
    } catch (err) {
      console.warn('Fallback a propuestas locales:', err)
      setAiProposals(generateBroadcastProposals({ topic: aiTopic, guest: aiGuest, role: aiRole }))
    } finally {
      setAiGenerating(false)
    }
  }

  const handleSelectProposal = (p, autoLaunch = false) => {
    setTag(p.tag)
    setText(p.text)
    setSubtitle(p.subtitle)
    setColor(p.color)
    setStyleId(p.styleId)
    setActiveTab('editor')

    if (autoLaunch) {
      onApplyLive({
        tag: p.tag,
        text: p.text,
        subtitle: p.subtitle,
        color: p.color,
        styleId: p.styleId,
        logoUrl,
      })
      onClose()
    }
  }

  const handleSave = () => {
    if (!text.trim()) return
    const data = {
      id: initialData?.id || `cint_${Date.now()}`,
      label: `${tag}: ${text.slice(0, 20)}`,
      tag,
      text: text.trim(),
      subtitle: subtitle.trim(),
      color,
      styleId,
      logoUrl,
      isCustom: true,
    }
    onSaveCustom(data)
    onClose()
  }

  const handleLaunchLive = () => {
    if (!text.trim()) return
    const data = {
      tag,
      text: text.trim(),
      subtitle: subtitle.trim(),
      color,
      styleId,
      logoUrl,
    }
    onApplyLive(data)
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <div className={styles.headerIcon}>
              <Type size={18} />
            </div>
            <div>
              <h2 className={styles.title}>Cintillos Profesionales Broadcast</h2>
              <p className={styles.subtitle}>
                Diseño translúcido con barrido de luz, logotipo 3D y edición para invitados.
              </p>
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* TABS */}
        <div className={styles.tabsRow}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'editor' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('editor')}
          >
            <Palette size={14} style={{ marginRight: 6 }} />
            <span>Diseñar Cintillo</span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'ai' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            <Sparkles size={14} style={{ marginRight: 6, color: 'var(--accent)' }} />
            <span>Generar con IA</span>
          </button>
        </div>

        {/* CONTENIDO TAB 1: EDITOR */}
        {activeTab === 'editor' && (
          <div className={styles.body}>
            {/* VISTA PREVIA EN VIVO */}
            <div className={styles.previewStage}>
              <div className={styles.previewStageLabel}>VISTA PREVIA AL AIRE (TRANSLÚCIDO):</div>
              <div className={styles.previewStageViewport}>
                <div className={styles.previewFauxBackground} />
                <CintilloOverlay
                  styleId={styleId}
                  tag={tag}
                  text={text || 'Nombre del Invitado'}
                  subtitle={subtitle || 'Especialista · @usuario'}
                  accentColor={color}
                  logoUrl={logoUrl}
                  position="bc"
                  format="16:9"
                  preview
                />
              </div>
            </div>

            {/* FORMULARIO */}
            <div className={styles.formGrid}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Categoría / Tag:</label>
                <div className={styles.quickTags}>
                  {QUICK_TAGS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`${styles.quickTagBtn} ${tag === t ? styles.quickTagActive : ''}`}
                      onClick={() => setTag(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.fieldGroup} style={{ flex: 1.2 }}>
                  <label className={styles.label}>Texto Principal (Nombre o Titular):</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Ej. Dra. Sofía Morales / Claves del Éxito..."
                  />
                </div>

                <div className={styles.fieldGroup} style={{ flex: 1 }}>
                  <label className={styles.label}>Bajada / Red Social / Cargo:</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="Ej. @sofiamorales_md / Neurocirujana"
                  />
                </div>
              </div>

              {/* LOGO 3D Y COLOR */}
              <div className={styles.fieldRow}>
                <div className={styles.fieldGroup} style={{ flex: 1 }}>
                  <label className={styles.label}>Logotipo o Foto de Invitado (Efecto 3D):</label>
                  <div className={styles.logoRow}>
                    {logoUrl ? (
                      <div className={styles.logoThumbWrap}>
                        <img src={logoUrl} alt="Logo" className={styles.logoThumb} />
                        <button type="button" className={styles.removeLogoBtn} onClick={() => setLogoUrl(null)}>
                          <X size={12} style={{ marginRight: 4 }} /> Quitar
                        </button>
                      </div>
                    ) : (
                      <label className={styles.uploadBtn}>
                        <Upload size={14} style={{ marginRight: 6 }} />
                        Subir PNG / Foto
                        <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                      </label>
                    )}
                  </div>
                </div>

                <div className={styles.fieldGroup} style={{ flex: 1.2 }}>
                  <label className={styles.label}>Color de Acento:</label>
                  <div className={styles.colorPills}>
                    {QUICK_COLORS.map((c) => (
                      <button
                        key={c.val}
                        type="button"
                        className={`${styles.colorPill} ${color === c.val ? styles.colorPillActive : ''}`}
                        style={{ background: c.val }}
                        onClick={() => setColor(c.val)}
                        title={c.label}
                      />
                    ))}
                    <input
                      type="color"
                      className={styles.colorPickerInput}
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      title="Color personalizado"
                    />
                  </div>
                </div>
              </div>

              {/* SELECTOR DE ESTILO */}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Estilo Visual Broadcast:</label>
                <div className={styles.styleCards}>
                  {CINTILLO_STYLES.slice(0, 6).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      className={`${styles.styleCard} ${styleId === st.id ? styles.styleCardActive : ''}`}
                      onClick={() => setStyleId(st.id)}
                    >
                      <span className={styles.styleCardTitle}>{st.name}</span>
                      <span className={styles.styleCardDesc}>{st.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CONTENIDO TAB 2: ASISTENTE IA */}
        {activeTab === 'ai' && (
          <div className={styles.body}>
            <div className={styles.aiHeader}>
              <Bot size={24} style={{ color: 'var(--accent)' }} />
              <div>
                <strong style={{ display: 'block', fontSize: 13, color: '#fff' }}>
                  Generador de Cintillos Broadcast con IA
                </strong>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Ingresa los datos de tu episodio y la IA generará 4 propuestas redactadas para televisión listas para el aire.
                </span>
              </div>
            </div>

            <div className={styles.aiFormRow}>
              <div className={styles.fieldGroup} style={{ flex: 1.2 }}>
                <label className={styles.label}>Tema o Pregunta Clave del Episodio:</label>
                <input
                  type="text"
                  className={styles.input}
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="Ej. Inteligencia Artificial en la Medicina / Negocios 2026"
                />
              </div>

              <div className={styles.fieldGroup} style={{ flex: 1 }}>
                <label className={styles.label}>Nombre del Invitado:</label>
                <input
                  type="text"
                  className={styles.input}
                  value={aiGuest}
                  onChange={(e) => setAiGuest(e.target.value)}
                  placeholder="Ej. Dra. Sofía Morales"
                />
              </div>

              <div className={styles.fieldGroup} style={{ flex: 1 }}>
                <label className={styles.label}>Cargo / Red Social:</label>
                <input
                  type="text"
                  className={styles.input}
                  value={aiRole}
                  onChange={(e) => setAiRole(e.target.value)}
                  placeholder="Ej. Neurocirujana · @sofia_md"
                />
              </div>
            </div>

            <button
              type="button"
              className={styles.generateAiBtn}
              onClick={handleGenerateWithAI}
              disabled={aiGenerating}
            >
              {aiGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              <span>{aiGenerating ? 'Generando propuestas...' : '✨ Generar Propuestas Broadcast'}</span>
            </button>

            {/* PROPUESTAS GENERADAS */}
            {aiProposals.length > 0 && (
              <div className={styles.proposalsList}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginTop: 8 }}>
                  Propuestas listas para usar:
                </div>
                {aiProposals.map((prop) => (
                  <div key={prop.id} className={styles.proposalCard}>
                    <div className={styles.propLeft}>
                      <span className={styles.propTag} style={{ background: `${prop.color}22`, color: prop.color, borderColor: `${prop.color}55` }}>
                        {prop.tag}
                      </span>
                      <strong className={styles.propText}>{prop.text}</strong>
                      <span className={styles.propSub}>{prop.subtitle}</span>
                    </div>

                    <div className={styles.propActions}>
                      <button
                        type="button"
                        className={styles.propEditBtn}
                        onClick={() => handleSelectProposal(prop, false)}
                        title="Personalizar colores o logo"
                      >
                        <Edit3 size={13} style={{ marginRight: 4 }} /> Editar
                      </button>
                      <button
                        type="button"
                        className={styles.propLaunchBtn}
                        onClick={() => handleSelectProposal(prop, true)}
                        title="Lanzar inmediatamente a pantalla Master"
                      >
                        <Radio size={13} style={{ marginRight: 4 }} /> Al Aire
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* FOOTER ACTIONS */}
        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancelar
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={styles.saveBtn}
              onClick={handleSave}
              disabled={!text.trim()}
            >
              <Save size={14} style={{ marginRight: 5 }} /> Guardar en Lista
            </button>
            <button
              type="button"
              className={styles.launchBtn}
              onClick={handleLaunchLive}
              disabled={!text.trim()}
            >
              <Radio size={14} style={{ marginRight: 5 }} /> 🔴 Lanzar al Aire (Master)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
