from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from pathlib import Path
import re
import shutil
from app.db.session import get_db
from app.schemas.company import Company, CompanyCreate, CompanyUpdate
from app.crud import crud_company
from app.api import deps
from app.models.models import Product, User

router = APIRouter()

@router.get("/", response_model=List[Company])
def read_companies(
    skip: int = 0, 
    limit: Optional[int] = None, 
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    return crud_company.get_companies(db, skip=skip, limit=limit)

@router.get("/{company_id}", response_model=Company)
def read_company(
    company_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    db_company = crud_company.get_company(db, company_id=company_id)
    if not db_company:
        raise HTTPException(status_code=404, detail="Company not found")
    return db_company

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
    has_products = db.query(Product.id).filter(Product.company_id == company_id).first()
    if has_products:
        raise HTTPException(status_code=400, detail="Company has products and cannot be deleted")

    db_company = crud_company.delete_company(db, company_id=company_id)
    if not db_company:
        raise HTTPException(status_code=404, detail="Company not found")
    return None


@router.post("/upload-logo", response_model=dict, status_code=status.HTTP_201_CREATED)
def upload_logo(
    file: UploadFile = File(...),
    current_user: User = Depends(deps.get_current_active_user)
):
    # Sanitize filename: only alphanumeric, dots, hyphens
    sanitized = re.sub(r'[^a-zA-Z0-9.\-]', '_', file.filename) if file.filename else "logo.png"
    
    # Path to frontend logos
    logos_dir = Path(__file__).resolve().parents[5] / 'frontend' / 'src' / 'logos'
    logos_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = logos_dir / sanitized
    
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"filename": sanitized}
