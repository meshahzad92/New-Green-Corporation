from fastapi import APIRouter
from app.api.v1.endpoints import products, transactions, reports, login, companies, expenses

api_router = APIRouter()

api_router.include_router(login.router, tags=["login"])
api_router.include_router(companies.router, prefix="/companies", tags=["companies"])
api_router.include_router(products.router, prefix="/products", tags=["products"])
api_router.include_router(transactions.router, tags=["transactions"])
api_router.include_router(expenses.router, prefix="/expenses", tags=["expenses"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
