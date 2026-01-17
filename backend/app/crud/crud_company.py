from sqlalchemy.orm import Session
from app.models.models import Company
from app.schemas.company import CompanyCreate, CompanyUpdate
from uuid import UUID

def get_companies(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Company).offset(skip).limit(limit).all()

def get_company(db: Session, company_id: UUID):
    return db.query(Company).filter(Company.id == company_id).first()

def create_company(db: Session, company: CompanyCreate):
    db_company = Company(name=company.name)
    db.add(db_company)
    db.commit()
    db.refresh(db_company)
    return db_company

def update_company(db: Session, company_id: UUID, company: CompanyUpdate):
    db_company = db.query(Company).filter(Company.id == company_id).first()
    if db_company:
        db_company.name = company.name
        db.commit()
        db.refresh(db_company)
    return db_company

def delete_company(db: Session, company_id: UUID):
    db_company = db.query(Company).filter(Company.id == company_id).first()
    if db_company:
        db.delete(db_company)
        db.commit()
    return db_company
