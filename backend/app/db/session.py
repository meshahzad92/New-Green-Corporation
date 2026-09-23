from sqlalchemy import create_engine
from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings


def get_connect_args(database_url: str) -> dict:
    url = make_url(database_url)
    connect_args = {
        "connect_timeout": 10,
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5
    }
    if url.get_backend_name() == "postgresql":
        host = url.host or ""
        # Supabase cloud requires SSL; local postgres does not
        if "supabase.com" in host or "pooler.supabase" in host:
            connect_args["sslmode"] = "require"
            # Bypass slow/unreliable ISP DNS lookup by supplying the known IPv4 address directly.
            connect_args["hostaddr"] = "52.74.252.201"
        # Local or AWS RDS connections: no forced SSL needed (can be added if required)

    return connect_args


# Use connection pooling for PostgreSQL; simple setup for SQLite local dev
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
