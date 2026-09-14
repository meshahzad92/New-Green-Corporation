from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from app.models.models import Note
from app.schemas.note import NoteCreate, NoteUpdate
from uuid import UUID
from datetime import datetime, timedelta
from typing import Optional

def get_notes(
    db: Session,
    skip: int = 0,
    limit: int = 200,
    status: Optional[str] = None,
    is_important: Optional[bool] = None,
    include_deleted: bool = False
):
    "Get active notes with optional status or importance filters"
    query = db.query(Note)
    
    if not include_deleted:
        query = query.filter(Note.is_deleted == False)
        
    if status:
        query = query.filter(Note.status == status)
        
    if is_important is not None:
        query = query.filter(Note.is_important == is_important)
        
    # Sort: important first, then target_date nulls last, then created_at desc
    return query.order_by(
        Note.is_important.desc(),
        Note.target_date.asc().nullslast(),
        Note.created_at.desc()
    ).offset(skip).limit(limit).all()

def get_note(db: Session, note_id: UUID):
    "Get a single note by ID"
    return db.query(Note).filter(
        Note.id == note_id,
        Note.is_deleted == False
    ).first()

def create_note(db: Session, note: NoteCreate):
    "Create a new note with 15s deduplication guard"
    now_utc = datetime.utcnow()
    recent_cutoff = now_utc - timedelta(seconds=15)
    trimmed_title = note.title.strip()
    
    existing = db.query(Note).filter(
        Note.title == trimmed_title,
        Note.status == note.status,
        Note.is_deleted == False,
        Note.created_at >= recent_cutoff
    ).first()
    if existing:
        return existing
        
    data = note.model_dump()
    data['title'] = trimmed_title
    db_note = Note(**data)
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    return db_note

def update_note(db: Session, note_id: UUID, note_update: NoteUpdate):
    "Update note fields"
    db_note = get_note(db, note_id)
    if not db_note:
        return None
        
    update_data = note_update.model_dump(exclude_unset=True)
    if 'title' in update_data and update_data['title']:
        update_data['title'] = update_data['title'].strip()
        
    for field, value in update_data.items():
        setattr(db_note, field, value)
        
    db_note.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_note)
    return db_note

def delete_note(db: Session, note_id: UUID):
    "Soft delete note"
    db_note = get_note(db, note_id)
    if not db_note:
        return False
        
    db_note.is_deleted = True
    db_note.deleted_at = datetime.utcnow()
    db.commit()
    return True
