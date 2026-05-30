import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { listRooms, createRoom, joinRoom, getMessages } from '../api/rooms'

export default function Chat() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
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
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth)
  const isNarrow = viewportWidth < 1180
  const isMobile = viewportWidth < 900

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

  useEffect(() => {
    return () => {
      clearTimeout(typingTimerRef.current)
      wsRef.current?.close()
    }
  }, [])

  useEffect(() => {
    function handleResize() {
      setViewportWidth(window.innerWidth)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key !== 'Escape') return

      if (showCreateModal) {
        closeCreateModal()
        return
      }

      if (showJoinModal) {
        closeJoinModal()
        return
      }

      if (activeRoom) {
        closeActiveRoom()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showCreateModal, showJoinModal, activeRoom])

  useEffect(() => {
    const roomId = searchParams.get('room')
    if (!roomId) {
      if (activeRoom) closeActiveRoom(false)
      return
    }
    if (rooms.length === 0) return

    const targetRoom = rooms.find(room => String(room.id) === roomId)
    if (!targetRoom) {
      closeActiveRoom(false)
      setSearchParams({}, { replace: true })
      return
    }
    if (activeRoom?.id === targetRoom.id) return

    if (targetRoom.is_protected && !targetRoom.is_member) {
      closeActiveRoom(false)
      setSearchParams({}, { replace: true })
      return
    }

    openRoom(targetRoom, true, false)
  }, [searchParams, rooms, activeRoom])

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
  function closeActiveRoom(updateHistory = true) {
    clearTimeout(typingTimerRef.current)
    wsRef.current?.close()
    wsRef.current = null
    setActiveRoom(null)
    setMessages([])
    setMsgInput('')
    setTypingUsers([])
    if (updateHistory) {
      setSearchParams({})
    }
  }

  async function openRoom(room, skipJoin = false, updateHistory = true) {
    if (activeRoom?.id === room.id) return
    clearTimeout(typingTimerRef.current)
    wsRef.current?.close()
    wsRef.current = null
    setActiveRoom(room)
    setMessages([])
    setMsgInput('')
    setTypingUsers([])
    if (updateHistory) {
      setSearchParams({ room: String(room.id) })
    }

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
    closeActiveRoom(false)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  if (!user) return null

  const joinedRooms = rooms.filter(room => room.is_member)
  const quickRooms = (joinedRooms.length > 0 ? joinedRooms : rooms).slice(0, 3)
  const protectedCount = rooms.filter(room => room.is_protected).length
  const isProtectedDraft = createPassword.trim().length > 0

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

      <div style={{ ...s.body, ...(isMobile ? s.bodyMobile : null) }}>
        {/* Sidebar */}
        <aside style={{ ...s.sidebar, ...(isMobile ? s.sidebarMobile : null) }}>
          <div style={s.sidebarHeader}>
            <span style={s.sidebarTitle}>Rooms</span>
            <button onClick={() => setShowCreateModal(true)} style={s.createBtn} title="Create room">
              + New
            </button>
          </div>
          <div style={{ ...s.roomList, ...(isMobile ? s.roomListMobile : null) }}>
            {rooms.length === 0 && (
              <p style={s.empty}>No rooms yet. Create one!</p>
            )}
            {rooms.map(r => (
              <button
                key={r.id}
                className="room-btn"
                onClick={() => handleRoomClick(r)}
                style={{
                  ...s.roomItem,
                  ...(activeRoom?.id === r.id ? s.roomItemActive : {}),
                  ...(isMobile ? s.roomItemMobile : null),
                }}
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
        <main style={{ ...s.main, ...(isMobile ? s.mainMobile : null) }}>
          {!activeRoom ? (
            <div style={{ ...s.placeholder, ...(isNarrow ? s.placeholderNarrow : null), ...(isMobile ? s.placeholderMobile : null) }}>
              <section style={s.emptyHeroCard}>
                <div style={s.emptyHeroIcon}>💬</div>
                <span style={s.emptyEyebrow}>Workspace Ready</span>
                <h1 style={s.emptyTitle}>Choose where the conversation starts.</h1>
                <p style={s.placeholderText}>
                  Open one of your rooms, or create a new space for team updates, private threads, or quick drop-ins.
                </p>

                <div style={{ ...s.emptyStats, ...(isNarrow ? s.emptyStatsNarrow : null) }}>
                  <div style={s.statCard}>
                    <span style={s.statLabel}>Joined Rooms</span>
                    <strong style={s.statValue}>{joinedRooms.length}</strong>
                  </div>
                  <div style={s.statCard}>
                    <span style={s.statLabel}>Protected</span>
                    <strong style={s.statValue}>{protectedCount}</strong>
                  </div>
                  <div style={s.statCard}>
                    <span style={s.statLabel}>Total Rooms</span>
                    <strong style={s.statValue}>{rooms.length}</strong>
                  </div>
                </div>

                <div style={{ ...s.emptyActions, ...(isMobile ? s.emptyActionsMobile : null) }}>
                  <button onClick={() => setShowCreateModal(true)} style={s.createBtnLarge}>
                    + Create a Room
                  </button>
                  {quickRooms[0] && (
                    <button onClick={() => handleRoomClick(quickRooms[0])} style={s.secondaryActionBtn}>
                      Open {quickRooms[0].name}
                    </button>
                  )}
                </div>
              </section>

              <aside style={s.previewPanel}>
                <div style={s.previewHeader}>
                  <span style={s.previewTitle}>Jump Back In</span>
                  <span style={s.previewMeta}>{quickRooms.length} shortcut{quickRooms.length !== 1 ? 's' : ''}</span>
                </div>

                {quickRooms.length === 0 ? (
                  <div style={s.previewEmptyCard}>
                    <strong style={s.previewEmptyTitle}>No rooms yet</strong>
                    <p style={s.previewEmptyText}>
                      Create your first room to start organizing conversations.
                    </p>
                  </div>
                ) : (
                  quickRooms.map(room => (
                    <button
                      key={room.id}
                      onClick={() => handleRoomClick(room)}
                      style={s.previewRoomCard}
                    >
                      <div style={s.previewRoomTop}>
                        <span style={s.previewRoomName}>{room.is_protected ? '🔒' : '#'} {room.name}</span>
                        {room.is_member && <span style={s.previewRoomBadge}>joined</span>}
                      </div>
                      <p style={s.previewRoomText}>
                        {room.member_count} member{room.member_count !== 1 ? 's' : ''} in this room
                        {room.is_protected ? ' · password required for new members' : ' · open to members instantly'}
                      </p>
                    </button>
                  ))
                )}

                <div style={s.previewNote}>
                  Protected rooms help keep sensitive discussions gated without leaving the app.
                </div>
              </aside>
            </div>
          ) : (
            <>
              <div style={s.chatHeader}>
                <div style={s.chatHeaderMain}>
                  <span style={s.chatRoomName}>
                    {activeRoom.is_protected ? '🔒' : '#'} {activeRoom.name}
                  </span>
                  <p style={s.chatHeaderText}>
                    {activeRoom.member_count} member{activeRoom.member_count !== 1 ? 's' : ''}
                    {activeRoom.is_protected ? ' · protected room' : ' · open room'}
                  </p>
                </div>
                <div style={s.chatHeaderMeta}>
                  {activeRoom.is_protected && (
                    <span style={s.protectedTag}>Password Protected</span>
                  )}
                  <span style={s.headerHint}>Esc to dashboard</span>
                </div>
              </div>
              <div style={s.messages}>
                {messages.length === 0 && (
                  <div style={s.roomEmptyState}>
                    <div style={s.roomEmptyOrb}>#</div>
                    <span style={s.roomEmptyEyebrow}>Fresh Room</span>
                    <h2 style={s.roomEmptyTitle}>No messages yet in {activeRoom.name}</h2>
                    <p style={s.roomEmptyText}>
                      Break the silence with a first update, question, or quick intro so everyone knows where to start.
                    </p>
                    <div style={s.roomEmptyMeta}>
                      <div style={s.roomMetaCard}>
                        <span style={s.roomMetaLabel}>Members</span>
                        <strong style={s.roomMetaValue}>{activeRoom.member_count}</strong>
                      </div>
                      <div style={s.roomMetaCard}>
                        <span style={s.roomMetaLabel}>Access</span>
                        <strong style={s.roomMetaValue}>{activeRoom.is_protected ? 'Locked' : 'Open'}</strong>
                      </div>
                    </div>
                  </div>
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
                <div style={s.composerWrap}>
                  <input
                    style={s.input}
                    value={msgInput}
                    onChange={handleInputChange}
                    placeholder={`Message ${activeRoom.is_protected ? '🔒' : '#'}${activeRoom.name}`}
                  />
                  <span style={s.composerHint}>Press Enter to send</span>
                </div>
                <button type="submit" style={s.sendBtn} disabled={!msgInput.trim()}>Send</button>
              </form>
            </>
          )}
        </main>
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div style={s.overlay} onClick={closeCreateModal}>
          <div style={{ ...s.modal, ...s.createModal }} onClick={e => e.stopPropagation()}>
            <div style={{ ...s.modalHeader, ...s.createModalHeader }}>
              <div>
                <div style={s.modalEyebrow}>New Workspace</div>
                <span style={{ ...s.modalTitle, ...s.createModalTitle }}>Create a Room</span>
              </div>
              <button onClick={closeCreateModal} style={{ ...s.closeBtn, ...s.createCloseBtn }}>✕</button>
            </div>
            <form onSubmit={handleCreateRoom} style={{ ...s.modalBody, ...s.createModalBody }}>
              <div style={s.createModalIntro}>
                <p style={s.createLead}>
                  Start a fresh conversation space for your team, side project, or private discussion.
                </p>
                <div style={s.modeCards}>
                  <div style={{ ...s.modeCard, ...(isProtectedDraft ? s.modeCardMuted : s.modeCardActive) }}>
                    <span style={s.modeCardLabel}>Public Room</span>
                    <strong style={s.modeCardTitle}>Anyone can join instantly</strong>
                    <p style={s.modeCardText}>Best for general chat, open planning, and shared updates.</p>
                  </div>
                  <div style={{ ...s.modeCard, ...(isProtectedDraft ? s.modeCardActive : s.modeCardMuted) }}>
                    <span style={s.modeCardLabel}>Protected Room</span>
                    <strong style={s.modeCardTitle}>Require a password</strong>
                    <p style={s.modeCardText}>Use this for focused workstreams or more private conversations.</p>
                  </div>
                </div>
              </div>

              <div style={s.fieldBlock}>
                <label style={s.label}>Room Name</label>
                <input
                  style={s.modalInput}
                  value={roomName}
                  onChange={e => { setRoomName(e.target.value); setCreateError('') }}
                  placeholder="e.g. general, design, random"
                  maxLength={100}
                  autoFocus
                />
                <p style={s.fieldHint}>Keep it short and recognizable so people can find it quickly.</p>
              </div>

              <div style={s.fieldBlock}>
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
                <p style={{ ...s.hintText, ...(isProtectedDraft ? s.hintTextActive : null) }}>
                  {isProtectedDraft
                    ? 'Locked room enabled. New members will need this password to join.'
                    : 'No password means this room stays public for signed-in members.'}
                </p>
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
          <div style={{ ...s.modal, ...s.joinModal }} onClick={e => e.stopPropagation()}>
            <div style={{ ...s.modalHeader, ...s.joinModalHeader }}>
              <div>
                <div style={s.modalEyebrow}>Protected Access</div>
                <span style={{ ...s.modalTitle, ...s.joinModalTitle }}>Password Required</span>
              </div>
              <button onClick={closeJoinModal} style={{ ...s.closeBtn, ...s.joinCloseBtn }}>✕</button>
            </div>
            <form onSubmit={handleJoinWithPassword} style={{ ...s.modalBody, ...s.joinModalBody }}>
              <div style={s.joinIntroCard}>
                <div style={s.joinRoomBadgeRow}>
                  <span style={s.joinRoomPill}>🔒 #{pendingRoom.name}</span>
                  <span style={s.joinMembersPill}>{pendingRoom.member_count} member{pendingRoom.member_count !== 1 ? 's' : ''}</span>
                </div>
                <p style={s.joinLead}>
                  This room is password protected. Enter the access key below to join the conversation.
                </p>
              </div>

              <div style={s.fieldBlock}>
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
                <p style={s.fieldHint}>Ask a room member or the creator if you do not have the password yet.</p>
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
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: 'radial-gradient(circle at top left, #2f6bff 0%, rgba(47,107,255,0) 28%), linear-gradient(135deg, #071626 0%, #0f2840 48%, #6f6340 155%)',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 26px', height: 66, flexShrink: 0,
    background: 'linear-gradient(135deg, rgba(93,121,240,0.96), rgba(120,81,169,0.9))',
    color: '#fff', boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
    backdropFilter: 'blur(12px)',
  },
  logo: { fontSize: 20, fontWeight: 700 },
  userInfo: { display: 'flex', alignItems: 'center', gap: 16 },
  username: { fontSize: 14, fontWeight: 600 },
  logoutBtn: {
    background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)',
    borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontSize: 13,
  },
  body: { display: 'flex', flex: 1, overflow: 'hidden', padding: 18, gap: 18, minHeight: 0 },
  bodyMobile: { flexDirection: 'column', padding: 14, gap: 14, minHeight: 0 },
  sidebar: {
    width: 270,
    background: 'rgba(17, 24, 39, 0.88)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 24,
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    overflow: 'hidden',
    boxShadow: '0 18px 40px rgba(4, 13, 25, 0.22)',
    backdropFilter: 'blur(12px)',
  },
  sidebarMobile: { width: '100%', maxHeight: 240 },
  sidebarHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' },
  sidebarTitle: { color: '#a0a8c0', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 },
  createBtn: {
    background: 'linear-gradient(135deg, #5b77ea, #7d58b7)', color: '#fff', border: 'none',
    borderRadius: 10, padding: '8px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700,
  },
  roomList: { flex: 1, overflowY: 'auto', padding: '10px 8px 12px' },
  roomListMobile: { display: 'flex', gap: 8, padding: 10, overflowX: 'auto', overflowY: 'hidden' },
  roomItem: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%',
    background: 'rgba(255,255,255,0.02)', border: '1px solid transparent', borderRadius: 14, padding: '10px 12px',
    cursor: 'pointer', textAlign: 'left', marginBottom: 6, transition: 'background .15s, border-color .15s, transform .15s',
  },
  roomItemMobile: { minWidth: 200, marginBottom: 0 },
  roomItemActive: { background: 'rgba(91,119,234,0.18)', borderColor: 'rgba(121,148,255,0.28)', transform: 'translateY(-1px)' },
  roomItemTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 6 },
  roomName: { color: '#e5ecff', fontSize: 14, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  memberBadge: {
    fontSize: 9, fontWeight: 700, color: '#48bb78', background: 'rgba(72,187,120,0.15)',
    border: '1px solid rgba(72,187,120,0.3)', borderRadius: 999, padding: '2px 6px', flexShrink: 0,
  },
  memberCount: { color: '#8f9ab2', fontSize: 11, marginTop: 4 },
  empty: { color: '#5a6070', fontSize: 13, padding: '12px 10px' },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: 0,
    background: 'linear-gradient(180deg, rgba(249,247,242,0.96), rgba(255,255,255,0.92))',
    border: '1px solid rgba(255,255,255,0.55)',
    borderRadius: 28,
    boxShadow: '0 22px 54px rgba(4, 13, 25, 0.16)',
    backdropFilter: 'blur(14px)',
  },
  mainMobile: { minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' },
  placeholder: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.9fr)',
    gap: 22,
    padding: 26,
    minHeight: 0,
  },
  placeholderNarrow: { gridTemplateColumns: '1fr' },
  placeholderMobile: { padding: 16, gap: 16, minHeight: 'max-content' },
  emptyHeroCard: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '34px 34px 30px',
    borderRadius: 28,
    background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(247,240,228,0.96))',
    border: '1px solid rgba(24,38,58,0.08)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
  },
  emptyHeroIcon: {
    width: 62,
    height: 62,
    borderRadius: 18,
    display: 'grid',
    placeItems: 'center',
    fontSize: 28,
    background: 'linear-gradient(135deg, #eef2ff, #f5e8ff)',
    boxShadow: '0 16px 32px rgba(90, 112, 182, 0.2)',
  },
  emptyEyebrow: {
    marginTop: 22,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#6f7b91',
  },
  emptyTitle: {
    margin: '12px 0 14px',
    fontSize: 'clamp(2rem, 4vw, 3.4rem)',
    lineHeight: 0.98,
    color: '#142132',
    fontWeight: 800,
    maxWidth: 560,
  },
  placeholderText: { color: '#536173', fontSize: 16, lineHeight: 1.7, margin: 0, maxWidth: 600 },
  emptyStats: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginTop: 28 },
  emptyStatsNarrow: { gridTemplateColumns: '1fr' },
  statCard: {
    padding: '16px 16px 14px',
    borderRadius: 18,
    background: 'rgba(18, 33, 52, 0.05)',
    border: '1px solid rgba(18, 33, 52, 0.08)',
  },
  statLabel: { display: 'block', fontSize: 12, fontWeight: 700, color: '#6b778c', textTransform: 'uppercase', letterSpacing: '0.06em' },
  statValue: { display: 'block', marginTop: 10, fontSize: 28, color: '#142132', lineHeight: 1, fontWeight: 800 },
  emptyActions: { display: 'flex', gap: 12, marginTop: 26, flexWrap: 'wrap' },
  emptyActionsMobile: { flexDirection: 'column', alignItems: 'stretch' },
  createBtnLarge: {
    background: 'linear-gradient(135deg, #5b77ea, #7d58b7)', color: '#fff', border: 'none',
    borderRadius: 12, padding: '13px 24px', cursor: 'pointer', fontSize: 15, fontWeight: 700,
    boxShadow: '0 14px 24px rgba(91,119,234,0.24)',
  },
  secondaryActionBtn: {
    background: 'rgba(255,255,255,0.82)', color: '#203147', border: '1px solid rgba(20,33,50,0.12)',
    borderRadius: 12, padding: '13px 18px', cursor: 'pointer', fontSize: 15, fontWeight: 700,
  },
  previewPanel: {
    padding: 24,
    borderRadius: 28,
    background: 'linear-gradient(180deg, rgba(20, 32, 47, 0.96), rgba(27, 39, 57, 0.94))',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#f4f7fb',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    boxShadow: '0 22px 48px rgba(5, 12, 25, 0.18)',
  },
  previewHeader: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  previewTitle: { fontSize: 15, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#f8d588' },
  previewMeta: { fontSize: 12, color: 'rgba(244,247,251,0.56)' },
  previewEmptyCard: {
    padding: '18px 18px 16px',
    borderRadius: 20,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  previewEmptyTitle: { display: 'block', fontSize: 16, color: '#fff' },
  previewEmptyText: { margin: '8px 0 0', color: 'rgba(244,247,251,0.72)', fontSize: 14, lineHeight: 1.6 },
  previewRoomCard: {
    width: '100%',
    textAlign: 'left',
    padding: '18px 18px 16px',
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    cursor: 'pointer',
  },
  previewRoomTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  previewRoomName: { fontSize: 21, fontWeight: 700, lineHeight: 1.1 },
  previewRoomBadge: {
    fontSize: 10, fontWeight: 800, color: '#48bb78', background: 'rgba(72,187,120,0.12)',
    border: '1px solid rgba(72,187,120,0.24)', borderRadius: 999, padding: '4px 8px',
  },
  previewRoomText: { margin: '10px 0 0', fontSize: 14, lineHeight: 1.6, color: 'rgba(244,247,251,0.72)' },
  previewNote: {
    marginTop: 'auto',
    padding: '14px 16px',
    borderRadius: 16,
    background: 'rgba(248,213,136,0.08)',
    color: '#f8d588',
    fontSize: 13,
    lineHeight: 1.55,
  },
  chatHeader: {
    padding: '20px 24px 18px',
    borderBottom: '1px solid rgba(17,24,39,0.08)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.72), rgba(249,247,242,0.48))',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
    flexWrap: 'wrap',
  },
  chatHeaderMain: { display: 'flex', flexDirection: 'column', gap: 6 },
  chatRoomName: { fontSize: 28, fontWeight: 800, color: '#162233', lineHeight: 1 },
  chatHeaderText: { margin: 0, fontSize: 14, color: '#627084' },
  chatHeaderMeta: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  protectedTag: {
    fontSize: 11, fontWeight: 700, color: '#764ba2', background: 'rgba(118,75,162,0.1)',
    border: '1px solid rgba(118,75,162,0.25)', borderRadius: 999, padding: '5px 10px',
  },
  headerHint: {
    fontSize: 11,
    fontWeight: 700,
    color: '#718097',
    background: 'rgba(17,24,39,0.05)',
    border: '1px solid rgba(17,24,39,0.08)',
    borderRadius: 999,
    padding: '5px 10px',
  },
  messages: { flex: 1, overflowY: 'auto', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 12, background: 'linear-gradient(180deg, rgba(250,249,246,0.82), rgba(244,247,251,0.92))' },
  roomEmptyState: {
    margin: 'auto',
    width: '100%',
    maxWidth: 560,
    padding: '32px 30px 28px',
    borderRadius: 28,
    background: 'linear-gradient(135deg, rgba(255,255,255,0.92), rgba(246,239,228,0.92))',
    border: '1px solid rgba(24,38,58,0.08)',
    boxShadow: '0 22px 46px rgba(9, 20, 36, 0.08)',
    textAlign: 'center',
  },
  roomEmptyOrb: {
    width: 68,
    height: 68,
    margin: '0 auto',
    borderRadius: 22,
    display: 'grid',
    placeItems: 'center',
    fontSize: 28,
    fontWeight: 800,
    color: '#3559a5',
    background: 'linear-gradient(135deg, #eef2ff, #f4eafe)',
    boxShadow: '0 18px 32px rgba(91,119,234,0.18)',
  },
  roomEmptyEyebrow: {
    display: 'block',
    marginTop: 18,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#6f7b91',
  },
  roomEmptyTitle: {
    margin: '12px 0 12px',
    fontSize: 'clamp(1.8rem, 3vw, 2.6rem)',
    lineHeight: 1.05,
    color: '#162233',
  },
  roomEmptyText: {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.7,
    color: '#58677b',
  },
  roomEmptyMeta: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 12,
    marginTop: 24,
  },
  roomMetaCard: {
    padding: '14px 14px 12px',
    borderRadius: 18,
    background: 'rgba(17,24,39,0.04)',
    border: '1px solid rgba(17,24,39,0.07)',
  },
  roomMetaLabel: {
    display: 'block',
    fontSize: 11,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: '#758196',
  },
  roomMetaValue: {
    display: 'block',
    marginTop: 10,
    fontSize: 20,
    color: '#162233',
    fontWeight: 800,
  },
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
  msgBubble: { background: '#edf1f6', borderRadius: '0 16px 16px 16px', padding: '10px 14px', fontSize: 14, color: '#222', wordBreak: 'break-word', boxShadow: '0 8px 20px rgba(14, 20, 35, 0.04)' },
  msgBubbleOwn: { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', borderRadius: '12px 0 12px 12px' },
  typingBar: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 24px 0', minHeight: 24, background: 'rgba(255,255,255,0.35)' },
  typingDots: { display: 'inline-flex', gap: 3, alignItems: 'center' },
  typingText: { fontSize: 12, color: '#888', fontStyle: 'italic' },
  inputRow: { display: 'flex', gap: 10, padding: '14px 24px 18px', borderTop: '1px solid rgba(17,24,39,0.08)', background: 'rgba(255,255,255,0.7)' },
  composerWrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  input: { flex: 1, border: '1px solid #d6dde8', borderRadius: 14, padding: '13px 14px', fontSize: 14, outline: 'none', background: '#fffdf9', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.75)' },
  composerHint: { fontSize: 12, color: '#7a879b', paddingLeft: 2 },
  sendBtn: {
    background: 'linear-gradient(135deg, #5b77ea, #7d58b7)', color: '#fff', border: 'none',
    borderRadius: 14, padding: '0 22px', minHeight: 50, cursor: 'pointer', fontSize: 14, fontWeight: 700,
  },
  // Modals
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    backdropFilter: 'blur(2px)',
  },
  modal: {
    background: '#fff', borderRadius: 22, width: 420, boxShadow: '0 28px 80px rgba(0,0,0,0.24)',
    overflow: 'hidden',
  },
  createModal: {
    width: 560,
    maxWidth: 'calc(100vw - 28px)',
    background: 'linear-gradient(180deg, #f9f6ef, #ffffff)',
    border: '1px solid rgba(17,24,39,0.08)',
  },
  modalHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 20px', borderBottom: '1px solid #eee',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
  },
  createModalHeader: {
    padding: '22px 24px 18px',
    borderBottom: '1px solid rgba(17,24,39,0.08)',
    background: 'linear-gradient(135deg, rgba(91,119,234,0.18), rgba(125,88,183,0.14))',
  },
  modalEyebrow: {
    marginBottom: 6,
    color: '#6e7b92',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  modalTitle: { fontSize: 16, fontWeight: 700, color: '#fff' },
  createModalTitle: { color: '#162233', fontSize: 22, fontWeight: 800 },
  createModalBody: { padding: 24, gap: 18 },
  joinModal: {
    width: 500,
    maxWidth: 'calc(100vw - 28px)',
    background: 'linear-gradient(180deg, #f8f3ea, #ffffff)',
    border: '1px solid rgba(17,24,39,0.08)',
  },
  joinModalHeader: {
    padding: '22px 24px 18px',
    borderBottom: '1px solid rgba(17,24,39,0.08)',
    background: 'linear-gradient(135deg, rgba(120,81,169,0.16), rgba(91,119,234,0.12))',
  },
  joinModalTitle: { color: '#162233', fontSize: 22, fontWeight: 800 },
  joinCloseBtn: { color: '#546277' },
  joinModalBody: { padding: 24, gap: 18 },
  closeBtn: { background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', lineHeight: 1 },
  createCloseBtn: { color: '#546277' },
  modalBody: { padding: 24, display: 'flex', flexDirection: 'column', gap: 16 },
  createModalIntro: {
    padding: '2px 0 2px',
  },
  createLead: {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.7,
    color: '#49586d',
  },
  modeCards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 12,
    marginTop: 16,
  },
  modeCard: {
    padding: '16px 16px 14px',
    borderRadius: 18,
    border: '1px solid rgba(17,24,39,0.08)',
    textAlign: 'left',
  },
  modeCardActive: {
    background: 'linear-gradient(135deg, rgba(255,255,255,0.98), rgba(238,242,255,0.92))',
    boxShadow: '0 12px 24px rgba(91,119,234,0.12)',
  },
  modeCardMuted: {
    background: 'rgba(17,24,39,0.03)',
  },
  modeCardLabel: {
    display: 'block',
    fontSize: 11,
    fontWeight: 800,
    color: '#6e7b92',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  modeCardTitle: {
    display: 'block',
    marginTop: 10,
    fontSize: 16,
    color: '#162233',
    lineHeight: 1.2,
  },
  modeCardText: {
    margin: '8px 0 0',
    fontSize: 13,
    lineHeight: 1.55,
    color: '#5d6a7f',
  },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 },
  optionalTag: { fontWeight: 400, color: '#999', fontSize: 11 },
  fieldBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  modalInput: {
    width: '100%', boxSizing: 'border-box',
    border: '1.5px solid #d8dee7', borderRadius: 12, padding: '12px 14px',
    fontSize: 15, outline: 'none', transition: 'border-color .2s',
    background: 'rgba(255,255,255,0.9)',
  },
  pwdRow: { display: 'flex', alignItems: 'center', border: '1.5px solid #d8dee7', borderRadius: 12, overflow: 'hidden', background: 'rgba(255,255,255,0.9)' },
  fieldHint: { fontSize: 12, color: '#7a879b', margin: '8px 0 0', lineHeight: 1.5 },
  hintText: { fontSize: 12, color: '#67758b', margin: '8px 0 0', fontWeight: 500, lineHeight: 1.5 },
  hintTextActive: { color: '#764ba2' },
  joinSubtitle: { fontSize: 14, color: '#555', margin: 0 },
  joinIntroCard: {
    padding: '18px 18px 16px',
    borderRadius: 20,
    background: 'linear-gradient(135deg, rgba(255,255,255,0.92), rgba(240,233,249,0.92))',
    border: '1px solid rgba(118,75,162,0.14)',
  },
  joinRoomBadgeRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  joinRoomPill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '7px 12px',
    borderRadius: 999,
    background: 'rgba(118,75,162,0.12)',
    color: '#764ba2',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.04em',
  },
  joinMembersPill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '7px 12px',
    borderRadius: 999,
    background: 'rgba(17,24,39,0.06)',
    color: '#5c687c',
    fontSize: 12,
    fontWeight: 700,
  },
  joinLead: {
    margin: '14px 0 0',
    fontSize: 14,
    lineHeight: 1.65,
    color: '#546277',
  },
  errorText: { color: '#e53e3e', fontSize: 13, margin: 0 },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  cancelBtn: {
    background: '#eef2f6', color: '#465468', border: 'none',
    borderRadius: 10, padding: '11px 18px', cursor: 'pointer', fontSize: 14, fontWeight: 600,
  },
  submitBtn: {
    background: 'linear-gradient(135deg, #5b77ea, #7d58b7)', color: '#fff', border: 'none',
    borderRadius: 10, padding: '11px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 700,
  },
}
