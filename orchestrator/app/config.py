import os
from pydantic import BaseModel

class Settings(BaseModel):
    port: int = int(os.getenv("ORCH_PORT", 8000))
    db_url: str = os.getenv("DATABASE_URL", "sqlite:///./orchestrator.db")
    allowed_origins: list[str] = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

settings = Settings()
