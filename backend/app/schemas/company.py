from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime

class CompanyBase(BaseModel):
    name: str

class CompanyCreate(CompanyBase):
    pass

class CompanyUpdate(CompanyBase):
    pass

class Company(CompanyBase):
    id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
