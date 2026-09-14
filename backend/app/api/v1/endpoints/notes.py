from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.db.session import get_db
from app.schemas.note import Note, NoteCreate, NoteUpdate
from app.crud import crud_note

router = APIRouter()

@router.get("/", response_model=List[Note])
def read_notes(
    skip: int = 0,
    limit: int = 200,
    status: Optional[str] = Query(None, description="Filter by status ('pending', 'in_progress', 'completed')"),
    is_important: Optional[bool] = Query(None, description="Filter by important flag"),
    db: Session = Depends(get_db)
):
    """List notes"""
    return crud_note.get_notes(db, skip=skip, limit=limit, status=status, is_important=is_important)

@router.get("/{id}", response_model=Note)
def read_note(
    id: UUID,
    db: Session = Depends(get_db)
):
    """Get single note"""
    note = crud_note.get_note(db, id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note

@router.post("/", response_model=Note)
def create_note(
    note: NoteCreate,
    db: Session = Depends(get_db)
):
    """Create a new note"""
    return crud_note.create_note(db, note)

@router.put("/{id}", response_model=Note)
def update_note(
    id: UUID,
    note_update: NoteUpdate,
    db: Session = Depends(get_db)
):
    """Update a note"""
    updated = crud_note.update_note(db, id, note_update)
    if not updated:
        raise HTTPException(status_code=404, detail="Note not found")
    return updated

@router.delete("/{id}")
def delete_note(
    id: UUID,
    db: Session = Depends(get_db)
):
    """Delete a note (soft delete)"""
    success = crud_note.delete_note(db, id)
    if not success:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"message": "Note deleted successfully"}

