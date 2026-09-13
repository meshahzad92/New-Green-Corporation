from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime
from typing import Optional

class CompanyBase(BaseModel):
    name: str = Field(..., min_length=1)
    logo: Optional[str] = None

class CompanyCreate(CompanyBase):
    pass

class CompanyUpdate(CompanyBase):
    pass

class Company(CompanyBase):
    id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
