from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from app.db.session import get_db
from app.schemas.company import Company, CompanyCreate, CompanyUpdate
from app.crud import crud_company
from app.api import deps
from app.models.models import User

router = APIRouter()

@router.get("/", response_model=List[Company])
def read_companies(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    return crud_company.get_companies(db, skip=skip, limit=limit)

@router.post("/", response_model=Company, status_code=status.HTTP_201_CREATED)
def create_company(
    company: CompanyCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    return crud_company.create_company(db=db, company=company)

@router.put("/{company_id}", response_model=Company)
def update_company(
    company_id: UUID,
    company: CompanyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    db_company = crud_company.update_company(db, company_id=company_id, company=company)
    if not db_company:
        raise HTTPException(status_code=404, detail="Company not found")
    return db_company

@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_company(
    company_id: UUID, 
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    db_company = crud_company.delete_company(db, company_id=company_id)
    if not db_company:
        raise HTTPException(status_code=404, detail="Company not found")
    return None
