const BASE = `${import.meta.env.VITE_API_BASE_URL ?? ''}/api`

async function request(path, options = {}) {
  const token = localStorage.getItem('token')
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...options, headers })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export async function listRooms() {
  return request('/rooms')
}

export async function createRoom(name) {
  return request('/rooms', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export async function joinRoom(id) {
  return request(`/rooms/${id}/join`, { method: 'POST' })
}

export async function getMessages(id) {
  return request(`/rooms/${id}/messages`)
}
