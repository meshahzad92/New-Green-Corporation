from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, Literal, List, Any, Dict
from decimal import Decimal

# --- Account Schemas ---
class KhataAccountBase(BaseModel):
    name: str = Field(..., min_length=1)
    phone: Optional[str] = None
    role: Optional[str] = 'Dealer'

class KhataAccountCreate(KhataAccountBase):
    pass

class KhataAccountUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None

class KhataAccountResponse(KhataAccountBase):
    id: UUID
    total_credit: Decimal = Decimal('0.00')
    total_recovery: Decimal = Decimal('0.00')
    total_left: Decimal = Decimal('0.00')
    entry_count: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Product Item for Credit Sales ---
class KhataProductItem(BaseModel):
    product_id: UUID
    name: str
    quantity: int = Field(..., gt=0)
    price: Decimal = Field(..., ge=0)
    total: Decimal = Field(..., ge=0)

# --- Entry Schemas ---
class KhataEntryBase(BaseModel):
    account_id: UUID
    entry_date: Optional[datetime] = None
    entry_type: Literal['CREDIT', 'RECOVERY']
    farmer_name: Optional[str] = None
    credit_amount: Decimal = Field(default=Decimal('0.00'), ge=0)
    recovery_amount: Decimal = Field(default=Decimal('0.00'), ge=0)
    payment_method: Optional[Literal['CASH', 'ONLINE']] = 'CASH'
    bank_name: Optional[str] = None
    products_detail: Optional[List[Dict[str, Any]]] = None
    remarks: Optional[str] = None

class KhataEntryCreate(KhataEntryBase):
    pass

class KhataEntryUpdate(BaseModel):
    entry_date: Optional[datetime] = None
    farmer_name: Optional[str] = None
    credit_amount: Optional[Decimal] = Field(default=None, ge=0)
    recovery_amount: Optional[Decimal] = Field(default=None, ge=0)
    payment_method: Optional[Literal['CASH', 'ONLINE']] = None
    bank_name: Optional[str] = None
    products_detail: Optional[List[Dict[str, Any]]] = None
    remarks: Optional[str] = None

class KhataEntryResponse(BaseModel):
    id: UUID
    account_id: UUID
    entry_date: datetime
    entry_type: Literal['CREDIT', 'RECOVERY']
    farmer_name: Optional[str] = None
    credit_amount: Decimal
    recovery_amount: Decimal
    payment_method: Optional[str] = 'CASH'
    bank_name: Optional[str] = None
    products_detail: Optional[List[Dict[str, Any]]] = None
    invoice_id: Optional[str] = None
    sale_id: Optional[UUID] = None
    remarks: Optional[str] = None
    running_balance: Optional[Decimal] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Specialized Endpoints Schemas ---
class KhataCreditSaleCreate(BaseModel):
    dealer_id: UUID
    farmer_name: Optional[str] = None
    entry_date: Optional[datetime] = None
    items: List[KhataProductItem] = Field(..., min_length=1)
    remarks: Optional[str] = None

class KhataRecoveryCreate(BaseModel):
    dealer_id: UUID
    entry_date: Optional[datetime] = None
    amount: Decimal = Field(..., gt=0)
    payment_method: Optional[Literal['CASH', 'ONLINE']] = 'CASH'
    bank_name: Optional[str] = None
    remarks: Optional[str] = None
