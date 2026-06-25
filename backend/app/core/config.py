from pydantic_settings import BaseSettings, SettingsConfigDict

# This class is the SINGLE SOURCE OF TRUTH for all configuration
class Settings(BaseSettings):
    # Application info
    APP_NAME: str = "ClarityEngine"
    DEBUG: bool = False

    # Database connection
    DATABASE_URL: str

    # Security
    SECRET_KEY: str

    # CORS — comma-separated list of allowed front-end origins. Override in .env
    # for production (e.g. "https://app.example.com"). Never use "*" together with
    # credentials. Defaults cover the local Vite dev server.
    CORS_ORIGINS: str = (
        "http://localhost:5173,http://localhost:5174,"
        "http://127.0.0.1:5173,http://127.0.0.1:5174"
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    # AI — DeepSeek (OpenAI-compatible)
    DEEPSEEK_API_KEY: str
    DEEPSEEK_TIMEOUT: int = 30

    # Token pricing — used by the admin cost panel to turn token counts into money.
    # Prices are per 1,000,000 tokens, in TOKEN_COST_CURRENCY. Input = prompt tokens,
    # output = completion tokens (providers bill the two at different rates).
    # Defaults track DeepSeek's published list price; override in .env with your
    # actual contract rates so the figures stay accurate.
    TOKEN_INPUT_PRICE_PER_1M:  float = 0.27
    TOKEN_OUTPUT_PRICE_PER_1M: float = 1.10
    TOKEN_COST_CURRENCY:       str   = "USD"

    # Abuse / cost controls (B9).
    # ANALYZE_BURST_PER_MINUTE: per-user, per-process burst cap on the analyze
    #   endpoints (cheap in-memory spam protection). 0 = disabled.
    # TENANT_DAILY_TOKEN_BUDGET: durable per-client daily token cap, computed from
    #   the total_tokens already recorded on each analysis (no extra infra; works
    #   on SQLite today and Postgres later). 0 = unlimited.
    ANALYZE_BURST_PER_MINUTE:  int = 15
    TENANT_DAILY_TOKEN_BUDGET: int = 0

    # Load variables from the .env file
    model_config = SettingsConfigDict(env_file=".env")


# Create one global settings instance (used everywhere in app)
settings = Settings()
