from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.api import api_router
from app.core.config import settings

app = FastAPI(
    title="AgriManage Pro API",
    description="Backend API for Premium Agricultural Inventory System",
    version="1.0.0"
)

# CORS Configuration - Allows frontend to access backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https://.*(onrender\.com|newgreencorporation\.app|vercel\.app)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(api_router, prefix="/api/v1")

@app.on_event("startup")
def startup_event():
    try:
        from sqlalchemy import text
        from app.db.session import engine
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE sales ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12, 2);"))
            conn.commit()
            print("Verified paid_amount column in sales table.")
    except Exception as e:
        print(f"Startup schema check note: {e}")

@app.get("/")
def root():
    return {"message": "Welcome to AgriManage Pro API"}
