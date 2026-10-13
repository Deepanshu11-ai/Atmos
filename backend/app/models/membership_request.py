from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class MembershipRequest(Base):
    __tablename__ = "membership_requests"

    __table_args__ = (
        CheckConstraint(
            "requested_role IN "
            "('compliance_manager', 'data_entry_operator')",
            name="ck_requested_role",
        ),
        CheckConstraint(
            "decision IN ('pending', 'approved', 'declined')",
            name="ck_request_decision",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )
    membership_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "organization_memberships.id",
            ondelete="CASCADE",
        ),
        index=True,
    )
    requested_role: Mapped[str] = mapped_column(String(30))
    decision: Mapped[str] = mapped_column(
        String(20),
        default="pending",
    )
    reviewed_by: Mapped[int | None] = mapped_column(
    ForeignKey("users.user_id"),
    nullable=True,
    )
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )