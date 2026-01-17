"""
Apply Expenses Table Migration
Run this to create the expenses table in the database
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

from app.db.session import engine
from sqlalchemy import text

def apply_migration():
    print("🔄 Creating expenses table...")
    
    with engine.connect() as connection:
        try:
            # Create expenses table
            connection.execute(text("""
                CREATE TABLE IF NOT EXISTS expenses (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name TEXT NOT NULL,
                    amount NUMERIC(12, 2) NOT NULL,
                    quantity INTEGER DEFAULT 1,
                    details TEXT,
                    expense_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
                    deleted_at TIMESTAMP WITH TIME ZONE
                );
            """))
            
            # Create indexes
            connection.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date);
            """))
            connection.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_expenses_is_deleted ON expenses(is_deleted);
            """))
            connection.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_expenses_date_not_deleted ON expenses(expense_date, is_deleted);
            """))
            
            connection.commit()
            print("✅ Expenses table created successfully!")
            
        except Exception as e:
            print(f"❌ Migration failed: {e}")
            connection.rollback()
            sys.exit(1)

if __name__ == "__main__":
    apply_migration()
