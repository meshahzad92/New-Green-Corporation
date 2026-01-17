from app.db.session import SessionLocal, engine, Base
from app.models.models import User, Company
from app.core.security import get_password_hash
from sqlalchemy import text, inspect

# Predefined companies based on logos (excluding agrimanage-logo.png)
PREDEFINED_COMPANIES = [
    {"name": "Bayer", "logo": "Bayer.png"},
    {"name": "Chatta Seeds", "logo": "Chatta Seeds.png"},
    {"name": "Corteva (Pioneer)", "logo": "Corteva(Pioneer).png"},
    {"name": "Mercury", "logo": "Mercury.png"},
    {"name": "Monsanto", "logo": "Monsanto.png"},
    {"name": "Sohni Dharti", "logo": "Sohni Dharti.jpeg"},
    {"name": "Syngenta", "logo": "Syngenta.png"},
]

def init_db():
    print("🔧 Initializing database...")
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created")
    
    # Add soft delete columns if they don't exist (for existing databases)
    db = SessionLocal()
    inspector = inspect(engine)
    
    try:
        # Check and add logo column to companies if it doesn't exist
        columns = [col['name'] for col in inspector.get_columns('companies')]
        
        if 'logo' not in columns:
            try:
                db.execute(text("ALTER TABLE companies ADD COLUMN logo TEXT"))
                db.commit()
                print("✅ Added logo column to companies")
            except Exception as e:
                print(f"⚠️  companies already has logo column or error: {e}")
                db.rollback()
        
        # Check and add columns to stock_transactions
        columns = [col['name'] for col in inspector.get_columns('stock_transactions')]
        
        if 'is_deleted' not in columns:
            try:
                db.execute(text("ALTER TABLE stock_transactions ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT 0"))
                db.execute(text("ALTER TABLE stock_transactions ADD COLUMN deleted_at TIMESTAMP"))
                db.commit()
                print("✅ Added soft delete columns to stock_transactions")
            except Exception as e:
                print(f"⚠️  stock_transactions already has soft delete columns or error: {e}")
                db.rollback()
        
        # Check and add columns to sales
        columns = [col['name'] for col in inspector.get_columns('sales')]
        
        if 'is_deleted' not in columns:
            try:
                db.execute(text("ALTER TABLE sales ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT 0"))
                db.execute(text("ALTER TABLE sales ADD COLUMN deleted_at TIMESTAMP"))
                db.commit()
                print("✅ Added soft delete columns to sales")
            except Exception as e:
                print(f"⚠️  sales already has soft delete columns or error: {e}")
                db.rollback()
        
    except Exception as e:
        print(f"⚠️  Schema migration note: {e}")
        db.rollback()
    
    # Seed predefined companies
    print("🏢 Seeding predefined companies...")
    for company_data in PREDEFINED_COMPANIES:
        existing = db.query(Company).filter(Company.name == company_data["name"]).first()
        if not existing:
            new_company = Company(
                name=company_data["name"],
                logo=company_data["logo"]
            )
            db.add(new_company)
            print(f"  ✅ Created company: {company_data['name']}")
        else:
            # Update logo if it doesn't have one
            if not existing.logo:
                existing.logo = company_data["logo"]
                print(f"  🔄 Updated logo for: {company_data['name']}")
    
    db.commit()
    print("✅ Predefined companies seeded successfully")
    
    # Check if user exists - wrapped in try-except for bcrypt compatibility
    try:
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
            print("✅ Created default user: waris92 / waris92")
        else:
            print("✅ Default user already exists")
    except Exception as e:
        print(f"⚠️  Skipping user creation due to error: {e}")
        print("💡 You can create users manually later via the API")
        db.rollback()
    
    db.close()
    print("🎉 Database initialization complete!")

if __name__ == "__main__":
    init_db()
