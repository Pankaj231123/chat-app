# 💬 Real-Time Chat Application

A full-stack real-time chat application built with Go, React, PostgreSQL, and WebSocket.

## 🚀 Features

- Real-time messaging using WebSocket
- User authentication with JWT
- Persistent message history with PostgreSQL
- Public and password-protected chat rooms
- Encrypted message storage
- Password reset flow
- Clean React frontend
- RESTful API for authentication and room management

## 🛠️ Tech Stack

**Backend:**

- Go (Golang)
- Gin
- WebSocket (`gorilla/websocket`)
- PostgreSQL
- JWT Authentication
- Bcrypt

**Frontend:**

- React.js
- React Router
- Vite
- WebSocket client
- REST API integration

## 📐 Architecture

```text
React Frontend ←→ WebSocket / REST API ←→ Go Backend ←→ PostgreSQL
```

## 🏃 How to Run

**Backend:**

```bash
cd backend
go mod download
go run main.go
```

**Frontend:**

```bash
cd frontend
npm install
npm start
```

## ⚙️ Environment Setup

**Backend:**

Create `backend/.env` from `backend/.env.example`.

Important variables:

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
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

**Frontend:**

Create `frontend/.env` from `frontend/.env.example`.

```env
VITE_API_BASE_URL=http://localhost:8081
```

## 📸 Screenshots

![alt text](<Screenshot 2026-05-30 at 10.54.09 AM.png>) ![alt text](<Screenshot 2026-05-30 at 10.53.52 AM.png>) ![alt text](<Screenshot 2026-05-30 at 10.53.39 AM.png>) ![alt text](<Screenshot 2026-05-30 at 10.53.12 AM.png>) ![alt text](<Screenshot 2026-05-30 at 10.52.58 AM.png>)

## 👨‍💻 Author

Pankaj Roy  
[Portfolio](https://pankaj231123.github.io/) | [LinkedIn](https://www.linkedin.com/in/pankaj-roy705/)
