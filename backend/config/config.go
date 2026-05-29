package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

type SMTPConfig struct {
	Host string
	Port int
	User string
	Pass string
	From string
}

type Config struct {
	Port           string
	DBConnStr      string
	JWTSecret      string
	MsgEncKey      string
	AppURL         string
	AllowedOrigins []string
	SMTP           SMTPConfig
}

func Load() *Config {
	smtpPort, _ := strconv.Atoi(getEnv("SMTP_PORT", "587"))
	appURL := getEnv("APP_URL", "http://localhost:5173")
	allowedOrigins := parseOrigins(getEnv("CORS_ALLOWED_ORIGINS", ""))
	if len(allowedOrigins) == 0 {
		allowedOrigins = []string{appURL}
	}

	return &Config{
		Port: getEnv("PORT", "8081"),
		DBConnStr: fmt.Sprintf(
			"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
			getEnv("DB_HOST", "localhost"),
			getEnv("DB_PORT", "5432"),
			getEnv("DB_USER", "postgres"),
			getEnv("DB_PASSWORD", "postgres"),
			getEnv("DB_NAME", "chatapp"),
		),
		JWTSecret:      getEnv("JWT_SECRET", "changeme"),
		MsgEncKey:      getEnv("MESSAGE_ENC_KEY", ""),
		AppURL:         appURL,
		AllowedOrigins: allowedOrigins,
		SMTP: SMTPConfig{
			Host: getEnv("SMTP_HOST", ""),
			Port: smtpPort,
			User: getEnv("SMTP_USER", ""),
			Pass: getEnv("SMTP_PASS", ""),
			From: getEnv("SMTP_FROM", ""),
		},
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func parseOrigins(raw string) []string {
	if raw == "" {
		return nil
	}

	parts := strings.Split(raw, ",")
	origins := make([]string, 0, len(parts))
	seen := make(map[string]struct{}, len(parts))

	for _, part := range parts {
		origin := strings.TrimSpace(part)
		if origin == "" {
			continue
		}
		if _, exists := seen[origin]; exists {
			continue
		}
		seen[origin] = struct{}{}
		origins = append(origins, origin)
	}

	return origins
}
