"""
Standalone migration script to add soft delete columns
Run this once to update the database schema
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

from app.db.session import engine
from sqlalchemy import text

def apply_migration():
    print("🔄 Applying database migration for soft deletes...")
    
    with engine.connect() as connection:
        try:
            # Add columns to stock_transactions
            connection.execute(text("""
                ALTER TABLE stock_transactions 
                ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
            """))
            connection.execute(text("""
                ALTER TABLE stock_transactions 
                ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
            """))
            connection.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_stock_transactions_is_deleted 
                ON stock_transactions(is_deleted);
            """))
            
            # Add columns to sales
            connection.execute(text("""
                ALTER TABLE sales 
                ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
            """))
            connection.execute(text("""
                ALTER TABLE sales 
                ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
            """))
            connection.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_sales_is_deleted 
                ON sales(is_deleted);
            """))
            
            connection.commit()
            print("✅ Migration completed successfully!")
            print("✅ Added soft delete columns to stock_transactions and sales tables")
            
        except Exception as e:
            print(f"❌ Migration failed: {e}")
            connection.rollback()
            sys.exit(1)

if __name__ == "__main__":
    apply_migration()
