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
		}
	}

	log.Printf("server running on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal(err)
	}
}
