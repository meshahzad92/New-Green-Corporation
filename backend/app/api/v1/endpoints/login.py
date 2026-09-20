from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from threading import Lock
from app.db.session import get_db
from app.core import security
from app.core.config import settings
from app.crud import crud_user
from app.schemas.user import Token, User, UserCreate

router = APIRouter()
MAX_FAILED_LOGIN_ATTEMPTS = 5
LOGIN_LOCKOUT_MINUTES = 15
_failed_login_attempts: dict[str, tuple[int, datetime]] = {}
_failed_login_lock = Lock()


def _login_key(request: Request, username: str) -> str:
    client_host = request.client.host if request.client else "unknown"
    return f"{client_host}:{username.strip().lower()}"


def _check_login_throttle(key: str) -> None:
    now = datetime.now(timezone.utc)
    with _failed_login_lock:
        attempts, locked_until = _failed_login_attempts.get(key, (0, now))
        if attempts >= MAX_FAILED_LOGIN_ATTEMPTS and locked_until > now:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed login attempts. Please try again later.",
            )
        if locked_until <= now:
            _failed_login_attempts.pop(key, None)


def _record_failed_login(key: str) -> None:
    now = datetime.now(timezone.utc)
    with _failed_login_lock:
        attempts, locked_until = _failed_login_attempts.get(key, (0, now))
        if locked_until <= now:
            attempts = 0
        attempts += 1
        next_allowed_at = now + timedelta(minutes=LOGIN_LOCKOUT_MINUTES)
        _failed_login_attempts[key] = (attempts, next_allowed_at)


def _clear_failed_login(key: str) -> None:
    with _failed_login_lock:
        _failed_login_attempts.pop(key, None)

@router.post("/login/access-token", response_model=Token)
def login_access_token(
    request: Request,
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
):
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    throttle_key = _login_key(request, form_data.username)
    _check_login_throttle(throttle_key)

    user = crud_user.authenticate(
        db, email=form_data.username, password=form_data.password
    )
    if not user:
        _record_failed_login(throttle_key)
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    elif not user.is_active:
        _record_failed_login(throttle_key)
        raise HTTPException(status_code=400, detail="Inactive user")
    
    _clear_failed_login(throttle_key)
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }

@router.post("/signup", response_model=User)
def create_user_signup(
    *,
    db: Session = Depends(get_db),
    user_in: UserCreate
):
    """
    Create new user without the need to be logged in
    """
    if not settings.SIGNUP_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Signup is disabled",
        )
    user = crud_user.get_user_by_email(db, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system",
        )
    user = crud_user.create_user(db, user_in=user_in)
    return user
