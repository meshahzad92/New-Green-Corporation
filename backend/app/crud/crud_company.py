from typing import Optional
from sqlalchemy.orm import Session
from app.models.models import Company
from app.schemas.company import CompanyCreate, CompanyUpdate
from uuid import UUID

def get_companies(db: Session, skip: int = 0, limit: Optional[int] = None):
    query = db.query(Company).offset(skip)
    if limit is not None and limit > 0:
        query = query.limit(limit)
    return query.all()

def get_company(db: Session, company_id: UUID):
    return db.query(Company).filter(Company.id == company_id).first()

def create_company(db: Session, company: CompanyCreate):
    trimmed_name = company.name.strip()
    # Idempotency / deduplication check
    existing = db.query(Company).filter(Company.name.ilike(trimmed_name)).first()
    if existing:
        return existing

    db_company = Company(name=trimmed_name, logo=company.logo)
    db.add(db_company)
    db.commit()
    db.refresh(db_company)
    return db_company

def update_company(db: Session, company_id: UUID, company: CompanyUpdate):
    db_company = db.query(Company).filter(Company.id == company_id).first()
    if db_company:
        db_company.name = company.name.strip()
        if company.logo is not None:
            db_company.logo = company.logo
        db.commit()
        db.refresh(db_company)
    return db_company

def delete_company(db: Session, company_id: UUID):
    db_company = db.query(Company).filter(Company.id == company_id).first()
    if db_company:
        db.delete(db_company)
        db.commit()
    return db_company
