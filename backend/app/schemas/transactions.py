from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional, Literal
from decimal import Decimal

# --- Stock Transaction Schemas ---
class StockTransactionBase(BaseModel):
    product_id: UUID
    quantity: int
    party_name: Optional[str] = None
    purchase_price: Optional[Decimal] = None
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
    customer_name: str
    customer_phone: Optional[str] = None
    quantity: int
    selling_price: Decimal
    payment_type: Literal['Credit', 'Debit']

class SaleCreate(SaleBase):
    # purchase_price and total_amount will be handled in the CRUD logic
    pass

class Sale(SaleBase):
    id: UUID
    purchase_price: Decimal
    total_amount: Decimal
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
