# app/routers/chat.py
from typing import Optional, Union, Dict, Any
from fastapi import APIRouter, Form, Request
from pydantic import BaseModel
from pathlib import Path
import json

from app.agents.master import handle_message

router = APIRouter()

class ChatOut(BaseModel):
    reply: Optional[str] = None
    pdf: Optional[str] = None              # served path like /files/...
    kfs: Optional[Dict[str, Any]] = None   # parsed JSON object for UI summary
    kfs_url: Optional[str] = None          # optional direct link to JSON file
    handoff: Optional[bool] = None

DATA_DIR = "/app/data"

def to_served(p: str) -> str:
    # convert an absolute disk path like /app/data/foo to served path /files/foo
    if not p:
        return p
    return p.replace("/app/data/", "/files/")

@router.post("/chat", response_model=ChatOut)
def chat(
    request: Request,
    session_id: str = Form(...),
    message: str = Form(...),
    # accept both field names from different UIs
    name: Optional[str] = Form(None),
    mobile: Optional[str] = Form(None),
    pan_tail: Optional[str] = Form(None),
    pan_last4: Optional[str] = Form(None),
    desired_amount: int = Form(150000),
    tenure: int = Form(24),
    salary: Optional[int] = Form(None),
    consent: Optional[str] = Form(None),   # "yes" from widget boot
):
    # normalize inputs
    pan_tail = pan_tail or pan_last4  # support either key
    form = {
        "name": name,
        "mobile": mobile,
        "pan_tail": pan_tail,
        "desired_amount": desired_amount,
        "tenure": tenure,
        "salary": salary,
        "consent": consent,
    }

    # delegate to master agent
    raw = handle_message(session_id, message, form) or {}

    # build absolute base to return full URLs if you prefer
    base = str(request.base_url).rstrip("/")

    # pdf can be absolute disk path or served path
    pdf = raw.get("pdf")
    if isinstance(pdf, str):
        pdf = to_served(pdf) if pdf.startswith("/app/data/") else pdf
        # if you want full URL uncomment next line
        # if pdf.startswith("/"): pdf = base + pdf

    # kfs can be dict or a path string. Normalize to dict plus optional kfs_url
    kfs_obj: Optional[Dict[str, Any]] = None
    kfs_url: Optional[str] = None
    kfs = raw.get("kfs")

    if isinstance(kfs, dict):
        kfs_obj = kfs
    elif isinstance(kfs, str) and kfs:
        # treat as path to JSON
        json_path = kfs
        if json_path.startswith("/files/"):
            # served path, map back to disk to load if needed
            disk = json_path.replace("/files/", "/app/data/")
        elif json_path.startswith("/app/data/"):
            disk = json_path
        else:
            # assume file name in data dir
            disk = str(Path(DATA_DIR) / json_path)

        try:
            with open(disk, "r", encoding="utf-8") as f:
                kfs_obj = json.load(f)
        except Exception:
            # do not fail the request. Just skip parsing.
            kfs_obj = None

        # always return a served link as well
        kfs_url = to_served(disk)

        # if you prefer absolute URL uncomment:
        # if kfs_url and kfs_url.startswith("/"):
        #     kfs_url = base + kfs_url

    out = ChatOut(
        reply=raw.get("reply"),
        pdf=pdf,
        kfs=kfs_obj,
        kfs_url=kfs_url,
        handoff=raw.get("handoff"),
    )
    return out
