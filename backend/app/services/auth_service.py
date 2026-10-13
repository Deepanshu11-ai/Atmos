
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
