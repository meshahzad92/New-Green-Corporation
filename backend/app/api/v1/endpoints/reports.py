from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.reports import DashboardReport
from app.crud import crud_report
from datetime import date
from typing import Optional

router = APIRouter()

@router.get("/", response_model=DashboardReport)
def get_dashboard_summary(db: Session = Depends(get_db)):
    """
    Get summary statistics for the dashboard:
    - Total Inventory Value
    - Low Stock Alerts
    - Today's Revenue & Profit
    """
    return crud_report.get_dashboard_stats(db)

@router.get("/period-summary")
def get_period_summary(
    start_date: date = Query(..., description="Start date of the period"),
    end_date: date = Query(..., description="End date of the period"),
    db: Session = Depends(get_db)
):
    """
    Get comprehensive financial summary for a specific period:
    - Total Sales Revenue
    - Total Sales Quantity
    - Total Expenses (outgoing money)
    - Total Income (incoming money from expenses table)
    - Net Expense (income - expenses from expense table)
    - Gross Profit (from sales)
    - Net Profit (gross profit - expenses + income)
    - Credit/Debit information
    """
    return crud_report.get_period_financial_summary(db, start_date, end_date)
