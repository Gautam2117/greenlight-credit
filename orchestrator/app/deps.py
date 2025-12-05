# app/deps.py
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

def add_cors(app: FastAPI) -> None:
    """
    Set CORS from ORCH_ALLOW_ORIGINS env (comma-separated). Defaults to *.
    Examples:
      ORCH_ALLOW_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
    """
    raw = os.getenv("ORCH_ALLOW_ORIGINS", "*")
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    allow_all = "*" in origins

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if allow_all else origins,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],
        allow_credentials=False,  # keep False unless you send cookies/Authorization
        max_age=86400,
    )
