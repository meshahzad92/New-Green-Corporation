from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, List

class MoneyAccountCreate(BaseModel):
    title: str = Field(..., min_length=1, description="Account title e.g. 'Shahzad Spray Center'")
    bank_name: Optional[str] = None  # e.g. 'UBL', 'HBL', 'CASH'
    account_type: Optional[str] = Field('BANK', description="'BANK' or 'CASH'")
    account_number: Optional[str] = None
    opening_balance: Optional[float] = Field(0.0, ge=0)

class MoneyAccountUpdate(BaseModel):
    title: Optional[str] = None
    bank_name: Optional[str] = None
    account_type: Optional[str] = None
    account_number: Optional[str] = None

class MoneyAccountOut(BaseModel):
    id: UUID
    title: str
    bank_name: Optional[str] = None
    account_type: str
    account_number: Optional[str] = None
    opening_balance: float
    current_balance: float  # computed
    created_at: datetime
    is_deleted: bool = False

    class Config:
        from_attributes = True

class MoneyTransactionCreate(BaseModel):
    account_id: UUID
    transaction_date: Optional[datetime] = None
    type: str = Field(..., description="'DEPOSIT' or 'WITHDRAWAL'")
    amount: float = Field(..., gt=0)
    payment_method: Optional[str] = Field('ONLINE', description="'ONLINE' or 'CASH'")
    description: Optional[str] = None
    tid: Optional[str] = None  # Transaction ID / reference

class MoneyTransferCreate(BaseModel):
    account_id: UUID
    transfer_to_type: str = Field(..., description="'COMPANY' or 'PERSON'")
    company_khata_account_id: Optional[UUID] = None
    person_name: Optional[str] = None
    person_account: Optional[str] = None
    amount: float = Field(..., gt=0)
    transaction_date: Optional[datetime] = None
    payment_method: Optional[str] = Field('ONLINE')
    tid: Optional[str] = None
    description: Optional[str] = None

class MoneyTransactionUpdate(BaseModel):
    transaction_date: Optional[datetime] = None
    amount: Optional[float] = None
    payment_method: Optional[str] = None
    description: Optional[str] = None
    tid: Optional[str] = None

class MoneyTransactionOut(BaseModel):
    id: UUID
    account_id: UUID
    transaction_date: datetime
    type: str
    amount: float
    payment_method: Optional[str] = None
    description: Optional[str] = None
    tid: Optional[str] = None
    company_khata_entry_id: Optional[UUID] = None
    running_balance: Optional[float] = None  # computed in ledger
    created_at: datetime
    is_deleted: bool = False

    class Config:
        from_attributes = True

class MoneyAccountLedgerOut(BaseModel):
    account: MoneyAccountOut
    transactions: List[MoneyTransactionOut]
    total_deposits: float
    total_withdrawals: float
    current_balance: float
