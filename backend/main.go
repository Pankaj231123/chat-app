package main

import (
	"log"

	"chat-app/backend/config"
	"chat-app/backend/db"
	"chat-app/backend/handlers"
	"chat-app/backend/middleware"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, using environment variables")
	}

	cfg := config.Load()
	database := db.Connect(cfg.DBConnStr)
	db.Migrate(database)

	auth := &handlers.AuthHandler{DB: database, JWTSecret: cfg.JWTSecret}
	room := &handlers.RoomHandler{DB: database}

	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	api := r.Group("/api")
	{
		api.POST("/signup", auth.Signup)
		api.POST("/login", auth.Login)

		protected := api.Group("/")
		protected.Use(middleware.Auth(cfg.JWTSecret))
		{
			protected.GET("/me", auth.Me)

			// Rooms
			protected.POST("/rooms", room.CreateRoom)
			protected.GET("/rooms", room.ListRooms)
			protected.GET("/rooms/:id", room.GetRoom)
			protected.POST("/rooms/:id/join", room.JoinRoom)
			protected.DELETE("/rooms/:id/join", room.LeaveRoom)

			// Messages
			protected.GET("/rooms/:id/messages", room.GetMessages)
			protected.POST("/rooms/:id/messages", room.SendMessage)

			// WebSocket  — token passed as ?token=<jwt>
			protected.GET("/rooms/:id/ws", room.WebSocketChat)
		}
	}

	log.Printf("server running on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal(err)
	}
}
