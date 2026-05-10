import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { resetPassword } from '../api/auth'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  // Redirect to login 3 s after success
  function handleDone() {
    setDone(true)
    setTimeout(() => navigate('/login'), 3000)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await resetPassword(token, password)
      handleDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // No token in URL at all
  if (!token) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.icon}>⚠️</div>
          <h1 style={s.title}>Invalid link</h1>
          <p style={s.subtitle}>
            This reset link is missing or malformed. Please request a new one.
          </p>
          <Link to="/forgot-password" style={s.btnLink}>Request new link</Link>
          <p style={s.footer}><Link to="/login" style={s.link}>← Back to login</Link></p>
        </div>
      </div>
    )
  }

  // Success state
  if (done) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.icon}>✅</div>
          <h1 style={s.title}>Password updated!</h1>
          <p style={s.subtitle}>
            Your password has been reset successfully.
            You'll be redirected to login in a moment…
          </p>
          <Link to="/login" style={s.btnLink}>Go to login now</Link>
        </div>
      </div>
    )
  }

  const mismatch = confirm && password !== confirm
  const weak = password && password.length < 6

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.icon}>🔑</div>
        <h1 style={s.title}>Set new password</h1>
        <p style={s.subtitle}>Choose a strong password for your account.</p>

        {error && <div style={s.alert}>{error}</div>}

        <form onSubmit={handleSubmit} style={s.form}>
          {/* New password */}
          <label style={s.label}>New password</label>
          <div style={s.pwdWrap}>
            <input
              style={s.pwdInput}
              type={showPwd ? 'text' : 'password'}
              placeholder="At least 6 characters"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              required
              autoFocus
            />
            <button type="button" style={s.eyeBtn} onClick={() => setShowPwd(v => !v)}>
              {showPwd ? '🙈' : '👁'}
            </button>
          </div>
          {weak && <p style={s.hint}>Password must be at least 6 characters.</p>}

          {/* Confirm password */}
          <label style={{ ...s.label, marginTop: 10 }}>Confirm password</label>
          <input
            style={{ ...s.input, borderColor: mismatch ? '#e53e3e' : '#ddd' }}
            type={showPwd ? 'text' : 'password'}
            placeholder="Repeat your password"
            value={confirm}
            onChange={e => { setConfirm(e.target.value); setError('') }}
            required
          />
          {mismatch && <p style={s.hintError}>Passwords don't match.</p>}

          <button
            type="submit"
            style={(loading || weak || mismatch) ? { ...s.btn, opacity: 0.65 } : s.btn}
            disabled={loading || !!weak || !!mismatch}
          >
            {loading ? 'Saving…' : 'Reset password'}
          </button>
        </form>

        <p style={s.footer}><Link to="/login" style={s.link}>← Back to login</Link></p>
      </div>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    padding: 16,
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '40px 36px',
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
    textAlign: 'center',
  },
  icon: { fontSize: 40, marginBottom: 8 },
  title: { margin: '0 0 8px', fontSize: 24, fontWeight: 700, color: '#1a1a2e' },
  subtitle: { color: '#666', fontSize: 14, marginBottom: 24, lineHeight: 1.6 },
  alert: {
    background: '#fff0f0', border: '1px solid #ffcccc', color: '#c0392b',
    borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 14, textAlign: 'left',
  },
  form: { display: 'flex', flexDirection: 'column', textAlign: 'left' },
  label: { fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 5 },
  input: {
    padding: '11px 14px', borderRadius: 8, border: '1.5px solid #ddd',
    fontSize: 15, outline: 'none', width: '100%', boxSizing: 'border-box', marginBottom: 4,
  },
  pwdWrap: {
    display: 'flex', alignItems: 'center',
    border: '1.5px solid #ddd', borderRadius: 8, overflow: 'hidden', marginBottom: 4,
  },
  pwdInput: {
    flex: 1, padding: '11px 14px', border: 'none',
    fontSize: 15, outline: 'none',
  },
  eyeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    padding: '0 12px', fontSize: 16, color: '#888',
  },
  hint: { fontSize: 12, color: '#e67e22', margin: '0 0 8px' },
  hintError: { fontSize: 12, color: '#e53e3e', margin: '0 0 8px' },
  btn: {
    marginTop: 16, padding: '13px',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff', border: 'none', borderRadius: 8,
    fontSize: 15, fontWeight: 600, cursor: 'pointer',
  },
  btnLink: {
    display: 'inline-block', marginTop: 8,
    padding: '12px 28px',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff', textDecoration: 'none', borderRadius: 8,
    fontSize: 15, fontWeight: 600,
  },
  footer: { marginTop: 24, fontSize: 14 },
  link: { color: '#667eea', textDecoration: 'none', fontWeight: 600 },
}
