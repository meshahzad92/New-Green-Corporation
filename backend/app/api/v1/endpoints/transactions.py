from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from app.db.session import get_db
from app.schemas.transactions import Sale, SaleCreate, SaleUpdate, StockTransaction, StockTransactionCreate
from app.crud import crud_transaction

router = APIRouter()

# --- Stock Transactions ---
@router.get("/transactions", response_model=List[StockTransaction])
def read_transactions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud_transaction.get_transactions(db, skip=skip, limit=limit)

@router.post("/transactions", response_model=StockTransaction, status_code=status.HTTP_201_CREATED)
def create_transaction(transaction: StockTransactionCreate, db: Session = Depends(get_db)):
    return crud_transaction.create_transaction(db=db, transaction=transaction)

# --- Sales ---
@router.get("/sales", response_model=List[Sale])
def read_sales(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud_transaction.get_sales(db, skip=skip, limit=limit)

@router.post("/sales", response_model=Sale, status_code=status.HTTP_201_CREATED)
def create_sale(sale: SaleCreate, db: Session = Depends(get_db)):
    return crud_transaction.create_sale(db=db, sale=sale)

@router.put("/sales/{sale_id}", response_model=Sale)
def update_sale(sale_id: UUID, sale: SaleUpdate, db: Session = Depends(get_db)):
    return crud_transaction.update_sale(db=db, sale_id=sale_id, sale_update=sale)

@router.delete("/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(transaction_id: UUID, db: Session = Depends(get_db)):
    db_trans = crud_transaction.delete_transaction(db, transaction_id=transaction_id)
    if not db_trans:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return None

@router.delete("/sales/{sale_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sale(sale_id: UUID, db: Session = Depends(get_db)):
    db_sale = crud_transaction.delete_sale(db, sale_id=sale_id)
    if not db_sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    return None
