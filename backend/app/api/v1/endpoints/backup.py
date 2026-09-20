from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from typing import Dict, Any, List, Optional
import uuid

from app.db.session import get_db
from app.api import deps
from app.models.models import User, Company, Product, Sale, StockTransaction, Expense, Note, KhataAccount, KhataEntry, CompanyKhataAccount, CompanyKhataEntry

router = APIRouter()

def to_iso(dt):
    if dt is None:
        return None
    if isinstance(dt, datetime):
        return dt.isoformat()
    return str(dt)

def to_float(dec):
    if dec is None:
        return None
    try:
        return float(dec)
    except Exception:
        return None

def parse_uuid(val):
    if not val:
        return None
    if isinstance(val, UUID):
        return val
    try:
        return UUID(str(val))
    except Exception:
        return None

def parse_dt(val):
    if not val:
        return None
    if isinstance(val, datetime):
        return val
    try:
        # Handle ISO strings like 2026-09-14T09:30:00 or with Z
        cleaned = str(val).replace("Z", "+00:00")
        return datetime.fromisoformat(cleaned)
    except Exception:
        return None

@router.get("/export")
def export_database_backup(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Dict[str, Any]:
    """
    Exports full database records in exact schema and column structure.
    Useful for local backups, cold storage, and database re-imports.
    """
    # 1. Companies
    companies_db = db.query(Company).all()
    companies_data = []
    for c in companies_db:
        companies_data.append({
            "id": str(c.id),
            "name": c.name,
            "logo": c.logo,
            "created_at": to_iso(c.created_at)
        })

    # 2. Products
    products_db = db.query(Product).all()
    products_data = []
    for p in products_db:
        products_data.append({
            "id": str(p.id),
            "company_id": str(p.company_id) if p.company_id else None,
            "name": p.name,
            "category": p.category,
            "unit": p.unit,
            "purchase_price": to_float(p.purchase_price),
            "mrp": to_float(p.mrp),
            "company_discount": to_float(p.company_discount),
            "min_stock": p.min_stock
        })

    # 3. Sales
    sales_db = db.query(Sale).all()
    sales_data = []
    for s in sales_db:
        sales_data.append({
            "id": str(s.id),
            "product_id": str(s.product_id) if s.product_id else None,
            "customer_name": s.customer_name,
            "customer_phone": s.customer_phone,
            "quantity": s.quantity,
            "selling_price": to_float(s.selling_price),
            "purchase_price": to_float(s.purchase_price),
            "total_amount": to_float(s.total_amount),
            "paid_amount": to_float(s.paid_amount),
            "invoice_id": s.invoice_id,
            "invoice_no": s.invoice_no,
            "payment_type": s.payment_type,
            "created_at": to_iso(s.created_at),
            "is_deleted": bool(s.is_deleted),
            "deleted_at": to_iso(s.deleted_at)
        })

    # 4. Stock Transactions
    transactions_db = db.query(StockTransaction).all()
    transactions_data = []
    for t in transactions_db:
        transactions_data.append({
            "id": str(t.id),
            "product_id": str(t.product_id) if t.product_id else None,
            "quantity": t.quantity,
            "party_name": t.party_name,
            "purchase_price": to_float(t.purchase_price),
            "mrp": to_float(t.mrp),
            "company_discount": to_float(t.company_discount),
            "type": t.type,
            "created_at": to_iso(t.created_at),
            "sale_id": str(t.sale_id) if t.sale_id else None,
            "is_deleted": bool(t.is_deleted),
            "deleted_at": to_iso(t.deleted_at)
        })

    # 5. Expenses
    expenses_db = db.query(Expense).all()
    expenses_data = []
    for e in expenses_db:
        expenses_data.append({
            "id": str(e.id),
            "name": e.name,
            "amount": to_float(e.amount),
            "quantity": e.quantity,
            "details": e.details,
            "expense_date": to_iso(e.expense_date),
            "created_at": to_iso(e.created_at),
            "is_deleted": bool(e.is_deleted),
            "deleted_at": to_iso(e.deleted_at)
        })

    # 6. Notes
    notes_db = db.query(Note).all()
    notes_data = []
    for n in notes_db:
        notes_data.append({
            "id": str(n.id),
            "title": n.title,
            "description": n.description,
            "status": n.status,
            "is_important": bool(n.is_important),
            "priority": n.priority,
            "target_date": to_iso(n.target_date),
            "created_at": to_iso(n.created_at),
            "updated_at": to_iso(n.updated_at),
            "is_deleted": bool(n.is_deleted),
            "deleted_at": to_iso(n.deleted_at)
        })

    # 7. Khata Accounts (Dealers)
    dealers_db = db.query(KhataAccount).all()
    dealers_data = []
    for d in dealers_db:
        dealers_data.append({
            "id": str(d.id),
            "name": d.name,
            "phone": d.phone,
            "address": d.address,
            "role": d.role,
            "created_at": to_iso(d.created_at),
            "is_deleted": bool(d.is_deleted),
            "deleted_at": to_iso(d.deleted_at)
        })

    # 8. Khata Entries
    entries_db = db.query(KhataEntry).all()
    entries_data = []
    for ke in entries_db:
        entries_data.append({
            "id": str(ke.id),
            "account_id": str(ke.account_id),
            "entry_date": to_iso(ke.entry_date),
            "entry_type": ke.entry_type,
            "farmer_name": ke.farmer_name,
            "credit_amount": to_float(ke.credit_amount),
            "recovery_amount": to_float(ke.recovery_amount),
            "products_detail": ke.products_detail,
            "invoice_id": ke.invoice_id,
            "sale_id": str(ke.sale_id) if ke.sale_id else None,
            "remarks": ke.remarks,
            "payment_method": ke.payment_method or "CASH",
            "bank_name": ke.bank_name,
            "created_at": to_iso(ke.created_at),
            "is_deleted": bool(ke.is_deleted),
            "deleted_at": to_iso(ke.deleted_at)
        })

    # 9. Company Khata Accounts
    co_accounts_db = db.query(CompanyKhataAccount).all()
    co_accounts_data = []
    for ca in co_accounts_db:
        co_accounts_data.append({
            "id": str(ca.id),
            "name": ca.name,
            "phone": ca.phone,
            "catalog_company_id": str(ca.catalog_company_id) if ca.catalog_company_id else None,
            "created_at": to_iso(ca.created_at),
            "is_deleted": bool(ca.is_deleted),
            "deleted_at": to_iso(ca.deleted_at)
        })

    # 10. Company Khata Entries
    co_entries_db = db.query(CompanyKhataEntry).all()
    co_entries_data = []
    for cke in co_entries_db:
        co_entries_data.append({
            "id": str(cke.id),
            "account_id": str(cke.account_id) if cke.account_id else None,
            "company_id": str(cke.company_id) if cke.company_id else None,
            "entry_date": to_iso(cke.entry_date),
            "entry_type": cke.entry_type,
            "amount_paid": to_float(cke.amount_paid),
            "payment_method": cke.payment_method or "ONLINE",
            "bank_name": cke.bank_name,
            "transaction_id": cke.transaction_id,
            "total_purchase_amount": to_float(cke.total_purchase_amount),
            "products_detail": cke.products_detail,
            "stock_transaction_ids": cke.stock_transaction_ids,
            "remarks": cke.remarks,
            "created_at": to_iso(cke.created_at),
            "is_deleted": bool(cke.is_deleted),
            "deleted_at": to_iso(cke.deleted_at)
        })

    return {
        "version": "1.0",
        "app": "AgriManage Pro",
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "counts": {
            "companies": len(companies_data),
            "products": len(products_data),
            "sales": len(sales_data),
            "stock_transactions": len(transactions_data),
            "expenses": len(expenses_data),
            "notes": len(notes_data),
            "khata_accounts": len(dealers_data),
            "khata_entries": len(entries_data),
            "company_khata_accounts": len(co_accounts_data),
            "company_khata_entries": len(co_entries_data)
        },
        "database": {
            "companies": companies_data,
            "products": products_data,
            "sales": sales_data,
            "stock_transactions": transactions_data,
            "expenses": expenses_data,
            "notes": notes_data,
            "khata_accounts": dealers_data,
            "khata_entries": entries_data,
            "company_khata_accounts": co_accounts_data,
            "company_khata_entries": co_entries_data
        }
    }

@router.post("/import")
def import_database_backup(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Dict[str, Any]:
    """
    Safely imports database backup JSON with foreign-key preservation and upsert support.
    """
    # Detect if wrapped in database key or at root
    data = payload.get("database", payload)

    companies_raw = data.get("companies", [])
    products_raw = data.get("products", [])
    sales_raw = data.get("sales", [])
    transactions_raw = data.get("stock_transactions", [])
    expenses_raw = data.get("expenses", [])
    notes_raw = data.get("notes", [])
    khata_accounts_raw = data.get("khata_accounts", [])
    khata_entries_raw = data.get("khata_entries", [])
    company_khata_accounts_raw = data.get("company_khata_accounts", [])
    company_khata_entries_raw = data.get("company_khata_entries", [])

    imported_counts = {
        "companies": 0,
        "products": 0,
        "sales": 0,
        "stock_transactions": 0,
        "expenses": 0,
        "notes": 0,
        "khata_accounts": 0,
        "khata_entries": 0,
        "company_khata_accounts": 0,
        "company_khata_entries": 0
    }

    try:
        # 1. Upsert Companies
        for c in companies_raw:
            c_id = parse_uuid(c.get("id")) or uuid.uuid4()
            existing = db.query(Company).filter(Company.id == c_id).first()
            if existing:
                existing.name = c.get("name", existing.name)
                existing.logo = c.get("logo", existing.logo)
            else:
                new_c = Company(
                    id=c_id,
                    name=c.get("name", ""),
                    logo=c.get("logo"),
                    created_at=parse_dt(c.get("created_at")) or datetime.utcnow()
                )
                db.add(new_c)
            imported_counts["companies"] += 1

        db.flush()

        # 2. Upsert Products
        for p in products_raw:
            p_id = parse_uuid(p.get("id")) or uuid.uuid4()
            comp_id = parse_uuid(p.get("company_id"))
            existing = db.query(Product).filter(Product.id == p_id).first()
            if existing:
                existing.company_id = comp_id or existing.company_id
                existing.name = p.get("name", existing.name)
                existing.category = p.get("category", existing.category)
                existing.unit = p.get("unit", existing.unit)
                if p.get("purchase_price") is not None:
                    existing.purchase_price = Decimal(str(p["purchase_price"]))
                if p.get("mrp") is not None:
                    existing.mrp = Decimal(str(p["mrp"]))
                if p.get("company_discount") is not None:
                    existing.company_discount = Decimal(str(p["company_discount"]))
                if p.get("min_stock") is not None:
                    existing.min_stock = int(p["min_stock"])
            else:
                new_p = Product(
                    id=p_id,
                    company_id=comp_id,
                    name=p.get("name", ""),
                    category=p.get("category"),
                    unit=p.get("unit", "Bags"),
                    purchase_price=Decimal(str(p.get("purchase_price", 0) or 0)),
                    mrp=Decimal(str(p["mrp"])) if p.get("mrp") is not None else None,
                    company_discount=Decimal(str(p["company_discount"])) if p.get("company_discount") is not None else 0,
                    min_stock=int(p.get("min_stock", 5) or 5)
                )
                db.add(new_p)
            imported_counts["products"] += 1

        db.flush()

        # 3. Upsert Sales (must precede transactions since transactions can reference sale_id)
        for s in sales_raw:
            s_id = parse_uuid(s.get("id")) or uuid.uuid4()
            prod_id = parse_uuid(s.get("product_id"))
            existing = db.query(Sale).filter(Sale.id == s_id).first()
            if existing:
                existing.product_id = prod_id or existing.product_id
                existing.customer_name = s.get("customer_name", existing.customer_name)
                existing.customer_phone = s.get("customer_phone", existing.customer_phone)
                if s.get("quantity") is not None:
                    existing.quantity = int(s["quantity"])
                if s.get("selling_price") is not None:
                    existing.selling_price = Decimal(str(s["selling_price"]))
                if s.get("purchase_price") is not None:
                    existing.purchase_price = Decimal(str(s["purchase_price"]))
                if s.get("total_amount") is not None:
                    existing.total_amount = Decimal(str(s["total_amount"]))
                if s.get("paid_amount") is not None:
                    existing.paid_amount = Decimal(str(s["paid_amount"]))
                existing.invoice_id = s.get("invoice_id", existing.invoice_id)
                existing.invoice_no = s.get("invoice_no", existing.invoice_no)
                existing.payment_type = s.get("payment_type", existing.payment_type)
                existing.is_deleted = bool(s.get("is_deleted", False))
                existing.deleted_at = parse_dt(s.get("deleted_at"))
            else:
                new_s = Sale(
                    id=s_id,
                    product_id=prod_id,
                    customer_name=s.get("customer_name", ""),
                    customer_phone=s.get("customer_phone"),
                    quantity=int(s.get("quantity", 1) or 1),
                    selling_price=Decimal(str(s.get("selling_price", 0) or 0)),
                    purchase_price=Decimal(str(s.get("purchase_price", 0) or 0)),
                    total_amount=Decimal(str(s.get("total_amount", 0) or 0)),
                    paid_amount=Decimal(str(s["paid_amount"])) if s.get("paid_amount") is not None else None,
                    invoice_id=s.get("invoice_id"),
                    invoice_no=s.get("invoice_no"),
                    payment_type=s.get("payment_type", "Debit"),
                    created_at=parse_dt(s.get("created_at")) or datetime.utcnow(),
                    is_deleted=bool(s.get("is_deleted", False)),
                    deleted_at=parse_dt(s.get("deleted_at"))
                )
                db.add(new_s)
            imported_counts["sales"] += 1

        db.flush()

        # 4. Upsert Stock Transactions
        for t in transactions_raw:
            t_id = parse_uuid(t.get("id")) or uuid.uuid4()
            prod_id = parse_uuid(t.get("product_id"))
            sale_id = parse_uuid(t.get("sale_id"))
            existing = db.query(StockTransaction).filter(StockTransaction.id == t_id).first()
            if existing:
                existing.product_id = prod_id or existing.product_id
                if t.get("quantity") is not None:
                    existing.quantity = int(t["quantity"])
                existing.party_name = t.get("party_name", existing.party_name)
                if t.get("purchase_price") is not None:
                    existing.purchase_price = Decimal(str(t["purchase_price"]))
                if t.get("mrp") is not None:
                    existing.mrp = Decimal(str(t["mrp"]))
                if t.get("company_discount") is not None:
                    existing.company_discount = Decimal(str(t["company_discount"]))
                existing.type = t.get("type", existing.type)
                existing.sale_id = sale_id
                existing.is_deleted = bool(t.get("is_deleted", False))
                existing.deleted_at = parse_dt(t.get("deleted_at"))
            else:
                new_t = StockTransaction(
                    id=t_id,
                    product_id=prod_id,
                    quantity=int(t.get("quantity", 1) or 1),
                    party_name=t.get("party_name"),
                    purchase_price=Decimal(str(t["purchase_price"])) if t.get("purchase_price") is not None else None,
                    mrp=Decimal(str(t["mrp"])) if t.get("mrp") is not None else None,
                    company_discount=Decimal(str(t["company_discount"])) if t.get("company_discount") is not None else None,
                    type=t.get("type", "IN"),
                    created_at=parse_dt(t.get("created_at")) or datetime.utcnow(),
                    sale_id=sale_id,
                    is_deleted=bool(t.get("is_deleted", False)),
                    deleted_at=parse_dt(t.get("deleted_at"))
                )
                db.add(new_t)
            imported_counts["stock_transactions"] += 1

        db.flush()

        # 5. Upsert Expenses
        for e in expenses_raw:
            e_id = parse_uuid(e.get("id")) or uuid.uuid4()
            existing = db.query(Expense).filter(Expense.id == e_id).first()
            if existing:
                existing.name = e.get("name", existing.name)
                if e.get("amount") is not None:
                    existing.amount = Decimal(str(e["amount"]))
                if e.get("quantity") is not None:
                    existing.quantity = int(e["quantity"])
                existing.details = e.get("details", existing.details)
                existing.expense_date = parse_dt(e.get("expense_date")) or existing.expense_date
                existing.is_deleted = bool(e.get("is_deleted", False))
                existing.deleted_at = parse_dt(e.get("deleted_at"))
            else:
                new_e = Expense(
                    id=e_id,
                    name=e.get("name", ""),
                    amount=Decimal(str(e.get("amount", 0) or 0)),
                    quantity=int(e.get("quantity", 1) or 1),
                    details=e.get("details"),
                    expense_date=parse_dt(e.get("expense_date")) or datetime.utcnow(),
                    created_at=parse_dt(e.get("created_at")) or datetime.utcnow(),
                    is_deleted=bool(e.get("is_deleted", False)),
                    deleted_at=parse_dt(e.get("deleted_at"))
                )
                db.add(new_e)
            imported_counts["expenses"] += 1

        # 6. Upsert Notes
        for n in notes_raw:
            n_id = parse_uuid(n.get("id")) or uuid.uuid4()
            existing = db.query(Note).filter(Note.id == n_id).first()
            if existing:
                existing.title = n.get("title", existing.title)
                existing.description = n.get("description", existing.description)
                existing.status = n.get("status", existing.status)
                existing.is_important = bool(n.get("is_important", existing.is_important))
                existing.priority = n.get("priority", existing.priority)
                existing.target_date = parse_dt(n.get("target_date"))
                existing.is_deleted = bool(n.get("is_deleted", False))
                existing.deleted_at = parse_dt(n.get("deleted_at"))
            else:
                new_n = Note(
                    id=n_id,
                    title=n.get("title", "Untitled"),
                    description=n.get("description"),
                    status=n.get("status", "pending"),
                    is_important=bool(n.get("is_important", False)),
                    priority=n.get("priority", "medium"),
                    target_date=parse_dt(n.get("target_date")),
                    created_at=parse_dt(n.get("created_at")) or datetime.utcnow(),
                    updated_at=parse_dt(n.get("updated_at")) or datetime.utcnow(),
                    is_deleted=bool(n.get("is_deleted", False)),
                    deleted_at=parse_dt(n.get("deleted_at"))
                )
                db.add(new_n)
            imported_counts["notes"] += 1

        # 7. Upsert Khata Accounts (Dealers)
        for d in khata_accounts_raw:
            d_id = parse_uuid(d.get("id")) or uuid.uuid4()
            existing = db.query(KhataAccount).filter(KhataAccount.id == d_id).first()
            if existing:
                existing.name = d.get("name", existing.name)
                existing.phone = d.get("phone", existing.phone)
                existing.address = d.get("address", existing.address)
                existing.role = d.get("role", existing.role)
                existing.is_deleted = bool(d.get("is_deleted", False))
                existing.deleted_at = parse_dt(d.get("deleted_at"))
            else:
                new_d = KhataAccount(
                    id=d_id,
                    name=d.get("name", "Unnamed Dealer"),
                    phone=d.get("phone"),
                    address=d.get("address"),
                    role=d.get("role", "Dealer"),
                    created_at=parse_dt(d.get("created_at")) or datetime.utcnow(),
                    is_deleted=bool(d.get("is_deleted", False)),
                    deleted_at=parse_dt(d.get("deleted_at"))
                )
                db.add(new_d)
            imported_counts["khata_accounts"] += 1

        # 8. Upsert Khata Entries
        for ke in khata_entries_raw:
            ke_id = parse_uuid(ke.get("id")) or uuid.uuid4()
            acc_id = parse_uuid(ke.get("account_id"))
            if not acc_id:
                continue

            existing = db.query(KhataEntry).filter(KhataEntry.id == ke_id).first()
            if existing:
                existing.account_id = acc_id
                existing.entry_date = parse_dt(ke.get("entry_date")) or existing.entry_date
                existing.entry_type = ke.get("entry_type", existing.entry_type)
                existing.farmer_name = ke.get("farmer_name", existing.farmer_name)
                if ke.get("credit_amount") is not None:
                    existing.credit_amount = Decimal(str(ke["credit_amount"]))
                if ke.get("recovery_amount") is not None:
                    existing.recovery_amount = Decimal(str(ke["recovery_amount"]))
                existing.products_detail = ke.get("products_detail", existing.products_detail)
                existing.invoice_id = ke.get("invoice_id", existing.invoice_id)
                existing.sale_id = parse_uuid(ke.get("sale_id"))
                existing.remarks = ke.get("remarks", existing.remarks)
                existing.payment_method = ke.get("payment_method", existing.payment_method or "CASH")
                existing.bank_name = ke.get("bank_name", existing.bank_name)
                existing.is_deleted = bool(ke.get("is_deleted", False))
                existing.deleted_at = parse_dt(ke.get("deleted_at"))
            else:
                new_ke = KhataEntry(
                    id=ke_id,
                    account_id=acc_id,
                    entry_date=parse_dt(ke.get("entry_date")) or datetime.utcnow(),
                    entry_type=ke.get("entry_type", "CREDIT"),
                    farmer_name=ke.get("farmer_name"),
                    credit_amount=Decimal(str(ke.get("credit_amount", 0) or 0)),
                    recovery_amount=Decimal(str(ke.get("recovery_amount", 0) or 0)),
                    payment_method=ke.get("payment_method", "CASH"),
                    bank_name=ke.get("bank_name"),
                    products_detail=ke.get("products_detail"),
                    invoice_id=ke.get("invoice_id"),
                    sale_id=parse_uuid(ke.get("sale_id")),
                    remarks=ke.get("remarks"),
                    created_at=parse_dt(ke.get("created_at")) or datetime.utcnow(),
                    is_deleted=bool(ke.get("is_deleted", False)),
                    deleted_at=parse_dt(ke.get("deleted_at"))
                )
                db.add(new_ke)
            imported_counts["khata_entries"] += 1

        # 9. Upsert Company Khata Accounts
        for ca in company_khata_accounts_raw:
            ca_id = parse_uuid(ca.get("id")) or uuid.uuid4()
            cat_comp_id = parse_uuid(ca.get("catalog_company_id"))
            existing = db.query(CompanyKhataAccount).filter(CompanyKhataAccount.id == ca_id).first()
            if existing:
                existing.name = ca.get("name", existing.name)
                existing.phone = ca.get("phone", existing.phone)
                existing.catalog_company_id = cat_comp_id
                existing.is_deleted = bool(ca.get("is_deleted", False))
                existing.deleted_at = parse_dt(ca.get("deleted_at"))
            else:
                new_ca = CompanyKhataAccount(
                    id=ca_id,
                    name=ca.get("name", ""),
                    phone=ca.get("phone"),
                    catalog_company_id=cat_comp_id,
                    created_at=parse_dt(ca.get("created_at")) or datetime.utcnow(),
                    is_deleted=bool(ca.get("is_deleted", False)),
                    deleted_at=parse_dt(ca.get("deleted_at"))
                )
                db.add(new_ca)
            imported_counts["company_khata_accounts"] += 1

        db.flush()

        # 10. Upsert Company Khata Entries
        for cke in company_khata_entries_raw:
            cke_id = parse_uuid(cke.get("id")) or uuid.uuid4()
            acc_id = parse_uuid(cke.get("account_id"))
            comp_id = parse_uuid(cke.get("company_id"))
            if not acc_id and not comp_id:
                continue

            existing = db.query(CompanyKhataEntry).filter(CompanyKhataEntry.id == cke_id).first()
            if existing:
                if acc_id:
                    existing.account_id = acc_id
                if comp_id:
                    existing.company_id = comp_id
                existing.entry_date = parse_dt(cke.get("entry_date")) or existing.entry_date
                existing.entry_type = cke.get("entry_type", existing.entry_type)
                if cke.get("amount_paid") is not None:
                    existing.amount_paid = Decimal(str(cke["amount_paid"]))
                existing.payment_method = cke.get("payment_method", existing.payment_method or "ONLINE")
                existing.bank_name = cke.get("bank_name", existing.bank_name)
                existing.transaction_id = cke.get("transaction_id", existing.transaction_id)
                if cke.get("total_purchase_amount") is not None:
                    existing.total_purchase_amount = Decimal(str(cke["total_purchase_amount"]))
                existing.products_detail = cke.get("products_detail", existing.products_detail)
                existing.stock_transaction_ids = cke.get("stock_transaction_ids", existing.stock_transaction_ids)
                existing.remarks = cke.get("remarks", existing.remarks)
                existing.is_deleted = bool(cke.get("is_deleted", False))
                existing.deleted_at = parse_dt(cke.get("deleted_at"))
            else:
                new_cke = CompanyKhataEntry(
                    id=cke_id,
                    account_id=acc_id or comp_id,
                    company_id=comp_id,
                    entry_date=parse_dt(cke.get("entry_date")) or datetime.utcnow(),
                    entry_type=cke.get("entry_type", "PAYMENT"),
                    amount_paid=Decimal(str(cke.get("amount_paid", 0) or 0)),
                    payment_method=cke.get("payment_method", "ONLINE"),
                    bank_name=cke.get("bank_name"),
                    transaction_id=cke.get("transaction_id"),
                    total_purchase_amount=Decimal(str(cke.get("total_purchase_amount", 0) or 0)),
                    products_detail=cke.get("products_detail"),
                    stock_transaction_ids=cke.get("stock_transaction_ids"),
                    remarks=cke.get("remarks"),
                    created_at=parse_dt(cke.get("created_at")) or datetime.utcnow(),
                    is_deleted=bool(cke.get("is_deleted", False)),
                    deleted_at=parse_dt(cke.get("deleted_at"))
                )
                db.add(new_cke)
            imported_counts["company_khata_entries"] += 1

        db.commit()

        return {
            "success": True,
            "message": "Database backup imported and synchronized successfully",
            "imported_counts": imported_counts
        }

    except Exception as err:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Import failed: {str(err)}"
        )
