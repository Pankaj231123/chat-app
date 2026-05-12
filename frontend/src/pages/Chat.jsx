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
  const [typingUsers, setTypingUsers] = useState([])
  const wsRef = useRef(null)
  const bottomRef = useRef(null)
  const typingTimerRef = useRef(null)

  // Create room modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [showCreatePwd, setShowCreatePwd] = useState(false)
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)

  // Join password modal (for protected rooms)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [pendingRoom, setPendingRoom] = useState(null)
  const [joinPassword, setJoinPassword] = useState('')
  const [showJoinPwd, setShowJoinPwd] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (!stored) { navigate('/login'); return }
    setUser(JSON.parse(stored))
    fetchRooms()

    const roomPollInterval = setInterval(fetchRooms, 15000)
    return () => clearInterval(roomPollInterval)
  }, [navigate])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function fetchRooms() {
    try {
      const data = await listRooms()
      if (!data) return
      // Preserve local is_member overrides (e.g. rooms joined this session)
      setRooms(prev => {
        const localMemberships = new Map(prev.map(r => [r.id, r.is_member]))
        return data.map(r => ({
          ...r,
          is_member: localMemberships.get(r.id) ?? r.is_member,
        }))
      })
    } catch { /* ignore */ }
  }

  // skipJoin=true when the caller already called joinRoom (e.g. after join password modal)
  async function openRoom(room, skipJoin = false) {
    if (activeRoom?.id === room.id) return
    clearTimeout(typingTimerRef.current)
    wsRef.current?.close()
    setActiveRoom(room)
    setMessages([])
    setMsgInput('')
    setTypingUsers([])

    if (!skipJoin) {
      try { await joinRoom(room.id) } catch { /* already a member */ }
    }

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
      const data = JSON.parse(e.data)
      if (data.type === 'typing') {
        setTypingUsers(prev =>
          data.typing
            ? prev.includes(data.username) ? prev : [...prev, data.username]
            : prev.filter(u => u !== data.username)
        )
        return
      }
      if (data.type === 'join') {
        setMessages(prev => [...prev, { _sysKey: Date.now() + Math.random(), isSystem: true, message: data.message }])
        return
      }
      if (data.id) {
        setMessages(prev => [...prev, data])
        setTypingUsers(prev => prev.filter(u => u !== data.username))
      }
    }
    wsRef.current = ws
  }

  function handleRoomClick(room) {
    // Protected room where user is not yet a member → ask for password
    if (room.is_protected && !room.is_member) {
      setPendingRoom(room)
      setJoinPassword('')
      setJoinError('')
      setShowJoinPwd(false)
      setShowJoinModal(true)
      return
    }
    openRoom(room)
  }

  async function handleJoinWithPassword(e) {
    e.preventDefault()
    if (!joinPassword.trim()) return
    setJoining(true)
    setJoinError('')
    try {
      await joinRoom(pendingRoom.id, joinPassword.trim())
      // Mark as member in local state so next click skips modal
      setRooms(prev => prev.map(r => r.id === pendingRoom.id ? { ...r, is_member: true } : r))
      setShowJoinModal(false)
      openRoom(pendingRoom, true)
      setPendingRoom(null)
    } catch (err) {
      setJoinError(err.message)
    } finally {
      setJoining(false)
    }
  }

  function closeJoinModal() {
    setShowJoinModal(false)
    setPendingRoom(null)
    setJoinPassword('')
    setJoinError('')
  }

  function sendTyping(isTyping) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'typing', typing: isTyping }))
    }
  }

  function handleInputChange(e) {
    setMsgInput(e.target.value)
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    sendTyping(true)
    clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => sendTyping(false), 2000)
  }

  function sendMessage(e) {
    e.preventDefault()
    if (!msgInput.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    clearTimeout(typingTimerRef.current)
    sendTyping(false)
    wsRef.current.send(JSON.stringify({ content: msgInput.trim() }))
    setMsgInput('')
  }

  async function handleCreateRoom(e) {
    e.preventDefault()
    if (!roomName.trim()) return
    setCreating(true)
    setCreateError('')
    try {
      const room = await createRoom(roomName.trim(), createPassword.trim() || undefined)
      setRooms(prev => [{ ...room, member_count: 1, is_member: true }, ...prev])
      closeCreateModal()
      openRoom(room, true)
    } catch (err) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  function closeCreateModal() {
    setShowCreateModal(false)
    setRoomName('')
    setCreatePassword('')
    setShowCreatePwd(false)
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
      <style>{`
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        .typing-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #667eea; display: inline-block;
          animation: typingBounce 1.2s infinite;
        }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        .room-btn:hover { background: rgba(102,126,234,0.15) !important; }
        .pwd-toggle { background: none; border: none; cursor: pointer; padding: 0 10px; color: #888; font-size: 16px; }
        .pwd-toggle:hover { color: #667eea; }
      `}</style>

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
            <button onClick={() => setShowCreateModal(true)} style={s.createBtn} title="Create room">
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
                className="room-btn"
                onClick={() => handleRoomClick(r)}
                style={{ ...s.roomItem, ...(activeRoom?.id === r.id ? s.roomItemActive : {}) }}
              >
                <div style={s.roomItemTop}>
                  <span style={s.roomName}>
                    {r.is_protected ? '🔒' : '#'} {r.name}
                  </span>
                  {r.is_member && <span style={s.memberBadge}>joined</span>}
                </div>
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
              <button onClick={() => setShowCreateModal(true)} style={s.createBtnLarge}>
                + Create a Room
              </button>
            </div>
          ) : (
            <>
              <div style={s.chatHeader}>
                <span style={s.chatRoomName}>
                  {activeRoom.is_protected ? '🔒' : '#'} {activeRoom.name}
                </span>
                {activeRoom.is_protected && (
                  <span style={s.protectedTag}>Password Protected</span>
                )}
              </div>
              <div style={s.messages}>
                {messages.length === 0 && (
                  <p style={s.empty}>No messages yet. Say hello!</p>
                )}
                {messages.map(m => {
                  if (m.isSystem) {
                    return (
                      <div key={m._sysKey} style={s.systemMsg}>
                        <span style={s.systemMsgLine} />
                        <span style={s.systemMsgText}>{m.message}</span>
                        <span style={s.systemMsgLine} />
                      </div>
                    )
                  }
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
              <div style={s.typingBar}>
                {typingUsers.length > 0 && (
                  <>
                    <span style={s.typingDots}>
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </span>
                    <span style={s.typingText}>
                      {typingUsers.length === 1
                        ? `${typingUsers[0]} is typing…`
                        : `${typingUsers.join(', ')} are typing…`}
                    </span>
                  </>
                )}
              </div>
              <form onSubmit={sendMessage} style={s.inputRow}>
                <input
                  style={s.input}
                  value={msgInput}
                  onChange={handleInputChange}
                  placeholder={`Message ${activeRoom.is_protected ? '🔒' : '#'}${activeRoom.name}`}
                />
                <button type="submit" style={s.sendBtn} disabled={!msgInput.trim()}>Send</button>
              </form>
            </>
          )}
        </main>
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div style={s.overlay} onClick={closeCreateModal}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>Create a Room</span>
              <button onClick={closeCreateModal} style={s.closeBtn}>✕</button>
            </div>
            <form onSubmit={handleCreateRoom} style={s.modalBody}>
              <div>
                <label style={s.label}>Room Name</label>
                <input
                  style={s.modalInput}
                  value={roomName}
                  onChange={e => { setRoomName(e.target.value); setCreateError('') }}
                  placeholder="e.g. general, design, random"
                  maxLength={100}
                  autoFocus
                />
              </div>
              <div>
                <label style={s.label}>
                  Password <span style={s.optionalTag}>(optional — leave blank for public room)</span>
                </label>
                <div style={s.pwdRow}>
                  <input
                    style={{ ...s.modalInput, flex: 1, border: 'none', borderRadius: 0 }}
                    type={showCreatePwd ? 'text' : 'password'}
                    value={createPassword}
                    onChange={e => setCreatePassword(e.target.value)}
                    placeholder="Set a room password…"
                    minLength={createPassword ? 4 : undefined}
                  />
                  <button
                    type="button"
                    className="pwd-toggle"
                    onClick={() => setShowCreatePwd(v => !v)}
                    title={showCreatePwd ? 'Hide' : 'Show'}
                  >
                    {showCreatePwd ? '🙈' : '👁'}
                  </button>
                </div>
                {createPassword && (
                  <p style={s.hintText}>
                    🔒 This room will be password protected
                  </p>
                )}
              </div>
              {createError && <p style={s.errorText}>{createError}</p>}
              <div style={s.modalActions}>
                <button type="button" onClick={closeCreateModal} style={s.cancelBtn}>Cancel</button>
                <button type="submit" style={s.submitBtn} disabled={creating || !roomName.trim()}>
                  {creating ? 'Creating…' : 'Create Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Password Modal */}
      {showJoinModal && pendingRoom && (
        <div style={s.overlay} onClick={closeJoinModal}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>🔒 Password Required</span>
              <button onClick={closeJoinModal} style={s.closeBtn}>✕</button>
            </div>
            <form onSubmit={handleJoinWithPassword} style={s.modalBody}>
              <p style={s.joinSubtitle}>
                Enter the password to join <strong>#{pendingRoom.name}</strong>
              </p>
              <div>
                <label style={s.label}>Room Password</label>
                <div style={s.pwdRow}>
                  <input
                    style={{ ...s.modalInput, flex: 1, border: 'none', borderRadius: 0 }}
                    type={showJoinPwd ? 'text' : 'password'}
                    value={joinPassword}
                    onChange={e => { setJoinPassword(e.target.value); setJoinError('') }}
                    placeholder="Enter room password…"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="pwd-toggle"
                    onClick={() => setShowJoinPwd(v => !v)}
                    title={showJoinPwd ? 'Hide' : 'Show'}
                  >
                    {showJoinPwd ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              {joinError && <p style={s.errorText}>{joinError}</p>}
              <div style={s.modalActions}>
                <button type="button" onClick={closeJoinModal} style={s.cancelBtn}>Cancel</button>
                <button type="submit" style={s.submitBtn} disabled={joining || !joinPassword.trim()}>
                  {joining ? 'Joining…' : 'Join Room'}
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
  roomItemTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 6 },
  roomName: { color: '#c8d0e8', fontSize: 14, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  memberBadge: {
    fontSize: 9, fontWeight: 700, color: '#48bb78', background: 'rgba(72,187,120,0.15)',
    border: '1px solid rgba(72,187,120,0.3)', borderRadius: 4, padding: '1px 5px', flexShrink: 0,
  },
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
  chatHeader: { padding: '14px 20px', borderBottom: '1px solid #eee', background: '#fafafa', display: 'flex', alignItems: 'center', gap: 10 },
  chatRoomName: { fontSize: 16, fontWeight: 700, color: '#333' },
  protectedTag: {
    fontSize: 11, fontWeight: 600, color: '#764ba2', background: 'rgba(118,75,162,0.1)',
    border: '1px solid rgba(118,75,162,0.25)', borderRadius: 4, padding: '2px 8px',
  },
  messages: { flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 },
  msgRow: { display: 'flex', width: '100%' },
  msg: { display: 'flex', flexDirection: 'column', maxWidth: '70%' },
  msgOther: { alignItems: 'flex-start', marginRight: 'auto' },
  msgOwn: { alignItems: 'flex-end', marginLeft: 'auto' },
  msgMeta: { display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 3 },
  msgUser: { fontSize: 12, fontWeight: 600, color: '#667eea' },
  msgUserOwn: { color: '#764ba2' },
  msgTime: { fontSize: 11, color: '#aaa' },
  systemMsg: { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', userSelect: 'none' },
  systemMsgLine: { flex: 1, height: 1, background: '#e8e8e8' },
  systemMsgText: { fontSize: 12, color: '#aaa', whiteSpace: 'nowrap', fontStyle: 'italic' },
  msgBubble: { background: '#f0f2f5', borderRadius: '0 12px 12px 12px', padding: '8px 14px', fontSize: 14, color: '#222', wordBreak: 'break-word' },
  msgBubbleOwn: { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', borderRadius: '12px 0 12px 12px' },
  typingBar: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 20px 0', minHeight: 24 },
  typingDots: { display: 'inline-flex', gap: 3, alignItems: 'center' },
  typingText: { fontSize: 12, color: '#888', fontStyle: 'italic' },
  inputRow: { display: 'flex', gap: 10, padding: '10px 20px 12px', borderTop: '1px solid #eee', background: '#fafafa' },
  input: { flex: 1, border: '1px solid #ddd', borderRadius: 8, padding: '10px 14px', fontSize: 14, outline: 'none' },
  sendBtn: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none',
    borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600,
  },
  // Modals
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    backdropFilter: 'blur(2px)',
  },
  modal: {
    background: '#fff', borderRadius: 12, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 20px', borderBottom: '1px solid #eee',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
  },
  modalTitle: { fontSize: 16, fontWeight: 700, color: '#fff' },
  closeBtn: { background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', lineHeight: 1 },
  modalBody: { padding: 24, display: 'flex', flexDirection: 'column', gap: 16 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 },
  optionalTag: { fontWeight: 400, color: '#999', fontSize: 11 },
  modalInput: {
    width: '100%', boxSizing: 'border-box',
    border: '1.5px solid #ddd', borderRadius: 8, padding: '10px 14px',
    fontSize: 15, outline: 'none', transition: 'border-color .2s',
  },
  pwdRow: { display: 'flex', alignItems: 'center', border: '1.5px solid #ddd', borderRadius: 8, overflow: 'hidden' },
  hintText: { fontSize: 12, color: '#764ba2', margin: '6px 0 0', fontWeight: 500 },
  joinSubtitle: { fontSize: 14, color: '#555', margin: 0 },
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
