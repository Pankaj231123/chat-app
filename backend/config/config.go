package config

import (
	"fmt"
	"os"
	"strconv"
)

type SMTPConfig struct {
	Host string
	Port int
	User string
	Pass string
	From string
}

type Config struct {
	Port      string
	DBConnStr string
	JWTSecret string
	MsgEncKey string
	AppURL    string
	SMTP      SMTPConfig
}

func Load() *Config {
	smtpPort, _ := strconv.Atoi(getEnv("SMTP_PORT", "587"))
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
		MsgEncKey: getEnv("MESSAGE_ENC_KEY", ""),
		AppURL:    getEnv("APP_URL", "http://localhost:5173"),
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
