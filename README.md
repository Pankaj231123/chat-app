# Chat App

Real-time chat app with a Go API, React frontend, JWT auth, password-protected rooms, encrypted message storage, and email-based password reset.

## Features

- Real-time messaging over WebSockets
- AES-256-GCM encryption before messages are stored in PostgreSQL
- Public and password-protected chat rooms
- JWT-based authentication
- Password reset flow with expiring one-time tokens
- Room membership tracking
- Typing indicators and join events
- Message history endpoint with cursor-style pagination

## Stack

### Backend

- Go
- Gin
- PostgreSQL
- `gorilla/websocket`
- `golang-jwt/jwt/v5`
- `bcrypt`

### Frontend

- React 18
- Vite 5
- React Router 6
- Tailwind Vite plugin

## Project Structure

```text
chat-app/
├── backend/
│   ├── config/
│   ├── crypto/
│   ├── db/
│   ├── handlers/
│   ├── mailer/
│   ├── middleware/
│   ├── models/
│   ├── .env.example
│   └── main.go
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   └── pages/
│   ├── .env.example
│   └── vite.config.js
└── README.md
```

## Prerequisites

- Go 1.21+
- Node.js 18+
- PostgreSQL

## Setup

### 1. Clone

```bash
git clone <repo-url>
cd chat-app
```

### 2. Configure the backend

```bash
cp backend/.env.example backend/.env
```

Important backend variables:

```env
PORT=8081
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_db_password
DB_NAME=chatapp
JWT_SECRET=replace_with_a_long_random_secret
MESSAGE_ENC_KEY=your_64_char_hex_key
APP_URL=http://localhost:5173
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

Notes:

- `MESSAGE_ENC_KEY` must be a 64-character hex string. Generate one with `openssl rand -hex 32`.
- If `SMTP_HOST` is blank, reset links are still generated and logged by the backend.
- `APP_URL` is used to build password reset links sent to the frontend.

### 3. Configure the frontend

```bash
cp frontend/.env.example frontend/.env
```

Frontend variable:

```env
VITE_API_BASE_URL=http://localhost:8081
```

Notes:

- In local development, Vite also proxies `/api` to `http://localhost:8081`.
- If `VITE_API_BASE_URL` is omitted, the frontend falls back to relative `/api` requests and uses the current browser host for WebSockets.

## Run Locally

### Backend

```bash
cd backend
go run main.go
```

The API starts on `http://localhost:8081` if you keep the default `PORT=8081`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`.

## Runtime Behavior

- Database tables are created automatically on backend startup.
- Room creators are automatically added as members.
- Protected rooms require a password only for users who are not already members.
- Messages are stored encrypted, then decrypted when fetched from history.
- WebSocket connections require membership in the target room.

## API

All HTTP routes are under `/api`.

### Auth

| Method | Path | Auth | Description |
|---|---|:---:|---|
| POST | `/api/signup` | No | Create a user and return a JWT |
| POST | `/api/login` | No | Log in and return a JWT |
| GET | `/api/me` | Yes | Return the current user |
| POST | `/api/forgot-password` | No | Create a reset token and send or log a reset link |
| POST | `/api/reset-password` | No | Reset password using a valid token |

### Rooms

| Method | Path | Auth | Description |
|---|---|:---:|---|
| POST | `/api/rooms` | Yes | Create a room, optionally with a password |
| GET | `/api/rooms` | Yes | List rooms with `member_count` and `is_member` |
| GET | `/api/rooms/:id` | Yes | Get room details plus members |
| POST | `/api/rooms/:id/join` | Yes | Join a room, with password if required |
| DELETE | `/api/rooms/:id/join` | Yes | Leave a room |

### Messages

| Method | Path | Auth | Description |
|---|---|:---:|---|
| GET | `/api/rooms/:id/messages` | Yes | Get message history, supports `limit` and `before` |
| POST | `/api/rooms/:id/messages` | Yes | Send a message via HTTP |
| GET | `/api/rooms/:id/ws?token=<jwt>` | Yes | Open a room WebSocket |

## WebSocket Protocol

Connect with:

```text
ws://localhost:8081/api/rooms/:id/ws?token=<jwt>
```

Client messages:

```json
{ "content": "hello" }
```

```json
{ "type": "typing", "typing": true }
```

Server messages can include:

- Normal chat messages with `id`, `room_id`, `user_id`, `username`, `content`, and `created_at`
- Typing events: `{ "type": "typing", "username": "...", "typing": true }`
- Join events: `{ "type": "join", "username": "...", "message": "..." }`

## Database Tables

The backend creates these tables automatically:

- `users`
- `rooms`
- `room_members`
- `messages`
- `password_reset_tokens`

## Development Notes

- CORS is currently configured in the backend for `http://localhost:5173`.
- The Vite dev server proxies `/api` requests and WebSocket upgrades to the backend.
- WebSocket auth accepts the JWT through the `token` query parameter.
