from fastapi import APIRouter
from app.api.v1.endpoints import products, transactions, reports, login, companies, expenses

api_router = APIRouter()

# Health check endpoint for Docker/Load Balancers
@api_router.get("/health", tags=["health"])
async def health_check():
    """Health check endpoint for monitoring and load balancers"""
    return {"status": "healthy", "service": "agrimanage-backend"}

api_router.include_router(login.router, tags=["login"])
api_router.include_router(companies.router, prefix="/companies", tags=["companies"])
api_router.include_router(products.router, prefix="/products", tags=["products"])
api_router.include_router(transactions.router, tags=["transactions"])
api_router.include_router(expenses.router, prefix="/expenses", tags=["expenses"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
