from types import SimpleNamespace
from uuid import uuid4
from fastapi.testclient import TestClient
from main import app
from app.core.db import get_db
from app.dependencies.authentication import get_current_user

client = TestClient(app)

class FakeDB:
    def __init__(self, membership=None, organization=None):
        self.membership = membership
        self.organization = organization

    def scalar(self, statement):
        return self.membership

    def get(self, model, object_id):
        return self.organization


def make_user(user_id=123):
    return SimpleNamespace(
        user_id=user_id,
        name="Test User",
        email="test@example.com",
        is_active=True,
    )


def make_membership(organization_id, role="admin", status="active"):
    return SimpleNamespace(
        user_id=123,
        organization_id=organization_id,
        role=role,
        status=status,
    )


def test_organization_details_for_user_without_membership_is_forbidden():
    organization_id = uuid4()
    fake_db = FakeDB(membership=None)

    app.dependency_overrides[get_current_user] = lambda: make_user()
    app.dependency_overrides[get_db] = lambda: fake_db

    try:
        response = client.get(f"/organizations/{organization_id}")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_organization_details_for_active_member():
    organization_id = uuid4()
    organization = SimpleNamespace(
        id=organization_id,
        name="Test Organization",
    )
    fake_db = FakeDB(
        membership=make_membership(organization_id, role="data_entry_operator"),
        organization=organization,
    )

    app.dependency_overrides[get_current_user] = lambda: make_user()
    app.dependency_overrides[get_db] = lambda: fake_db

    try:
        response = client.get(f"/organizations/{organization_id}")
        assert response.status_code == 200
        assert response.json()["name"] == "Test Organization"
    finally:
        app.dependency_overrides.clear()


def test_non_admin_cannot_list_organization_members():
    organization_id = uuid4()
    fake_db = FakeDB(
        membership=make_membership(
            organization_id,
            role="data_entry_operator",
        )
    )

    app.dependency_overrides[get_current_user] = lambda: make_user()
    app.dependency_overrides[get_db] = lambda: fake_db

    try:
        response = client.get(f"/organizations/{organization_id}/members")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()