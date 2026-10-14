"""Teen tables. Sab plain integers (ForeignKey nahi), taaki teammates ke tables se coupling na ho.
Base wahi hai jo teammates ka app/core/db.py deta hai, isliye Alembic inhe dekh sakta hai."""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.notifications.database import Base


class Notification(Base):
    """Har email/WhatsApp ka record. status 'sent' = provider ne accept kiya (delivered nahi)."""
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    department_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False)
    channel: Mapped[str] = mapped_column(String(20), nullable=False)    # email | whatsapp
    level: Mapped[str] = mapped_column(String(20), nullable=False)      # WARNING | CRITICAL | EXCEEDED
    tone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    subject: Mapped[str | None] = mapped_column(String(200), nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    provider_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now())


class AlertState(Base):
    """Har department ka last alert level (spam rokne ke liye)."""
    __tablename__ = "alert_state"

    department_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    last_level: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_notified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True)


class DepartmentBudget(Base):
    """Department ka carbon budget (alerts isi se compare hote hain).
    Agar teammates ka apna budget table ho, to sirf adapters.get_budget_status badlo."""
    __tablename__ = "department_budgets"

    department_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    budget_limit: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    updated_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        server_default=func.now(), onupdate=func.now())
