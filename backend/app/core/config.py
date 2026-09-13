from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "AgriManage Pro"
    API_V1_STR: str = "/api/v1"
    
    # Database - Read from .env, fallback to SQLite for local dev
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./sql_app.db")
    
    # Security Settings - MUST be set in production .env
    SECRET_KEY: str = os.getenv("SECRET_KEY", "CHANGE-THIS-IN-PRODUCTION-INSECURE-DEFAULT")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))  # 1 week default
    
    # API Configuration
    API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
    API_PORT: int = int(os.getenv("API_PORT", "8000"))
    
    # CORS Settings - Specific allowed origins for production
    # Includes custom domain, Vercel frontend, Render backend, and localhost for local dev
    CORS_ORIGINS: List[str] = [
        "https://www.newgreencorporation.app",
        "https://newgreencorporation.app",
        "https://new-green-corporation.vercel.app",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]

    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8", 
        case_sensitive=True,
        extra='ignore'  # Allow extra fields like TZ without validation errors
    )

settings = Settings()

