from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.models import StockTransaction, Sale, Product
        
from app.schemas import transactions
from uuid import UUID
import uuid
from decimal import Decimal
from fastapi import HTTPException
from datetime import datetime, timedelta

def get_product_stock(db: Session, product_id: UUID):
    in_stock = db.query(func.coalesce(func.sum(StockTransaction.quantity), 0)).filter(
        StockTransaction.product_id == product_id,
        StockTransaction.type == 'IN',
        StockTransaction.is_deleted == False
    ).scalar()
    out_stock = db.query(func.coalesce(func.sum(StockTransaction.quantity), 0)).filter(
        StockTransaction.product_id == product_id,
        StockTransaction.type == 'OUT',
        StockTransaction.is_deleted == False
    ).scalar()
    return int(in_stock - out_stock)

# --- Stock Transaction CRUD ---
def get_transactions(db: Session, skip: int = 0, limit: int = 100, include_deleted: bool = False):
    """Get stock transactions, by default excludes soft-deleted records (most recent first)"""
    query = db.query(StockTransaction).filter(StockTransaction.product_id != None)
    
    if not include_deleted:
        query = query.filter(StockTransaction.is_deleted == False)
    
    return query.order_by(StockTransaction.created_at.desc()).offset(skip).limit(limit).all()

def create_transaction(db: Session, transaction: transactions.StockTransactionCreate):
    db_product = db.query(Product).filter(Product.id == transaction.product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Idempotency / deduplication check: prevent double-inserting if identical IN transaction submitted in last 20 seconds
    now_utc = datetime.utcnow()
    recent_cutoff = now_utc - timedelta(seconds=20)
    existing = db.query(StockTransaction).filter(
        StockTransaction.product_id == transaction.product_id,
        StockTransaction.quantity == transaction.quantity,
        StockTransaction.party_name == transaction.party_name,
        StockTransaction.type == transaction.type,
        StockTransaction.is_deleted == False,
        StockTransaction.created_at >= recent_cutoff
    ).first()
    if existing:
        return existing

    db_transaction = StockTransaction(**transaction.model_dump())
    db.add(db_transaction)
    
    # Update product's purchase price, mrp, and company_discount if it's an 'IN' transaction
    if transaction.type == 'IN' and transaction.purchase_price:
        db_product.purchase_price = transaction.purchase_price
        if transaction.mrp is not None:
            db_product.mrp = transaction.mrp
        db_product.company_discount = transaction.company_discount if transaction.company_discount is not None else Decimal('0.00')
            
    db.commit()
    db.refresh(db_transaction)
    return db_transaction

def delete_transaction(db: Session, transaction_id: UUID):
    """Soft delete: Mark transaction as deleted instead of removing from database and update product pricing"""
    db_transaction = db.query(StockTransaction).filter(
        StockTransaction.id == transaction_id,
        StockTransaction.is_deleted == False  # Can only delete non-deleted transactions
    ).first()
    
    if db_transaction:
        # Soft delete - mark as deleted with timestamp
        db_transaction.is_deleted = True
        db_transaction.deleted_at = datetime.utcnow()
        
        # If this was an 'IN' stock transaction, recalculate the product's purchase_price, mrp, and company_discount
        if db_transaction.type == 'IN' and db_transaction.product_id:
            db_product = db.query(Product).filter(Product.id == db_transaction.product_id).first()
            if db_product:
                latest_in = db.query(StockTransaction).filter(
                    StockTransaction.product_id == db_product.id,
                    StockTransaction.type == 'IN',
                    StockTransaction.is_deleted == False
                ).order_by(StockTransaction.created_at.desc()).first()
                
                if latest_in:
                    db_product.purchase_price = latest_in.purchase_price or Decimal('0.00')
                    db_product.mrp = latest_in.mrp
                    db_product.company_discount = latest_in.company_discount
                else:
                    db_product.purchase_price = Decimal('0.00')
                    db_product.mrp = None
                    db_product.company_discount = Decimal('0.00')
        
        db.commit()
        db.refresh(db_transaction)
    
    return db_transaction

# --- Sales CRUD ---
def get_sales(db: Session, skip: int = 0, limit: int = 100, include_deleted: bool = False):
    """Get sales, by default excludes soft-deleted records (most recent first)"""
    query = db.query(Sale).filter(Sale.product_id != None)
    
    if not include_deleted:
        query = query.filter(Sale.is_deleted == False)
    
    return query.order_by(Sale.created_at.desc()).offset(skip).limit(limit).all()

def create_sale(db: Session, sale: transactions.SaleCreate):
    # Idempotency / deduplication check: return existing sale if identical sale submitted in last 20 seconds
    recent_cutoff = datetime.utcnow() - timedelta(seconds=20)
    trimmed_cust = sale.customer_name.strip()
    existing = db.query(Sale).filter(
        Sale.customer_name == trimmed_cust,
        Sale.product_id == sale.product_id,
        Sale.quantity == sale.quantity,
        Sale.selling_price == sale.selling_price,
        Sale.is_deleted == False,
        Sale.created_at >= recent_cutoff
    ).first()
    if existing:
        return existing

    # Fetch product to get historical purchase price
    db_product = db.query(Product).filter(Product.id == sale.product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")

    if get_product_stock(db, sale.product_id) < sale.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")
    
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

def create_bulk_sale(db: Session, bulk_sale: transactions.BulkSaleCreate):
    """
    Creates multiple sale items under a single invoice with atomic stock validation.
    Includes idempotency deduplication guard.
    """
    if not bulk_sale.items:
        return []

    # Idempotency / deduplication check:
    # If a user double-clicks submit, return existing invoice sales rather than creating duplicates
    recent_cutoff = datetime.utcnow() - timedelta(seconds=20)
    trimmed_cust = bulk_sale.customer_name.strip()
    first_item = bulk_sale.items[0]
    existing_sale = db.query(Sale).filter(
        Sale.customer_name == trimmed_cust,
        Sale.product_id == first_item.product_id,
        Sale.quantity == first_item.quantity,
        Sale.is_deleted == False,
        Sale.created_at >= recent_cutoff
    ).first()
    if existing_sale and existing_sale.invoice_id:
        matching_sales = db.query(Sale).filter(
            Sale.invoice_id == existing_sale.invoice_id,
            Sale.is_deleted == False
        ).all()
        if len(matching_sales) == len(bulk_sale.items):
            return matching_sales

    # 1. Validate all products and stock availability FIRST
    products_map = {}
    for item in bulk_sale.items:
        db_product = db.query(Product).filter(Product.id == item.product_id).first()
        if not db_product:
            raise HTTPException(status_code=404, detail=f"Product not found")
        
        available = get_product_stock(db, item.product_id)
        if available < item.quantity:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient stock for '{db_product.name}'. Available: {available}, Requested: {item.quantity}"
            )
        products_map[item.product_id] = db_product

    # 2. Generate unique invoice identifier & human-friendly invoice number
    invoice_id = str(uuid.uuid4())
    inv_short = uuid.uuid4().hex[:4].upper()
    now_ts = datetime.utcnow()
    invoice_no = f"INV-{now_ts.strftime('%y%m%d')}-{inv_short}"

    # 3. Calculate total invoice amount
    total_invoice_amount = sum(item.selling_price * item.quantity for item in bulk_sale.items)
    
    # 4. Determine total paid amount
    if bulk_sale.paid_amount is not None:
        remaining_paid = bulk_sale.paid_amount
    else:
        remaining_paid = total_invoice_amount if bulk_sale.payment_type == 'Debit' else Decimal('0')

    created_sales = []

    # 5. Create each sale and stock transaction
    for item in bulk_sale.items:
        db_product = products_map[item.product_id]
        item_total = item.selling_price * item.quantity

        # Allocate paid amount sequentially across items
        if remaining_paid >= item_total:
            item_paid = item_total
            remaining_paid -= item_total
        else:
            item_paid = remaining_paid
            remaining_paid = Decimal('0')

        item_payment_type = 'Debit' if item_paid >= item_total else 'Credit'

        db_sale = Sale(
            product_id=item.product_id,
            customer_name=bulk_sale.customer_name,
            customer_phone=bulk_sale.customer_phone,
            quantity=item.quantity,
            selling_price=item.selling_price,
            purchase_price=db_product.purchase_price,
            total_amount=item_total,
            paid_amount=item_paid,
            payment_type=item_payment_type,
            invoice_id=invoice_id,
            invoice_no=invoice_no,
            created_at=bulk_sale.created_at or now_ts
        )
        db.add(db_sale)
        db.flush()

        # Log OUT stock transaction
        db_transaction = StockTransaction(
            product_id=item.product_id,
            quantity=item.quantity,
            party_name=f"Sale to {bulk_sale.customer_name}",
            purchase_price=db_product.purchase_price,
            type='OUT',
            sale_id=db_sale.id,
            created_at=bulk_sale.created_at or now_ts
        )
        db.add(db_transaction)
        created_sales.append(db_sale)

    db.commit()
    for s in created_sales:
        db.refresh(s)

    return created_sales

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

    if quantity_changed or product_changed:
        target_product_id = db_sale.product_id
        existing_sale_quantity = db.query(func.coalesce(func.sum(StockTransaction.quantity), 0)).filter(
            StockTransaction.sale_id == sale_id,
            StockTransaction.is_deleted == False
        ).scalar()
        available_stock = get_product_stock(db, target_product_id) + int(existing_sale_quantity)
        if available_stock < db_sale.quantity:
            raise HTTPException(status_code=400, detail="Insufficient stock")
    
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
            
            # Sync sale date to linked stock transaction
            if sale_update.created_at is not None:
                db_stock_transaction.created_at = sale_update.created_at
    
    # If only date changed (no product/quantity change), still sync stock transaction date
    elif sale_update.created_at is not None:
        db_stock_transaction = db.query(StockTransaction).filter(
            StockTransaction.sale_id == sale_id,
            StockTransaction.is_deleted == False
        ).first()
        if db_stock_transaction:
            db_stock_transaction.created_at = sale_update.created_at
    
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

def delete_invoice(db: Session, invoice_id: str):
    """Soft delete all sales and stock transactions for an invoice"""
    sales = db.query(Sale).filter(
        Sale.invoice_id == invoice_id,
        Sale.is_deleted == False
    ).all()
    
    if not sales:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    now = datetime.utcnow()
    for s in sales:
        s.is_deleted = True
        s.deleted_at = now
        db_stock_transaction = db.query(StockTransaction).filter(
            StockTransaction.sale_id == s.id,
            StockTransaction.is_deleted == False
        ).first()
        if db_stock_transaction:
            db_stock_transaction.is_deleted = True
            db_stock_transaction.deleted_at = now
            
    db.commit()
    return True

