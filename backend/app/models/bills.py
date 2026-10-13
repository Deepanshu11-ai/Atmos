
from datetime import date
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Bill(Base):
    __tablename__ = "bills"

    bill_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )
    department_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("departments.dept_id"),
        nullable=True,
    )
    uploaded_by: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.user_id"),
        nullable=True,
    )
    cost: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )
    carbon_emitted: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )
    billing_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    status: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    is_suspicious: Mapped[bool | None] = mapped_column(
        Boolean,
        nullable=True,
    )
