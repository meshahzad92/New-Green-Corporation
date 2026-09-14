from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, Literal

class NoteBase(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = None
    status: Literal['pending', 'in_progress', 'completed'] = 'pending'
    is_important: bool = False
    priority: Literal['low', 'medium', 'high'] = 'medium'
    target_date: Optional[datetime] = None

class NoteCreate(NoteBase):
    pass

class NoteUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1)
    description: Optional[str] = None
    status: Optional[Literal['pending', 'in_progress', 'completed']] = None
    is_important: Optional[bool] = None
    priority: Optional[Literal['low', 'medium', 'high']] = None
    target_date: Optional[datetime] = None

class Note(NoteBase):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
