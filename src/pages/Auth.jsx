import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { signIn, signUp, isSupabaseConfigured } from '../lib/projects.js'
import { mapSupabaseUser, checkSupabaseHealth } from '../lib/supabase.js'
import { hasSeenTour } from '../config/tourSteps.js'
import { isKnownEmailTypo, normalizeLoginEmail } from '../lib/adminEmail.js'
import { getPostLoginPath } from '../lib/access.js'
import { notifyWelcome } from '../lib/notifications.js'
import styles from './Auth.module.css'

export default function Auth({ onAuth }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const pendingPlan = searchParams.get('plan')
  const nextPath = searchParams.get('next')
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [serverOk, setServerOk] = useState(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    checkSupabaseHealth().then((h) => setServerOk(h.ok))
  }, [])

  useEffect(() => {
    if (searchParams.get('mode') === 'signup') setMode('signup')
  }, [searchParams])

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
      return 'Correo o contraseña incorrectos.'
    }
    if (msg.includes('already registered') || msg.includes('user already registered')) {
      return 'Este correo ya tiene cuenta. Inicia sesión.'
    }
    if (msg.includes('password') && msg.includes('short')) {
      return 'La contraseña debe tener al menos 6 caracteres.'
    }
    return err?.message || 'Error de autenticación'
  }

  const finishAuth = (user, session) => {
    if (!session) throw new Error('No se pudo guardar la sesión. Intenta de nuevo.')
    const mapped = mapSupabaseUser(user)
    onAuth(mapped)
    if (nextPath && nextPath.startsWith('/')) {
      navigate(nextPath, { replace: true })
      return
    }
    navigate(getPostLoginPath(mapped, {
      pendingPlan,
      seenTour: hasSeenTour(),
    }))
  }

  const submitLogin = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    if (!form.email || !form.password) { setError('Completa todos los campos.'); return }
    setLoading(true)
    try {
      if (!isSupabaseConfigured) {
        setError('Supabase no está configurado. No se puede iniciar sesión.')
        return
      }
      const { user, session } = await signIn(form.email, form.password)
      finishAuth(user, session)
    } catch (err) {
      setError(friendlyAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  const submitSignup = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    if (!form.name?.trim() || !form.email || !form.password) {
      setError('Completa nombre, correo y contraseña.')
      return
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (form.password !== form.confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setLoading(true)
    try {
      if (!isSupabaseConfigured) {
        setError('Supabase no está configurado.')
        return
      }
      const data = await signUp(form.email, form.password, form.name)
      if (data.session?.user) {
        const mapped = mapSupabaseUser(data.session.user)
        notifyWelcome(mapped)
        finishAuth(data.session.user, data.session)
        return
      }
      if (data.user && !data.session) {
        setInfo('Cuenta creada. Revisa tu correo para confirmar y luego inicia sesión.')
        setMode('login')
        return
      }
      setInfo('Registro completado. Inicia sesión con tu correo.')
      setMode('login')
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
          <button
            type="button"
            className={`${styles.tab} ${mode === 'login' ? styles.tabActive : ''}`}
            onClick={() => { setMode('login'); setError(''); setInfo('') }}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            className={`${styles.tab} ${mode === 'signup' ? styles.tabActive : ''}`}
            onClick={() => { setMode('signup'); setError(''); setInfo('') }}
          >
            Crear cuenta
          </button>
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
        {info && (
          <div className={styles.demoNote} style={{ color: '#8fd4a8', borderColor: 'rgba(80,200,120,0.3)' }}>
            <i className="ti ti-check" /> {info}
          </div>
        )}
        <form className={styles.form} onSubmit={mode === 'login' ? submitLogin : submitSignup}>
          {mode === 'signup' && (
            <div className={styles.field}>
              <label>Nombre</label>
              <input name="name" type="text" value={form.name} onChange={handle} placeholder="Tu nombre" autoComplete="name" autoFocus />
            </div>
          )}
          <div className={styles.field}>
            <label>Correo electrónico</label>
            <input name="email" type="email" value={form.email} onChange={handle} onBlur={handleEmailBlur} placeholder="tu@correo.com" autoComplete="email" autoFocus={mode === 'login'} />
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
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
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
          {mode === 'signup' && (
            <div className={styles.field}>
              <label>Confirmar contraseña</label>
              <input name="confirm" type="password" value={form.confirm} onChange={handle} placeholder="••••••••" autoComplete="new-password" />
            </div>
          )}
          {error && <div className={styles.error}><i className="ti ti-alert-circle" /> {error}</div>}
          <button className={styles.submitBtn} type="submit" disabled={loading}>
            {loading
              ? <><i className="ti ti-loader" style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }} /> Procesando...</>
              : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>
        <p className={styles.manualLink}>
          <button type="button" onClick={() => navigate('/guia')}>
            <i className="ti ti-book" /> Ver manual de operación
          </button>
        </p>
        <p className={styles.terms}>
          {mode === 'login'
            ? '¿No tienes cuenta? '
            : '¿Ya tienes cuenta? '}
          <button
            type="button"
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 'inherit', padding: 0 }}
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
          >
            {mode === 'login' ? 'Regístrate gratis' : 'Inicia sesión'}
          </button>
        </p>
      </div>
    </div>
  )
}
