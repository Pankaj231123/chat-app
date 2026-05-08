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
	query := `
	CREATE TABLE IF NOT EXISTS users (
		id         SERIAL PRIMARY KEY,
		username   VARCHAR(50)  UNIQUE NOT NULL,
		email      VARCHAR(255) UNIQUE NOT NULL,
		password   TEXT         NOT NULL,
		created_at TIMESTAMPTZ  DEFAULT NOW()
	);`
	if _, err := db.Exec(query); err != nil {
		log.Fatalf("migration failed: %v", err)
	}
}
