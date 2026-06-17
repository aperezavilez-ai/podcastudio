import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Auth.module.css'

export default function Auth({ onAuth }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handle = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.email || !form.password) { setError('Completa todos los campos.'); return }
    setLoading(true)
    await new Promise(r => setTimeout(r, 900))
    const user = { id: '1', name: form.name || form.email.split('@')[0], email: form.email }
    onAuth(user)
    setLoading(false)
    navigate('/setup')
  }

  return (
    <div className={styles.page}>
      <div className={styles.brand} onClick={() => navigate('/')}>
        <div className={styles.brandLogo}><i className="ti ti-microphone" /></div>
        <span>Podcast<strong>Studio</strong></span>
      </div>
      <div className={styles.card}>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${mode === 'login' ? styles.tabActive : ''}`} onClick={() => setMode('login')}>Iniciar sesión</button>
          <button className={`${styles.tab} ${mode === 'register' ? styles.tabActive : ''}`} onClick={() => setMode('register')}>Crear cuenta</button>
        </div>
        <form className={styles.form} onSubmit={submit}>
          {mode === 'register' && (
            <div className={styles.field}>
              <label>Nombre del podcast</label>
              <input name="name" value={form.name} onChange={handle} placeholder="Ej: El Futuro es Hoy" autoFocus />
            </div>
          )}
          <div className={styles.field}>
            <label>Correo electrónico</label>
            <input name="email" type="email" value={form.email} onChange={handle} placeholder="tu@email.com" autoFocus={mode === 'login'} />
          </div>
          <div className={styles.field}>
            <label>Contraseña</label>
            <input name="password" type="password" value={form.password} onChange={handle} placeholder="••••••••" />
          </div>
          {error && <div className={styles.error}><i className="ti ti-alert-circle" /> {error}</div>}
          <button className={styles.submitBtn} type="submit" disabled={loading}>
            {loading ? <><i className="ti ti-loader" style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }} /> Procesando...</> : mode === 'login' ? 'Entrar al estudio' : 'Crear cuenta y continuar'}
          </button>
        </form>
        <div className={styles.divider}><span>o continúa con</span></div>
        <div className={styles.socials}>
          <button className={styles.socialBtn} onClick={() => { onAuth({ id: '1', name: 'Demo User', email: 'demo@ps.com' }); navigate('/setup') }}>
            <i className="ti ti-brand-google" /> Google
          </button>
          <button className={styles.socialBtn}>
            <i className="ti ti-brand-apple" /> Apple
          </button>
        </div>
        <p className={styles.terms}>Al continuar aceptas los <a href="#">Términos de uso</a> y la <a href="#">Política de privacidad</a>.</p>
      </div>
    </div>
  )
}
