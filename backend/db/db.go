package db

import (
	"database/sql"
	"log"

	_ "github.com/lib/pq"
)

func Connect(connStr string) *sql.DB {
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("failed to open db: %v", err)
	}
	if err = db.Ping(); err != nil {
		log.Fatalf("failed to connect to db: %v", err)
	}
	return db
}

func Migrate(db *sql.DB) {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id         SERIAL PRIMARY KEY,
			username   VARCHAR(50)  UNIQUE NOT NULL,
			email      VARCHAR(255) UNIQUE NOT NULL,
			password   TEXT         NOT NULL,
			created_at TIMESTAMPTZ  DEFAULT NOW()
		);`,
		`CREATE TABLE IF NOT EXISTS rooms (
			id            SERIAL PRIMARY KEY,
			name          VARCHAR(100) UNIQUE NOT NULL,
			created_by    INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			created_at    TIMESTAMPTZ  DEFAULT NOW(),
			is_protected  BOOLEAN      NOT NULL DEFAULT FALSE,
			password_hash TEXT
		);`,
		`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_protected BOOLEAN NOT NULL DEFAULT FALSE;`,
		`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS password_hash TEXT;`,
		`CREATE TABLE IF NOT EXISTS room_members (
			room_id   INT         NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
			user_id   INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			joined_at TIMESTAMPTZ DEFAULT NOW(),
			PRIMARY KEY (room_id, user_id)
		);`,
		`CREATE TABLE IF NOT EXISTS messages (
			id         SERIAL PRIMARY KEY,
			room_id    INT         NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
			user_id    INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			content    TEXT        NOT NULL,
			created_at TIMESTAMPTZ DEFAULT NOW()
		);`,
	}
	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			log.Fatalf("migration failed: %v", err)
		}
	}
}
