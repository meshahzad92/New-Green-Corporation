from pydantic import BaseModel
from decimal import Decimal
from typing import Dict, List

class DashboardStats(BaseModel):
    total_inventory_value: Decimal
    total_products: int
    low_stock_count: int
    today_sales_revenue: Decimal
    today_sales_profit: Decimal
    total_expense: Decimal
    net_profit: Decimal
    recent_sales_count: int

class WeeklySalesData(BaseModel):
    date: str
    sales: float

class DashboardReport(BaseModel):
    stats: DashboardStats
    weekly_sales: List[WeeklySalesData]
