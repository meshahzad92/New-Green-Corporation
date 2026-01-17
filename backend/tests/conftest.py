"""
Test configuration and fixtures
"""
import sys
import os

# Add parent directory to Python path so we can import app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Import after path is set
from app.main import app
from app.db.session import Base, get_db

# Test database URL - using same database for now (production database)
# In a real production environment, you'd use a separate test database
TEST_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/agrimanage_pro")

# Create test engine
engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session")
def db():
    """Use existing database tables"""
    # Don't create or drop tables - use existing production database
    yield

@pytest.fixture(scope="function")
def db_session(db):
    """Create a new database session for each test"""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture(scope="function")
def client(db_session):
    """Create a test client with dependency override"""
    def override_get_db():
        try:
            yield db_session
        finally:
            db_session.close()
    
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def auth_token(client):
    """Get authentication token for protected endpoints"""
    # Use the default user created by init_db.py
    response = client.post(
        "/api/v1/login/access-token",
        data={"username": "waris92", "password": "waris92"}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    return None

@pytest.fixture
def auth_headers(auth_token):
    """Get authorization headers"""
    if auth_token:
        return {"Authorization": f"Bearer {auth_token}"}
    return {}
