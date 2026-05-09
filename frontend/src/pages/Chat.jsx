import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Chat() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (!stored) { navigate('/login'); return }
    setUser(JSON.parse(stored))
  }, [navigate])

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  if (!user) return null

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <span style={styles.logo}>💬 Chat App</span>
        <div style={styles.userInfo}>
          <span style={styles.username}>@{user.username}</span>
          <button onClick={logout} style={styles.logoutBtn}>Logout</button>
        </div>
      </div>
      <div style={styles.body}>
        <p style={styles.welcome}>Welcome, <strong>{user.username}</strong>! Chat feature coming soon.</p>
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', background: '#f0f2f5', fontFamily: "'Segoe UI', system-ui, sans-serif" },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 24px', height: 60,
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  },
  logo: { fontSize: 20, fontWeight: 700 },
  userInfo: { display: 'flex', alignItems: 'center', gap: 16 },
  username: { fontSize: 14 },
  logoutBtn: {
    background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)',
    borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13,
  },
  body: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 60px)' },
  welcome: { fontSize: 18, color: '#444' },
}
