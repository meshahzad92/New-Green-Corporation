from sqlalchemy.orm import Session
from sqlalchemy import func, case, and_
from app.models.models import Product, StockTransaction, Sale, Expense
from app.db.session import SessionLocal
from datetime import datetime, date, timedelta
from decimal import Decimal
import time
from typing import Dict, Tuple, Any
from concurrent.futures import ThreadPoolExecutor

# In-memory cache for period reports with 60-second TTL
_period_report_cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}
CACHE_TTL_SECONDS = 60


def get_dashboard_stats(db: Session):
    # 1. Calculate Inventory Value and Stock Levels
    # Only count non-deleted transactions for accurate stock levels
    in_stock = func.coalesce(func.sum(case((
        and_(StockTransaction.type == 'IN', StockTransaction.is_deleted == False), 
        StockTransaction.quantity
    ), else_=0)), 0)
    
    out_stock = func.coalesce(func.sum(case((
        and_(StockTransaction.type == 'OUT', StockTransaction.is_deleted == False), 
        StockTransaction.quantity
    ), else_=0)), 0)
    
    current_stock = (in_stock - out_stock)

    product_stats_query = db.query(
        Product.id,
        Product.purchase_price,
        Product.mrp,
        Product.min_stock,
        current_stock.label("stock_balance")
    ).outerjoin(StockTransaction).group_by(Product.id).all()

    total_value = Decimal('0.00')
    total_mrp_value = Decimal('0.00')
    low_stock_count = 0
    total_products = len(product_stats_query)

    for p in product_stats_query:
        if p.stock_balance and p.stock_balance > 0:
            qty = Decimal(str(p.stock_balance))
            cost = p.purchase_price or Decimal('0.00')
            mrp = p.mrp if (p.mrp and p.mrp > 0) else cost
            total_value += (cost * qty)
            total_mrp_value += (mrp * qty)
        if p.stock_balance is None or p.stock_balance <= (p.min_stock or 5):
            low_stock_count += 1

    projected_profit = total_mrp_value - total_value

    # 2. Today's Sales Performance - only count non-deleted sales
    today = date.today()
    today_sales = db.query(
        func.sum(Sale.total_amount).label("revenue"),
        func.sum(Sale.total_amount - (Sale.purchase_price * Sale.quantity)).label("profit"),
        func.count(Sale.id).label("count")
    ).filter(
        func.date(Sale.created_at) == today,
        Sale.is_deleted == False
    ).first()

    # 3. Today's Expenses - Get total expenses (will be negative) and income (positive)
    today_expenses_query = db.query(
        func.sum(Expense.amount).label("total")
    ).filter(
        func.date(Expense.expense_date) == today,
        Expense.is_deleted == False
    ).first()

    # Total expense includes both expenses (negative) and income (positive)
    # So if you have -5000 expense and +1000 income, total will be -4000
    total_expense_amount = today_expenses_query.total or Decimal('0.00')
    
    # Calculate Net Profit = Sales Profit + Expense Total
    # (Expense total is already negative for expenses, positive for income)
    sales_profit = today_sales.profit or Decimal('0.00')
    sales_revenue = today_sales.revenue or Decimal('0.00')
    net_profit = sales_profit + total_expense_amount

    # 4. Weekly sales data for chart (last 7 days) - single grouped query
    start_week = today - timedelta(days=6)
    weekly_sales_rows = db.query(
        func.date(Sale.created_at).label("day"),
        func.coalesce(func.sum(Sale.total_amount), 0).label("revenue")
    ).filter(
        and_(
            func.date(Sale.created_at) >= start_week,
            func.date(Sale.created_at) <= today,
            Sale.is_deleted == False
        )
    ).group_by(func.date(Sale.created_at)).all()
    weekly_map = {row.day.strftime("%Y-%m-%d"): float(row.revenue) for row in weekly_sales_rows if row.day}

    weekly_data = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        weekly_data.append({
            "date": day.strftime("%a"),
            "sales": weekly_map.get(day.strftime("%Y-%m-%d"), 0.0)
        })
    
    return {
        "stats": {
            "total_inventory_value": total_value,
            "total_inventory_mrp_value": total_mrp_value,
            "projected_inventory_profit": projected_profit,
            "total_products": total_products,
            "low_stock_count": low_stock_count,
            "today_sales_revenue": sales_revenue,
            "today_sales_profit": sales_profit,
            "total_expense": total_expense_amount,
            "net_profit": net_profit,
            "recent_sales_count": today_sales.count or 0
        },
        "weekly_sales": weekly_data
    }

def clear_report_cache():
    """Clear in-memory cached report data"""
    _period_report_cache.clear()

def get_period_financial_summary(db: Session, start_date: date, end_date: date):
    """
    Get comprehensive financial summary for a date range with high-performance
    grouped aggregation, parallel execution, and 60-second in-memory caching.
    """
    cache_key = f"{start_date}_{end_date}"
    now_ts = time.time()
    if cache_key in _period_report_cache:
        cached_ts, cached_data = _period_report_cache[cache_key]
        if now_ts - cached_ts < CACHE_TTL_SECONDS:
            return cached_data

    def fetch_sales_data():
        s_db = SessionLocal()
        try:
            summary = s_db.query(
                func.count(Sale.id).label("total_sales_count"),
                func.coalesce(func.sum(Sale.quantity), 0).label("total_quantity_sold"),
                func.coalesce(func.sum(Sale.total_amount), 0).label("total_revenue"),
                func.coalesce(func.sum(Sale.purchase_price * Sale.quantity), 0).label("total_cost"),
                func.coalesce(func.sum(Sale.total_amount - (Sale.purchase_price * Sale.quantity)), 0).label("gross_profit"),
                func.coalesce(func.sum(case((Sale.payment_type == 'Credit', Sale.total_amount), else_=0)), 0).label("total_credit"),
                func.coalesce(func.sum(case((Sale.payment_type == 'Debit', Sale.total_amount), else_=0)), 0).label("total_cash"),
                func.coalesce(func.count(case((Sale.payment_type == 'Credit', 1))), 0).label("credit_count"),
                func.coalesce(func.count(case((Sale.payment_type == 'Debit', 1))), 0).label("cash_count")
            ).filter(
                and_(
                    func.date(Sale.created_at) >= start_date,
                    func.date(Sale.created_at) <= end_date,
                    Sale.is_deleted == False
                )
            ).first()

            by_day = s_db.query(
                func.date(Sale.created_at).label("sale_date"),
                func.coalesce(func.sum(Sale.total_amount), 0).label("revenue"),
                func.coalesce(func.sum(Sale.total_amount - (Sale.purchase_price * Sale.quantity)), 0).label("profit")
            ).filter(
                and_(
                    func.date(Sale.created_at) >= start_date,
                    func.date(Sale.created_at) <= end_date,
                    Sale.is_deleted == False
                )
            ).group_by(func.date(Sale.created_at)).all()
            return summary, by_day
        finally:
            s_db.close()

    def fetch_expense_data():
        e_db = SessionLocal()
        try:
            summary = e_db.query(
                func.coalesce(func.sum(case((Expense.amount < 0, Expense.amount), else_=0)), 0).label("total_expenses"),
                func.coalesce(func.sum(case((Expense.amount > 0, Expense.amount), else_=0)), 0).label("total_income"),
                func.coalesce(func.sum(Expense.amount), 0).label("net_expense_total"),
                func.count(Expense.id).label("expense_count")
            ).filter(
                and_(
                    func.date(Expense.expense_date) >= start_date,
                    func.date(Expense.expense_date) <= end_date,
                    Expense.is_deleted == False
                )
            ).first()

            by_day = e_db.query(
                func.date(Expense.expense_date).label("exp_date"),
                func.coalesce(func.sum(Expense.amount), 0).label("total")
            ).filter(
                and_(
                    func.date(Expense.expense_date) >= start_date,
                    func.date(Expense.expense_date) <= end_date,
                    Expense.is_deleted == False
                )
            ).group_by(func.date(Expense.expense_date)).all()
            return summary, by_day
        finally:
            e_db.close()

    with ThreadPoolExecutor(max_workers=2) as ex:
        f_sales = ex.submit(fetch_sales_data)
        f_expenses = ex.submit(fetch_expense_data)
        sales_data, sales_by_day = f_sales.result()
        expenses_data, expenses_by_day = f_expenses.result()

    total_revenue = float(sales_data.total_revenue or 0)
    total_cost = float(sales_data.total_cost or 0)
    gross_profit = float(sales_data.gross_profit or 0)

    total_expenses = abs(float(expenses_data.total_expenses or 0))
    total_income_from_expenses = float(expenses_data.total_income or 0)
    net_expense = float(expenses_data.net_expense_total or 0)

    net_profit = gross_profit + net_expense

    total_credit = float(sales_data.total_credit or 0)
    total_cash = float(sales_data.total_cash or 0)

    sales_map = {row.sale_date.strftime("%Y-%m-%d"): row for row in sales_by_day if row.sale_date}
    exp_map = {row.exp_date.strftime("%Y-%m-%d"): row for row in expenses_by_day if row.exp_date}

    daily_data = []
    current_date = start_date
    while current_date <= end_date:
        d_str = current_date.strftime("%Y-%m-%d")
        s_row = sales_map.get(d_str)
        e_row = exp_map.get(d_str)
        daily_data.append({
            "date": d_str,
            "revenue": float(s_row.revenue) if s_row else 0.0,
            "profit": float(s_row.profit) if s_row else 0.0,
            "expenses": float(e_row.total) if e_row else 0.0
        })
        current_date += timedelta(days=1)

    result = {
        "period": {
            "start_date": start_date.strftime("%Y-%m-%d"),
            "end_date": end_date.strftime("%Y-%m-%d"),
            "days": (end_date - start_date).days + 1
        },
        "sales_summary": {
            "total_sales_count": sales_data.total_sales_count or 0,
            "total_quantity_sold": float(sales_data.total_quantity_sold or 0),
            "total_revenue": total_revenue,
            "total_cost": total_cost,
            "gross_profit": gross_profit,
            "profit_margin": round((gross_profit / total_revenue * 100), 2) if total_revenue > 0 else 0
        },
        "expense_summary": {
            "total_expenses": total_expenses,
            "total_income": total_income_from_expenses,
            "net_expense": net_expense,
            "expense_count": expenses_data.expense_count or 0
        },
        "credit_debit": {
            "total_credit": total_credit,
            "total_cash": total_cash,
            "credit_count": sales_data.credit_count or 0,
            "cash_count": sales_data.cash_count or 0,
            "credit_percentage": round((total_credit / total_revenue * 100), 2) if total_revenue > 0 else 0
        },
        "overall": {
            "net_profit": net_profit,
            "total_transactions": (sales_data.total_sales_count or 0) + (expenses_data.expense_count or 0)
        },
        "daily_breakdown": daily_data
    }

    _period_report_cache[cache_key] = (now_ts, result)
    return result

