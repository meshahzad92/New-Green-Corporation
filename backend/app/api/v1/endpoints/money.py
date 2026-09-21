from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.db.session import get_db
from app.schemas.money import (
    MoneyAccountCreate, MoneyAccountUpdate, MoneyAccountOut,
    MoneyTransactionCreate, MoneyTransactionUpdate, MoneyTransactionOut,
    MoneyTransferCreate, MoneyAccountLedgerOut
)
from app.crud import crud_money

router = APIRouter()

# ============================================================
# Accounts
# ============================================================

@router.get("/accounts", response_model=List[MoneyAccountOut])
def list_money_accounts(db: Session = Depends(get_db)):
    """List all money accounts with current balances"""
    return crud_money.get_money_accounts(db)

@router.post("/accounts", response_model=MoneyAccountOut, status_code=201)
def create_money_account(data: MoneyAccountCreate, db: Session = Depends(get_db)):
    """Add a new bank or cash account"""
    return crud_money.create_money_account(db, data)

@router.put("/accounts/{account_id}", response_model=MoneyAccountOut)
def update_money_account(account_id: UUID, data: MoneyAccountUpdate, db: Session = Depends(get_db)):
    """Update account title or details"""
    return crud_money.update_money_account(db, account_id, data)

@router.delete("/accounts/{account_id}")
def delete_money_account(account_id: UUID, db: Session = Depends(get_db)):
    """Delete account (blocked if transactions exist)"""
    return crud_money.delete_money_account(db, account_id)

# ============================================================
# Ledger
# ============================================================

@router.get("/accounts/{account_id}/ledger", response_model=MoneyAccountLedgerOut)
def get_money_account_ledger(account_id: UUID, db: Session = Depends(get_db)):
    """Full chronological ledger with running balance for one account"""
    return crud_money.get_money_account_ledger(db, account_id)

# ============================================================
# Transactions & Transfers
# ============================================================

@router.post("/transactions", response_model=MoneyTransactionOut, status_code=201)
def create_money_transaction(data: MoneyTransactionCreate, db: Session = Depends(get_db)):
    """Record a DEPOSIT or WITHDRAWAL"""
    return crud_money.create_money_transaction(db, data)

@router.post("/transfers", response_model=MoneyTransactionOut, status_code=201)
def create_money_transfer(data: MoneyTransferCreate, db: Session = Depends(get_db)):
    """Record a Transfer to a Company (syncs with Company Khata) or Person"""
    return crud_money.create_money_transfer(db, data)

@router.put("/transactions/{transaction_id}", response_model=MoneyTransactionOut)
def update_money_transaction(transaction_id: UUID, data: MoneyTransactionUpdate, db: Session = Depends(get_db)):
    """Edit a transaction's details"""
    return crud_money.update_money_transaction(db, transaction_id, data)

@router.delete("/transactions/{transaction_id}")
def delete_money_transaction(transaction_id: UUID, db: Session = Depends(get_db)):
    """Soft delete a transaction"""
    return crud_money.delete_money_transaction(db, transaction_id)

