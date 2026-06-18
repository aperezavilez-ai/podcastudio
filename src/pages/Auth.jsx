import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { signIn, isSupabaseConfigured } from '../lib/projects.js'
import { mapSupabaseUser } from '../lib/supabase.js'
import { hasSeenTour } from '../config/tourSteps.js'
import styles from './Auth.module.css'

export default function Auth({ onAuth }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const pendingPlan = searchParams.get('plan')
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handle = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.email || !form.password) { setError('Completa todos los campos.'); return }
    setLoading(true)
    try {
      if (isSupabaseConfigured) {
        const { user } = await signIn(form.email, form.password)
        onAuth(mapSupabaseUser(user))
      } else {
        setError('Supabase no está configurado. No se puede iniciar sesión.')
        return
      }
      if (pendingPlan) {
        navigate(`/plans?plan=${pendingPlan}`)
      } else if (!hasSeenTour()) {
        navigate('/tour')
      } else {
        navigate('/plans')
      }
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.brand} onClick={() => navigate('/')}>
        <div className={styles.brandLogo}><i className="ti ti-microphone" /></div>
        <span>Podcast<strong>Studio</strong></span>
      </div>
      <div className={styles.card}>
        <div className={styles.tabs}>
          <button type="button" className={`${styles.tab} ${styles.tabActive}`}>Iniciar sesión</button>
        </div>
        {!isSupabaseConfigured && (
          <div className={styles.demoNote}>
            <i className="ti ti-info-circle" /> Supabase no configurado. Revisa VITE_SUPABASE_URL en Vercel.
          </div>
        )}
        <form className={styles.form} onSubmit={submit}>
          <div className={styles.field}>
            <label>Correo electrónico</label>
            <input name="email" type="email" value={form.email} onChange={handle} placeholder="tu@email.com" autoFocus />
          </div>
          <div className={styles.field}>
            <label>Contraseña</label>
            <input name="password" type="password" value={form.password} onChange={handle} placeholder="••••••••" />
          </div>
          {error && <div className={styles.error}><i className="ti ti-alert-circle" /> {error}</div>}
          <button className={styles.submitBtn} type="submit" disabled={loading}>
            {loading ? <><i className="ti ti-loader" style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }} /> Procesando...</> : 'Entrar'}
          </button>
        </form>
        <p className={styles.terms}>Acceso solo con cuenta autorizada. Contacta al administrador si necesitas una cuenta.</p>
      </div>
    </div>
  )
}
