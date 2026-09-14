from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime
from typing import Optional
from decimal import Decimal

# Base Product Schema
class ProductBase(BaseModel):
    name: str = Field(..., min_length=1)
    category: Optional[str] = None
    unit: str = Field(..., min_length=1)
    purchase_price: Decimal = Field(default=Decimal('0.00'), ge=0)
    mrp: Optional[Decimal] = Field(default=None, ge=0)
    company_discount: Optional[Decimal] = Field(default=None, ge=0, le=100)
    min_stock: int = Field(default=5, ge=0)
    company_id: Optional[UUID] = None

# Create Product Schema
class ProductCreate(ProductBase):
    pass

# Update Product Schema
class ProductUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1)
    category: Optional[str] = None
    unit: Optional[str] = Field(default=None, min_length=1)
    purchase_price: Optional[Decimal] = Field(default=None, ge=0)
    mrp: Optional[Decimal] = Field(default=None, ge=0)
    company_discount: Optional[Decimal] = Field(default=None, ge=0, le=100)
    min_stock: Optional[int] = Field(default=None, ge=0)
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
