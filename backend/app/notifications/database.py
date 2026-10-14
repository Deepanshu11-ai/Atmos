"""Database objects ka ek hi raasta: teammates ka (real) ya fake (stubs).
models.py aur integration.py dono yahin se lete hain, isliye circular import nahi banta."""
from app.notifications.config import settings

if settings.USE_STUBS:
    from app.notifications.dev_stubs import Base, SessionLocal, get_db  # noqa: F401
else:
    from app.core.db import Base, SessionLocal, get_db  # noqa: F401
