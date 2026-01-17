from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime
from uuid import UUID

from app.db.session import get_db
from app.schemas.expense import Expense, ExpenseCreate, ExpenseUpdate
from app.crud import crud_expense

router = APIRouter()

@router.get("/", response_model=List[Expense])
def read_expenses(
    skip: int = 0,
    limit: int = 100,
    expense_date: Optional[date] = Query(None, description="Filter by specific date"),
    db: Session = Depends(get_db)
):
    """
    Get all expenses, optionally filtered by date
    If no date is provided, returns all expenses
    """
    expenses = crud_expense.get_expenses(
        db, 
        skip=skip, 
        limit=limit,
        expense_date=expense_date
    )
    return expenses

@router.get("/daily-total", response_model=dict)
def get_daily_total(
    expense_date: date = Query(..., description="Date to get total for"),
    db: Session = Depends(get_db)
):
    """Get total expenses for a specific date"""
    total = crud_expense.get_daily_total(db, expense_date)
    return {
        "date": expense_date,
        "total": float(total)
    }

@router.get("/date-range", response_model=List[dict])
def get_expenses_by_date_range(
    start_date: date = Query(..., description="Start date"),
    end_date: date = Query(..., description="End date"),
    db: Session = Depends(get_db)
):
    """Get expenses grouped by date within a date range"""
    expenses = crud_expense.get_expenses_by_date_range(db, start_date, end_date)
    return [
        {
            "date": exp.date,
            "total": float(exp.total),
            "count": exp.count
        }
        for exp in expenses
    ]

@router.get("/{expense_id}", response_model=Expense)
def read_expense(expense_id: UUID, db: Session = Depends(get_db)):
    """Get a specific expense by ID"""
    expense = crud_expense.get_expense(db, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return expense

@router.post("/", response_model=Expense, status_code=201)
def create_expense(expense: ExpenseCreate, db: Session = Depends(get_db)):
    """
    Create a new expense
    - Use negative amount for expenses (outgoing money)
    - Use positive amount for income/gifts (incoming money)
    """
    return crud_expense.create_expense(db, expense)

@router.put("/{expense_id}", response_model=Expense)
def update_expense(
    expense_id: UUID,
    expense: ExpenseUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing expense"""
    db_expense = crud_expense.update_expense(db, expense_id, expense)
    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return db_expense

@router.delete("/{expense_id}", response_model=Expense)
def delete_expense(expense_id: UUID, db: Session = Depends(get_db)):
    """Soft delete an expense (maintains historical records)"""
    db_expense = crud_expense.delete_expense(db, expense_id)
    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return db_expense
