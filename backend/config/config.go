package config

import (
	"fmt"
	"os"
)

type Config struct {
	Port      string
	DBConnStr string
	JWTSecret string
}

func Load() *Config {
	return &Config{
		Port: getEnv("PORT", "8080"),
		DBConnStr: fmt.Sprintf(
			"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
			getEnv("DB_HOST", "localhost"),
			getEnv("DB_PORT", "5432"),
			getEnv("DB_USER", "postgres"),
			getEnv("DB_PASSWORD", "postgres"),
			getEnv("DB_NAME", "chatapp"),
		),
		JWTSecret: getEnv("JWT_SECRET", "changeme"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
