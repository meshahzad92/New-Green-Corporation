from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.db.session import get_db
from app.schemas.khata import (
    KhataAccountCreate,
    KhataAccountUpdate,
    KhataAccountResponse,
    KhataEntryCreate,
    KhataEntryUpdate,
    KhataEntryResponse,
    KhataCreditSaleCreate,
    KhataRecoveryCreate,
    KhataManualCreditCreate
)
from app.crud import crud_khata

router = APIRouter()

@router.get("/dealers", response_model=List[KhataAccountResponse])
def list_dealers(db: Session = Depends(get_db)):
    """List all dealers with computed credit, recovery, and balance left"""
    return crud_khata.get_dealers(db)

@router.post("/dealers", response_model=KhataAccountResponse)
def create_dealer(dealer_in: KhataAccountCreate, db: Session = Depends(get_db)):
    """Create a new dealer account"""
    dealer = crud_khata.create_dealer(db, dealer_in)
    return crud_khata.get_dealer(db, dealer.id)

@router.get("/dealers/{dealer_id}", response_model=KhataAccountResponse)
def get_dealer(dealer_id: UUID, db: Session = Depends(get_db)):
    """Get single dealer by ID"""
    dealer = crud_khata.get_dealer(db, dealer_id)
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer not found")
    return dealer

@router.put("/dealers/{dealer_id}", response_model=KhataAccountResponse)
def update_dealer(dealer_id: UUID, dealer_in: KhataAccountUpdate, db: Session = Depends(get_db)):
    """Update dealer details"""
    updated = crud_khata.update_dealer(db, dealer_id, dealer_in)
    if not updated:
        raise HTTPException(status_code=404, detail="Dealer not found")
    return crud_khata.get_dealer(db, dealer_id)

from sqlalchemy import func
from app.models.models import KhataEntry

@router.delete("/dealers/{dealer_id}")
def delete_dealer(dealer_id: UUID, db: Session = Depends(get_db)):
    """Soft delete dealer account if no active khata entries exist"""
    # Check if active entries exist
    active_entries_count = db.query(func.count(KhataEntry.id)).filter(
        KhataEntry.account_id == dealer_id,
        KhataEntry.is_deleted == False
    ).scalar() or 0

    if active_entries_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete dealer because there are {active_entries_count} active log(s) in their Khata. Please clear or delete all entries first."
        )

    success = crud_khata.delete_dealer(db, dealer_id)
    if not success:
        raise HTTPException(status_code=404, detail="Dealer not found")
    return {"message": "Dealer deleted successfully"}

@router.get("/dealers/{dealer_id}/ledger", response_model=List[KhataEntryResponse])
def get_dealer_ledger(dealer_id: UUID, db: Session = Depends(get_db)):
    """Get full chronological ledger with running balance for a dealer"""
    return crud_khata.get_dealer_ledger(db, dealer_id)

@router.post("/credit-sale", response_model=KhataEntryResponse)
def create_credit_sale(credit_sale_in: KhataCreditSaleCreate, db: Session = Depends(get_db)):
    """Record a credit sale: deducts stock, creates sales records, logs Khata credit"""
    return crud_khata.create_credit_sale(db, credit_sale_in)

@router.post("/recovery", response_model=KhataEntryResponse)
def create_recovery(recovery_in: KhataRecoveryCreate, db: Session = Depends(get_db)):
    """Record cash recovery: logs recovery into Khata, subtracts from dealer credit"""
    return crud_khata.create_recovery(db, recovery_in)

@router.post("/manual-credit", response_model=KhataEntryResponse)
def create_manual_credit(credit_in: KhataManualCreditCreate, db: Session = Depends(get_db)):
    """Record a manual credit entry (previous dues from register) — no stock deduction"""
    return crud_khata.create_manual_credit(db, credit_in)

@router.put("/entries/{entry_id}", response_model=KhataEntryResponse)
def update_entry(entry_id: UUID, entry_in: KhataEntryUpdate, db: Session = Depends(get_db)):
    """Update a khata entry"""
    updated = crud_khata.update_entry(db, entry_id, entry_in)
    if not updated:
        raise HTTPException(status_code=404, detail="Khata entry not found")
    return updated

@router.delete("/entries/{entry_id}")
def delete_entry(entry_id: UUID, db: Session = Depends(get_db)):
    """Soft delete a khata entry (and reverse stock if linked to a sale)"""
    success = crud_khata.delete_entry(db, entry_id)
    if not success:
        raise HTTPException(status_code=404, detail="Khata entry not found")
    return {"message": "Entry deleted successfully"}
