from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, Literal
from decimal import Decimal

# --- Stock Transaction Schemas ---
class StockTransactionBase(BaseModel):
    product_id: UUID
    quantity: int = Field(..., gt=0)
    party_name: Optional[str] = None
    purchase_price: Optional[Decimal] = Field(default=None, ge=0)
    type: Literal['IN', 'OUT']

class StockTransactionCreate(StockTransactionBase):
    pass

class StockTransaction(StockTransactionBase):
    id: UUID
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

# --- Sales Schemas ---
class SaleBase(BaseModel):
    product_id: UUID
    customer_name: str = Field(..., min_length=1)
    customer_phone: Optional[str] = None
    quantity: int = Field(..., gt=0)
    selling_price: Decimal = Field(..., ge=0)
    payment_type: Literal['Credit', 'Debit']

class SaleCreate(SaleBase):
    # purchase_price and total_amount will be handled in the CRUD logic
    # created_at is optional - if not provided, will use current time
    created_at: Optional[datetime] = None

class SaleUpdate(BaseModel):
    """Schema for updating an existing sale - all fields are optional"""
    product_id: Optional[UUID] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    quantity: Optional[int] = Field(default=None, gt=0)
    selling_price: Optional[Decimal] = Field(default=None, ge=0)
    payment_type: Optional[Literal['Credit', 'Debit']] = None

class Sale(SaleBase):
    id: UUID
    purchase_price: Decimal
    total_amount: Decimal
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

