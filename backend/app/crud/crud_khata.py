import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException

from app.models.models import KhataAccount, KhataEntry, Sale, StockTransaction, Product
from app.schemas.khata import (
    KhataAccountCreate,
    KhataAccountUpdate,
    KhataAccountResponse,
    KhataEntryCreate,
    KhataEntryUpdate,
    KhataEntryResponse,
    KhataCreditSaleCreate,
    KhataRecoveryCreate,
    KhataManualCreditCreate
)
from app.crud.crud_transaction import get_product_stock

def get_dealers(db: Session) -> List[dict]:
    stats_subq = db.query(
        KhataEntry.account_id.label("account_id"),
        func.coalesce(func.sum(KhataEntry.credit_amount), 0).label("total_credit"),
        func.coalesce(func.sum(KhataEntry.recovery_amount), 0).label("total_recovery"),
        func.count(KhataEntry.id).label("entry_count")
    ).filter(
        KhataEntry.is_deleted == False
    ).group_by(KhataEntry.account_id).subquery()

    rows = db.query(
        KhataAccount,
        func.coalesce(stats_subq.c.total_credit, 0).label("total_credit"),
        func.coalesce(stats_subq.c.total_recovery, 0).label("total_recovery"),
        func.coalesce(stats_subq.c.entry_count, 0).label("entry_count")
    ).outerjoin(
        stats_subq, stats_subq.c.account_id == KhataAccount.id
    ).filter(
        KhataAccount.is_deleted == False
    ).order_by(KhataAccount.name.asc()).all()

    result = []
    for d, total_credit_raw, total_recovery_raw, entry_count in rows:
        total_credit = Decimal(str(total_credit_raw or 0))
        total_recovery = Decimal(str(total_recovery_raw or 0))
        total_left = total_credit - total_recovery

        result.append({
            'id': d.id,
            'name': d.name,
            'phone': d.phone,
            'address': d.address,
            'role': d.role,
            'total_credit': total_credit,
            'total_recovery': total_recovery,
            'total_left': total_left,
            'entry_count': entry_count or 0,
            'created_at': d.created_at
        })
    return result

def get_dealer(db: Session, dealer_id: uuid.UUID) -> Optional[dict]:
    d = db.query(KhataAccount).filter(KhataAccount.id == dealer_id, KhataAccount.is_deleted == False).first()
    if not d:
        return None

    stats = db.query(
        func.coalesce(func.sum(KhataEntry.credit_amount), 0).label('total_credit'),
        func.coalesce(func.sum(KhataEntry.recovery_amount), 0).label('total_recovery'),
        func.count(KhataEntry.id).label('entry_count')
    ).filter(
        KhataEntry.account_id == d.id,
        KhataEntry.is_deleted == False
    ).first()

    total_credit = Decimal(str(stats.total_credit or 0))
    total_recovery = Decimal(str(stats.total_recovery or 0))
    total_left = total_credit - total_recovery

    return {
        'id': d.id,
        'name': d.name,
        'phone': d.phone,
        'address': d.address,
        'role': d.role,
        'total_credit': total_credit,
        'total_recovery': total_recovery,
        'total_left': total_left,
        'entry_count': stats.entry_count or 0,
        'created_at': d.created_at
    }

def create_dealer(db: Session, dealer_in: KhataAccountCreate) -> KhataAccount:
    trimmed_name = dealer_in.name.strip()
    existing = db.query(KhataAccount).filter(
        func.lower(func.trim(KhataAccount.name)) == trimmed_name.lower(),
        KhataAccount.is_deleted == False
    ).first()
    if existing:
        return existing

    db_dealer = KhataAccount(
        name=trimmed_name,
        phone=dealer_in.phone.strip() if dealer_in.phone else None,
        address=dealer_in.address.strip() if dealer_in.address else None,
        role=dealer_in.role or 'Dealer'
    )
    db.add(db_dealer)
    db.commit()
    db.refresh(db_dealer)
    return db_dealer

def update_dealer(db: Session, dealer_id: uuid.UUID, dealer_in: KhataAccountUpdate) -> Optional[KhataAccount]:
    db_dealer = db.query(KhataAccount).filter(KhataAccount.id == dealer_id, KhataAccount.is_deleted == False).first()
    if not db_dealer:
        return None

    if dealer_in.name is not None:
        db_dealer.name = dealer_in.name.strip()
    if dealer_in.phone is not None:
        db_dealer.phone = dealer_in.phone.strip() if dealer_in.phone else None
    if dealer_in.address is not None:
        db_dealer.address = dealer_in.address.strip() if dealer_in.address else None
    if dealer_in.role is not None:
        db_dealer.role = dealer_in.role.strip()

    db.commit()
    db.refresh(db_dealer)
    return db_dealer

def delete_dealer(db: Session, dealer_id: uuid.UUID) -> bool:
    db_dealer = db.query(KhataAccount).filter(KhataAccount.id == dealer_id, KhataAccount.is_deleted == False).first()
    if not db_dealer:
        return False

    db_dealer.is_deleted = True
    db_dealer.deleted_at = datetime.utcnow()
    db.commit()
    return True

def get_dealer_ledger(db: Session, dealer_id: uuid.UUID) -> List[dict]:
    dealer = db.query(KhataAccount).filter(KhataAccount.id == dealer_id, KhataAccount.is_deleted == False).first()
    if not dealer:
        raise HTTPException(status_code=404, detail='Dealer not found')

    entries = db.query(KhataEntry).filter(
        KhataEntry.account_id == dealer_id,
        KhataEntry.is_deleted == False
    ).order_by(KhataEntry.entry_date.asc(), KhataEntry.created_at.asc()).all()

    running = Decimal('0.00')
    ledger = []
    for e in entries:
        c_amt = Decimal(str(e.credit_amount or 0))
        r_amt = Decimal(str(e.recovery_amount or 0))
        running = running + c_amt - r_amt

        ledger.append({
            'id': e.id,
            'account_id': e.account_id,
            'entry_date': e.entry_date,
            'entry_type': e.entry_type,
            'farmer_name': e.farmer_name,
            'credit_amount': c_amt,
            'recovery_amount': r_amt,
            'products_detail': e.products_detail,
            'invoice_id': e.invoice_id,
            'sale_id': e.sale_id,
            'remarks': e.remarks,
            'payment_method': e.payment_method or 'CASH',
            'bank_name': e.bank_name,
            'running_balance': running,
            'created_at': e.created_at
        })

    ledger.sort(key=lambda x: x['entry_date'], reverse=True)
    return ledger

def create_credit_sale(db: Session, credit_sale_in: KhataCreditSaleCreate) -> KhataEntry:
    dealer = db.query(KhataAccount).filter(KhataAccount.id == credit_sale_in.dealer_id, KhataAccount.is_deleted == False).first()
    if not dealer:
        raise HTTPException(status_code=404, detail='Dealer not found')

    if not credit_sale_in.items:
        raise HTTPException(status_code=400, detail='At least one product item is required')

    products_map = {}
    for item in credit_sale_in.items:
        db_prod = db.query(Product).filter(Product.id == item.product_id).first()
        if not db_prod:
            raise HTTPException(status_code=404, detail=f'Product not found: {item.name}')

        available = get_product_stock(db, item.product_id)
        if available < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for '{db_prod.name}'. Available: {available}, Requested: {item.quantity}"
            )
        products_map[item.product_id] = db_prod

    invoice_id = str(uuid.uuid4())
    inv_short = uuid.uuid4().hex[:4].upper()
    sale_dt = credit_sale_in.entry_date or datetime.utcnow()
    invoice_no = f"INV-{sale_dt.strftime('%y%m%d')}-{inv_short}"

    total_credit = sum(item.total for item in credit_sale_in.items)
    farmer_clean = credit_sale_in.farmer_name.strip() if credit_sale_in.farmer_name and credit_sale_in.farmer_name.strip() else None
    cust_display = f"{dealer.name} (Farmer: {farmer_clean})" if farmer_clean else dealer.name
    party_display = f"Credit: {dealer.name} -> {farmer_clean}" if farmer_clean else f"Credit: {dealer.name}"

    for item in credit_sale_in.items:
        db_prod = products_map[item.product_id]

        db_sale = Sale(
            product_id=item.product_id,
            customer_name=cust_display,
            customer_phone=dealer.phone,
            dealer_id=dealer.id,
            dealer_name=dealer.name,
            farmer_name=farmer_clean,
            quantity=item.quantity,
            selling_price=item.price,
            purchase_price=db_prod.purchase_price or Decimal('0.00'),
            total_amount=item.total,
            paid_amount=Decimal('0.00'),
            invoice_id=invoice_id,
            invoice_no=invoice_no,
            payment_type='Credit',
            created_at=sale_dt
        )
        db.add(db_sale)
        db.flush()

        stock_tx = StockTransaction(
            product_id=item.product_id,
            quantity=item.quantity,
            party_name=party_display,
            purchase_price=db_prod.purchase_price,
            mrp=db_prod.mrp,
            company_discount=db_prod.company_discount,
            type='OUT',
            sale_id=db_sale.id,
            created_at=sale_dt
        )
        db.add(stock_tx)

    items_data = [
        {
            'product_id': str(it.product_id),
            'name': it.name,
            'quantity': it.quantity,
            'price': float(it.price),
            'total': float(it.total)
        }
        for it in credit_sale_in.items
    ]

    khata_entry = KhataEntry(
        account_id=dealer.id,
        entry_date=sale_dt,
        entry_type='CREDIT',
        farmer_name=farmer_clean,
        credit_amount=total_credit,
        recovery_amount=Decimal('0.00'),
        products_detail=items_data,
        invoice_id=invoice_id,
        remarks=credit_sale_in.remarks
    )
    db.add(khata_entry)
    db.commit()
    db.refresh(khata_entry)
    return khata_entry

def create_recovery(db: Session, recovery_in: KhataRecoveryCreate) -> KhataEntry:
    dealer = db.query(KhataAccount).filter(KhataAccount.id == recovery_in.dealer_id, KhataAccount.is_deleted == False).first()
    if not dealer:
        raise HTTPException(status_code=404, detail='Dealer not found')

    cutoff = datetime.utcnow() - timedelta(seconds=15)
    recent = db.query(KhataEntry).filter(
        KhataEntry.account_id == dealer.id,
        KhataEntry.entry_type == 'RECOVERY',
        KhataEntry.recovery_amount == recovery_in.amount,
        KhataEntry.is_deleted == False,
        KhataEntry.created_at >= cutoff
    ).first()
    if recent:
        return recent

    rec_dt = recovery_in.entry_date or datetime.utcnow()
    khata_entry = KhataEntry(
        account_id=dealer.id,
        entry_date=rec_dt,
        entry_type='RECOVERY',
        farmer_name=None,
        credit_amount=Decimal('0.00'),
        recovery_amount=recovery_in.amount,
        payment_method=recovery_in.payment_method or 'CASH',
        bank_name=recovery_in.bank_name.strip() if recovery_in.bank_name else None,
        products_detail=None,
        remarks=recovery_in.remarks
    )
    db.add(khata_entry)
    db.commit()
    db.refresh(khata_entry)
    return khata_entry

def create_manual_credit(db: Session, credit_in: KhataManualCreditCreate) -> KhataEntry:
    """Record a manual credit (previous dues from register) — no stock deduction, no sale."""
    dealer = db.query(KhataAccount).filter(KhataAccount.id == credit_in.dealer_id, KhataAccount.is_deleted == False).first()
    if not dealer:
        raise HTTPException(status_code=404, detail='Dealer not found')

    # 15-second dedup guard
    cutoff = datetime.utcnow() - timedelta(seconds=15)
    recent = db.query(KhataEntry).filter(
        KhataEntry.account_id == dealer.id,
        KhataEntry.entry_type == 'CREDIT',
        KhataEntry.credit_amount == credit_in.amount,
        KhataEntry.invoice_id == None,
        KhataEntry.sale_id == None,
        KhataEntry.is_deleted == False,
        KhataEntry.created_at >= cutoff
    ).first()
    if recent:
        return recent

    entry_dt = credit_in.entry_date or datetime.utcnow()
    person_clean = credit_in.person_name.strip() if credit_in.person_name and credit_in.person_name.strip() else None

    khata_entry = KhataEntry(
        account_id=dealer.id,
        entry_date=entry_dt,
        entry_type='CREDIT',
        farmer_name=person_clean,
        credit_amount=credit_in.amount,
        recovery_amount=Decimal('0.00'),
        products_detail=None,
        invoice_id=None,
        sale_id=None,
        remarks=credit_in.remarks
    )
    db.add(khata_entry)
    db.commit()
    db.refresh(khata_entry)
    return khata_entry

def update_entry(db: Session, entry_id: uuid.UUID, entry_in: KhataEntryUpdate) -> Optional[KhataEntry]:
    entry = db.query(KhataEntry).filter(KhataEntry.id == entry_id, KhataEntry.is_deleted == False).first()
    if not entry:
        return None

    if entry_in.entry_date is not None:
        entry.entry_date = entry_in.entry_date
    if entry_in.farmer_name is not None:
        entry.farmer_name = entry_in.farmer_name
    if entry_in.credit_amount is not None:
        entry.credit_amount = entry_in.credit_amount
    if entry_in.recovery_amount is not None:
        entry.recovery_amount = entry_in.recovery_amount
    if entry_in.payment_method is not None:
        entry.payment_method = entry_in.payment_method
    if entry_in.bank_name is not None:
        entry.bank_name = entry_in.bank_name.strip() if entry_in.bank_name else None
    if entry_in.remarks is not None:
        entry.remarks = entry_in.remarks
    if entry_in.products_detail is not None:
        entry.products_detail = entry_in.products_detail

    db.commit()
    db.refresh(entry)
    return entry

def delete_entry(db: Session, entry_id: uuid.UUID) -> bool:
    entry = db.query(KhataEntry).filter(KhataEntry.id == entry_id).first()
    if not entry:
        return False

    now = datetime.utcnow()
    entry.is_deleted = True
    entry.deleted_at = now

    sales_to_delete = []
    if entry.invoice_id:
        inv_sales = db.query(Sale).filter(Sale.invoice_id == entry.invoice_id, Sale.is_deleted == False).all()
        sales_to_delete.extend(inv_sales)

    if entry.sale_id:
        sale_by_id = db.query(Sale).filter(Sale.id == entry.sale_id, Sale.is_deleted == False).first()
        if sale_by_id and sale_by_id not in sales_to_delete:
            sales_to_delete.append(sale_by_id)

    for s in sales_to_delete:
        s.is_deleted = True
        s.deleted_at = now
        db.query(StockTransaction).filter(
            StockTransaction.sale_id == s.id,
            StockTransaction.is_deleted == False
        ).update({"is_deleted": True, "deleted_at": now}, synchronize_session=False)

    db.commit()
    return True

