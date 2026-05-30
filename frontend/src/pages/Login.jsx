import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '../api/auth'

function EyeIcon({ open }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

const highlights = [
  {
    title: 'Real-time rooms',
    description: 'Jump into public or password-protected rooms with live updates over WebSockets.',
  },
  {
    title: 'Encrypted history',
    description: 'Messages are encrypted before storage, then loaded back as searchable room history.',
  },
  {
    title: 'Account recovery',
    description: 'Reset access through expiring email links when you need to get back in quickly.',
  },
]

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth)
  const isCompact = viewportWidth < 960
  const isMobile = viewportWidth < 640

  useEffect(() => {
    function handleResize() {
      setViewportWidth(window.innerWidth)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await login(form.email, form.password)
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      navigate('/chat')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : null) }}>
      <div
        style={{
          ...styles.shell,
          ...(isCompact ? styles.shellCompact : null),
          ...(isMobile ? styles.shellMobile : null),
        }}
      >
        <section
          style={{
            ...styles.authPane,
            ...(isCompact ? styles.authPaneCompact : null),
          }}
        >
          <div
            style={{
              ...styles.authCard,
              ...(isCompact ? styles.authCardCompact : null),
              ...(isMobile ? styles.authCardMobile : null),
            }}
          >
            <div style={styles.authInner}>
              <h2 style={{ ...styles.title, ...(isMobile ? styles.titleMobile : null) }}>Welcome back</h2>
              <p style={{ ...styles.subtitle, ...(isMobile ? styles.subtitleMobile : null) }}>
                Sign in to continue to your rooms
              </p>

              {error && <div style={styles.alert}>{error}</div>}

              <form onSubmit={handleSubmit} style={styles.form}>
                <label style={styles.label}>Email</label>
                <input
                  style={styles.input}
                  type="email"
                  name="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                  autoFocus
                />

                <div style={{ ...styles.labelRow, ...(isMobile ? styles.labelRowMobile : null) }}>
                  <label style={styles.label}>Password</label>
                  <Link to="/forgot-password" style={styles.forgotLink}>Forgot password?</Link>
                </div>
                <div style={styles.passwordWrap}>
                  <input
                    style={{ ...styles.input, marginBottom: 0, paddingRight: 42, width: '100%', boxSizing: 'border-box' }}
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={handleChange}
                    required
                  />
                  <button
                    type="button"
                    style={styles.eyeBtn}
                    onClick={() => setShowPassword(v => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>

                <button style={loading ? { ...styles.btn, opacity: 0.7 } : styles.btn} disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              <p style={{ ...styles.footer, ...(isMobile ? styles.footerMobile : null) }}>
                Don't have an account?{' '}
                <Link to="/signup" style={styles.link}>Create one</Link>
              </p>
            </div>
          </div>
        </section>

        <section
          style={{
            ...styles.infoPanel,
            ...(isCompact ? styles.infoPanelCompact : null),
            ...(isMobile ? styles.infoPanelMobile : null),
          }}
        >
          <div style={{ ...styles.infoInner, ...(isMobile ? styles.infoInnerMobile : null) }}>
            <div style={styles.badge}>Chat App</div>
            <h1
              style={{
                ...styles.heroTitle,
                ...(isCompact ? styles.heroTitleCompact : null),
                ...(isMobile ? styles.heroTitleMobile : null),
              }}
            >
              Conversations that stay fast, organized, and secure.
            </h1>
            <p style={{ ...styles.heroText, ...(isMobile ? styles.heroTextMobile : null) }}>
              Sign in to join live rooms, catch up on encrypted message history, and collaborate without losing context.
            </p>

            <div
              style={{
                ...styles.highlightList,
                ...(isMobile ? styles.highlightListMobile : null),
              }}
            >
              {highlights.map(item => (
                <div
                  key={item.title}
                  style={{
                    ...styles.highlightCard,
                    ...(isCompact ? styles.highlightCardCompact : null),
                    ...(isMobile ? styles.highlightCardMobile : null),
                  }}
                >
                  <div style={styles.highlightDot} />
                  <div>
                    <h2 style={styles.highlightTitle}>{item.title}</h2>
                    <p style={styles.highlightText}>{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '36px 24px',
    background: 'radial-gradient(circle at top left, #2f6bff 0%, rgba(47,107,255,0) 32%), linear-gradient(135deg, #06131f 0%, #102942 45%, #e8b64f 140%)',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  pageMobile: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    padding: '14px',
  },
  shell: {
    width: '100%',
    maxWidth: 1160,
    display: 'grid',
    gridTemplateColumns: 'minmax(380px, 460px) minmax(0, 1fr)',
    gap: 26,
    alignItems: 'stretch',
  },
  shellCompact: {
    gridTemplateColumns: '1fr',
    gap: 18,
    maxWidth: 760,
  },
  shellMobile: {
    gap: 14,
  },
  authPane: {
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  authPaneCompact: {
    order: 1,
  },
  authCard: {
    width: '100%',
    minHeight: 640,
    background: '#f8f1e5',
    borderRadius: 34,
    border: '1px solid rgba(255,255,255,0.3)',
    boxShadow: '0 26px 60px rgba(4, 13, 25, 0.28)',
    padding: '44px 40px',
    display: 'flex',
    alignItems: 'center',
  },
  authCardCompact: {
    maxWidth: '100%',
    minHeight: 'unset',
  },
  authCardMobile: {
    borderRadius: 28,
    padding: '28px 22px',
  },
  authInner: {
    width: '100%',
    maxWidth: 360,
    margin: '0 auto',
  },
  infoPanel: {
    display: 'flex',
    alignItems: 'center',
    minHeight: 640,
    padding: '42px 42px 42px 30px',
    color: '#f4f7fb',
    background: 'linear-gradient(180deg, rgba(18, 33, 52, 0.96), rgba(22, 32, 47, 0.92))',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 34,
    boxShadow: '0 26px 60px rgba(4, 13, 25, 0.2)',
  },
  infoPanelCompact: {
    alignItems: 'flex-start',
    minHeight: 'unset',
    padding: '34px 28px',
  },
  infoPanelMobile: {
    order: 2,
    padding: '26px 22px',
    borderRadius: 28,
  },
  infoInner: {
    width: '100%',
    maxWidth: 520,
    margin: '0 auto',
  },
  infoInnerMobile: {
    maxWidth: '100%',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 14px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.12)',
    color: '#f8d588',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  heroTitle: {
    margin: '22px 0 18px',
    fontSize: 'clamp(3rem, 4.6vw, 4.5rem)',
    lineHeight: 0.98,
    fontWeight: 800,
    maxWidth: 480,
  },
  heroTitleCompact: {
    maxWidth: '100%',
    fontSize: 'clamp(2.4rem, 7vw, 3.5rem)',
  },
  heroTitleMobile: {
    margin: '18px 0 12px',
    fontSize: 42,
    lineHeight: 1,
  },
  heroText: {
    margin: 0,
    maxWidth: 470,
    fontSize: 16,
    lineHeight: 1.75,
    color: 'rgba(244,247,251,0.76)',
  },
  heroTextMobile: {
    fontSize: 14,
    lineHeight: 1.6,
  },
  highlightList: {
    display: 'grid',
    gap: 16,
    marginTop: 34,
  },
  highlightListMobile: {
    gap: 10,
    marginTop: 22,
  },
  highlightCard: {
    display: 'grid',
    gridTemplateColumns: '12px 1fr',
    gap: 14,
    padding: '18px 20px',
    borderRadius: 18,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.09)',
  },
  highlightCardCompact: {
    padding: '16px 18px',
  },
  highlightCardMobile: {
    gap: 12,
    padding: '14px 14px',
    borderRadius: 16,
  },
  highlightDot: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #f8d588, #ff8c42)',
    marginTop: 6,
    boxShadow: '0 0 0 6px rgba(248,213,136,0.12)',
  },
  highlightTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 700,
    color: '#ffffff',
  },
  highlightText: {
    margin: '6px 0 0',
    fontSize: 14,
    lineHeight: 1.6,
    color: 'rgba(244,247,251,0.72)',
  },
  title: { margin: 0, fontSize: 30, fontWeight: 800, color: '#15212f' },
  titleMobile: { fontSize: 28 },
  subtitle: { marginTop: 8, marginBottom: 24, color: '#526171', fontSize: 15 },
  subtitleMobile: { marginBottom: 20, fontSize: 14 },
  alert: {
    background: '#fff0f0',
    border: '1px solid #ffcccc',
    color: '#c0392b',
    borderRadius: 8,
    padding: '10px 14px',
    marginBottom: 16,
    fontSize: 14,
  },
  form: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 700, color: '#2b3a4b', marginBottom: 2 },
  labelRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  labelRowMobile: { gap: 4, flexDirection: 'column', alignItems: 'flex-start' },
  input: {
    padding: '13px 14px',
    borderRadius: 12,
    border: '1.5px solid #d2d8df',
    fontSize: 15,
    outline: 'none',
    marginBottom: 12,
    transition: 'border-color 0.2s, box-shadow 0.2s',
    background: '#fffdf9',
    color: '#14202d',
  },
  btn: {
    marginTop: 6,
    padding: '14px',
    background: 'linear-gradient(135deg, #102942, #21598c)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
    width: '100%',
  },
  footer: { marginTop: 24, textAlign: 'center', fontSize: 14, color: '#526171' },
  footerMobile: { textAlign: 'left', lineHeight: 1.5 },
  link: { color: '#0d5ea8', textDecoration: 'none', fontWeight: 700 },
  forgotLink: { color: '#0d5ea8', textDecoration: 'none', fontSize: 13, fontWeight: 700 },
  passwordWrap: { position: 'relative', display: 'flex', alignItems: 'center', marginBottom: 12 },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#6c7b8a',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
  },
}
