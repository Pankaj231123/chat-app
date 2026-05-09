import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listRooms, createRoom, joinRoom, getMessages } from '../api/rooms'

export default function Chat() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [rooms, setRooms] = useState([])
  const [activeRoom, setActiveRoom] = useState(null)
  const [messages, setMessages] = useState([])
  const [msgInput, setMsgInput] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)
  const wsRef = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (!stored) { navigate('/login'); return }
    setUser(JSON.parse(stored))
    fetchRooms()
  }, [navigate])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function fetchRooms() {
    try {
      const data = await listRooms()
      setRooms(data ?? [])
    } catch { /* ignore */ }
  }

  async function openRoom(room) {
    if (activeRoom?.id === room.id) return
    wsRef.current?.close()
    setActiveRoom(room)
    setMessages([])
    setMsgInput('')

    try {
      await joinRoom(room.id)
    } catch { /* already a member is fine */ }

    try {
      const msgs = await getMessages(room.id)
      setMessages(msgs ?? [])
    } catch { /* ignore */ }

    const token = localStorage.getItem('token')
    const wsBase = import.meta.env.VITE_API_BASE_URL
      ? import.meta.env.VITE_API_BASE_URL.replace(/^http/, 'ws')
      : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
    const ws = new WebSocket(`${wsBase}/api/rooms/${room.id}/ws?token=${token}`)
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.id) setMessages(prev => [...prev, msg])
    }
    wsRef.current = ws
  }

  function sendMessage(e) {
    e.preventDefault()
    if (!msgInput.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ content: msgInput.trim() }))
    setMsgInput('')
  }

  async function handleCreateRoom(e) {
    e.preventDefault()
    if (!roomName.trim()) return
    setCreating(true)
    setCreateError('')
    try {
      const room = await createRoom(roomName.trim())
      setRooms(prev => [{ ...room, member_count: 1 }, ...prev])
      setShowModal(false)
      setRoomName('')
      openRoom(room)
    } catch (err) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  function closeModal() {
    setShowModal(false)
    setRoomName('')
    setCreateError('')
  }

  function logout() {
    wsRef.current?.close()
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  if (!user) return null

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <span style={s.logo}>💬 Chat App</span>
        <div style={s.userInfo}>
          <span style={s.username}>@{user.username}</span>
          <button onClick={logout} style={s.logoutBtn}>Logout</button>
        </div>
      </div>

      <div style={s.body}>
        {/* Sidebar */}
        <aside style={s.sidebar}>
          <div style={s.sidebarHeader}>
            <span style={s.sidebarTitle}>Rooms</span>
            <button onClick={() => setShowModal(true)} style={s.createBtn} title="Create room">
              + New
            </button>
          </div>
          <div style={s.roomList}>
            {rooms.length === 0 && (
              <p style={s.empty}>No rooms yet. Create one!</p>
            )}
            {rooms.map(r => (
              <button
                key={r.id}
                onClick={() => openRoom(r)}
                style={{ ...s.roomItem, ...(activeRoom?.id === r.id ? s.roomItemActive : {}) }}
              >
                <span style={s.roomName}># {r.name}</span>
                <span style={s.memberCount}>{r.member_count} member{r.member_count !== 1 ? 's' : ''}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Chat area */}
        <main style={s.main}>
          {!activeRoom ? (
            <div style={s.placeholder}>
              <div style={s.placeholderIcon}>💬</div>
              <p style={s.placeholderText}>Select a room to start chatting</p>
              <button onClick={() => setShowModal(true)} style={s.createBtnLarge}>
                + Create a Room
              </button>
            </div>
          ) : (
            <>
              <div style={s.chatHeader}>
                <span style={s.chatRoomName}># {activeRoom.name}</span>
              </div>
              <div style={s.messages}>
                {messages.length === 0 && (
                  <p style={s.empty}>No messages yet. Say hello!</p>
                )}
                {messages.map(m => {
                  const isOwn = Number(m.user_id) === Number(user.id)
                  return (
                    <div key={m.id} style={s.msgRow}>
                      <div style={{ ...s.msg, ...(isOwn ? s.msgOwn : s.msgOther) }}>
                        <div style={{ ...s.msgMeta, ...(isOwn ? { justifyContent: 'flex-end' } : {}) }}>
                          <span style={{ ...s.msgUser, ...(isOwn ? s.msgUserOwn : {}) }}>{m.username}</span>
                          <span style={s.msgTime}>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div style={{ ...s.msgBubble, ...(isOwn ? s.msgBubbleOwn : {}) }}>
                          {m.content}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={sendMessage} style={s.inputRow}>
                <input
                  style={s.input}
                  value={msgInput}
                  onChange={e => setMsgInput(e.target.value)}
                  placeholder={`Message #${activeRoom.name}`}
                />
                <button type="submit" style={s.sendBtn} disabled={!msgInput.trim()}>Send</button>
              </form>
            </>
          )}
        </main>
      </div>

      {/* Create Room Modal */}
      {showModal && (
        <div style={s.overlay} onClick={closeModal}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>Create a Room</span>
              <button onClick={closeModal} style={s.closeBtn}>✕</button>
            </div>
            <form onSubmit={handleCreateRoom} style={s.modalBody}>
              <label style={s.label}>Room Name</label>
              <input
                style={s.modalInput}
                value={roomName}
                onChange={e => { setRoomName(e.target.value); setCreateError('') }}
                placeholder="e.g. general, design, random"
                maxLength={100}
                autoFocus
              />
              {createError && <p style={s.errorText}>{createError}</p>}
              <div style={s.modalActions}>
                <button type="button" onClick={closeModal} style={s.cancelBtn}>Cancel</button>
                <button type="submit" style={s.submitBtn} disabled={creating || !roomName.trim()}>
                  {creating ? 'Creating…' : 'Create Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  page: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#f0f2f5', fontFamily: "'Segoe UI', system-ui, sans-serif" },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 24px', height: 60, flexShrink: 0,
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
  body: { display: 'flex', flex: 1, overflow: 'hidden' },
  sidebar: { width: 240, background: '#1e1e2e', display: 'flex', flexDirection: 'column', flexShrink: 0 },
  sidebarHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 14px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)' },
  sidebarTitle: { color: '#a0a8c0', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 },
  createBtn: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none',
    borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
  },
  roomList: { flex: 1, overflowY: 'auto', padding: '8px 6px' },
  roomItem: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%',
    background: 'transparent', border: 'none', borderRadius: 6, padding: '8px 10px',
    cursor: 'pointer', textAlign: 'left', marginBottom: 2, transition: 'background .15s',
  },
  roomItemActive: { background: 'rgba(102,126,234,0.3)' },
  roomName: { color: '#c8d0e8', fontSize: 14 },
  memberCount: { color: '#5a6070', fontSize: 11, marginTop: 2 },
  empty: { color: '#5a6070', fontSize: 13, padding: '12px 10px' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' },
  placeholder: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 },
  placeholderIcon: { fontSize: 48 },
  placeholderText: { color: '#888', fontSize: 16 },
  createBtnLarge: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none',
    borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontSize: 14, fontWeight: 600,
  },
  chatHeader: { padding: '14px 20px', borderBottom: '1px solid #eee', background: '#fafafa' },
  chatRoomName: { fontSize: 16, fontWeight: 700, color: '#333' },
  messages: { flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 },
  msgRow: { display: 'flex', width: '100%' },
  msg: { display: 'flex', flexDirection: 'column', maxWidth: '70%' },
  msgOther: { alignItems: 'flex-start', marginRight: 'auto' },
  msgOwn: { alignItems: 'flex-end', marginLeft: 'auto' },
  msgMeta: { display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 3 },
  msgUser: { fontSize: 12, fontWeight: 600, color: '#667eea' },
  msgUserOwn: { color: '#764ba2' },
  msgTime: { fontSize: 11, color: '#aaa' },
  msgBubble: { background: '#f0f2f5', borderRadius: '0 12px 12px 12px', padding: '8px 14px', fontSize: 14, color: '#222', wordBreak: 'break-word' },
  msgBubbleOwn: { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', borderRadius: '12px 0 12px 12px' },
  inputRow: { display: 'flex', gap: 10, padding: '12px 20px', borderTop: '1px solid #eee', background: '#fafafa' },
  input: { flex: 1, border: '1px solid #ddd', borderRadius: 8, padding: '10px 14px', fontSize: 14, outline: 'none' },
  sendBtn: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none',
    borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600,
  },
  // Modal
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    backdropFilter: 'blur(2px)',
  },
  modal: {
    background: '#fff', borderRadius: 12, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
    overflow: 'hidden', animation: 'none',
  },
  modalHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 20px', borderBottom: '1px solid #eee',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
  },
  modalTitle: { fontSize: 16, fontWeight: 700, color: '#fff' },
  closeBtn: { background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', lineHeight: 1 },
  modalBody: { padding: 24, display: 'flex', flexDirection: 'column', gap: 14 },
  label: { fontSize: 13, fontWeight: 600, color: '#555' },
  modalInput: {
    border: '1.5px solid #ddd', borderRadius: 8, padding: '10px 14px',
    fontSize: 15, outline: 'none', transition: 'border-color .2s',
  },
  errorText: { color: '#e53e3e', fontSize: 13, margin: 0 },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  cancelBtn: {
    background: '#f0f2f5', color: '#555', border: 'none',
    borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontSize: 14,
  },
  submitBtn: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none',
    borderRadius: 8, padding: '9px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600,
  },
}
