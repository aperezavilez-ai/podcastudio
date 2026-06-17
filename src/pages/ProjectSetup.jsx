import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import CintilloOverlay from '../components/CintilloOverlay.jsx'
import CintilloStylePicker from '../components/CintilloStylePicker.jsx'
import BackgroundPicker from '../components/BackgroundPicker.jsx'
import SetBackground from '../components/SetBackground.jsx'
import { getCintilloStyle } from '../config/cintilloStyles.js'
import { getBackgroundTemplate } from '../config/backgroundTemplates.js'
import { CINTILLO_SETUP_TYPES } from '../config/cintilloPresets.js'
import { saveProject } from '../lib/projects.js'

const CINTILLO_POSITIONS = [
  { id: 'bl', label: 'Abajo izquierda' },
  { id: 'bc', label: 'Abajo centro' },
  { id: 'br', label: 'Abajo derecha' },
]

const LOGO_POSITIONS = [
  { id: 'tl', icon: 'ti-arrow-up-left', label: 'Arriba izquierda' },
  { id: 'tc', icon: 'ti-arrow-up', label: 'Arriba centro' },
  { id: 'tr', icon: 'ti-arrow-up-right', label: 'Arriba derecha' },
  { id: 'ml', icon: 'ti-arrow-left', label: 'Centro izquierda' },
  { id: 'mc', icon: 'ti-circle', label: 'Centro' },
  { id: 'mr', icon: 'ti-arrow-right', label: 'Centro derecha' },
  { id: 'bl', icon: 'ti-arrow-down-left', label: 'Abajo izquierda' },
  { id: 'bc', icon: 'ti-arrow-down', label: 'Abajo centro' },
  { id: 'br', icon: 'ti-arrow-down-right', label: 'Abajo derecha' },
]

const POS_STYLE = {
  tl: { top: 10, left: 10 }, tc: { top: 10, left: '50%', transform: 'translateX(-50%)' },
  tr: { top: 10, right: 10 }, ml: { top: '50%', left: 10, transform: 'translateY(-50%)' },
  mc: { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' },
  mr: { top: '50%', right: 10, transform: 'translateY(-50%)' },
  bl: { bottom: 40, left: 10 }, bc: { bottom: 40, left: '50%', transform: 'translateX(-50%)' },
  br: { bottom: 40, right: 10 },
}

export default function ProjectSetup({ user, onProject }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [project, setProject] = useState({
    name: '', episodeTitle: '', guestName: '', guestRole: '',
    logoFile: null, logoUrl: null, logoPosition: 'tr',
    cintillos: { guest: '', topic: '', promo: '', social: '', contact: '' },
    cintilloStyle: 'angled',
    cintilloPosition: 'bl',
    backgroundTemplate: 'podcast-dark',
    customBackgroundUrl: null,
    chromaEnabled: false,
    chromaSimilarity: 45,
    chromaSmoothness: 20,
    cameraScale: 100,
    format: '16:9',
  })
  const fileRef = useRef()
  const bgFileRef = useRef()

  const upd = (k, v) => setProject(p => ({ ...p, [k]: v }))
  const updCint = (k, v) => setProject(p => ({ ...p, cintillos: { ...p.cintillos, [k]: v } }))

  const handleLogo = (e) => {
    const f = e.target.files[0]
    if (!f) return
    const url = URL.createObjectURL(f)
    setProject(p => ({ ...p, logoFile: f, logoUrl: url }))
  }

  const handleBgUpload = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const url = URL.createObjectURL(f)
    setProject(p => ({ ...p, customBackgroundUrl: url }))
  }

  const finish = async () => {
    try {
      await saveProject(user?.id, project)
    } catch (e) {
      console.error('Save project:', e)
    }
    onProject(project)
    navigate('/studio')
  }

  const STEPS = ['Proyecto', 'Logo', 'Fondos', 'Cintillos', 'Listo']

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.brand} onClick={() => navigate('/')}>
          <div className={styles.brandLogo}><i className="ti ti-microphone" /></div>
          <span>Podcast<strong>Studio</strong></span>
        </div>
      </div>

      <div className={`${styles.wizard} ${step >= 2 ? styles.wizardWide : ''}`}>
        {/* STEPPER */}
        <div className={styles.stepper}>
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className={`${styles.stepItem} ${i <= step ? styles.stepActive : ''}`}>
                <div className={styles.stepCircle}>
                  {i < step ? <i className="ti ti-check" /> : <span>{i + 1}</span>}
                </div>
                <span className={styles.stepLabel}>{s}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`${styles.stepLine} ${i < step ? styles.stepLineActive : ''}`} />}
            </React.Fragment>
          ))}
        </div>

        <div className={styles.card}>
          {/* STEP 0 — PROJECT INFO */}
          {step === 0 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>Información del episodio</h2>
              <p className={styles.stepDesc}>Estos datos aparecerán en los cintillos y posts generados por IA.</p>
              <div className={styles.fields}>
                <div className={styles.field}>
                  <label>Nombre del podcast</label>
                  <input value={project.name} onChange={e => upd('name', e.target.value)} placeholder="Ej: El Futuro es Hoy" autoFocus />
                </div>
                <div className={styles.field}>
                  <label>Título del episodio</label>
                  <input value={project.episodeTitle} onChange={e => upd('episodeTitle', e.target.value)} placeholder="Ej: IA y el futuro del trabajo en LATAM" />
                </div>
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label>Nombre del invitado</label>
                    <input value={project.guestName} onChange={e => upd('guestName', e.target.value)} placeholder="Carlos Pérez" />
                  </div>
                  <div className={styles.field}>
                    <label>Cargo / empresa</label>
                    <input value={project.guestRole} onChange={e => upd('guestRole', e.target.value)} placeholder="CEO · TechCo LATAM" />
                  </div>
                </div>
                <div className={styles.field}>
                  <label>Formato de grabación</label>
                  <div className={styles.fmtPicker}>
                    {['16:9', '9:16', '1:1'].map(f => (
                      <button key={f} className={`${styles.fmtBtn} ${project.format === f ? styles.fmtActive : ''}`} onClick={() => upd('format', f)}>
                        <div className={styles.fmtIcon} style={{
                          width: f === '16:9' ? 32 : f === '1:1' ? 20 : 14,
                          height: f === '9:16' ? 28 : f === '1:1' ? 20 : 18,
                          border: '1.5px solid currentColor', borderRadius: 3
                        }} />
                        <div>
                          <div className={styles.fmtLabel}>{f}</div>
                          <div className={styles.fmtSub}>{{ '16:9': 'YouTube · Facebook', '9:16': 'TikTok · Reels', '1:1': 'Instagram' }[f]}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 1 — LOGO */}
          {step === 1 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>Logo del podcast</h2>
              <p className={styles.stepDesc}>Sube tu logo y elige en qué esquina aparecerá durante la grabación.</p>
              <div className={styles.logoLayout}>
                <div className={styles.logoControls}>
                  <div className={styles.uploadZone} onClick={() => fileRef.current.click()}>
                    <input ref={fileRef} type="file" accept="image/*" onChange={handleLogo} style={{ display: 'none' }} />
                    {project.logoUrl
                      ? <img src={project.logoUrl} alt="Logo" className={styles.logoPreviewImg} />
                      : <>
                          <i className="ti ti-cloud-upload" style={{ fontSize: 32, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }} />
                          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Haz clic para subir tu logo</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>PNG con fondo transparente recomendado</div>
                        </>
                    }
                  </div>
                  <div className={styles.posLabel}>Posición en pantalla</div>
                  <div className={styles.posGrid}>
                    {LOGO_POSITIONS.map(p => (
                      <button key={p.id}
                        className={`${styles.posBtn} ${project.logoPosition === p.id ? styles.posBtnActive : ''}`}
                        onClick={() => upd('logoPosition', p.id)}
                        title={p.label}>
                        <i className={`ti ${p.icon}`} />
                      </button>
                    ))}
                  </div>
                </div>
                {/* LIVE PREVIEW */}
                <div className={styles.logoPreviewBox}>
                  <div className={styles.miniScreen}>
                    <i className="ti ti-video" style={{ fontSize: 24, color: '#333' }} />
                    <div className={styles.miniLogo} style={{ position: 'absolute', ...POS_STYLE[project.logoPosition] }}>
                      {project.logoUrl
                        ? <img src={project.logoUrl} alt="" style={{ height: 18, borderRadius: 3 }} />
                        : <i className="ti ti-microphone" style={{ fontSize: 11, color: '#fff' }} />
                      }
                      <span>{project.name || 'Mi Podcast'}</span>
                    </div>
                    <div className={styles.miniCintilloWrap}>
                      <CintilloOverlay
                        styleId={project.cintilloStyle}
                        tag="INVITADO"
                        text={project.guestName || 'Invitado'}
                        imageUrl={project.logoUrl}
                        position={project.cintilloPosition}
                        preview
                      />
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>Vista previa en tiempo real</div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 — FONDOS */}
          {step === 2 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>Fondo del set</h2>
              <p className={styles.stepDesc}>Elige una plantilla estilo TV o sube tu propio set. Activa croma key si usas pantalla verde.</p>
              <div className={styles.bgLayout}>
                <BackgroundPicker
                  templateId={project.backgroundTemplate}
                  customUrl={project.customBackgroundUrl}
                  chromaEnabled={project.chromaEnabled}
                  chromaSimilarity={project.chromaSimilarity}
                  chromaSmoothness={project.chromaSmoothness}
                  cameraScale={project.cameraScale}
                  onTemplateChange={v => upd('backgroundTemplate', v)}
                  onCustomUpload={handleBgUpload}
                  onClearCustom={() => upd('customBackgroundUrl', null)}
                  onChromaChange={v => upd('chromaEnabled', v)}
                  onChromaSimilarityChange={v => upd('chromaSimilarity', v)}
                  onChromaSmoothnessChange={v => upd('chromaSmoothness', v)}
                  onCameraScaleChange={v => upd('cameraScale', v)}
                />
                <div className={styles.bgPreviewBox}>
                  <div className={styles.cintLiveLabel}>Vista previa del set</div>
                  <div className={styles.miniScreen}>
                    <SetBackground templateId={project.backgroundTemplate} customUrl={project.customBackgroundUrl} />
                    <div className={styles.bgCamPlaceholder}>
                      <i className="ti ti-user" />
                      <span>Tu cámara</span>
                    </div>
                    {project.chromaEnabled && (
                      <div className={styles.bgChromaTag}><i className="ti ti-background" /> Croma</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 — CINTILLOS */}
          {step === 3 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>Cintillos del episodio</h2>
              <p className={styles.stepDesc}>Elige el estilo de cortinilla y personaliza los textos. Se activan durante la grabación en el estudio.</p>

              <div className={styles.cintSection}>
                <div className={styles.cintSectionTitle}>Estilo de cintillo</div>
                <CintilloStylePicker
                  value={project.cintilloStyle}
                  onChange={v => upd('cintilloStyle', v)}
                  previewTag="INVITADO"
                  previewText={project.guestName || project.episodeTitle || 'Tu texto aquí'}
                />
              </div>

              <div className={styles.cintPosRow}>
                <span className={styles.posLabel}>Posición en pantalla</span>
                <div className={styles.cintPosBtns}>
                  {CINTILLO_POSITIONS.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className={`${styles.cintPosBtn} ${project.cintilloPosition === p.id ? styles.cintPosBtnActive : ''}`}
                      onClick={() => upd('cintilloPosition', p.id)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.cintLivePreview}>
                <div className={styles.cintLiveLabel}>Vista previa en vivo</div>
                <div className={styles.miniScreen}>
                  <i className="ti ti-video" style={{ fontSize: 24, color: '#333' }} />
                  <CintilloOverlay
                    styleId={project.cintilloStyle}
                    tag="INVITADO"
                    text={project.cintillos.guest || project.guestName || 'Nombre del invitado'}
                    subtitle={project.guestRole || ''}
                    imageUrl={project.logoUrl}
                    position={project.cintilloPosition}
                  />
                </div>
              </div>

              <div className={styles.cintSectionTitle} style={{ marginTop: 20 }}>Textos de los cintillos</div>
              <div className={styles.fields}>
                {CINTILLO_SETUP_TYPES.map(ct => (
                  <div key={ct.id} className={styles.cintField}>
                    <div className={styles.cintDot} style={{ background: ct.color }} />
                    <div className={styles.field} style={{ flex: 1 }}>
                      <label>{ct.label}</label>
                      <input
                        value={project.cintillos[ct.id]}
                        onChange={e => updCint(ct.id, e.target.value)}
                        placeholder={{
                          guest: 'Ej: Carolina Bañuelos · Conductora',
                          topic: 'Ej: Nos cacharon en el episodio',
                          promo: 'Ej: 50% OFF · Código: PODCAST24',
                          social: 'Ej: @losdosdeabajo · Síguenos',
                          contact: 'Ej: WhatsApp 55 1234 5678 · miproducto.com',
                        }[ct.id]}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4 — READY */}
          {step === 4 && (
            <div className={styles.stepContent} style={{ textAlign: 'center', padding: '20px 0' }}>
              <div className={styles.readyIcon}><i className="ti ti-sparkles" /></div>
              <h2 className={styles.stepTitle}>¡Todo listo!</h2>
              <p className={styles.stepDesc}>Tu estudio está configurado. Conecta tus cámaras y micrófonos, y comienza a grabar.</p>
              <div className={styles.readySummary}>
                {project.name && <div className={styles.summaryRow}><i className="ti ti-microphone" />{project.name}</div>}
                {project.episodeTitle && <div className={styles.summaryRow}><i className="ti ti-file-text" />{project.episodeTitle}</div>}
                {project.guestName && <div className={styles.summaryRow}><i className="ti ti-user" />{project.guestName}{project.guestRole ? ` · ${project.guestRole}` : ''}</div>}
                <div className={styles.summaryRow}><i className="ti ti-aspect-ratio" />Formato {project.format}</div>
                <div className={styles.summaryRow}><i className="ti ti-layout-bottombar" />Logo: {LOGO_POSITIONS.find(p => p.id === project.logoPosition)?.label}</div>
                <div className={styles.summaryRow}><i className="ti ti-palette" />Cintillo: {getCintilloStyle(project.cintilloStyle).name}</div>
                <div className={styles.summaryRow}><i className="ti ti-photo" />Fondo: {project.customBackgroundUrl ? 'Set personalizado' : getBackgroundTemplate(project.backgroundTemplate).name}{project.chromaEnabled ? ' + Croma' : ''}</div>
              </div>
            </div>
          )}

          {/* NAVIGATION */}
          <div className={styles.nav}>
            {step > 0 && (
              <button className={styles.btnBack} onClick={() => setStep(s => s - 1)}>
                <i className="ti ti-arrow-left" /> Atrás
              </button>
            )}
            <div style={{ flex: 1 }} />
            {step < 4
              ? <button className={styles.btnNext} onClick={() => setStep(s => s + 1)}>
                  {step === 3 ? 'Revisar configuración' : 'Continuar'} <i className="ti ti-arrow-right" />
                </button>
              : <button className={styles.btnFinish} onClick={finish}>
                  <i className="ti ti-player-play" /> Abrir el estudio
                </button>
            }
          </div>
        </div>
      </div>
    </div>
  )
}
