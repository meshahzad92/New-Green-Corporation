from sqlalchemy import func, case, and_
from sqlalchemy.orm import Session
from app.models.models import Company, Product, StockTransaction
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
    limit: Optional[int] = None, 
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

    query = query.group_by(Product.id)
    if skip:
        query = query.offset(skip)
    if limit is not None and limit > 0:
        query = query.limit(limit)
    results = query.all()
    
    # Flatten results to match schema (Product + stock balance)
    products = []
    for product, stock in results:
        product.current_stock = int(stock)
        products.append(product)
        
    return products

def get_product(db: Session, product_id: UUID):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return None

    in_stock = db.query(func.coalesce(func.sum(StockTransaction.quantity), 0)).filter(
        StockTransaction.product_id == product_id,
        StockTransaction.type == 'IN',
        StockTransaction.is_deleted == False,
    ).scalar()
    out_stock = db.query(func.coalesce(func.sum(StockTransaction.quantity), 0)).filter(
        StockTransaction.product_id == product_id,
        StockTransaction.type == 'OUT',
        StockTransaction.is_deleted == False,
    ).scalar()
    product.current_stock = int(in_stock - out_stock)
    return product

def create_product(db: Session, product: ProductCreate):
    if product.company_id:
        company = db.query(Company).filter(Company.id == product.company_id).first()
        if not company:
            return None

    trimmed_name = product.name.strip()
    # Deduplication / idempotency check: same name and same company
    existing = db.query(Product).filter(
        Product.company_id == product.company_id,
        Product.name.ilike(trimmed_name)
    ).first()
    if existing:
        return existing

    db_product = Product(
        name=trimmed_name,
        category=product.category,
        unit=product.unit,
        purchase_price=product.purchase_price,
        mrp=product.mrp,
        company_discount=product.company_discount,
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
