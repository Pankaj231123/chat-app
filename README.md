# Chat App

A full-stack real-time chat application with end-to-end message encryption, password-protected rooms, and secure email-based password reset — built with a Go backend and a React + Vite frontend.

## Features

- **Real-time messaging** via WebSockets with live typing indicators
- **Message encryption** — AES-256-GCM encryption at rest for every message
- **Password-protected rooms** — create private rooms secured with a bcrypt-hashed passphrase
- **JWT authentication** — stateless, 7-day signed tokens
- **Password reset** — secure email flow with one-time, time-limited tokens
- **Room management** — create, join, leave, and browse chat rooms
- **Paginated message history** — cursor-based pagination (limit + before)
- **Password visibility toggle** — show/hide password on login and signup

## Tech Stack

**Backend**
| Package | Purpose |
|---------|---------|
| [Go](https://go.dev/) + [Gin](https://github.com/gin-gonic/gin) | HTTP framework & routing |
| [PostgreSQL](https://www.postgresql.org/) + `lib/pq` | Relational database |
| [gorilla/websocket](https://github.com/gorilla/websocket) | WebSocket server |
| [golang-jwt/jwt v5](https://github.com/golang-jwt/jwt) | JWT signing & verification |
| [bcrypt](https://pkg.go.dev/golang.org/x/crypto/bcrypt) | Password hashing |
| AES-256-GCM (`crypto/aes`, `crypto/cipher`) | Message encryption at rest |
| [godotenv](https://github.com/joho/godotenv) | `.env` file loading |

**Frontend**
| Package | Purpose |
|---------|---------|
| [React 18](https://react.dev/) | UI framework |
| [Vite 5](https://vitejs.dev/) + [`@tailwindcss/vite`](https://tailwindcss.com/) | Build tool & CSS |
| [React Router v6](https://reactrouter.com/) | Client-side routing |

## Project Structure

```
chat-app/
├── backend/
│   ├── config/        # Environment & app config loading
│   ├── crypto/        # AES-256-GCM message encrypt/decrypt
│   ├── db/            # PostgreSQL connection & auto-migrations
│   ├── handlers/
│   │   ├── auth.go    # Signup, login, forgot/reset password
│   │   └── room.go    # Rooms, messages, WebSocket hub
│   ├── mailer/        # SMTP mailer + no-op console fallback
│   ├── middleware/    # JWT auth middleware
│   ├── models/        # User, Room, Message, RoomMember structs
│   ├── main.go
│   └── .env           # Local env vars (not committed)
└── frontend/
    ├── vite.config.js # Vite + Tailwind + /api proxy to :8081
    └── src/
        ├── api/
        │   ├── auth.js    # Login, signup, forgot/reset password calls
        │   └── rooms.js   # Room & message API calls
        ├── pages/
        │   ├── Login.jsx
        │   ├── Signup.jsx
        │   ├── Chat.jsx
        │   ├── ForgotPassword.jsx
        │   └── ResetPassword.jsx
        └── App.jsx
```

## Getting Started

### Prerequisites

- Go 1.21+
- PostgreSQL running locally
- Node.js 18+

### 1. Clone the repo

```bash
git clone <repo-url>
cd chat-app
```

### 2. Configure the backend

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
PORT=8081
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=chatapp

# Generate with: openssl rand -base64 32
JWT_SECRET=your_jwt_secret_here

# 64-char hex string — 32-byte AES-256 key
# Generate with: openssl rand -hex 32
MESSAGE_ENC_KEY=your_64char_hex_key_here

# Frontend base URL — used to build password-reset links
APP_URL=http://localhost:5173

# SMTP — leave SMTP_HOST blank to log reset links to console instead
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=Chat App <you@gmail.com>
```

> **Gmail tip:** Use an [App Password](https://support.google.com/accounts/answer/185833) for `SMTP_PASS`, not your account password. Port `587` = STARTTLS, port `465` = implicit TLS.

### 3. Run the backend

```bash
cd backend
go run main.go
```

The server starts on `http://localhost:8081`. All database tables are created automatically on first startup.

### 4. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

The UI is available at `http://localhost:5173`. The Vite dev server proxies all `/api` requests to the backend, so no CORS configuration is needed during development.

## API Reference

All routes are prefixed with `/api`. Protected routes require an `Authorization: Bearer <token>` header.

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| POST | `/api/signup` | | Register a new user |
| POST | `/api/login` | | Login and receive a JWT |
| GET | `/api/me` | ✓ | Get the current user |
| POST | `/api/forgot-password` | | Send a password-reset email |
| POST | `/api/reset-password` | | Reset password with the emailed token |

### Rooms

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| POST | `/api/rooms` | ✓ | Create a room (optional password) |
| GET | `/api/rooms` | ✓ | List all rooms |
| GET | `/api/rooms/:id` | ✓ | Get a single room |
| POST | `/api/rooms/:id/join` | ✓ | Join a room (provide password if protected) |
| DELETE | `/api/rooms/:id/join` | ✓ | Leave a room |

### Messages

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| GET | `/api/rooms/:id/messages` | ✓ | Fetch message history (`?limit=50&before=<id>`) |
| POST | `/api/rooms/:id/messages` | ✓ | Send a message (REST fallback) |
| GET | `/api/rooms/:id/ws?token=<jwt>` | ✓ | Open a WebSocket for real-time chat |

### WebSocket Protocol

Connect with a valid JWT in the query string:

```
ws://localhost:8081/api/rooms/:id/ws?token=<jwt>
```

Send messages as JSON:

```json
{ "content": "Hello, world!" }
```

Incoming broadcasts include the full message object with sender info. System events (join/leave, typing) are also delivered over the same connection.

## Environment Variables

| Variable | Required | Description |
|----------|:--------:|-------------|
| `PORT` | | Port the server listens on (default `8080`) |
| `DB_HOST` | ✓ | PostgreSQL host |
| `DB_PORT` | ✓ | PostgreSQL port |
| `DB_USER` | ✓ | PostgreSQL user |
| `DB_PASSWORD` | ✓ | PostgreSQL password |
| `DB_NAME` | ✓ | PostgreSQL database name |
| `JWT_SECRET` | ✓ | Secret for signing JWTs |
| `MESSAGE_ENC_KEY` | ✓ | 64-char hex key for AES-256-GCM message encryption |
| `APP_URL` | ✓ | Frontend base URL (used in password-reset emails) |
| `SMTP_HOST` | | SMTP server hostname — omit to log reset links to console |
| `SMTP_PORT` | | SMTP port (`587` STARTTLS / `465` implicit TLS) |
| `SMTP_USER` | | SMTP username |
| `SMTP_PASS` | | SMTP password or App Password |
| `SMTP_FROM` | | Sender name + address shown in outbound emails |

## Database Schema

Tables are created automatically by `db.Migrate()` on startup.

```sql
CREATE TABLE users (
  id         SERIAL PRIMARY KEY,
  username   VARCHAR(50)  UNIQUE NOT NULL,
  email      VARCHAR(255) UNIQUE NOT NULL,
  password   TEXT         NOT NULL,
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE rooms (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) UNIQUE NOT NULL,
  is_protected  BOOLEAN      NOT NULL DEFAULT FALSE,
  password_hash TEXT,
  created_by    INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE room_members (
  room_id   INT         NOT NULL REFERENCES rooms(id)  ON DELETE CASCADE,
  user_id   INT         NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE messages (
  id         SERIAL PRIMARY KEY,
  room_id    INT         NOT NULL REFERENCES rooms(id)  ON DELETE CASCADE,
  user_id    INT         NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  content    TEXT        NOT NULL,   -- AES-256-GCM encrypted
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE password_reset_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```
