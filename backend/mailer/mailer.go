package mailer

import (
	"crypto/tls"
	"fmt"
	"log"
	"net/mail"
	"net/smtp"
)

// Sender is the interface both Mailer and NoOp implement.
type Sender interface {
	Send(to, subject, htmlBody string) error
}

// Config holds SMTP connection settings.
type Config struct {
	Host string
	Port int
	User string
	Pass string
	From string
}

// Mailer sends real emails over SMTP.
type Mailer struct{ cfg Config }

func New(cfg Config) *Mailer { return &Mailer{cfg} }

func (m *Mailer) Send(to, subject, htmlBody string) error {
	msg := buildMessage(m.cfg.From, to, subject, htmlBody)
	auth := smtp.PlainAuth("", m.cfg.User, m.cfg.Pass, m.cfg.Host)
	addr := fmt.Sprintf("%s:%d", m.cfg.Host, m.cfg.Port)

	// SMTP envelope needs a bare address; display names like "App <a@b.com>" cause 555 errors
	envelopeFrom := m.cfg.From
	if parsed, err := mail.ParseAddress(m.cfg.From); err == nil {
		envelopeFrom = parsed.Address
	}

	if m.cfg.Port == 465 {
		return sendImplicitTLS(addr, m.cfg.Host, auth, envelopeFrom, to, msg)
	}
	return smtp.SendMail(addr, auth, envelopeFrom, []string{to}, msg)
}

// sendImplicitTLS dials TLS directly (port 465) then speaks SMTP.
func sendImplicitTLS(addr, host string, auth smtp.Auth, from, to string, msg []byte) error {
	conn, err := tls.Dial("tcp", addr, &tls.Config{ServerName: host})
	if err != nil {
		return fmt.Errorf("tls dial: %w", err)
	}
	c, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("smtp client: %w", err)
	}
	defer c.Quit() //nolint: errcheck
	if err = c.Auth(auth); err != nil {
		return fmt.Errorf("smtp auth: %w", err)
	}
	if err = c.Mail(from); err != nil {
		return err
	}
	if err = c.Rcpt(to); err != nil {
		return err
	}
	w, err := c.Data()
	if err != nil {
		return err
	}
	if _, err = w.Write(msg); err != nil {
		return err
	}
	return w.Close()
}

func buildMessage(from, to, subject, htmlBody string) []byte {
	header := fmt.Sprintf(
		"From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n",
		from, to, subject,
	)
	return []byte(header + htmlBody)
}

// NoOp is used when SMTP is not configured.
// It logs the email content so developers can test the reset flow locally.
type NoOp struct{}

func (NoOp) Send(to, subject, body string) error {
	log.Printf("[mailer no-op] to=%s subject=%q (SMTP not configured)", to, subject)
	return nil
}
