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
            conn.execute(text("ALTER TABLE sales ADD COLUMN IF NOT EXISTS invoice_id VARCHAR(50);"))
            conn.execute(text("ALTER TABLE sales ADD COLUMN IF NOT EXISTS invoice_no VARCHAR(50);"))
            conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS mrp NUMERIC(12, 2);"))
            conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS company_discount NUMERIC(5, 2) DEFAULT 0;"))
            conn.execute(text("ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS mrp NUMERIC(12, 2);"))
            conn.execute(text("ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS company_discount NUMERIC(5, 2);"))
            conn.commit()
            print("Schema verified: paid_amount, invoice columns, mrp, company_discount all present.")
    except Exception as e:
        print(f"Startup schema check note: {e}")

@app.get("/")
def root():
    return {"message": "Welcome to AgriManage Pro API"}
