from sqlalchemy.orm import Session
from sqlalchemy import func, case
from app.models.models import MoneyAccount, MoneyTransaction
from app.schemas.money import (
    MoneyAccountCreate, MoneyAccountUpdate,
    MoneyTransactionCreate, MoneyTransactionUpdate,
    MoneyAccountOut, MoneyTransactionOut, MoneyAccountLedgerOut
)
from uuid import UUID
import uuid
from decimal import Decimal
from fastapi import HTTPException, status
from datetime import datetime


def _compute_balance(account: MoneyAccount, db: Session) -> float:
    """Compute current balance: opening + deposits + company_payments_incoming - withdrawals - company_payments_outgoing"""
    opening = float(account.opening_balance or 0)
    
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
    
    return round(opening + float(agg.total_in or 0) - float(agg.total_out or 0), 2)


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

    running = float(account.opening_balance or 0)
    total_deposits = 0.0
    total_withdrawals = 0.0
    out_txns = []

    for t in txns:
        amt = float(t.amount)
        if t.type in ('DEPOSIT', 'OPENING'):
            running += amt
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

    txn.is_deleted = True
    txn.deleted_at = datetime.utcnow()
    db.commit()
    return {"message": "Transaction deleted"}
