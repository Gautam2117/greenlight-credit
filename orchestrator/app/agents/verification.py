from app.services import ckyc, aa
from app.audit import check

# app/agents/verification.py
def run(payload: dict) -> dict:
    name = payload.get("name", "")
    mobile = payload.get("mobile", "")
    pan_tail = payload.get("pan_tail") or payload.get("pan_last4") or ""
    ok = bool(name and len(mobile) == 10 and len(pan_tail) == 4)
    return {"ok": ok, "mobile": mobile, "pan_tail": pan_tail}
