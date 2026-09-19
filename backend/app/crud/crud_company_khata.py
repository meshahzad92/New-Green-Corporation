from sqlalchemy.orm import Session
from sqlalchemy import func, case, and_
from app.models.models import Company, Product, StockTransaction, CompanyKhataAccount, CompanyKhataEntry
from app.schemas.company_khata import (
    CompanyAccountCreate,
    CompanyAccountUpdate,
    CompanyAccountOut,
    CompanyPaymentCreate,
    CompanyPurchaseCreate,
    CompanyKhataEntryUpdate,
    CompanyKhataOverview,
    CompanyKhataLedgerOut,
    CompanyKhataEntryOut
)
from uuid import UUID
import uuid
from decimal import Decimal
from fastapi import HTTPException, status
from datetime import datetime

# ==============================================================================
# Company Accounts CRUD (Dedicated to Company Khata)
# ==============================================================================

def create_company_account(db: Session, data: CompanyAccountCreate) -> CompanyKhataAccount:
    """Create a new supplier/company account in Company Khata"""
    name_clean = data.name.strip()
    if not name_clean:
        raise HTTPException(status_code=400, detail="Company name is required")

    # Check for existing active account with the same name
    existing = db.query(CompanyKhataAccount).filter(
        func.lower(func.trim(CompanyKhataAccount.name)) == name_clean.lower(),
        CompanyKhataAccount.is_deleted == False
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Company account '{name_clean}' already exists in Company Khata"
        )

    # Validate catalog company if provided
    catalog_comp_id = None
    if data.catalog_company_id:
        cat_comp = db.query(Company).filter(Company.id == data.catalog_company_id).first()
        if cat_comp:
            catalog_comp_id = cat_comp.id
    else:
        # Auto-match by name if exists in catalog
        cat_match = db.query(Company).filter(
            func.lower(func.trim(Company.name)) == name_clean.lower()
        ).first()
        if cat_match:
            catalog_comp_id = cat_match.id

    new_account = CompanyKhataAccount(
        id=uuid.uuid4(),
        name=name_clean,
        phone=data.phone.strip() if data.phone else None,
        catalog_company_id=catalog_comp_id,
        created_at=datetime.utcnow()
    )
    db.add(new_account)
    db.commit()
    db.refresh(new_account)
    return new_account

def get_company_accounts(db: Session):
    """List all active company accounts in Company Khata"""
    return db.query(CompanyKhataAccount).filter(
        CompanyKhataAccount.is_deleted == False
    ).order_by(CompanyKhataAccount.name.asc()).all()

def get_company_account(db: Session, account_id: UUID) -> CompanyKhataAccount:
    """Fetch single company account by ID"""
    account = db.query(CompanyKhataAccount).filter(
        CompanyKhataAccount.id == account_id,
        CompanyKhataAccount.is_deleted == False
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Company account not found in Company Khata")
    return account

def update_company_account(db: Session, account_id: UUID, data: CompanyAccountUpdate) -> CompanyKhataAccount:
    """Update company account details"""
    account = get_company_account(db, account_id)

    if data.name is not None:
        clean_name = data.name.strip()
        if not clean_name:
            raise HTTPException(status_code=400, detail="Company name cannot be empty")
        
        # Check duplicate
        dup = db.query(CompanyKhataAccount).filter(
            func.lower(func.trim(CompanyKhataAccount.name)) == clean_name.lower(),
            CompanyKhataAccount.id != account_id,
            CompanyKhataAccount.is_deleted == False
        ).first()
        if dup:
            raise HTTPException(status_code=400, detail=f"Company account '{clean_name}' already exists")
        account.name = clean_name

    if data.phone is not None:
        account.phone = data.phone.strip() if data.phone else None

    if data.catalog_company_id is not None:
        cat_comp = db.query(Company).filter(Company.id == data.catalog_company_id).first()
        if cat_comp:
            account.catalog_company_id = cat_comp.id
        else:
            account.catalog_company_id = None

    db.commit()
    db.refresh(account)
    return account

def delete_company_account(db: Session, account_id: UUID):
    """Soft delete company account with strict blocked deletion if entries exist"""
    account = get_company_account(db, account_id)

    # Check for active entries
    entry_count = db.query(func.count(CompanyKhataEntry.id)).filter(
        CompanyKhataEntry.account_id == account_id,
        CompanyKhataEntry.is_deleted == False
    ).scalar() or 0

    if entry_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete company '{account.name}' because it has {entry_count} transaction log(s) in its Khata. Delete all logs before removing this company."
        )

    account.is_deleted = True
    account.deleted_at = datetime.utcnow()
    db.commit()
    return {"message": f"Company account '{account.name}' deleted successfully"}


# ==============================================================================
# Highly Optimized Overview Aggregation (Single SQL Query)
# ==============================================================================

def get_company_khata_overview(db: Session):
    """
    Get all user-added company accounts with their computed financial balances and stats.
    Executes in a single optimized SQL query using subqueries and LEFT JOINs.
    """
    # 1. Aggregated entries subquery: sum of payments and purchases per account
    stats_sub = db.query(
        CompanyKhataEntry.account_id.label("account_id"),
        func.coalesce(func.sum(
            case((and_(CompanyKhataEntry.entry_type == 'PAYMENT', CompanyKhataEntry.is_deleted == False), CompanyKhataEntry.amount_paid), else_=0)
        ), 0).label("total_paid"),
        func.coalesce(func.sum(
            case((and_(CompanyKhataEntry.entry_type == 'PURCHASE', CompanyKhataEntry.is_deleted == False), CompanyKhataEntry.total_purchase_amount), else_=0)
        ), 0).label("total_purchased"),
        func.count(
            case((CompanyKhataEntry.is_deleted == False, CompanyKhataEntry.id), else_=None)
        ).label("entry_count")
    ).group_by(CompanyKhataEntry.account_id).subquery()

    # 2. Product count per catalog company subquery
    prod_sub = db.query(
        Product.company_id.label("company_id"),
        func.count(Product.id).label("products_count")
    ).group_by(Product.company_id).subquery()

    # 3. Single join query on CompanyKhataAccount
    rows = db.query(
        CompanyKhataAccount,
        Company.name.label("catalog_name"),
        Company.logo.label("catalog_logo"),
        func.coalesce(stats_sub.c.total_paid, 0).label("total_paid"),
        func.coalesce(stats_sub.c.total_purchased, 0).label("total_purchased"),
        func.coalesce(stats_sub.c.entry_count, 0).label("entry_count"),
        func.coalesce(prod_sub.c.products_count, 0).label("products_count")
    ).outerjoin(
        Company, CompanyKhataAccount.catalog_company_id == Company.id
    ).outerjoin(
        stats_sub, CompanyKhataAccount.id == stats_sub.c.account_id
    ).outerjoin(
        prod_sub, CompanyKhataAccount.catalog_company_id == prod_sub.c.company_id
    ).filter(
        CompanyKhataAccount.is_deleted == False
    ).order_by(
        CompanyKhataAccount.name.asc()
    ).all()

    overview_list = []
    for acc, cat_name, cat_logo, paid, purchased, e_count, p_count in rows:
        f_paid = float(paid)
        f_purchased = float(purchased)
        net_bal = round(f_paid - f_purchased, 2)

        if net_bal > 0:
            bal_status = 'ADVANCE'
        elif net_bal < 0:
            bal_status = 'PAYABLE'
        else:
            bal_status = 'SETTLED'

        overview_list.append(CompanyKhataOverview(
            account_id=acc.id,
            company_id=acc.id,  # backward compatibility alias
            name=acc.name,
            company_name=acc.name,  # backward compatibility alias
            phone=acc.phone,
            catalog_company_id=acc.catalog_company_id,
            catalog_company_name=cat_name,
            company_logo=cat_logo,
            total_paid=f_paid,
            total_purchased=f_purchased,
            net_balance=net_bal,
            balance_status=bal_status,
            entry_count=int(e_count),
            products_count=int(p_count)
        ))

    return overview_list


# ==============================================================================
# Chronological Ledger & Entries
# ==============================================================================

def get_company_khata_ledger(db: Session, account_id: UUID) -> CompanyKhataLedgerOut:
    """Get full chronological ledger for a specific company account with running balances"""
    acc = db.query(CompanyKhataAccount).filter(
        CompanyKhataAccount.id == account_id,
        CompanyKhataAccount.is_deleted == False
    ).first()
    
    # Fallback check if passed id is catalog_company_id or legacy company_id
    if not acc:
        acc = db.query(CompanyKhataAccount).filter(
            CompanyKhataAccount.catalog_company_id == account_id,
            CompanyKhataAccount.is_deleted == False
        ).first()

    if not acc:
        raise HTTPException(status_code=404, detail="Company account not found in Company Khata")

    # Fetch catalog details
    cat_comp = db.query(Company).filter(Company.id == acc.catalog_company_id).first() if acc.catalog_company_id else None

    # Fetch all active entries for this account
    entries = db.query(CompanyKhataEntry).filter(
        and_(
            CompanyKhataEntry.is_deleted == False,
            (CompanyKhataEntry.account_id == acc.id) | (CompanyKhataEntry.company_id == acc.id) | (CompanyKhataEntry.company_id == acc.catalog_company_id)
        )
    ).order_by(CompanyKhataEntry.entry_date.asc(), CompanyKhataEntry.created_at.asc()).all()

    running_bal = Decimal('0.00')
    ledger_entries = []

    for ent in entries:
        p_amt = Decimal(str(ent.amount_paid or 0))
        b_amt = Decimal(str(ent.total_purchase_amount or 0))

        if ent.entry_type == 'PAYMENT':
            running_bal += p_amt
        elif ent.entry_type == 'PURCHASE':
            running_bal -= b_amt

        out_entry = CompanyKhataEntryOut(
            id=ent.id,
            account_id=acc.id,
            company_id=acc.id,
            entry_date=ent.entry_date,
            entry_type=ent.entry_type,
            amount_paid=float(p_amt),
            payment_method=ent.payment_method,
            bank_name=ent.bank_name,
            transaction_id=ent.transaction_id,
            total_purchase_amount=float(b_amt),
            products_detail=ent.products_detail,
            stock_transaction_ids=ent.stock_transaction_ids,
            remarks=ent.remarks,
            running_balance=float(round(running_bal, 2)),
            created_at=ent.created_at
        )
        ledger_entries.append(out_entry)

    # Compute account totals
    total_paid_dec = sum(Decimal(str(e.amount_paid or 0)) for e in entries if e.entry_type == 'PAYMENT')
    total_purchased_dec = sum(Decimal(str(e.total_purchase_amount or 0)) for e in entries if e.entry_type == 'PURCHASE')
    net_bal_dec = total_paid_dec - total_purchased_dec

    if net_bal_dec > 0:
        bal_status = 'ADVANCE'
    elif net_bal_dec < 0:
        bal_status = 'PAYABLE'
    else:
        bal_status = 'SETTLED'

    # Reverse for UI display (newest entries at top)
    ledger_entries.reverse()

    return CompanyKhataLedgerOut(
        account_id=acc.id,
        company_id=acc.id,
        name=acc.name,
        company_name=acc.name,
        phone=acc.phone,
        catalog_company_id=acc.catalog_company_id,
        catalog_company_name=cat_comp.name if cat_comp else None,
        company_logo=cat_comp.logo if cat_comp else None,
        total_paid=float(total_paid_dec),
        total_purchased=float(total_purchased_dec),
        net_balance=float(round(net_bal_dec, 2)),
        balance_status=bal_status,
        entries=ledger_entries
    )


# ==============================================================================
# Record Payment & Stock Inward
# ==============================================================================

def create_company_payment(db: Session, data: CompanyPaymentCreate):
    """Record an advance payment or bill settlement made to a company account"""
    target_id = data.account_id or data.company_id
    if not target_id:
        raise HTTPException(status_code=400, detail="Account ID is required")

    acc = db.query(CompanyKhataAccount).filter(CompanyKhataAccount.id == target_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Company account not found in Company Khata")

    now = datetime.utcnow()
    entry = CompanyKhataEntry(
        id=uuid.uuid4(),
        account_id=acc.id,
        company_id=acc.catalog_company_id,
        entry_date=data.entry_date or now,
        entry_type='PAYMENT',
        amount_paid=Decimal(str(data.amount_paid)),
        payment_method=data.payment_method or "ONLINE",
        bank_name=data.bank_name.strip() if data.bank_name else None,
        transaction_id=data.transaction_id.strip() if data.transaction_id else None,
        total_purchase_amount=Decimal('0.00'),
        remarks=data.remarks.strip() if data.remarks else None,
        created_at=now
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry

def create_company_purchase(db: Session, data: CompanyPurchaseCreate):
    """
    Record stock delivery / purchase bill from company:
    1. Increments product inventory via StockTransaction(type='IN')
    2. Auto-calculates unit purchase price (total_price / quantity) and updates product
    3. Records purchase row in Company Khata deducting from company balance
    """
    target_id = data.account_id or data.company_id
    if not target_id:
        raise HTTPException(status_code=400, detail="Account ID is required")

    acc = db.query(CompanyKhataAccount).filter(CompanyKhataAccount.id == target_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Company account not found in Company Khata")

    if not data.items:
        raise HTTPException(status_code=400, detail="At least one product item is required")

    now = datetime.utcnow()
    entry_date = data.entry_date or now
    products_detail = []
    stock_transaction_ids = []
    total_bill_amount = Decimal('0.00')

    for item in data.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")

        qty = item.quantity
        if qty <= 0:
            raise HTTPException(status_code=400, detail="Quantity must be greater than zero")

        tot_price = Decimal(str(item.total_price))
        unit_price = round(tot_price / Decimal(str(qty)), 2)

        # Create StockTransaction IN
        stock_trans = StockTransaction(
            id=uuid.uuid4(),
            product_id=product.id,
            quantity=qty,
            party_name=f"{acc.name} (Inward Khata)",
            purchase_price=unit_price,
            mrp=product.mrp,
            company_discount=Decimal('0.00'),
            type='IN',
            created_at=entry_date,
            is_deleted=False
        )
        db.add(stock_trans)
        db.flush()

        # Update product's purchase price to newly calculated unit purchase price
        product.purchase_price = unit_price
        db.flush()

        stock_transaction_ids.append(str(stock_trans.id))
        products_detail.append({
            "product_id": str(product.id),
            "name": product.name,
            "quantity": qty,
            "unit": product.unit,
            "total_price": float(tot_price),
            "unit_price": float(unit_price)
        })

        total_bill_amount += tot_price

    # Create Company Khata purchase entry
    entry = CompanyKhataEntry(
        id=uuid.uuid4(),
        account_id=acc.id,
        company_id=acc.catalog_company_id,
        entry_date=entry_date,
        entry_type='PURCHASE',
        amount_paid=Decimal('0.00'),
        total_purchase_amount=total_bill_amount,
        products_detail=products_detail,
        stock_transaction_ids=stock_transaction_ids,
        remarks=data.remarks.strip() if data.remarks else None,
        created_at=now
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry

def update_company_entry(db: Session, entry_id: UUID, data: CompanyKhataEntryUpdate):
    """Update company entry details"""
    entry = db.query(CompanyKhataEntry).filter(
        CompanyKhataEntry.id == entry_id,
        CompanyKhataEntry.is_deleted == False
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    if data.entry_date:
        entry.entry_date = data.entry_date

    if data.remarks is not None:
        entry.remarks = data.remarks.strip() if data.remarks else None

    if entry.entry_type == 'PAYMENT':
        if data.amount_paid is not None:
            amt = Decimal(str(data.amount_paid))
            if amt <= 0:
                raise HTTPException(status_code=400, detail="Amount paid must be greater than zero")
            entry.amount_paid = amt

        if data.payment_method:
            entry.payment_method = data.payment_method
        if data.bank_name is not None:
            entry.bank_name = data.bank_name.strip() if data.bank_name else None
        if data.transaction_id is not None:
            entry.transaction_id = data.transaction_id.strip() if data.transaction_id else None

    db.commit()
    db.refresh(entry)
    return entry

def delete_company_entry(db: Session, entry_id: UUID):
    """Soft delete company entry and reverse inventory stock if purchase"""
    entry = db.query(CompanyKhataEntry).filter(
        CompanyKhataEntry.id == entry_id,
        CompanyKhataEntry.is_deleted == False
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    now = datetime.utcnow()

    # If this was a purchase entry, soft delete all linked stock transactions and restore pricing
    if entry.entry_type == 'PURCHASE' and entry.stock_transaction_ids:
        for str_id in entry.stock_transaction_ids:
            try:
                st_id = UUID(str_id)
                st = db.query(StockTransaction).filter(StockTransaction.id == st_id).first()
                if st:
                    st.is_deleted = True
                    st.deleted_at = now

                    # Recalculate product purchase price from latest remaining active refill log
                    latest_refill = db.query(StockTransaction).filter(
                        StockTransaction.product_id == st.product_id,
                        StockTransaction.type == 'IN',
                        StockTransaction.is_deleted == False,
                        StockTransaction.id != st.id
                    ).order_by(StockTransaction.created_at.desc()).first()

                    prod = db.query(Product).filter(Product.id == st.product_id).first()
                    if prod:
                        if latest_refill and latest_refill.purchase_price:
                            prod.purchase_price = latest_refill.purchase_price
                            prod.mrp = latest_refill.mrp
                            prod.company_discount = latest_refill.company_discount or Decimal('0.00')
                        else:
                            prod.purchase_price = Decimal('0.00')
            except Exception as e:
                print(f"Error reverting stock transaction {str_id}: {e}")

    entry.is_deleted = True
    entry.deleted_at = now
    db.commit()
    return {"message": "Company Khata entry deleted successfully"}
