from sqlalchemy.orm import Session
from app.models.models import StockTransaction, Sale, Product
        
from app.schemas import transactions
from uuid import UUID
from fastapi import HTTPException
from datetime import datetime

# --- Stock Transaction CRUD ---
def get_transactions(db: Session, skip: int = 0, limit: int = 100, include_deleted: bool = False):
    """Get stock transactions, by default excludes soft-deleted records"""
    query = db.query(StockTransaction).filter(StockTransaction.product_id != None)
    
    if not include_deleted:
        query = query.filter(StockTransaction.is_deleted == False)
    
    return query.offset(skip).limit(limit).all()

def create_transaction(db: Session, transaction: transactions.StockTransactionCreate):
    db_transaction = StockTransaction(**transaction.model_dump())
    db.add(db_transaction)
    
    # Update product's purchase price if it's an 'IN' transaction and price is provided
    if transaction.type == 'IN' and transaction.purchase_price:
        db_product = db.query(Product).filter(Product.id == transaction.product_id).first()
        if db_product:
            db_product.purchase_price = transaction.purchase_price
            
    db.commit()
    db.refresh(db_transaction)
    return db_transaction

def delete_transaction(db: Session, transaction_id: UUID):
    """Soft delete: Mark transaction as deleted instead of removing from database"""
    db_transaction = db.query(StockTransaction).filter(
        StockTransaction.id == transaction_id,
        StockTransaction.is_deleted == False  # Can only delete non-deleted transactions
    ).first()
    
    if db_transaction:
        # Soft delete - mark as deleted with timestamp
        db_transaction.is_deleted = True
        db_transaction.deleted_at = datetime.utcnow()
        db.commit()
        db.refresh(db_transaction)
    
    return db_transaction

# --- Sales CRUD ---
def get_sales(db: Session, skip: int = 0, limit: int = 100, include_deleted: bool = False):
    """Get sales, by default excludes soft-deleted records"""
    query = db.query(Sale).filter(Sale.product_id != None)
    
    if not include_deleted:
        query = query.filter(Sale.is_deleted == False)
    
    return query.offset(skip).limit(limit).all()

def create_sale(db: Session, sale: transactions.SaleCreate):
    # Fetch product to get historical purchase price
    db_product = db.query(Product).filter(Product.id == sale.product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Calculate total amount
    total_amount = sale.selling_price * sale.quantity
    
    # Prepare sale data
    sale_data = sale.model_dump(exclude={'created_at'})
    db_sale = Sale(
        **sale_data,
        purchase_price=db_product.purchase_price,
        total_amount=total_amount
    )
    
    # Set custom created_at if provided
    if sale.created_at:
        db_sale.created_at = sale.created_at
    
    db.add(db_sale)
    db.flush() 
    
    # Log an 'OUT' transaction automatically for the sale
    db_transaction = StockTransaction(
        product_id=sale.product_id,
        quantity=sale.quantity,
        party_name=f"Sale to {sale.customer_name}",
        purchase_price=db_product.purchase_price,
        type='OUT',
        sale_id=db_sale.id
    )
    
    # Match stock transaction date with sale date
    if sale.created_at:
        db_transaction.created_at = sale.created_at
    
    db.add(db_transaction)
    db.commit()
    db.refresh(db_sale)
    return db_sale

def update_sale(db: Session, sale_id: UUID, sale_update: transactions.SaleUpdate):
    """Update an existing sale and recalculate amounts if needed"""
    db_sale = db.query(Sale).filter(
        Sale.id == sale_id,
        Sale.is_deleted == False
    ).first()
    
    if not db_sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    # Track if quantity or product changed (affects stock transaction)
    quantity_changed = sale_update.quantity is not None and sale_update.quantity != db_sale.quantity
    product_changed = sale_update.product_id is not None and sale_update.product_id != db_sale.product_id
    
    # Update fields that were provided
    update_data = sale_update.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(db_sale, field, value)
    
    # If product changed, update purchase_price
    if product_changed:
        db_product = db.query(Product).filter(Product.id == db_sale.product_id).first()
        if not db_product:
            raise HTTPException(status_code=404, detail="Product not found")
        db_sale.purchase_price = db_product.purchase_price
    
    # Recalculate total_amount if quantity or selling_price changed
    if sale_update.quantity is not None or sale_update.selling_price is not None:
        db_sale.total_amount = db_sale.selling_price * db_sale.quantity
    
    # Update associated stock transaction if quantity or product changed
    if quantity_changed or product_changed:
        db_stock_transaction = db.query(StockTransaction).filter(
            StockTransaction.sale_id == sale_id,
            StockTransaction.is_deleted == False
        ).first()
        
        if db_stock_transaction:
            if quantity_changed:
                db_stock_transaction.quantity = db_sale.quantity
            if product_changed:
                db_stock_transaction.product_id = db_sale.product_id
                db_product = db.query(Product).filter(Product.id == db_sale.product_id).first()
                if db_product:
                    db_stock_transaction.purchase_price = db_product.purchase_price
            
            # Update party name if customer name changed
            if sale_update.customer_name is not None:
                db_stock_transaction.party_name = f"Sale to {db_sale.customer_name}"
    
    db.commit()
    db.refresh(db_sale)
    return db_sale

def delete_sale(db: Session, sale_id: UUID):
    """Soft delete: Mark sale and its stock transaction as deleted instead of removing from database"""
    db_sale = db.query(Sale).filter(
        Sale.id == sale_id,
        Sale.is_deleted == False  # Can only delete non-deleted sales
    ).first()
    
    if db_sale:
        # Soft delete the sale
        db_sale.is_deleted = True
        db_sale.deleted_at = datetime.utcnow()
        
        # Also soft delete the associated stock transaction
        db_stock_transaction = db.query(StockTransaction).filter(
            StockTransaction.sale_id == sale_id,
            StockTransaction.is_deleted == False
        ).first()
        
        if db_stock_transaction:
            db_stock_transaction.is_deleted = True
            db_stock_transaction.deleted_at = datetime.utcnow()
        
        db.commit()
        db.refresh(db_sale)
    
    return db_sale

