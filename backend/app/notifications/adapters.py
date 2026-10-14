"""Teammates ke code (User, Bill, login) se jodne wala layer. Sirf real mode (USE_STUBS=false) mein use hota hai.

Jo cheezein yahan teammates ki hain:
    app.core.db                      -> Base, SessionLocal, get_db     (database.py se aata hai)
    app.dependencies.authentication  -> get_current_user (session cookie)
    app.models.user.User             -> user_id, name, email, phone, role, department_id, whatsapp_opt_in, is_active
    app.models.bills.Bill            -> department_id, carbon_emitted, billing_date, status, is_suspicious
    departments table                -> dept_id (+ naam wala column, apne aap dhundha jata hai)
"""
import re
from datetime import date
from types import SimpleNamespace

from fastapi import Depends, HTTPException, status
from sqlalchemy import func, inspect, or_, select, text

from app.dependencies.authentication import get_current_user
from app.models.bills import Bill
from app.models.user import User
from app.notifications.config import settings
from app.notifications.models import DepartmentBudget


# ----------------------------------------------------------------- roles
def _norm(role: str | None) -> str:
    """'Data Officer', 'data-officer', 'DATA_OFFICER' sab ek jaise ho jaate hain."""
    return re.sub(r"[\s\-]+", "_", (role or "").strip().lower())


def _csv(value: str) -> set[str]:
    return {_norm(v) for v in value.split(",") if v.strip()}


def _role_groups() -> dict[str, set[str]]:
    return {
        "admin": _csv(settings.ADMIN_ROLES),
        "manager": _csv(settings.MANAGER_ROLES),
        "data_officer": _csv(settings.DATA_OFFICER_ROLES),
    }


def _allowed(roles: tuple[str, ...]) -> set[str]:
    groups = _role_groups()
    allowed: set[str] = set()
    for r in roles:
        allowed |= groups.get(_norm(r), {_norm(r)})
    return allowed


def require_role(*roles: str):
    """Endpoint ko sirf in roles ke liye kholo. Logical naam do: 'admin', 'manager', 'data_officer'.
    Asli role strings .env ke ADMIN_ROLES / MANAGER_ROLES / DATA_OFFICER_ROLES se aate hain."""
    allowed = _allowed(roles)

    def checker(user: User = Depends(get_current_user)) -> User:
        if not user.is_active:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is inactive")
        if _norm(user.role) not in allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient role")
        return user

    return checker


def is_admin(user) -> bool:
    return _norm(user.role) in _role_groups()["admin"]


# ----------------------------------------------------------------- budget and usage
def _period_start(today: date | None = None) -> date | None:
    today = today or date.today()
    period = settings.BUDGET_PERIOD.strip().lower()
    if period == "month":
        return today.replace(day=1)
    if period == "quarter":
        return date(today.year, 3 * ((today.month - 1) // 3) + 1, 1)
    if period == "year":
        return date(today.year, 1, 1)
    return None                                   # "all": poora time


def _used(db, dept_id: int) -> float:
    """Department ke bills ka total carbon_emitted (settings ke filters ke saath)."""
    stmt = select(func.coalesce(func.sum(Bill.carbon_emitted), 0)).where(
        Bill.department_id == dept_id)
    start = _period_start()
    if start is not None:
        stmt = stmt.where(Bill.billing_date >= start)
    if settings.EXCLUDE_SUSPICIOUS:
        stmt = stmt.where(or_(Bill.is_suspicious.is_(None), Bill.is_suspicious.is_(False)))
    statuses = [s.strip() for s in settings.BILL_STATUSES.split(",") if s.strip()]
    if statuses:
        stmt = stmt.where(Bill.status.in_(statuses))
    return float(db.scalar(stmt) or 0)


_NAME_COLUMNS = ("dept_name", "name", "department_name", "title")
_dept_columns: list[str] | None = None


def _department_name(db, dept_id: int) -> str:
    """departments table ka naam wala column apne aap dhundta hai (model ka naam pata na ho tab bhi)."""
    global _dept_columns
    if _dept_columns is None:
        try:
            _dept_columns = [c["name"] for c in inspect(db.get_bind()).get_columns("departments")]
        except Exception:                                   # noqa: BLE001
            _dept_columns = []
    for col in _NAME_COLUMNS:
        if col in _dept_columns:                            # col DB metadata se hai, user input se nahi
            value = db.execute(
                text(f'SELECT "{col}" FROM departments WHERE dept_id = :i'), {"i": dept_id}
            ).scalar()
            if value:
                return str(value)
    return f"Department {dept_id}"


def get_budget_status(db, dept_id: int) -> dict:
    """Contract: {dept_name, budget, used, remaining}. budget None = budget set nahi hai."""
    row = db.get(DepartmentBudget, dept_id)
    if row is not None:
        budget: float | None = float(row.budget_limit)
    else:
        budget = float(settings.DEFAULT_DEPT_BUDGET) or None
    used = _used(db, dept_id)
    return {
        "dept_name": _department_name(db, dept_id),
        "budget": budget,
        "used": used,
        "remaining": None if budget is None else budget - used,
    }


def set_budget(db, dept_id: int, amount: float, user_id: int | None = None) -> None:
    db.merge(DepartmentBudget(department_id=dept_id, budget_limit=amount, updated_by=user_id))
    db.commit()


def all_department_ids(db) -> list[int]:
    return [r[0] for r in db.execute(text("SELECT dept_id FROM departments ORDER BY dept_id"))]


# ----------------------------------------------------------------- recipients
def _as_recipient(u: User) -> SimpleNamespace:
    """Service user.id maangti hai, teammates ka User user_id deta hai: yahan convert hota hai."""
    return SimpleNamespace(
        id=u.user_id, name=u.name, email=u.email, phone=u.phone,
        whatsapp_opt_in=bool(u.whatsapp_opt_in),
    )


def get_recipients(db, dept_id: int, level: int) -> list[SimpleNamespace]:
    """Dept ke active Manager(s) hamesha; EXCEEDED (level 3) par saare active Admin bhi."""
    groups = _role_groups()
    chosen: dict[int, User] = {}

    in_dept = db.scalars(
        select(User).where(User.department_id == dept_id, User.is_active.is_(True))).all()
    for u in in_dept:
        if _norm(u.role) in groups["manager"]:
            chosen[u.user_id] = u

    if int(level) >= 3:
        everyone = db.scalars(select(User).where(User.is_active.is_(True))).all()
        for u in everyone:
            if _norm(u.role) in groups["admin"]:
                chosen[u.user_id] = u

    return [_as_recipient(u) for u in chosen.values()]
