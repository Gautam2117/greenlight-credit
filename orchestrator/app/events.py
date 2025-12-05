from app.models import SessionLocal, Event, Session

def append_event(session_id: str, type_: str, payload: dict):
    with SessionLocal() as db:
        db.add(Event(session_id=session_id, type=type_, payload=payload))
        db.commit()

def get_or_create_session(session_id: str) -> dict:
    with SessionLocal() as db:
        s = db.get(Session, session_id)
        if not s:
            s = Session(id=session_id, state={"stage":"start","history":[]})
            db.add(s); db.commit()
        return s.state

def save_session(session_id: str, state: dict):
    with SessionLocal() as db:
        s = db.get(Session, session_id)
        if not s:
            s = Session(id=session_id, state=state)
            db.add(s)
        else:
            s.state = state
        db.commit()
