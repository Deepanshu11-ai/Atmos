from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Department(Base):
    __tablename__ = "departments"

    dept_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )
    dept_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    total_budget: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    used_budget: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    is_locked: Mapped[bool | None] = mapped_column(
        Boolean,
        nullable=True,
    )
