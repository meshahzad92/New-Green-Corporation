from sqlalchemy.orm import Session
from sqlalchemy import func, case
from app.models.models import MoneyAccount, MoneyTransaction, CompanyKhataAccount, CompanyKhataEntry
from app.schemas.money import (
    MoneyAccountCreate, MoneyAccountUpdate,
    MoneyTransactionCreate, MoneyTransactionUpdate, MoneyTransferCreate,
    MoneyAccountOut, MoneyTransactionOut, MoneyAccountLedgerOut
)
from uuid import UUID
import uuid
from decimal import Decimal
from fastapi import HTTPException, status
from datetime import datetime


def _compute_balance(account: MoneyAccount, db: Session) -> float:
    """Compute current balance: sums all active transactions. Avoids double-counting opening balance if OPENING transaction row exists."""
    has_opening_tx = db.query(MoneyTransaction.id).filter(
        MoneyTransaction.account_id == account.id,
        MoneyTransaction.type == 'OPENING',
        MoneyTransaction.is_deleted == False
    ).first() is not None

    base_opening = 0.0 if has_opening_tx else float(account.opening_balance or 0)

    agg = db.query(
        func.coalesce(func.sum(
            case(
                (MoneyTransaction.type.in_(['DEPOSIT', 'OPENING']), MoneyTransaction.amount),
                else_=0
            )
        ), 0).label('total_in'),
        func.coalesce(func.sum(
            case(
                (MoneyTransaction.type.in_(['WITHDRAWAL', 'COMPANY_PAYMENT']), MoneyTransaction.amount),
                else_=0
            )
        ), 0).label('total_out')
    ).filter(
        MoneyTransaction.account_id == account.id,
        MoneyTransaction.is_deleted == False
    ).one()

    return round(base_opening + float(agg.total_in or 0) - float(agg.total_out or 0), 2)



def _to_account_out(account: MoneyAccount, db: Session) -> MoneyAccountOut:
    return MoneyAccountOut(
        id=account.id,
        title=account.title,
        bank_name=account.bank_name,
        account_type=account.account_type,
        account_number=account.account_number,
        opening_balance=float(account.opening_balance or 0),
        current_balance=_compute_balance(account, db),
        created_at=account.created_at,
        is_deleted=account.is_deleted
    )


# ============================================================
# Money Accounts CRUD
# ============================================================

def get_money_accounts(db: Session):
    """List all active money accounts with computed balances"""
    accounts = db.query(MoneyAccount).filter(
        MoneyAccount.is_deleted == False
    ).order_by(MoneyAccount.created_at.asc()).all()
    return [_to_account_out(a, db) for a in accounts]


def get_money_account(db: Session, account_id: UUID) -> MoneyAccount:
    account = db.query(MoneyAccount).filter(
        MoneyAccount.id == account_id,
        MoneyAccount.is_deleted == False
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Money account not found")
    return account


def create_money_account(db: Session, data: MoneyAccountCreate) -> MoneyAccountOut:
    """Create a new bank/cash account. If opening_balance > 0, creates an OPENING transaction."""
    title_clean = data.title.strip()
    if not title_clean:
        raise HTTPException(status_code=400, detail="Account title is required")

    now = datetime.utcnow()
    account = MoneyAccount(
        id=uuid.uuid4(),
        title=title_clean,
        bank_name=data.bank_name.strip() if data.bank_name else None,
        account_type=data.account_type or 'BANK',
        account_number=data.account_number.strip() if data.account_number else None,
        opening_balance=Decimal(str(data.opening_balance or 0)),
        created_at=now
    )
    db.add(account)
    db.flush()  # get account.id

    # Create OPENING transaction if opening balance > 0
    if data.opening_balance and data.opening_balance > 0:
        opening_tx = MoneyTransaction(
            id=uuid.uuid4(),
            account_id=account.id,
            transaction_date=now,
            type='OPENING',
            amount=Decimal(str(data.opening_balance)),
            description='Opening Balance',
            created_at=now
        )
        db.add(opening_tx)

    db.commit()
    db.refresh(account)
    return _to_account_out(account, db)


def update_money_account(db: Session, account_id: UUID, data: MoneyAccountUpdate) -> MoneyAccountOut:
    account = get_money_account(db, account_id)

    if data.title is not None:
        clean = data.title.strip()
        if not clean:
            raise HTTPException(status_code=400, detail="Title cannot be empty")
        account.title = clean
    if data.bank_name is not None:
        account.bank_name = data.bank_name.strip() if data.bank_name else None
    if data.account_type is not None:
        account.account_type = data.account_type
    if data.account_number is not None:
        account.account_number = data.account_number.strip() if data.account_number else None

    db.commit()
    db.refresh(account)
    return _to_account_out(account, db)


def delete_money_account(db: Session, account_id: UUID):
    account = get_money_account(db, account_id)

    tx_count = db.query(func.count(MoneyTransaction.id)).filter(
        MoneyTransaction.account_id == account_id,
        MoneyTransaction.is_deleted == False,
        MoneyTransaction.type != 'OPENING'
    ).scalar() or 0

    if tx_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete account '{account.title}' — it has {tx_count} transaction(s). Delete all entries first."
        )

    account.is_deleted = True
    account.deleted_at = datetime.utcnow()
    db.commit()
    return {"message": f"Account '{account.title}' deleted successfully"}


# ============================================================
# Money Account Ledger
# ============================================================

def get_money_account_ledger(db: Session, account_id: UUID) -> MoneyAccountLedgerOut:
    """Get full chronological ledger for an account with running balances"""
    account = get_money_account(db, account_id)

    txns = db.query(MoneyTransaction).filter(
        MoneyTransaction.account_id == account_id,
        MoneyTransaction.is_deleted == False
    ).order_by(MoneyTransaction.transaction_date.asc(), MoneyTransaction.created_at.asc()).all()

    has_opening_tx = any(t.type == 'OPENING' for t in txns)
    running = 0.0 if has_opening_tx else float(account.opening_balance or 0)
    total_deposits = 0.0
    total_withdrawals = 0.0
    out_txns = []

    for t in txns:
        amt = float(t.amount)
        if t.type in ('DEPOSIT', 'OPENING'):
            running += amt
            if t.type == 'DEPOSIT':
                total_deposits += amt
        else:  # WITHDRAWAL, COMPANY_PAYMENT
            running -= amt
            total_withdrawals += amt

        out_txns.append(MoneyTransactionOut(
            id=t.id,
            account_id=t.account_id,
            transaction_date=t.transaction_date,
            type=t.type,
            amount=amt,
            payment_method=t.payment_method,
            description=t.description,
            tid=t.tid,
            company_khata_entry_id=t.company_khata_entry_id,
            running_balance=round(running, 2),
            created_at=t.created_at,
            is_deleted=t.is_deleted
        ))

    account_out = _to_account_out(account, db)

    return MoneyAccountLedgerOut(
        account=account_out,
        transactions=out_txns,
        total_deposits=round(total_deposits, 2),
        total_withdrawals=round(total_withdrawals, 2),
        current_balance=account_out.current_balance
    )


# ============================================================
# Money Transactions CRUD
# ============================================================

def create_money_transaction(db: Session, data: MoneyTransactionCreate) -> MoneyTransactionOut:
    """Create a DEPOSIT or WITHDRAWAL transaction"""
    account = get_money_account(db, data.account_id)

    tx_type = data.type.upper()
    if tx_type not in ('DEPOSIT', 'WITHDRAWAL'):
        raise HTTPException(status_code=400, detail="Transaction type must be DEPOSIT or WITHDRAWAL")

    now = datetime.utcnow()
    txn = MoneyTransaction(
        id=uuid.uuid4(),
        account_id=account.id,
        transaction_date=data.transaction_date or now,
        type=tx_type,
        amount=Decimal(str(data.amount)),
        payment_method=data.payment_method or 'ONLINE',
        description=data.description.strip() if data.description else None,
        tid=data.tid.strip() if data.tid else None,
        created_at=now
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)

    return MoneyTransactionOut(
        id=txn.id,
        account_id=txn.account_id,
        transaction_date=txn.transaction_date,
        type=txn.type,
        amount=float(txn.amount),
        payment_method=txn.payment_method,
        description=txn.description,
        tid=txn.tid,
        company_khata_entry_id=txn.company_khata_entry_id,
        running_balance=None,
        created_at=txn.created_at,
        is_deleted=txn.is_deleted
    )


def create_money_transfer(db: Session, data: MoneyTransferCreate) -> MoneyTransactionOut:
    """Transfer money to a Company (syncs with Company Khata) or a Person"""
    account = get_money_account(db, data.account_id)
    now = datetime.utcnow()
    tx_date = data.transaction_date or now
    amt_dec = Decimal(str(data.amount))
    method = data.payment_method or 'ONLINE'
    tid_clean = data.tid.strip() if data.tid else None
    desc_clean = data.description.strip() if data.description else None

    if data.transfer_to_type.upper() == 'COMPANY':
        if not data.company_khata_account_id:
            raise HTTPException(status_code=400, detail="Please select a company to transfer to")
        co_account = db.query(CompanyKhataAccount).filter(
            CompanyKhataAccount.id == data.company_khata_account_id,
            CompanyKhataAccount.is_deleted == False
        ).first()
        if not co_account:
            raise HTTPException(status_code=404, detail="Company Khata Account not found")

        # 1. Create CompanyKhataEntry (PAYMENT)
        co_entry = CompanyKhataEntry(
            id=uuid.uuid4(),
            account_id=co_account.id,
            company_id=co_account.catalog_company_id,
            entry_date=tx_date,
            entry_type='PAYMENT',
            amount_paid=amt_dec,
            payment_method=method,
            transaction_id=tid_clean,
            remarks=f"Payment received via Money Account ({account.title})" + (f" - {desc_clean}" if desc_clean else ""),
            created_at=now
        )
        db.add(co_entry)
        db.flush()

        # 2. Create MoneyTransaction (COMPANY_PAYMENT)
        full_desc = f"Transfer to Company: {co_account.name}" + (f" - {desc_clean}" if desc_clean else "")
        txn = MoneyTransaction(
            id=uuid.uuid4(),
            account_id=account.id,
            transaction_date=tx_date,
            type='COMPANY_PAYMENT',
            amount=amt_dec,
            payment_method=method,
            description=full_desc,
            tid=tid_clean,
            company_khata_entry_id=co_entry.id,
            created_at=now
        )
        db.add(txn)
        db.commit()
        db.refresh(txn)

    else:  # PERSON
        person_name = (data.person_name or "").strip()
        if not person_name:
            raise HTTPException(status_code=400, detail="Person name is required for transfer")
        person_acc = (data.person_account or "").strip()
        person_info = f"{person_name} ({person_acc})" if person_acc else person_name
        full_desc = f"Transfer to Person: {person_info}" + (f" - {desc_clean}" if desc_clean else "")

        txn = MoneyTransaction(
            id=uuid.uuid4(),
            account_id=account.id,
            transaction_date=tx_date,
            type='WITHDRAWAL',
            amount=amt_dec,
            payment_method=method,
            description=full_desc,
            tid=tid_clean,
            created_at=now
        )
        db.add(txn)
        db.commit()
        db.refresh(txn)

    return MoneyTransactionOut(
        id=txn.id,
        account_id=txn.account_id,
        transaction_date=txn.transaction_date,
        type=txn.type,
        amount=float(txn.amount),
        payment_method=txn.payment_method,
        description=txn.description,
        tid=txn.tid,
        company_khata_entry_id=txn.company_khata_entry_id,
        running_balance=None,
        created_at=txn.created_at,
        is_deleted=txn.is_deleted
    )


def update_money_transaction(db: Session, transaction_id: UUID, data: MoneyTransactionUpdate) -> MoneyTransactionOut:
    txn = db.query(MoneyTransaction).filter(
        MoneyTransaction.id == transaction_id,
        MoneyTransaction.is_deleted == False
    ).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if data.transaction_date is not None:
        txn.transaction_date = data.transaction_date
    if data.amount is not None:
        if data.amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be greater than 0")
        txn.amount = Decimal(str(data.amount))
    if data.payment_method is not None:
        txn.payment_method = data.payment_method
    if data.description is not None:
        txn.description = data.description.strip() if data.description else None
    if data.tid is not None:
        txn.tid = data.tid.strip() if data.tid else None

    # Sync changes with linked CompanyKhataEntry if present
    if txn.company_khata_entry_id:
        co_entry = db.query(CompanyKhataEntry).filter(
            CompanyKhataEntry.id == txn.company_khata_entry_id
        ).first()
        if co_entry:
            if data.amount is not None:
                co_entry.amount_paid = Decimal(str(data.amount))
            if data.tid is not None:
                co_entry.transaction_id = data.tid.strip() if data.tid else None
            if data.transaction_date is not None:
                co_entry.entry_date = data.transaction_date

    # Sync opening balance on MoneyAccount if editing an OPENING transaction
    if txn.type == 'OPENING' and data.amount is not None:
        account = db.query(MoneyAccount).filter(MoneyAccount.id == txn.account_id).first()
        if account:
            account.opening_balance = Decimal(str(data.amount))

    db.commit()
    db.refresh(txn)

    return MoneyTransactionOut(
        id=txn.id,
        account_id=txn.account_id,
        transaction_date=txn.transaction_date,
        type=txn.type,
        amount=float(txn.amount),
        payment_method=txn.payment_method,
        description=txn.description,
        tid=txn.tid,
        company_khata_entry_id=txn.company_khata_entry_id,
        running_balance=None,
        created_at=txn.created_at,
        is_deleted=txn.is_deleted
    )


def delete_money_transaction(db: Session, transaction_id: UUID):
    txn = db.query(MoneyTransaction).filter(
        MoneyTransaction.id == transaction_id,
        MoneyTransaction.is_deleted == False
    ).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    now = datetime.utcnow()
    txn.is_deleted = True
    txn.deleted_at = now

    # Also soft delete linked CompanyKhataEntry if present
    if txn.company_khata_entry_id:
        co_entry = db.query(CompanyKhataEntry).filter(
            CompanyKhataEntry.id == txn.company_khata_entry_id
        ).first()
        if co_entry:
            co_entry.is_deleted = True
            co_entry.deleted_at = now

    # Reset opening balance to 0.0 if deleting OPENING transaction
    if txn.type == 'OPENING':
        account = db.query(MoneyAccount).filter(MoneyAccount.id == txn.account_id).first()
        if account:
            account.opening_balance = Decimal('0.00')

    db.commit()
    return {"message": "Transaction deleted successfully"}
