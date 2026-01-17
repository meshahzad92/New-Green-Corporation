from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional
from decimal import Decimal

# Base Product Schema
class ProductBase(BaseModel):
    name: str
    category: Optional[str] = None
    unit: str
    purchase_price: Decimal = Decimal('0.00')
    min_stock: int = 5
    company_id: Optional[UUID] = None

# Create Product Schema
class ProductCreate(ProductBase):
    pass

# Update Product Schema
class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    purchase_price: Optional[Decimal] = None
    min_stock: Optional[int] = None
    company_id: Optional[UUID] = None

# Response Product Schema
class Product(ProductBase):
    id: UUID
    current_stock: int = 0
    
    model_config = ConfigDict(from_attributes=True)

# Company Schema
class CompanyBase(BaseModel):
    name: str

class CompanyCreate(CompanyBase):
    pass

class Company(CompanyBase):
    id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
