# Chat App

A real-time chat application with a Go backend and a frontend client.

## Tech Stack

**Backend**
- [Go](https://go.dev/) with [Gin](https://github.com/gin-gonic/gin) — HTTP framework
- [PostgreSQL](https://www.postgresql.org/) — database
- [JWT](https://github.com/golang-jwt/jwt) — authentication
- [bcrypt](https://pkg.go.dev/golang.org/x/crypto/bcrypt) — password hashing

**Frontend**
- Runs on `http://localhost:5173` (e.g. Vite + React)

## Project Structure

```
chat-app/
├── backend/
│   ├── config/        # Environment configuration
│   ├── db/            # Database connection and migrations
│   ├── handlers/      # HTTP request handlers
│   ├── middleware/    # JWT auth middleware
│   ├── models/        # Data models
│   ├── main.go
│   └── .env           # Local env vars (not committed)
└── README.md
```

## Getting Started

### Prerequisites

- Go 1.21+
- PostgreSQL running locally

### 1. Clone the repo

```bash
git clone <repo-url>
cd chat-app
```

### 2. Configure environment

Copy the example env file and fill in your values:

```bash
cp backend/.env.example backend/.env
```

```env
PORT=8080
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=chatapp
JWT_SECRET=your_secret_key_here
```

### 3. Run the backend

```bash
cd backend
go run main.go
```

The server starts on `http://localhost:8080`. The database schema is created automatically on startup.

## API Reference

All routes are prefixed with `/api`.

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/signup` | No | Register a new user |
| POST | `/api/login` | No | Login and get a JWT |
| GET | `/api/me` | Yes | Get the current user |

```

## Database Schema

```sql
CREATE TABLE users (
  id         SERIAL PRIMARY KEY,
  username   VARCHAR(50)  UNIQUE NOT NULL,
  email      VARCHAR(255) UNIQUE NOT NULL,
  password   TEXT         NOT NULL,
  created_at TIMESTAMPTZ  DEFAULT NOW()
);
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Port the server listens on |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `postgres` | PostgreSQL user |
| `DB_PASSWORD` | `postgres` | PostgreSQL password |
| `DB_NAME` | `chatapp` | PostgreSQL database name |
| `JWT_SECRET` | — | Secret key for signing JWTs (required in production) |
