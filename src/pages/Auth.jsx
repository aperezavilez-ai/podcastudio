import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { signIn, isSupabaseConfigured } from '../lib/projects.js'
import { mapSupabaseUser, checkSupabaseHealth } from '../lib/supabase.js'
import { hasSeenTour } from '../config/tourSteps.js'
import { isKnownEmailTypo, normalizeLoginEmail } from '../lib/adminEmail.js'
import { getPostLoginPath } from '../lib/access.js'
import styles from './Auth.module.css'

export default function Auth({ onAuth }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const pendingPlan = searchParams.get('plan')
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [serverOk, setServerOk] = useState(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    checkSupabaseHealth().then((h) => setServerOk(h.ok))
  }, [])

  const handle = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleEmailBlur = () => {
    if (isKnownEmailTypo(form.email)) {
      setForm(f => ({ ...f, email: normalizeLoginEmail(f.email) }))
    }
  }

  const emailTypo = isKnownEmailTypo(form.email)

  const friendlyAuthError = (err) => {
    const msg = (err?.message || '').toLowerCase()
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')) {
      return 'Sin conexión al servidor. Comprueba internet o intenta más tarde.'
    }
    if (msg.includes('invalid login') || msg.includes('invalid_credentials') || msg.includes('incorrectos')) {
      return 'Contraseña incorrecta. Escribe la contraseña manualmente (no uses autocompletar del navegador).'
    }
    return err?.message || 'Error al iniciar sesión'
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.email || !form.password) { setError('Completa todos los campos.'); return }
    setLoading(true)
    try {
      if (!isSupabaseConfigured) {
        setError('Supabase no está configurado. No se puede iniciar sesión.')
        return
      }
      const { user, session } = await signIn(form.email, form.password)
      if (!session) throw new Error('No se pudo guardar la sesión. Intenta de nuevo.')
      const mapped = mapSupabaseUser(user)
      onAuth(mapped)
      navigate(getPostLoginPath(mapped, {
        pendingPlan,
        seenTour: hasSeenTour(),
      }))
    } catch (err) {
      setError(friendlyAuthError(err))
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
        {isSupabaseConfigured && serverOk === false && (
          <div className={styles.demoNote}>
            <i className="ti ti-wifi-off" /> No hay conexión con la plataforma. El proyecto Supabase puede estar mal configurado o inactivo.
          </div>
        )}
        <form className={styles.form} onSubmit={submit}>
          <div className={styles.field}>
            <label>Correo electrónico</label>
            <input name="email" type="email" value={form.email} onChange={handle} onBlur={handleEmailBlur} placeholder="tu@correo.com" autoComplete="email" autoFocus />
            {emailTypo && (
              <p className={styles.typoWarn}>
                Revisa la ortografía de tu correo e intenta de nuevo.
              </p>
            )}
          </div>
          <div className={styles.field}>
            <label>Contraseña</label>
            <div className={styles.passwordWrap}>
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={handle}
                placeholder="••••••••"
                autoComplete="off"
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                tabIndex={-1}
              >
                <i className={`ti ${showPassword ? 'ti-eye-off' : 'ti-eye'}`} />
              </button>
            </div>
          </div>
          {error && <div className={styles.error}><i className="ti ti-alert-circle" /> {error}</div>}
          <button className={styles.submitBtn} type="submit" disabled={loading}>
            {loading ? <><i className="ti ti-loader" style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }} /> Procesando...</> : 'Entrar'}
          </button>
        </form>
        <p className={styles.manualLink}>
          <button type="button" onClick={() => navigate('/guia')}>
            <i className="ti ti-book" /> Ver manual de operación
          </button>
        </p>
        <p className={styles.terms}>Acceso solo con cuenta autorizada. Contacta al administrador si necesitas una cuenta.</p>
      </div>
    </div>
  )
}
