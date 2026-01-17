from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional
from decimal import Decimal

class ExpenseBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=500, description="Name of the expense or income")
    amount: Decimal = Field(..., description="Amount - negative for expenses, positive for income/gifts")
    quantity: int = Field(default=1, ge=1, description="Quantity of items")
    details: Optional[str] = Field(None, description="Additional details about the expense")
    expense_date: Optional[datetime] = Field(None, description="Date of expense (defaults to now)")

class ExpenseCreate(ExpenseBase):
    pass

class ExpenseUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=500)
    amount: Optional[Decimal] = None
    quantity: Optional[int] = Field(None, ge=1)
    details: Optional[str] = None
    expense_date: Optional[datetime] = None

class Expense(ExpenseBase):
    id: UUID
    created_at: datetime
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
