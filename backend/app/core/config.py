from pydantic_settings import BaseSettings

# This class is the SINGLE SOURCE OF TRUTH for all configuration
class Settings(BaseSettings):
    # Application info
    APP_NAME: str = "ClarityEngine"
    DEBUG: bool = False

    # Database connection
    DATABASE_URL: str

    # Security
    SECRET_KEY: str

    # AI Configuration
    GROQ_API_KEY: str

    class Config:
        # This tells Pydantic to load variables from .env file
        env_file = ".env"


# Create one global settings instance (used everywhere in app)
settings = Settings()
