from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from app.db.session import get_db
from app.schemas.transactions import Sale, SaleCreate, SaleUpdate, StockTransaction, StockTransactionCreate, StockTransactionUpdate, BulkSaleCreate
from app.crud import crud_transaction
from app.api import deps
from app.models.models import User

router = APIRouter()

# --- Stock Transactions ---
@router.get("/transactions", response_model=List[StockTransaction])
def read_transactions(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    return crud_transaction.get_transactions(db, skip=skip, limit=limit)

@router.post("/transactions", response_model=StockTransaction, status_code=status.HTTP_201_CREATED)
def create_transaction(
    transaction: StockTransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    return crud_transaction.create_transaction(db=db, transaction=transaction)

@router.put("/transactions/{transaction_id}", response_model=StockTransaction)
def update_transaction(
    transaction_id: UUID,
    transaction: StockTransactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    updated = crud_transaction.update_transaction(db=db, transaction_id=transaction_id, transaction_update=transaction)
    if not updated:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return updated

# --- Sales ---
@router.get("/sales", response_model=List[Sale])
def read_sales(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    return crud_transaction.get_sales(db, skip=skip, limit=limit)

@router.post("/sales", response_model=Sale, status_code=status.HTTP_201_CREATED)
def create_sale(
    sale: SaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    return crud_transaction.create_sale(db=db, sale=sale)

@router.post("/sales/bulk", response_model=List[Sale], status_code=status.HTTP_201_CREATED)
def create_bulk_sale(
    bulk_sale: BulkSaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    return crud_transaction.create_bulk_sale(db=db, bulk_sale=bulk_sale)

@router.put("/sales/{sale_id}", response_model=Sale)
def update_sale(
    sale_id: UUID,
    sale: SaleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    return crud_transaction.update_sale(db=db, sale_id=sale_id, sale_update=sale)

@router.delete("/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(
    transaction_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    db_trans = crud_transaction.delete_transaction(db, transaction_id=transaction_id)
    if not db_trans:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return None

@router.delete("/sales/{sale_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sale(
    sale_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    db_sale = crud_transaction.delete_sale(db, sale_id=sale_id)
    if not db_sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    return None

@router.delete("/sales/invoice/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invoice(
    invoice_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    success = crud_transaction.delete_invoice(db, invoice_id=invoice_id)
    if not success:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return None
