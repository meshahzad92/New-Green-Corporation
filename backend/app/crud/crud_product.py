from sqlalchemy import func, case, and_
from sqlalchemy.orm import Session
from app.models.models import Product, StockTransaction
from app.schemas.product import ProductCreate, ProductUpdate
from uuid import UUID
from typing import Optional

def update_product(db: Session, product_id: UUID, product: ProductUpdate):
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if db_product:
        update_data = product.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_product, key, value)
        db.commit()
        db.refresh(db_product)
    return db_product

def get_products(
    db: Session, 
    skip: int = 0, 
    limit: int = 100, 
    search: Optional[str] = None, 
    category: Optional[str] = None
):
    # Calculate stock balance: (Sum of IN) - (Sum of OUT)
    # Only count non-deleted transactions for accurate stock levels
    in_stock = func.coalesce(
        func.sum(case((
            and_(StockTransaction.type == 'IN', StockTransaction.is_deleted == False), 
            StockTransaction.quantity
        ), else_=0)), 
        0
    )
    out_stock = func.coalesce(
        func.sum(case((
            and_(StockTransaction.type == 'OUT', StockTransaction.is_deleted == False), 
            StockTransaction.quantity
        ), else_=0)), 
        0
    )
    
    query = db.query(
        Product,
        (in_stock - out_stock).label("current_stock")
    ).outerjoin(StockTransaction)

    if search:
        query = query.filter(Product.name.ilike(f"%{search}%"))
    if category:
        query = query.filter(Product.category == category)

    results = query.group_by(Product.id).offset(skip).limit(limit).all()
    
    # Flatten results to match schema (Product + stock balance)
    products = []
    for product, stock in results:
        product.current_stock = int(stock)
        products.append(product)
        
    return products

def get_product(db: Session, product_id: UUID):
    return db.query(Product).filter(Product.id == product_id).first()

def create_product(db: Session, product: ProductCreate):
    db_product = Product(
        name=product.name,
        category=product.category,
        unit=product.unit,
        purchase_price=product.purchase_price,
        min_stock=product.min_stock,
        company_id=product.company_id
    )
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

def delete_product(db: Session, product_id: UUID):
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if db_product:
        db.delete(db_product)
        db.commit()
    return db_product
