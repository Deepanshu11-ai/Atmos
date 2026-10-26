from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import (
    SESSION_DURATION,
    accessible_department,
    bootstrap_admin,
    create_session,
    get_current_session,
    hash_password,
    require_admin,
    verify_password,
)
from app.bills import router as bill_router
from app.credits import router as credit_router
from app.emissions import router as emissions_router
from app.database import CreditAccount, Department, User, UserSession, get_db, get_session_factory
from app.migrations import initialize_database
from app.schemas import (
    CreateDepartmentRequest, CreateUserRequest, DepartmentResponse,
    LoginRequest, RegisterRequest, TokenResponse, UserResponse,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    factory = get_session_factory()
    initialize_database(factory.kw["bind"])
    with factory() as db:
        bootstrap_admin(db)
    yield


app = FastAPI(title="Department accounts and credits API", lifespan=lifespan)
app.include_router(credit_router)
app.include_router(bill_router)
app.include_router(emissions_router)


@app.post("/auth/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> User:
    """Sign up as an owner; create a department when the team is ready."""
    email = str(payload.email).lower()
    if db.scalar(select(User.user_id).where(func.lower(User.email) == email)) is not None:
        raise HTTPException(status_code=409, detail="Email already registered")
    try:
        user = User(
            department_id=None, name=payload.name, email=email,
            role="admin", password_hash=hash_password(payload.password),
        )
        db.add(user)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Email already registered") from None
    db.refresh(user)
    return user


@app.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(User).where(func.lower(User.email) == str(payload.email).lower()))
    if user is None or not user.is_active or not verify_password(user.password_hash, payload.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    token = create_session(db, user)
    return TokenResponse(access_token=token, expires_in=int(SESSION_DURATION.total_seconds()))


@app.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    current: tuple[User, UserSession] = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> None:
    _, session = current
    session.revoked_at = datetime.now(timezone.utc)
    db.commit()


@app.get("/users/me", response_model=UserResponse)
def me(current: tuple[User, UserSession] = Depends(get_current_session)) -> User:
    return current[0]


@app.post("/admin/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: CreateUserRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> User:
    department_id = payload.department_id or admin.department_id
    if department_id is None:
        raise HTTPException(status_code=400, detail="Create a department before adding users")
    accessible_department(db, admin, department_id)
    email = str(payload.email).lower()
    if db.scalar(select(User.user_id).where(func.lower(User.email) == email)) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(
        department_id=department_id,
        name=payload.name,
        email=email,
        role=payload.role,
        password_hash=hash_password(payload.password),
        is_active=True,
        created_at=datetime.now(timezone.utc),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered") from None
    db.refresh(user)
    return user


@app.get("/admin/users", response_model=list[UserResponse])
def list_users(
    department_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> list[User]:
    target = department_id or admin.department_id
    if target is None:
        raise HTTPException(status_code=400, detail="Create a department before listing users")
    accessible_department(db, admin, target)
    return list(db.scalars(select(User).where(User.department_id == target).order_by(User.user_id)))


@app.post("/admin/departments", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
def create_department(
    payload: CreateDepartmentRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> Department:
    home = db.get(Department, admin.department_id) if admin.department_id is not None else None
    if admin.department_id is not None and (home is None or home.owner_id != admin.user_id):
        raise HTTPException(status_code=403, detail="Only a department owner can create departments")
    if db.scalar(select(Department.id).where(
        Department.owner_id == admin.user_id,
        func.lower(Department.name) == payload.name.lower(),
    )):
        raise HTTPException(status_code=409, detail="You already have a department with this name")
    try:
        department = Department(name=payload.name, owner_id=admin.user_id)
        db.add(department)
        db.flush()
        db.add(CreditAccount(department_id=department.id, balance=0))
        if admin.department_id is None:
            admin.department_id = department.id
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="You already have a department with this name") from None
    db.refresh(department)
    return department


@app.get("/admin/departments", response_model=list[DepartmentResponse])
def list_departments(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> list[Department]:
    return list(db.scalars(
        select(Department)
        .where(or_(Department.id == admin.department_id, Department.owner_id == admin.user_id))
        .order_by(Department.id)
    ))
