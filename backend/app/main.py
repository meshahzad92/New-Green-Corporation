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
        from app.db.session import engine, Base, SessionLocal
        import app.models.models  # Guarantees all 13 models are imported and registered in Base.metadata

        # 1. Create all tables defined in SQLAlchemy models if they do not already exist
        Base.metadata.create_all(bind=engine)

        # 2. Non-destructive migrations and compatibility checks
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo TEXT;"))
            conn.execute(text("ALTER TABLE sales ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12, 2);"))
            conn.execute(text("ALTER TABLE sales ADD COLUMN IF NOT EXISTS invoice_id VARCHAR(50);"))
            conn.execute(text("ALTER TABLE sales ADD COLUMN IF NOT EXISTS invoice_no VARCHAR(50);"))
            conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS mrp NUMERIC(12, 2);"))
            conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS company_discount NUMERIC(5, 2) DEFAULT 0;"))
            conn.execute(text("ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS mrp NUMERIC(12, 2);"))
            conn.execute(text("ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS company_discount NUMERIC(5, 2);"))
            conn.execute(text("ALTER TABLE sales ADD COLUMN IF NOT EXISTS dealer_id UUID;"))
            conn.execute(text("ALTER TABLE sales ADD COLUMN IF NOT EXISTS dealer_name TEXT;"))
            conn.execute(text("ALTER TABLE sales ADD COLUMN IF NOT EXISTS farmer_name TEXT;"))
            # Widen customer_phone from VARCHAR(11) to VARCHAR(20) — dealer phones with dashes like '0302-8292000' are 13 chars
            conn.execute(text("ALTER TABLE sales ALTER COLUMN customer_phone TYPE VARCHAR(20);"))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS khata_accounts (
                    id UUID PRIMARY KEY,
                    name TEXT NOT NULL,
                    phone VARCHAR(20),
                    address TEXT,
                    role TEXT NOT NULL DEFAULT 'Dealer',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
                    deleted_at TIMESTAMP WITH TIME ZONE
                );
            """))
            conn.execute(text("ALTER TABLE khata_accounts ADD COLUMN IF NOT EXISTS address TEXT;"))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS khata_entries (
                    id UUID PRIMARY KEY,
                    account_id UUID NOT NULL REFERENCES khata_accounts(id) ON DELETE CASCADE,
                    entry_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                    entry_type TEXT NOT NULL CHECK (entry_type IN ('CREDIT', 'RECOVERY')),
                    farmer_name TEXT,
                    credit_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
                    recovery_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
                    products_detail JSONB,
                    invoice_id VARCHAR(50),
                    sale_id UUID,
                    remarks TEXT,
                    payment_method TEXT DEFAULT 'CASH',
                    bank_name TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
                    deleted_at TIMESTAMP WITH TIME ZONE
                );
            """))
            conn.execute(text("""
                ALTER TABLE khata_entries ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'CASH';
            """))
            conn.execute(text("""
                ALTER TABLE khata_entries ADD COLUMN IF NOT EXISTS bank_name TEXT;
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS company_khata_accounts (
                    id UUID PRIMARY KEY,
                    name TEXT NOT NULL,
                    phone VARCHAR(50),
                    catalog_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
                    deleted_at TIMESTAMP WITH TIME ZONE
                );
                CREATE TABLE IF NOT EXISTS company_khata_entries (
                    id UUID PRIMARY KEY,
                    account_id UUID REFERENCES company_khata_accounts(id) ON DELETE CASCADE,
                    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
                    entry_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                    entry_type TEXT NOT NULL CHECK (entry_type IN ('PAYMENT', 'PURCHASE')),
                    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
                    payment_method TEXT DEFAULT 'ONLINE',
                    bank_name TEXT,
                    transaction_id TEXT,
                    total_purchase_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
                    products_detail JSONB,
                    stock_transaction_ids JSONB,
                    remarks TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
                    deleted_at TIMESTAMP WITH TIME ZONE
                );
                ALTER TABLE company_khata_entries ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES company_khata_accounts(id) ON DELETE CASCADE;
                ALTER TABLE company_khata_entries ALTER COLUMN company_id DROP NOT NULL;
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS notes (
                    id UUID PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT,
                    status TEXT NOT NULL DEFAULT 'pending',
                    is_important BOOLEAN NOT NULL DEFAULT FALSE,
                    priority TEXT NOT NULL DEFAULT 'medium',
                    target_date TIMESTAMP WITH TIME ZONE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
                    deleted_at TIMESTAMP WITH TIME ZONE
                );
            """))
            # Safe cleanup of duplicate products that have 0 transactions and 0 sales
            conn.execute(text("""
                DELETE FROM products p1
                WHERE p1.id IN (
                    SELECT p_sub.id FROM products p_sub
                    WHERE p_sub.id NOT IN (SELECT DISTINCT product_id FROM stock_transactions WHERE product_id IS NOT NULL)
                      AND p_sub.id NOT IN (SELECT DISTINCT product_id FROM sales WHERE product_id IS NOT NULL)
                      AND EXISTS (
                          SELECT 1 FROM products p_dup
                          WHERE p_dup.company_id = p_sub.company_id
                            AND LOWER(TRIM(p_dup.name)) = LOWER(TRIM(p_sub.name))
                            AND p_dup.id != p_sub.id
                            AND (
                                EXISTS (SELECT 1 FROM stock_transactions WHERE product_id = p_dup.id)
                                OR EXISTS (SELECT 1 FROM sales WHERE product_id = p_dup.id)
                                OR p_dup.id < p_sub.id
                            )
                      )
                );
            """))
            # Safe cleanup of unreferenced duplicate companies with identical names
            conn.execute(text("""
                DELETE FROM companies c1
                WHERE c1.id IN (
                    SELECT c_sub.id FROM companies c_sub
                    WHERE c_sub.id NOT IN (SELECT DISTINCT company_id FROM products WHERE company_id IS NOT NULL)
                      AND c_sub.id NOT IN (SELECT DISTINCT catalog_company_id FROM company_khata_accounts WHERE catalog_company_id IS NOT NULL)
                      AND c_sub.id NOT IN (SELECT DISTINCT company_id FROM company_khata_entries WHERE company_id IS NOT NULL)
                      AND EXISTS (
                          SELECT 1 FROM companies c_dup
                          WHERE LOWER(TRIM(c_dup.name)) = LOWER(TRIM(c_sub.name))
                            AND c_dup.id != c_sub.id
                            AND (
                                EXISTS (SELECT 1 FROM products WHERE company_id = c_dup.id)
                                OR c_dup.id < c_sub.id
                            )
                      )
                );
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS money_accounts (
                    id UUID PRIMARY KEY,
                    title TEXT NOT NULL,
                    bank_name TEXT,
                    account_type TEXT NOT NULL DEFAULT 'BANK',
                    account_number TEXT,
                    opening_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
                    deleted_at TIMESTAMP WITH TIME ZONE
                );
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS money_transactions (
                    id UUID PRIMARY KEY,
                    account_id UUID NOT NULL REFERENCES money_accounts(id) ON DELETE CASCADE,
                    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                    type TEXT NOT NULL CHECK (type IN ('DEPOSIT', 'WITHDRAWAL', 'OPENING', 'COMPANY_PAYMENT')),
                    amount NUMERIC(12, 2) NOT NULL,
                    payment_method TEXT,
                    description TEXT,
                    tid TEXT,
                    company_khata_entry_id UUID REFERENCES company_khata_entries(id) ON DELETE SET NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
                    deleted_at TIMESTAMP WITH TIME ZONE
                );
            """))
            conn.commit()
            print("Schema verified: paid_amount, invoice columns, mrp, company_discount, notes table present, customer_phone widened to VARCHAR(20), and duplicate products pruned.")

        # 3. Seed default admin user and initial companies if database is fresh
        try:
            db = SessionLocal()
            from app.models.models import User, Company
            from app.core.security import get_password_hash

            admin_user = db.query(User).filter(User.email == "waris92").first()
            if not admin_user:
                new_user = User(
                    email="waris92",
                    hashed_password=get_password_hash("waris92"),
                    full_name="Waris Admin",
                    is_active=True
                )
                db.add(new_user)
                db.commit()
                print("Default admin user (waris92 / waris92) initialized.")

            co_count = db.query(Company).count()
            if co_count == 0:
                predefined_companies = [
                    {"name": "Bayer", "logo": "Bayer.png"},
                    {"name": "Chatta Seeds", "logo": "Chatta Seeds.png"},
                    {"name": "Corteva (Pioneer)", "logo": "Corteva(Pioneer).png"},
                    {"name": "Mercury", "logo": "Mercury.png"},
                    {"name": "Monsanto", "logo": "Monsanto.png"},
                    {"name": "Sohni Dharti", "logo": "Sohni Dharti.jpeg"},
                    {"name": "Syngenta", "logo": "Syngenta.png"},
                ]
                for comp in predefined_companies:
                    db.add(Company(name=comp["name"], logo=comp["logo"]))
                db.commit()
                print("Initial companies seeded.")
            db.close()
        except Exception as seed_err:
            print(f"Seed note: {seed_err}")
    except Exception as e:
        print(f"Startup schema check note: {e}")

@app.get("/")
def root():
    return {"message": "Welcome to AgriManage Pro API"}
