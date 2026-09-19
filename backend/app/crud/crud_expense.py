from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from app.models.models import Expense
from app.schemas.expense import ExpenseCreate, ExpenseUpdate
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal

def get_expenses(
    db: Session, 
    skip: int = 0, 
    limit: int = 1000,
    expense_date: date = None,
    start_date: date = None,
    end_date: date = None,
    search: str = None,
    include_deleted: bool = False
):
    """Get expenses, optionally filtered by specific date, date range, or keyword search"""
    query = db.query(Expense)
    
    # Filter out soft-deleted records unless explicitly requested
    if not include_deleted:
        query = query.filter(Expense.is_deleted == False)
    
    # Filter by date if provided
    if expense_date:
        query = query.filter(func.date(Expense.expense_date) == expense_date)
    elif start_date or end_date:
        if start_date:
            query = query.filter(func.date(Expense.expense_date) >= start_date)
        if end_date:
            query = query.filter(func.date(Expense.expense_date) <= end_date)
            
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            (Expense.name.ilike(term)) | (Expense.details.ilike(term))
        )
    
    # Order by expense date descending, then created_at descending
    return query.order_by(Expense.expense_date.desc(), Expense.created_at.desc()).offset(skip).limit(limit).all()

def get_expense(db: Session, expense_id: UUID):
    """Get a single expense by ID"""
    return db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.is_deleted == False
    ).first()

def create_expense(db: Session, expense: ExpenseCreate):
    """Create a new expense with deduplication guard"""
    from datetime import timedelta
    now_utc = datetime.utcnow()
    recent_cutoff = now_utc - timedelta(seconds=30)
    trimmed_name = expense.name.strip()
    
    # Check if an identical active expense was created within the last 30 seconds
    existing = db.query(Expense).filter(
        Expense.name == trimmed_name,
        Expense.amount == expense.amount,
        Expense.is_deleted == False,
        Expense.created_at >= recent_cutoff
    ).first()
    if existing:
        return existing

    data = expense.model_dump()
    data['name'] = trimmed_name
    db_expense = Expense(**data)
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    return db_expense

def update_expense(db: Session, expense_id: UUID, expense: ExpenseUpdate):
    """Update an existing expense"""
    db_expense = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.is_deleted == False
    ).first()
    
    if db_expense:
        update_data = expense.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_expense, key, value)
        db.commit()
        db.refresh(db_expense)
    
    return db_expense

def delete_expense(db: Session, expense_id: UUID):
    """Soft delete an expense"""
    db_expense = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.is_deleted == False
    ).first()
    
    if db_expense:
        db_expense.is_deleted = True
        db_expense.deleted_at = datetime.utcnow()
        db.commit()
        db.refresh(db_expense)
    
    return db_expense

def get_daily_total(db: Session, expense_date: date):
    """Get total expenses for a specific date"""
    result = db.query(func.sum(Expense.amount)).filter(
        func.date(Expense.expense_date) == expense_date,
        Expense.is_deleted == False
    ).scalar()
    
    return result if result else Decimal('0.00')

def get_expenses_by_date_range(db: Session, start_date: date, end_date: date):
    """Get expenses within a date range with daily totals"""
    expenses = db.query(
        func.date(Expense.expense_date).label('date'),
        func.sum(Expense.amount).label('total'),
        func.count(Expense.id).label('count')
    ).filter(
        and_(
            func.date(Expense.expense_date) >= start_date,
            func.date(Expense.expense_date) <= end_date,
            Expense.is_deleted == False
        )
    ).group_by(func.date(Expense.expense_date)).all()
    
    return expenses
