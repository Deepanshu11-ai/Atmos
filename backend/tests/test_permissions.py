
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.dependencies.permissions import check_organization_membership


def test_missing_membership_is_forbidden(monkeypatch):
    organization_id = uuid4()

    class FakeDB:
        def scalar(self, statement):
            return None

    with pytest.raises(HTTPException) as exc:
        check_organization_membership(
            FakeDB(),
            user_id=123,
            organization_id=organization_id,
        )

    assert exc.value.status_code == 403
    assert exc.value.detail == "Active organization membership required"


def test_role_not_allowed_is_forbidden(monkeypatch):
    organization_id = uuid4()

    membership = SimpleNamespace(
        user_id=123,
        organization_id=organization_id,
        role="data_entry_operator",
        status="active",
    )

    class FakeDB:
        def scalar(self, statement):
            return membership

    with pytest.raises(HTTPException) as exc:
        check_organization_membership(
            FakeDB(),
            user_id=123,
            organization_id=organization_id,
            allowed_roles={"admin"},
        )

    assert exc.value.status_code == 403
    assert exc.value.detail == "Insufficient organization permissions"


def test_allowed_role_returns_membership():
    organization_id = uuid4()

    membership = SimpleNamespace(
        user_id=123,
        organization_id=organization_id,
        role="admin",
        status="active",
    )

    class FakeDB:
        def scalar(self, statement):
            return membership

    result = check_organization_membership(
        FakeDB(),
        user_id=123,
        organization_id=organization_id,
        allowed_roles={"admin"},
    )

    assert result is membership
