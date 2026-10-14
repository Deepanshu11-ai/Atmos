"""add notification tables (notifications, alert_state, department_budgets)

Revision ID: 7f3a9c1d2e4b
Revises: PASTE_CURRENT_HEAD_HERE
Create Date: 2026-10-15
"""
from alembic import op
import sqlalchemy as sa

revision = "7f3a9c1d2e4b"
down_revision = "PASTE_CURRENT_HEAD_HERE"   # `alembic heads` ka output (12 character id) yahan daalo
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "department_budgets",
        sa.Column("department_id", sa.Integer(), primary_key=True),
        sa.Column("budget_limit", sa.Numeric(12, 2), nullable=False),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("department_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("channel", sa.String(20), nullable=False),
        sa.Column("level", sa.String(20), nullable=False),
        sa.Column("tone", sa.String(20), nullable=True),
        sa.Column("subject", sa.String(200), nullable=True),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("provider_id", sa.String(120), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_notifications_department_id", "notifications", ["department_id"])
    op.create_table(
        "alert_state",
        sa.Column("department_id", sa.Integer(), primary_key=True),
        sa.Column("last_level", sa.Integer(), nullable=False),
        sa.Column("last_notified_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("alert_state")
    op.drop_index("ix_notifications_department_id", table_name="notifications")
    op.drop_table("notifications")
    op.drop_table("department_budgets")
