import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from app.core.config import settings
from app.models.user_session import UserSession
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.user import User


def get_user_by_email(db: Session, email: str) -> User | None:
    """Find an account by its email address."""
    normalized_email = email.strip().lower()

    statement = select(User).where(User.email == normalized_email)
    return db.scalar(statement)


def register_user(
    db: Session,
    *,
    name: str,
    email: str,
    password: str,
    role: str = "employee",
) -> User:
    """Create a user with a securely hashed password."""
    normalized_email = email.strip().lower()

    if not name.strip():
        raise ValueError("Name cannot be empty")

    if not normalized_email:
        raise ValueError("Email cannot be empty")

    if not password:
        raise ValueError("Password cannot be empty")

    if get_user_by_email(db, normalized_email) is not None:
        raise ValueError("An account with this email already exists")

    user = User(
        name=name.strip(),
        email=normalized_email,
        password_hash=hash_password(password),
        role=role,
    )

    db.add(user)

    try:
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        raise

    return user


def authenticate_user(
    db: Session,
    *,
    email: str,
    password: str,
) -> User | None:
    """Return an authenticated active user, or None."""
    user = get_user_by_email(db, email)

    if user is None:
        return None

    if not user.is_active or not user.password_hash:
        return None

    if not verify_password(password, user.password_hash):
        return None

    return user





def create_user_session(db: Session, user_id: int) -> str:
    """Create a session and return the raw token once."""
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    session = UserSession(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc)
        + timedelta(hours=settings.session_ttl_hours),
    )

    db.add(session)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    return raw_token


def get_session_user(db: Session, raw_token: str) -> User | None:
    """Return the user for a valid, unexpired, non-revoked session."""
    if not raw_token:
        return None

    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    statement = (
        select(User)
        .join(UserSession, User.user_id == UserSession.user_id)
        .where(
            UserSession.token_hash == token_hash,
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > datetime.now(timezone.utc),
            User.is_active.is_(True),
        )
    )
    return db.scalar(statement)


def revoke_user_session(db: Session, raw_token: str) -> None:
    """Revoke a session without storing or exposing its raw token."""
    if not raw_token:
        return

    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    statement = select(UserSession).where(
        UserSession.token_hash == token_hash,
        UserSession.revoked_at.is_(None),
    )
    session = db.scalar(statement)

    if session is not None:
        session.revoked_at = datetime.now(timezone.utc)
        try:
            db.commit()
        except Exception:
            db.rollback()
            raise
