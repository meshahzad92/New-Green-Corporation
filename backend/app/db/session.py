from sqlalchemy import create_engine
from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Primary static IPv4 address for aws-0-ap-southeast-1.pooler.supabase.com
SUPABASE_POOLER_IP = "52.74.252.201"

def get_connect_args(database_url: str) -> dict:
    url = make_url(database_url)
    connect_args = {
        "connect_timeout": 5,
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5
    }
    if url.get_backend_name() == "postgresql":
        connect_args["sslmode"] = "require"
        host = url.host
        if host and "pooler.supabase.com" in host:
            # Bypass slow/unreliable ISP DNS lookup by supplying the IPv4 address directly.
            # Hostname is still preserved for SSL/TLS SNI validation.
            connect_args["hostaddr"] = SUPABASE_POOLER_IP

    return connect_args

# Use SSL & connection pooling for PostgreSQL (Supabase requires it), skip for SQLite local dev
if settings.DATABASE_URL.startswith("postgresql"):
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args=get_connect_args(settings.DATABASE_URL),
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=10,
        max_overflow=20
    )
else:
    # SQLite fallback for local development (no SSL, no threading issues)
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
