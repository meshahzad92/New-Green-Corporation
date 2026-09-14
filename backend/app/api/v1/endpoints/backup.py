from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from typing import Dict, Any, List, Optional
import uuid

from app.db.session import get_db
from app.api import deps
from app.models.models import User, Company, Product, Sale, StockTransaction, Expense, Note

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
            "notes": len(notes_data)
        },
        "database": {
            "companies": companies_data,
            "products": products_data,
            "sales": sales_data,
            "stock_transactions": transactions_data,
            "expenses": expenses_data,
            "notes": notes_data
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

    imported_counts = {
        "companies": 0,
        "products": 0,
        "sales": 0,
        "stock_transactions": 0,
        "expenses": 0,
        "notes": 0
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
