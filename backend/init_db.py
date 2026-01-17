from app.db.session import SessionLocal, engine, Base
from app.models.models import User
from app.core.security import get_password_hash
from sqlalchemy import text

def init_db():
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    # Add soft delete columns if they don't exist (for existing databases)
    db = SessionLocal()
    try:
        # Check and add columns to stock_transactions
        db.execute(text("""
            DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name='stock_transactions' AND column_name='is_deleted') THEN
                    ALTER TABLE stock_transactions ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
                    ALTER TABLE stock_transactions ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
                    CREATE INDEX idx_stock_transactions_is_deleted ON stock_transactions(is_deleted);
                END IF;
            END $$;
        """))
        
        # Check and add columns to sales
        db.execute(text("""
            DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name='sales' AND column_name='is_deleted') THEN
                    ALTER TABLE sales ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
                    ALTER TABLE sales ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
                    CREATE INDEX idx_sales_is_deleted ON sales(is_deleted);
                END IF;
            END $$;
        """))
        
        db.commit()
        print("✅ Database schema updated with soft delete support")
    except Exception as e:
        print(f"⚠️  Schema migration note: {e}")
        db.rollback()
    
    # Check if user exists
    user = db.query(User).filter(User.email == "waris92").first()
    if not user:
        new_user = User(
            email="waris92",
            hashed_password=get_password_hash("waris92"),
            full_name="Waris Admin",
            is_active=True
        )
        db.add(new_user)
        db.commit()
        print("✅ Created debug user: waris92 / waris92")
    else:
        print("✅ Debug user already exists")
    db.close()

if __name__ == "__main__":
    init_db()
