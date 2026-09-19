from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.db.session import get_db
from app.schemas.company_khata import (
    CompanyAccountCreate,
    CompanyAccountUpdate,
    CompanyAccountOut,
    CompanyPaymentCreate,
    CompanyPurchaseCreate,
    CompanyKhataEntryUpdate,
    CompanyKhataOverview,
    CompanyKhataLedgerOut,
    CompanyKhataEntryOut
)
from app.crud import crud_company_khata

router = APIRouter()

# ==============================================================================
# Dedicated Accounts in Company Khata
# ==============================================================================

@router.get("/accounts", response_model=List[CompanyAccountOut])
def list_company_accounts(db: Session = Depends(get_db)):
    """List all accounts added to Company Khata"""
    return crud_company_khata.get_company_accounts(db)

@router.post("/accounts", response_model=CompanyAccountOut, status_code=201)
def create_company_account(data: CompanyAccountCreate, db: Session = Depends(get_db)):
    """Add a new company/supplier account to Company Khata"""
    return crud_company_khata.create_company_account(db, data)

@router.get("/accounts/{account_id}", response_model=CompanyAccountOut)
def get_company_account(account_id: UUID, db: Session = Depends(get_db)):
    """Get single company account details"""
    return crud_company_khata.get_company_account(db, account_id)

@router.put("/accounts/{account_id}", response_model=CompanyAccountOut)
def update_company_account(account_id: UUID, data: CompanyAccountUpdate, db: Session = Depends(get_db)):
    """Update company account details"""
    return crud_company_khata.update_company_account(db, account_id, data)

@router.delete("/accounts/{account_id}")
def delete_company_account(account_id: UUID, db: Session = Depends(get_db)):
    """Delete company account (blocked if transaction logs exist)"""
    return crud_company_khata.delete_company_account(db, account_id)


# ==============================================================================
# Overview & Ledger
# ==============================================================================

@router.get("/overview", response_model=List[CompanyKhataOverview])
def get_company_khata_overview(db: Session = Depends(get_db)):
    """
    Get all user-added company accounts with their financial standing (Advance, Payable, Settled).
    Single-query optimized for high performance (<50ms).
    """
    return crud_company_khata.get_company_khata_overview(db)

@router.get("/{account_id}/ledger", response_model=CompanyKhataLedgerOut)
def get_company_khata_ledger(account_id: UUID, db: Session = Depends(get_db)):
    """Get complete chronological ledger and running balance for a specific company account"""
    return crud_company_khata.get_company_khata_ledger(db, account_id)


# ==============================================================================
# Transactions (Payment & Purchase)
# ==============================================================================

@router.post("/payment", response_model=CompanyKhataEntryOut, status_code=201)
def create_company_payment(data: CompanyPaymentCreate, db: Session = Depends(get_db)):
    """Record payment/advance sent to a company"""
    return crud_company_khata.create_company_payment(db, data)

@router.post("/purchase", response_model=CompanyKhataEntryOut, status_code=201)
def create_company_purchase(data: CompanyPurchaseCreate, db: Session = Depends(get_db)):
    """
    Record stock delivery received from company:
    - Automatically creates 'IN' stock transactions incrementing inventory
    - Automatically calculates unit purchase price (total_price / quantity)
    - Deducts bill amount from company balance
    """
    return crud_company_khata.create_company_purchase(db, data)

@router.put("/entries/{entry_id}", response_model=CompanyKhataEntryOut)
def update_company_entry(entry_id: UUID, data: CompanyKhataEntryUpdate, db: Session = Depends(get_db)):
    """Update date, remarks, or payment details of an existing company khata entry"""
    return crud_company_khata.update_company_entry(db, entry_id, data)

@router.delete("/entries/{entry_id}")
def delete_company_entry(entry_id: UUID, db: Session = Depends(get_db)):
    """Soft delete an entry (if purchase, restores inventory stock and recalculates prices)"""
    return crud_company_khata.delete_company_entry(db, entry_id)
