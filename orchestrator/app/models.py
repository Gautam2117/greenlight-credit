from sqlalchemy import create_engine, Column, Integer, String, JSON, DateTime, Text
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.sql import func
from app.config import settings

engine = create_engine(settings.db_url, echo=False, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()

class Session(Base):
    __tablename__ = "sessions"
    id = Column(String, primary_key=True)
    state = Column(JSON, nullable=False, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, index=True)
    type = Column(String, index=True)
    payload = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Audit(Base):
    __tablename__ = "audit"
    id = Column(Integer, primary_key=True, autoincrement=True)
    actor = Column(String)           # master, agent:verification, service:ckyc
    action = Column(String)          # read, write, call_api
    resource = Column(String)        # which object or api
    meta = Column(JSON)
    result = Column(String)          # ok, denied, alert
    at = Column(DateTime(timezone=True), server_default=func.now())

def init_db():
    Base.metadata.create_all(bind=engine)
