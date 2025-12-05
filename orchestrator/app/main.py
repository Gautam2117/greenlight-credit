from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.models import init_db
from app.deps import add_cors
from app.routers import health, chat

app = FastAPI(title="GreenLight Orchestrator")
add_cors(app)
init_db()

# Serve generated documents
DATA_DIR = "/app/data"
Path(DATA_DIR).mkdir(parents=True, exist_ok=True)
app.mount("/files", StaticFiles(directory=DATA_DIR), name="files")

# API routers
app.include_router(health.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
