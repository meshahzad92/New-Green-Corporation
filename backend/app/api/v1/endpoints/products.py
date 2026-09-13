from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from uuid import UUID
from app.db.session import get_db
from app.schemas.product import Product, ProductCreate, ProductUpdate
from app.crud import crud_product
from app.api import deps
from app.models.models import User, Product as DBProduct

router = APIRouter()

@router.put("/{product_id}", response_model=Product)
def update_product(
    product_id: UUID,
    product: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    if product.name and product.company_id:
        existing = db.query(DBProduct).filter(
            func.lower(DBProduct.name) == func.lower(product.name.strip()),
            DBProduct.company_id == product.company_id,
            DBProduct.id != product_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A product named '{product.name.strip()}' already exists for this company."
            )

    db_product = crud_product.update_product(db, product_id=product_id, product=product)
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    return db_product

@router.get("/", response_model=List[Product])
def read_products(
    skip: int = 0, 
    limit: int = 100, 
    search: str = None, 
    category: str = None, 
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    products = crud_product.get_products(
        db, skip=skip, limit=limit, search=search, category=category
    )
    return products

@router.get("/{product_id}", response_model=Product)
def read_product(
    product_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    db_product = crud_product.get_product(db, product_id=product_id)
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    return db_product

@router.post("/", response_model=Product, status_code=status.HTTP_201_CREATED)
def create_product(
    product: ProductCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    # Check for duplicate product within same company
    if product.company_id:
        existing = db.query(DBProduct).filter(
            func.lower(DBProduct.name) == func.lower(product.name.strip()),
            DBProduct.company_id == product.company_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A product named '{product.name.strip()}' already exists for this company."
            )

    db_product = crud_product.create_product(db=db, product=product)
    if db_product is None:
        raise HTTPException(status_code=404, detail="Company not found")
    return db_product

@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: UUID, 
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    db_product = crud_product.delete_product(db, product_id=product_id)
    if db_product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return None
