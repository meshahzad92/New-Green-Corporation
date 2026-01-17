from sqlalchemy.orm import Session
from sqlalchemy import func, case, and_
from app.models.models import Product, StockTransaction, Sale, Expense
from datetime import datetime, date, timedelta
from decimal import Decimal

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
        Product.min_stock,
        current_stock.label("stock_balance")
    ).outerjoin(StockTransaction).group_by(Product.id).all()

    total_value = Decimal('0.00')
    low_stock_count = 0
    total_products = len(product_stats_query)

    for p in product_stats_query:
        if p.stock_balance > 0:
            total_value += (p.purchase_price * p.stock_balance)
        if p.stock_balance <= p.min_stock:
            low_stock_count += 1

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

    # 4. Weekly sales data for chart (last 7 days)
    weekly_data = []
    for i in range(6, -1, -1):  # Last 7 days
        day = today - timedelta(days=i)
        day_sales = db.query(
            func.sum(Sale.total_amount).label("revenue")
        ).filter(
            func.date(Sale.created_at) == day,
            Sale.is_deleted == False
        ).first()
        
        weekly_data.append({
            "date": day.strftime("%a"),  # Mon, Tue, etc.
            "sales": float(day_sales.revenue or 0)
        })
    
    return {
        "stats": {
            "total_inventory_value": total_value,
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

def get_period_financial_summary(db: Session, start_date: date, end_date: date):
    """
    Get comprehensive financial summary for a date range
    Returns sales, expenses, profit, and credit/debit information
    """
    
    # 1. Sales Summary - only count non-deleted sales
    sales_summary = db.query(
        func.count(Sale.id).label("total_sales_count"),
        func.sum(Sale.quantity).label("total_quantity_sold"),
        func.sum(Sale.total_amount).label("total_revenue"),
        func.sum(Sale.purchase_price * Sale.quantity).label("total_cost"),
        func.sum(Sale.total_amount - (Sale.purchase_price * Sale.quantity)).label("gross_profit")
    ).filter(
        and_(
            func.date(Sale.created_at) >= start_date,
            func.date(Sale.created_at) <= end_date,
            Sale.is_deleted == False
        )
    ).first()
    
    # 2. Expense Summary - split into expenses (negative) and income (positive)
    expenses_data = db.query(
        func.sum(case(
            (Expense.amount < 0, Expense.amount),
            else_=0
        )).label("total_expenses"),
        func.sum(case(
            (Expense.amount > 0, Expense.amount),
            else_=0
        )).label("total_income"),
        func.sum(Expense.amount).label("net_expense_total"),
        func.count(Expense.id).label("expense_count")
    ).filter(
        and_(
            func.date(Expense.expense_date) >= start_date,
            func.date(Expense.expense_date) <= end_date,
            Expense.is_deleted == False
        )
    ).first()
    
    # 3. Credit/Debit Summary from Sales (payment_status)
    credit_debit_summary = db.query(
        func.sum(case(
            (Sale.payment_type == 'Credit', Sale.total_amount),
            else_=0
        )).label("total_credit"),
        func.sum(case(
            (Sale.payment_type == 'Debit', Sale.total_amount),
            else_=0
        )).label("total_cash"),
        func.count(case(
            (Sale.payment_type == 'Credit', 1)
        )).label("credit_count"),
        func.count(case(
            (Sale.payment_type == 'Debit', 1)
        )).label("cash_count")
    ).filter(
        and_(
            func.date(Sale.created_at) >= start_date,
            func.date(Sale.created_at) <= end_date,
            Sale.is_deleted == False
        )
    ).first()
    
    # 4. Calculate comprehensive metrics
    total_revenue = float(sales_summary.total_revenue or 0)
    total_cost = float(sales_summary.total_cost or 0)
    gross_profit = float(sales_summary.gross_profit or 0)
    
    # Expenses are negative, income is positive in DB
    total_expenses = abs(float(expenses_data.total_expenses or 0))  # Convert to positive for display
    total_income_from_expenses = float(expenses_data.total_income or 0)
    net_expense = float(expenses_data.net_expense_total or 0)  # This will be negative if more expenses than income
    
    # Net Profit = Gross Profit from Sales + Net Expense Total
    # (Net expense total is negative for expenses, so it reduces profit)
    net_profit = gross_profit + net_expense
    
    # Credit/Debit
    total_credit = float(credit_debit_summary.total_credit or 0)
    total_cash = float(credit_debit_summary.total_cash or 0)
    
    # Daily breakdown for charts
    daily_data = []
    current_date = start_date
    while current_date <= end_date:
        # Get daily sales
        day_sales = db.query(
            func.sum(Sale.total_amount).label("revenue"),
            func.sum(Sale.total_amount - (Sale.purchase_price * Sale.quantity)).label("profit")
        ).filter(
            func.date(Sale.created_at) == current_date,
            Sale.is_deleted == False
        ).first()
        
        # Get daily expenses
        day_expenses = db.query(
            func.sum(Expense.amount).label("total")
        ).filter(
            func.date(Expense.expense_date) == current_date,
            Expense.is_deleted == False
        ).first()
        
        daily_data.append({
            "date": current_date.strftime("%Y-%m-%d"),
            "revenue": float(day_sales.revenue or 0),
            "profit": float(day_sales.profit or 0),
            "expenses": float(day_expenses.total or 0)
        })
        
        current_date += timedelta(days=1)
    
    return {
        "period": {
            "start_date": start_date.strftime("%Y-%m-%d"),
            "end_date": end_date.strftime("%Y-%m-%d"),
            "days": (end_date - start_date).days + 1
        },
        "sales_summary": {
            "total_sales_count": sales_summary.total_sales_count or 0,
            "total_quantity_sold": float(sales_summary.total_quantity_sold or 0),
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
            "credit_count": credit_debit_summary.credit_count or 0,
            "cash_count": credit_debit_summary.cash_count or 0,
            "credit_percentage": round((total_credit / total_revenue * 100), 2) if total_revenue > 0 else 0
        },
        "overall": {
            "net_profit": net_profit,
            "total_transactions": (sales_summary.total_sales_count or 0) + (expenses_data.expense_count or 0)
        },
        "daily_breakdown": daily_data
    }
