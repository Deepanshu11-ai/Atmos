"""Teammates se jo kuch chahiye, SAB yahin se import hota hai.
Real mode  (USE_STUBS=false): app/core/db.py, authentication.py aur adapters.py
Stub mode  (USE_STUBS=true) : dev_stubs.py (akele development/testing ke liye)"""
from app.notifications.config import settings
from app.notifications.database import Base, SessionLocal, get_db  # noqa: F401

if settings.USE_STUBS:
    from app.notifications.dev_stubs import (  # noqa: F401
        all_department_ids,
        get_budget_status,
        get_recipients,
        is_admin,
        require_role,
        set_budget,
    )
else:
    from app.notifications.adapters import (  # noqa: F401
        all_department_ids,
        get_budget_status,
        get_recipients,
        is_admin,
        require_role,
        set_budget,
    )
