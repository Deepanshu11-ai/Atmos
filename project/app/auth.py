import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import CreditAccount, Department, User, UserSession, get_db

password_hasher = PasswordHasher()
bearer = HTTPBearer(auto_error=False)
SESSION_DURATION = timedelta(hours=24)


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    if not password_hash:
        return False
    try:
        return password_hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session(db: Session, user: User) -> str:
    token = secrets.token_urlsafe(48)
    now = datetime.now(timezone.utc)
    db.add(UserSession(
        user_id=user.user_id,
        token_hash=token_digest(token),
        created_at=now,
        expires_at=now + SESSION_DURATION,
    ))
    db.commit()
    return token


def get_current_session(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> tuple[User, UserSession]:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized
    row = db.execute(
        select(User, UserSession)
        .join(UserSession, UserSession.user_id == User.user_id)
        .where(UserSession.token_hash == token_digest(credentials.credentials))
    ).first()
    if row is None:
        raise unauthorized
    user, session = row
    expires_at = session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if not user.is_active or session.revoked_at is not None or expires_at <= datetime.now(timezone.utc):
        raise unauthorized
    return user, session


def require_admin(current: tuple[User, UserSession] = Depends(get_current_session)) -> User:
    user, _ = current
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
    return user


def accessible_department(db: Session, admin: User, department_id: int) -> Department:
    department = db.get(Department, department_id)
    if department is None:
        raise HTTPException(status_code=404, detail="Department not found")
    if department.id != admin.department_id and department.owner_id != admin.user_id:
        raise HTTPException(status_code=403, detail="Department is not managed by this account")
    return department


def bootstrap_admin(db: Session) -> None:
    """Optionally create the first admin from environment credentials."""
    email = os.getenv("ADMIN_EMAIL")
    password = os.getenv("ADMIN_PASSWORD")
    if not email and not password:
        return
    if db.scalar(select(User.user_id).where(User.role == "admin").limit(1)) is not None:
        return
    if not email or not password or len(password) < 8:
        raise RuntimeError("Set both ADMIN_EMAIL and ADMIN_PASSWORD (at least 8 characters), or use /auth/register")
    from sqlalchemy import func

    if db.scalar(select(User.user_id).where(func.lower(User.email) == email.strip().lower())) is not None:
        raise RuntimeError("ADMIN_EMAIL already belongs to an existing user; choose a new address")
    department_name = os.getenv("ADMIN_DEPARTMENT_NAME", "Main Department")
    department = db.scalar(select(Department).where(Department.name == department_name))
    if department is None:
        department = Department(name=department_name)
        db.add(department)
        db.flush()
        db.add(CreditAccount(department_id=department.id, balance=0))
    user = User(
        department_id=department.id,
        name=os.getenv("ADMIN_NAME", "Administrator").strip() or "Administrator",
        email=email.strip().lower(),
        role="admin",
        password_hash=hash_password(password),
        is_active=True,
        created_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.flush()
    department.owner_id = user.user_id
    db.commit()
