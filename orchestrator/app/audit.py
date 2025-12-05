from app.models import SessionLocal, Audit

ALLOWED = {
    "agent:verification": {"ckyc.read","aa.read"},
    "agent:underwriting": {"bureau.read"},
    "agent:sanction": {"pdf.write","crm.write"},
    "master": {"route","summarize"}
}

def check(actor: str, action: str, resource: str, meta: dict=None):
    scope = f"{resource}.{action}"
    result = "ok" if scope in ALLOWED.get(actor, set()) else "alert"
    with SessionLocal() as db:
        db.add(Audit(actor=actor, action=action, resource=resource, meta=meta or {}, result=result))
        db.commit()
    return result == "ok"
