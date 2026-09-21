from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, List, Dict, Any

class CompanyAccountCreate(BaseModel):
    name: str = Field(..., min_length=1, description="Company / Supplier Name")
    phone: Optional[str] = None
    catalog_company_id: Optional[UUID] = None

class CompanyAccountUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    catalog_company_id: Optional[UUID] = None

class CompanyAccountOut(BaseModel):
    id: UUID
    name: str
    phone: Optional[str] = None
    catalog_company_id: Optional[UUID] = None
    catalog_company_name: Optional[str] = None
    catalog_company_logo: Optional[str] = None
    created_at: datetime
    is_deleted: bool = False

    class Config:
        from_attributes = True

class CompanyPaymentCreate(BaseModel):
    account_id: Optional[UUID] = None
    company_id: Optional[UUID] = None  # fallback/alias for account_id
    entry_date: Optional[datetime] = None
    amount_paid: float = Field(..., gt=0, description="Amount paid to company")
    payment_method: Optional[str] = Field("ONLINE", description="CASH or ONLINE")
    bank_name: Optional[str] = None
    transaction_id: Optional[str] = None
    remarks: Optional[str] = None
    money_account_id: Optional[UUID] = None  # If set, deducts from this money account

class CompanyPurchaseItem(BaseModel):
    product_id: UUID
    quantity: int = Field(..., gt=0)
    total_price: float = Field(..., gt=0, description="Total cost of this product lot")

class CompanyPurchaseCreate(BaseModel):
    account_id: Optional[UUID] = None
    company_id: Optional[UUID] = None  # fallback/alias for account_id
    entry_date: Optional[datetime] = None
    items: List[CompanyPurchaseItem]
    remarks: Optional[str] = None

class CompanyKhataEntryUpdate(BaseModel):
    entry_date: Optional[datetime] = None
    amount_paid: Optional[float] = None
    payment_method: Optional[str] = None
    bank_name: Optional[str] = None
    transaction_id: Optional[str] = None
    remarks: Optional[str] = None

class CompanyKhataEntryOut(BaseModel):
    id: UUID
    account_id: Optional[UUID] = None
    company_id: Optional[UUID] = None
    entry_date: datetime
    entry_type: str
    amount_paid: float
    payment_method: Optional[str] = None
    bank_name: Optional[str] = None
    transaction_id: Optional[str] = None
    total_purchase_amount: float
    products_detail: Optional[List[Dict[str, Any]]] = None
    stock_transaction_ids: Optional[List[str]] = None
    remarks: Optional[str] = None
    running_balance: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True

class CompanyKhataOverview(BaseModel):
    account_id: UUID
    company_id: UUID  # alias for account_id
    name: str
    company_name: str  # alias for name
    phone: Optional[str] = None
    catalog_company_id: Optional[UUID] = None
    catalog_company_name: Optional[str] = None
    company_logo: Optional[str] = None
    total_paid: float
    total_purchased: float
    net_balance: float
    balance_status: str  # 'ADVANCE', 'PAYABLE', 'SETTLED'
    entry_count: int
    products_count: int

class CompanyKhataLedgerOut(BaseModel):
    account_id: UUID
    company_id: UUID
    name: str
    company_name: str
    phone: Optional[str] = None
    catalog_company_id: Optional[UUID] = None
    catalog_company_name: Optional[str] = None
    company_logo: Optional[str] = None
    total_paid: float
    total_purchased: float
    net_balance: float
    balance_status: str
    company: Optional[CompanyKhataOverview] = None
    entries: List[CompanyKhataEntryOut]
