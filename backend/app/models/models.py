import uuid
from sqlalchemy import Column, String, Integer, Numeric, ForeignKey, DateTime, Text, CheckConstraint, Boolean, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.session import Base

class Company(Base):
    __tablename__ = "companies"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    logo = Column(Text, nullable=True)  # Store logo filename (e.g., "Bayer.png")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    products = relationship("Product", back_populates="company")
    khata_entries = relationship("CompanyKhataEntry", back_populates="company", cascade="all, delete-orphan", order_by="CompanyKhataEntry.entry_date.asc()")

class Product(Base):
    __tablename__ = "products"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"))
    name = Column(Text, nullable=False)
    category = Column(Text)
    unit = Column(Text, nullable=False)
    purchase_price = Column(Numeric(12, 2), default=0.0)
    mrp = Column(Numeric(12, 2), nullable=True)
    company_discount = Column(Numeric(5, 2), nullable=True, default=0)
    min_stock = Column(Integer, default=5)

    company = relationship("Company", back_populates="products")
    transactions = relationship("StockTransaction", back_populates="product", cascade="all, delete-orphan")
    sales = relationship("Sale", back_populates="product", cascade="all, delete-orphan")

class StockTransaction(Base):
    __tablename__ = "stock_transactions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"))
    quantity = Column(Integer, nullable=False)
    party_name = Column(Text)
    purchase_price = Column(Numeric(12, 2))
    mrp = Column(Numeric(12, 2), nullable=True)
    company_discount = Column(Numeric(5, 2), nullable=True)
    type = Column(Text, CheckConstraint("type IN ('IN', 'OUT')"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    sale_id = Column(UUID(as_uuid=True), ForeignKey("sales.id", ondelete="CASCADE"), nullable=True)
    
    # Soft delete support - for maintaining complete historical logs
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    product = relationship("Product", back_populates="transactions")
    sale = relationship("Sale", back_populates="stock_transaction")

class Sale(Base):
    __tablename__ = "sales"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"))
    customer_name = Column(Text, nullable=False)
    customer_phone = Column(String(20), nullable=True)
    dealer_id = Column(UUID(as_uuid=True), ForeignKey("khata_accounts.id", ondelete="SET NULL"), nullable=True)
    dealer_name = Column(Text, nullable=True)
    farmer_name = Column(Text, nullable=True)
    quantity = Column(Integer, nullable=False)
    selling_price = Column(Numeric(12, 2), nullable=False)
    purchase_price = Column(Numeric(12, 2), nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False)
    paid_amount = Column(Numeric(12, 2), nullable=True)
    invoice_id = Column(String(50), nullable=True, index=True)
    invoice_no = Column(String(50), nullable=True, index=True)
    payment_type = Column(Text, CheckConstraint("payment_type IN ('Credit', 'Debit')"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Soft delete support - for maintaining complete historical logs
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    product = relationship("Product", back_populates="sales")
    stock_transaction = relationship("StockTransaction", back_populates="sale", uselist=False, cascade="all, delete")
    khata_account = relationship("KhataAccount", back_populates="sales")

class Expense(Base):
    __tablename__ = "expenses"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)  # Can be negative (expense) or positive (income/gift)
    quantity = Column(Integer, default=1)
    details = Column(Text, nullable=True)
    expense_date = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Soft delete support - for maintaining complete historical logs
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(String, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean(), default=True)

class Note(Base):
    __tablename__ = "notes"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Text, default="pending", nullable=False)  # 'pending', 'in_progress', 'completed'
    is_important = Column(Boolean, default=False, nullable=False)  # Highlighted in top bar
    priority = Column(Text, default="medium", nullable=False)  # 'low', 'medium', 'high'
    target_date = Column(DateTime(timezone=True), nullable=True)  # Due / target scheduling date
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

class KhataAccount(Base):
    __tablename__ = "khata_accounts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    phone = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    role = Column(Text, default="Dealer", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    entries = relationship("KhataEntry", back_populates="account", cascade="all, delete-orphan", order_by="KhataEntry.entry_date.asc()")
    sales = relationship("Sale", back_populates="khata_account")

class KhataEntry(Base):
    __tablename__ = "khata_entries"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("khata_accounts.id", ondelete="CASCADE"), nullable=False)
    entry_date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    entry_type = Column(Text, CheckConstraint("entry_type IN ('CREDIT', 'RECOVERY')"), nullable=False)
    farmer_name = Column(Text, nullable=True)
    credit_amount = Column(Numeric(12, 2), default=0.0, nullable=False)
    recovery_amount = Column(Numeric(12, 2), default=0.0, nullable=False)
    products_detail = Column(JSON, nullable=True)
    invoice_id = Column(String(50), nullable=True, index=True)
    sale_id = Column(UUID(as_uuid=True), ForeignKey("sales.id", ondelete="SET NULL"), nullable=True)
    remarks = Column(Text, nullable=True)
    payment_method = Column(Text, default="CASH", nullable=True)
    bank_name = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    account = relationship("KhataAccount", back_populates="entries")
 
class CompanyKhataAccount(Base):
    __tablename__ = "company_khata_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    phone = Column(String(50), nullable=True)
    catalog_company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    catalog_company = relationship("Company")
    entries = relationship("CompanyKhataEntry", back_populates="account", cascade="all, delete-orphan")

class CompanyKhataEntry(Base):
    __tablename__ = "company_khata_entries"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("company_khata_accounts.id", ondelete="CASCADE"), nullable=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)
    entry_date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    entry_type = Column(Text, CheckConstraint("entry_type IN ('PAYMENT', 'PURCHASE')"), nullable=False)
    
    # For Payments made to company (Advance / Bill payment)
    amount_paid = Column(Numeric(12, 2), default=0.0, nullable=False)
    payment_method = Column(Text, default="ONLINE", nullable=True)  # 'ONLINE', 'CASH'
    bank_name = Column(Text, nullable=True)
    transaction_id = Column(Text, nullable=True)
    
    # For Stock Purchases / Inward delivery from company
    total_purchase_amount = Column(Numeric(12, 2), default=0.0, nullable=False)
    products_detail = Column(JSON, nullable=True)  # [{ product_id, product_name, quantity, total_price, unit_purchase_price }]
    stock_transaction_ids = Column(JSON, nullable=True)  # list of UUID strings
    
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    account = relationship("CompanyKhataAccount", back_populates="entries")
    company = relationship("Company", back_populates="khata_entries")


