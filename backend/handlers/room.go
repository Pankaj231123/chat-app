package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"sync"
	"time"

	"chat-app/backend/models"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// hub holds active WebSocket connections per room
type hub struct {
	mu      sync.RWMutex
	clients map[int]map[*websocket.Conn]int // roomID -> conn -> userID
}

var globalHub = &hub{clients: make(map[int]map[*websocket.Conn]int)}

func (h *hub) add(roomID int, conn *websocket.Conn, userID int) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.clients[roomID] == nil {
		h.clients[roomID] = make(map[*websocket.Conn]int)
	}
	h.clients[roomID][conn] = userID
}

func (h *hub) remove(roomID int, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.clients[roomID], conn)
}

func (h *hub) broadcast(roomID int, msg models.Message) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for conn := range h.clients[roomID] {
		conn.WriteJSON(msg) //nolint: errcheck
	}
}

func (h *hub) broadcastExcept(roomID int, exclude *websocket.Conn, payload any) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for conn := range h.clients[roomID] {
		if conn != exclude {
			conn.WriteJSON(payload) //nolint: errcheck
		}
	}
}

// RoomHandler handles all room and message endpoints.
type RoomHandler struct {
	DB *sql.DB
}

// CreateRoom POST /api/rooms
func (h *RoomHandler) CreateRoom(c *gin.Context) {
	userID := c.GetInt("user_id")
	var body struct {
		Name string `json:"name" binding:"required,min=2,max=100"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var room models.Room
	err := h.DB.QueryRow(
		`INSERT INTO rooms (name, created_by) VALUES ($1, $2)
		 RETURNING id, name, created_by, created_at`,
		body.Name, userID,
	).Scan(&room.ID, &room.Name, &room.CreatedBy, &room.CreatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "room name already taken"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create room"})
		return
	}

	// creator auto-joins
	h.DB.Exec(`INSERT INTO room_members (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, room.ID, userID) //nolint: errcheck

	c.JSON(http.StatusCreated, room)
}

// ListRooms GET /api/rooms
func (h *RoomHandler) ListRooms(c *gin.Context) {
	rows, err := h.DB.Query(
		`SELECT r.id, r.name, r.created_by, r.created_at,
		        COUNT(rm.user_id) AS member_count
		 FROM rooms r
		 LEFT JOIN room_members rm ON rm.room_id = r.id
		 GROUP BY r.id
		 ORDER BY r.created_at DESC`,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not list rooms"})
		return
	}
	defer rows.Close()

	type roomRow struct {
		models.Room
		MemberCount int `json:"member_count"`
	}
	rooms := []roomRow{}
	for rows.Next() {
		var rr roomRow
		if err := rows.Scan(&rr.ID, &rr.Name, &rr.CreatedBy, &rr.CreatedAt, &rr.MemberCount); err != nil {
			continue
		}
		rooms = append(rooms, rr)
	}
	c.JSON(http.StatusOK, rooms)
}

// GetRoom GET /api/rooms/:id
func (h *RoomHandler) GetRoom(c *gin.Context) {
	roomID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid room id"})
		return
	}

	var room models.Room
	err = h.DB.QueryRow(
		`SELECT id, name, created_by, created_at FROM rooms WHERE id = $1`, roomID,
	).Scan(&room.ID, &room.Name, &room.CreatedBy, &room.CreatedAt)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch room"})
		return
	}

	rows, _ := h.DB.Query(
		`SELECT rm.user_id, u.username, rm.joined_at
		 FROM room_members rm
		 JOIN users u ON u.id = rm.user_id
		 WHERE rm.room_id = $1`, roomID,
	)
	defer rows.Close()
	members := []models.RoomMember{}
	for rows.Next() {
		var m models.RoomMember
		m.RoomID = roomID
		rows.Scan(&m.UserID, &m.Username, &m.JoinedAt) //nolint: errcheck
		members = append(members, m)
	}

	c.JSON(http.StatusOK, gin.H{"room": room, "members": members})
}

// JoinRoom POST /api/rooms/:id/join
func (h *RoomHandler) JoinRoom(c *gin.Context) {
	roomID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid room id"})
		return
	}
	userID := c.GetInt("user_id")

	var exists bool
	h.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM rooms WHERE id=$1)`, roomID).Scan(&exists) //nolint: errcheck
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
		return
	}

	_, err = h.DB.Exec(
		`INSERT INTO room_members (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		roomID, userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not join room"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "joined room"})
}

// LeaveRoom DELETE /api/rooms/:id/join
func (h *RoomHandler) LeaveRoom(c *gin.Context) {
	roomID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid room id"})
		return
	}
	userID := c.GetInt("user_id")
	h.DB.Exec(`DELETE FROM room_members WHERE room_id=$1 AND user_id=$2`, roomID, userID) //nolint: errcheck
	c.JSON(http.StatusOK, gin.H{"message": "left room"})
}

// GetMessages GET /api/rooms/:id/messages?limit=50&before=<message_id>
func (h *RoomHandler) GetMessages(c *gin.Context) {
	roomID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid room id"})
		return
	}

	limit := 50
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 100 {
			limit = n
		}
	}

	var rows *sql.Rows
	before := c.Query("before")
	if before != "" {
		beforeID, _ := strconv.Atoi(before)
		rows, err = h.DB.Query(
			`SELECT m.id, m.room_id, m.user_id, u.username, m.content, m.created_at
			 FROM messages m JOIN users u ON u.id = m.user_id
			 WHERE m.room_id = $1 AND m.id < $2
			 ORDER BY m.created_at DESC LIMIT $3`,
			roomID, beforeID, limit,
		)
	} else {
		rows, err = h.DB.Query(
			`SELECT m.id, m.room_id, m.user_id, u.username, m.content, m.created_at
			 FROM messages m JOIN users u ON u.id = m.user_id
			 WHERE m.room_id = $1
			 ORDER BY m.created_at DESC LIMIT $2`,
			roomID, limit,
		)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch messages"})
		return
	}
	defer rows.Close()

	msgs := []models.Message{}
	for rows.Next() {
		var m models.Message
		rows.Scan(&m.ID, &m.RoomID, &m.UserID, &m.Username, &m.Content, &m.CreatedAt) //nolint: errcheck
		msgs = append(msgs, m)
	}

	// reverse so oldest first
	for i, j := 0, len(msgs)-1; i < j; i, j = i+1, j-1 {
		msgs[i], msgs[j] = msgs[j], msgs[i]
	}
	c.JSON(http.StatusOK, msgs)
}

// SendMessage POST /api/rooms/:id/messages
func (h *RoomHandler) SendMessage(c *gin.Context) {
	roomID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid room id"})
		return
	}
	userID := c.GetInt("user_id")

	var body struct {
		Content string `json:"content" binding:"required,min=1,max=2000"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// must be a member
	var isMember bool
	h.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM room_members WHERE room_id=$1 AND user_id=$2)`, roomID, userID).Scan(&isMember) //nolint: errcheck
	if !isMember {
		c.JSON(http.StatusForbidden, gin.H{"error": "join the room first"})
		return
	}

	var msg models.Message
	err = h.DB.QueryRow(
		`INSERT INTO messages (room_id, user_id, content)
		 VALUES ($1, $2, $3)
		 RETURNING id, room_id, user_id, content, created_at`,
		roomID, userID, body.Content,
	).Scan(&msg.ID, &msg.RoomID, &msg.UserID, &msg.Content, &msg.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not send message"})
		return
	}

	h.DB.QueryRow(`SELECT username FROM users WHERE id=$1`, userID).Scan(&msg.Username) //nolint: errcheck

	globalHub.broadcast(roomID, msg)
	c.JSON(http.StatusCreated, msg)
}

// WebSocketChat GET /api/rooms/:id/ws?token=<jwt>
func (h *RoomHandler) WebSocketChat(c *gin.Context) {
	roomID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid room id"})
		return
	}
	userID := c.GetInt("user_id")
	username := c.GetString("username")

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	globalHub.add(roomID, conn, userID)
	defer globalHub.remove(roomID, conn)

	conn.SetReadDeadline(time.Time{}) //nolint: errcheck

	for {
		var body struct {
			Type    string `json:"type"`
			Content string `json:"content"`
			Typing  bool   `json:"typing"`
		}
		if err := conn.ReadJSON(&body); err != nil {
			break
		}

		if body.Type == "typing" {
			globalHub.broadcastExcept(roomID, conn, gin.H{
				"type":     "typing",
				"username": username,
				"typing":   body.Typing,
			})
			continue
		}

		if body.Content == "" {
			continue
		}

		var isMember bool
		h.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM room_members WHERE room_id=$1 AND user_id=$2)`, roomID, userID).Scan(&isMember) //nolint: errcheck
		if !isMember {
			conn.WriteJSON(gin.H{"error": "join the room first"}) //nolint: errcheck
			continue
		}

		var msg models.Message
		err = h.DB.QueryRow(
			`INSERT INTO messages (room_id, user_id, content)
			 VALUES ($1, $2, $3)
			 RETURNING id, room_id, user_id, content, created_at`,
			roomID, userID, body.Content,
		).Scan(&msg.ID, &msg.RoomID, &msg.UserID, &msg.Content, &msg.CreatedAt)
		if err != nil {
			continue
		}
		msg.Username = username

		globalHub.broadcast(roomID, msg)
	}
}

func isUniqueViolation(err error) bool {
	return err != nil && len(err.Error()) > 0 &&
		(contains(err.Error(), "unique") || contains(err.Error(), "duplicate"))
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(s) > 0 && containsStr(s, sub))
}

func containsStr(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
