import uuid
from sqlalchemy import Column, String, Integer, Numeric, ForeignKey, DateTime, Text, CheckConstraint, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.session import Base

class Company(Base):
    __tablename__ = "companies"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    products = relationship("Product", back_populates="company")

class Product(Base):
    __tablename__ = "products"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"))
    name = Column(Text, nullable=False)
    category = Column(Text)
    unit = Column(Text, nullable=False)
    purchase_price = Column(Numeric(12, 2), default=0.0)
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
    customer_phone = Column(String(11))
    quantity = Column(Integer, nullable=False)
    selling_price = Column(Numeric(12, 2), nullable=False)
    purchase_price = Column(Numeric(12, 2), nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False)
    payment_type = Column(Text, CheckConstraint("payment_type IN ('Credit', 'Debit')"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Soft delete support - for maintaining complete historical logs
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    product = relationship("Product", back_populates="sales")
    stock_transaction = relationship("StockTransaction", back_populates="sale", uselist=False, cascade="all, delete")

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
