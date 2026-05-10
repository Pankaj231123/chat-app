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

export async function signup(username, email, password) {
  return request('/signup', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  })
}

export async function login(email, password) {
  return request('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function getMe() {
  return request('/me')
}

export async function forgotPassword(email) {
  return request('/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function resetPassword(token, password) {
  return request('/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  })
}
