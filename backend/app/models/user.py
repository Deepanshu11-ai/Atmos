
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(
        String(150),
        unique=True,
        nullable=False,
    )

    # Nullable temporarily to preserve existing accounts.
    password_hash: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    # Keep legacy fields so existing bill/department functionality survives.
    role: Mapped[str] = mapped_column(String(50), nullable=False)

    department_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("departments.dept_id"),
        nullable=True,
    )

    phone: Mapped[str | None] = mapped_column(
        String(15),
        nullable=True,
    )

    whatsapp_opt_in: Mapped[bool | None] = mapped_column(
        Boolean,
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
