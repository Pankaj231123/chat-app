package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"time"

	"chat-app/backend/mailer"
	"chat-app/backend/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	DB        *sql.DB
	JWTSecret string
	AppURL    string
	Mailer    mailer.Sender
}

type signupRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50"`
	Email    string `json:"email"    binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

type loginRequest struct {
	Email    string `json:"email"    binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

func (h *AuthHandler) Signup(c *gin.Context) {
	var req signupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not hash password"})
		return
	}

	var user models.User
	err = h.DB.QueryRow(
		`INSERT INTO users (username, email, password) VALUES ($1, $2, $3)
		 RETURNING id, username, email, created_at`,
		req.Username, req.Email, string(hash),
	).Scan(&user.ID, &user.Username, &user.Email, &user.CreatedAt)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "username or email already taken"})
		return
	}

	token, err := h.makeToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create token"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"token": token, "user": user})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	err := h.DB.QueryRow(
		`SELECT id, username, email, password, created_at FROM users WHERE email = $1`,
		req.Email,
	).Scan(&user.ID, &user.Username, &user.Email, &user.Password, &user.CreatedAt)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	token, err := h.makeToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": token, "user": user})
}

func (h *AuthHandler) Me(c *gin.Context) {
	userID := c.GetInt("user_id")
	var user models.User
	err := h.DB.QueryRow(
		`SELECT id, username, email, created_at FROM users WHERE id = $1`, userID,
	).Scan(&user.ID, &user.Username, &user.Email, &user.CreatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, user)
}

func (h *AuthHandler) makeToken(user models.User) (string, error) {
	claims := jwt.MapClaims{
		"user_id":  user.ID,
		"username": user.Username,
		"exp":      time.Now().Add(7 * 24 * time.Hour).Unix(),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(h.JWTSecret))
}

// ForgotPassword POST /api/forgot-password
func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Always respond 200 — never leak whether an email is registered
	c.JSON(http.StatusOK, gin.H{"message": "If that email is registered you will receive a reset link shortly."})

	go h.sendResetEmail(req.Email)
}

func (h *AuthHandler) sendResetEmail(email string) {
	var userID int
	var username string
	err := h.DB.QueryRow(
		`SELECT id, username FROM users WHERE email = $1`, email,
	).Scan(&userID, &username)
	if err != nil {
		return // user not found — silently exit
	}

	token, err := generateResetToken()
	if err != nil {
		log.Printf("[forgot-password] failed to generate token: %v", err)
		return
	}

	_, err = h.DB.Exec(
		`INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
		userID, token, time.Now().Add(time.Hour),
	)
	if err != nil {
		log.Printf("[forgot-password] failed to store token: %v", err)
		return
	}

	resetLink := fmt.Sprintf("%s/reset-password?token=%s", h.AppURL, token)

	// Always log the link so developers can test without SMTP configured
	log.Printf("[forgot-password] reset link for %s → %s", email, resetLink)

	if err := h.Mailer.Send(email, "Reset your Chat App password", resetEmailHTML(username, resetLink)); err != nil {
		log.Printf("[forgot-password] SMTP error for %s: %v", email, err)
	}
}

// ResetPassword POST /api/reset-password
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req struct {
		Token    string `json:"token"    binding:"required"`
		Password string `json:"password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var tokenID, userID int
	var expiresAt time.Time
	var used bool
	err := h.DB.QueryRow(
		`SELECT id, user_id, expires_at, used FROM password_reset_tokens WHERE token = $1`,
		req.Token,
	).Scan(&tokenID, &userID, &expiresAt, &used)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired reset link"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not verify token"})
		return
	}
	if used {
		c.JSON(http.StatusBadRequest, gin.H{"error": "this reset link has already been used"})
		return
	}
	if time.Now().After(expiresAt) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "reset link has expired, please request a new one"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not hash password"})
		return
	}

	tx, err := h.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not process request"})
		return
	}
	defer tx.Rollback() //nolint: errcheck

	if _, err = tx.Exec(`UPDATE users SET password = $1 WHERE id = $2`, string(hash), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update password"})
		return
	}
	if _, err = tx.Exec(`UPDATE password_reset_tokens SET used = TRUE WHERE id = $1`, tokenID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not invalidate token"})
		return
	}
	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save changes"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password reset successfully. You can now log in."})
}

func generateResetToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func resetEmailHTML(username, link string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html><body style="font-family:'Segoe UI',sans-serif;background:#f0f2f5;margin:0;padding:40px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:28px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;">💬 Chat App</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#333;margin-top:0;">Reset your password</h2>
      <p style="color:#555;">Hi <strong>%s</strong>,</p>
      <p style="color:#555;">We received a request to reset your password. Click the button below — this link expires in <strong>1 hour</strong>.</p>
      <div style="text-align:center;margin:32px 0;">
        <a href="%s" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:600;font-size:15px;display:inline-block;">
          Reset Password
        </a>
      </div>
      <p style="color:#999;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
      <p style="color:#bbb;font-size:12px;margin-bottom:0;word-break:break-all;">
        Or copy this link:<br><a href="%s" style="color:#667eea;">%s</a>
      </p>
    </div>
  </div>
</body></html>`, username, link, link, link)
}
