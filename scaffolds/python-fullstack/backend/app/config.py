"""
Application Configuration using Pydantic Settings
"""
from functools import lru_cache
from typing import Any, Dict, Optional

from pydantic import Field, PostgresDsn, field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # ===== App =====
    APP_NAME: str = "PDD-Scaffold"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"  # development / staging / production
    
    # ===== Server =====
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: list = ["*"]
    
    # ===== Database (MySQL) =====
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = ""
    DB_NAME: str = "scaffold_db"
    DATABASE_URL: Optional[str] = None
    
    # ===== JWT Auth =====
    JWT_SECRET_KEY: str = "change-me-in-production-use-strong-random-secret-key-at-least-32-chars"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # ===== Redis (Optional) =====
    REDIS_URL: Optional[str] = None
    
    # ===== OAuth Providers =====
    OAUTH_ENABLED: bool = True
    DEFAULT_PROVIDER: str = ""
    
    # ===== Data Permission =====
    DATA_PERMISSION_ENABLED: bool = True
    
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}
    
    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: Optional[str], info) -> Any:
        if isinstance(v, str) and v:
            return v
        from sqlalchemy.engine.url import URL
        return URL.build(
            drivername="mysql+aiomysql",
            username=info.data.get("DB_USER"),
            password=info.data.get("DB_PASSWORD"),
            host=info.data.get("DB_HOST"),
            port=info.data.get("DB_PORT"),
            database=info.data.get("DB_NAME"),
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
