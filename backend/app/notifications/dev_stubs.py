"""Teammates ke parts ready hone tak ke FAKE versions. Sirf USE_STUBS=true par use hoti hai."""
from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.notifications.config import settings

engine = create_engine(
    "sqlite:///./dev_notifications.db", connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_role(*roles):
    """Fake: sabko admin maanta hai. Asli RBAC adapters.py mein teammates ke login se judta hai."""
    def checker():
        return SimpleNamespace(id=1, user_id=1, role="admin", department_id=1)
    return checker


def is_admin(user) -> bool:
    return True


# Sketch: har department ka budget 1000; D1=800, D2=200, D3=700 use
_ORIGINAL = {
    1: {"dept_name": "D1", "budget": 1000, "used": 800},
    2: {"dept_name": "D2", "budget": 1000, "used": 200},
    3: {"dept_name": "D3", "budget": 1000, "used": 700},
}
FAKE_DEPTS = {k: dict(v) for k, v in _ORIGINAL.items()}


def reset_fake_data():
    for k, v in _ORIGINAL.items():
        FAKE_DEPTS[k] = dict(v)


def set_fake_usage(dept_id: int, used: float):
    FAKE_DEPTS[dept_id]["used"] = used


def get_budget_status(db, dept_id: int) -> dict:
    d = FAKE_DEPTS[dept_id]
    budget = d["budget"]
    return {**d, "remaining": None if budget is None else budget - d["used"]}


def set_budget(db, dept_id: int, amount: float, user_id=None) -> None:
    FAKE_DEPTS[dept_id]["budget"] = amount


def all_department_ids(db) -> list[int]:
    return list(FAKE_DEPTS)


def get_recipients(db, dept_id: int, level: int) -> list:
    """Fake: Manager hamesha, Admin sirf EXCEEDED (level 3) par."""
    def person(uid, name):
        return SimpleNamespace(
            id=uid, name=name,
            email=settings.DEV_TEST_EMAIL,
            phone=settings.DEV_TEST_PHONE,
            whatsapp_opt_in=True,
        )

    people = [person(100 + dept_id, f"Manager{dept_id}")]
    if int(level) >= 3:
        people.append(person(1, "Admin"))
    return people
