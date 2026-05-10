import { useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../api/auth'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await forgotPassword(email.trim())
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>

        {/* Logo */}
        <div style={s.logo}>💬</div>
        <h1 style={s.title}>Forgot your password?</h1>

        {sent ? (
          /* ── Success state ── */
          <div style={s.successBox}>
            <div style={s.successIcon}>📬</div>
            <h2 style={s.successTitle}>Check your inbox</h2>
            <p style={s.successText}>
              We sent a reset link to <strong>{email}</strong>.
              It expires in 1 hour.
            </p>
            <p style={s.successHint}>
              Didn't get it? Check your spam folder or{' '}
              <button style={s.retryBtn} onClick={() => setSent(false)}>
                try again
              </button>
              .
            </p>
            <Link to="/login" style={s.backBtn}>← Back to login</Link>
          </div>
        ) : (
          /* ── Form state ── */
          <>
            <p style={s.subtitle}>
              Enter your account email and we'll send you a link to reset your password.
            </p>

            {error && <div style={s.alert}>{error}</div>}

            <form onSubmit={handleSubmit} style={s.form}>
              <label style={s.label}>Email address</label>
              <input
                style={s.input}
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
              <button
                type="submit"
                style={loading ? { ...s.btn, opacity: 0.7 } : s.btn}
                disabled={loading || !email.trim()}
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>

            <p style={s.footer}>
              <Link to="/login" style={s.link}>← Back to login</Link>
            </p>
          </>
        )}
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
  logo: { fontSize: 40, marginBottom: 8 },
  title: { margin: '0 0 8px', fontSize: 24, fontWeight: 700, color: '#1a1a2e' },
  subtitle: { color: '#666', fontSize: 14, marginBottom: 24, lineHeight: 1.6 },
  alert: {
    background: '#fff0f0', border: '1px solid #ffcccc', color: '#c0392b',
    borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 14, textAlign: 'left',
  },
  form: { display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' },
  label: { fontSize: 13, fontWeight: 600, color: '#444' },
  input: {
    padding: '11px 14px', borderRadius: 8, border: '1.5px solid #ddd',
    fontSize: 15, outline: 'none', marginBottom: 8,
  },
  btn: {
    padding: '13px', marginTop: 4,
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff', border: 'none', borderRadius: 8,
    fontSize: 15, fontWeight: 600, cursor: 'pointer',
  },
  footer: { marginTop: 24, fontSize: 14 },
  link: { color: '#667eea', textDecoration: 'none', fontWeight: 600 },
  // Success state
  successBox: { padding: '8px 0' },
  successIcon: { fontSize: 48, marginBottom: 12 },
  successTitle: { fontSize: 20, fontWeight: 700, color: '#1a1a2e', margin: '0 0 10px' },
  successText: { color: '#555', fontSize: 14, lineHeight: 1.6, margin: '0 0 12px' },
  successHint: { color: '#888', fontSize: 13, margin: '0 0 24px' },
  retryBtn: {
    background: 'none', border: 'none', color: '#667eea',
    fontWeight: 600, cursor: 'pointer', fontSize: 13, padding: 0,
  },
  backBtn: {
    display: 'inline-block', marginTop: 4,
    color: '#667eea', textDecoration: 'none', fontWeight: 600, fontSize: 14,
  },
}
