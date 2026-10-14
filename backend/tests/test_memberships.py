
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient

from main import app
from app.core.db import get_db
from app.dependencies.authentication import get_current_user
from app.models.membership import OrganizationMembership
from app.models.membership_request import MembershipRequest


client = TestClient(app)



class FakeDB:
    def __init__(
        self,
        request=None,
        membership=None,
        reviewer_membership=None,
    ):
        self.request = request
        self.membership = membership
        self.reviewer_membership = reviewer_membership

    def get(self, model, object_id):
        if model is MembershipRequest:
            if self.request and self.request.id == object_id:
                return self.request
            return None

        if model is OrganizationMembership:
            if self.membership and self.membership.id == object_id:
                return self.membership
            return None

        return None

    def scalar(self, statement):
        # Simulate the organization-membership permission query.
        # A reviewer is authorized only if their membership
        # belongs to the target organization.
        if (
            self.reviewer_membership is not None
            and self.membership is not None
            and self.reviewer_membership.organization_id
            == self.membership.organization_id
        ):
            return self.reviewer_membership

        return None





def make_user(user_id=100):
    return SimpleNamespace(
        user_id=user_id,
        name="Test User",
        email="test@example.com",
        is_active=True,
    )


def make_membership(
    organization_id,
    user_id=200,
    role="admin",
    status="active",
):
    return SimpleNamespace(
        id=uuid4(),
        user_id=user_id,
        organization_id=organization_id,
        role=role,
        status=status,
    )


def make_request(membership_id):
    return SimpleNamespace(
        id=uuid4(),
        membership_id=membership_id,
        requested_role="data_entry_operator",
        decision="pending",
    )


def setup_overrides(fake_db, user=None):
    app.dependency_overrides[get_current_user] = (
        lambda: user or make_user()
    )
    app.dependency_overrides[get_db] = lambda: fake_db


def teardown_overrides():
    app.dependency_overrides.clear()


def test_non_admin_cannot_review_membership_request():
    organization_id = uuid4()
    membership = make_membership(
        organization_id,
        role="data_entry_operator",
    )
    request = make_request(membership.id)
    fake_db = FakeDB(request=request, membership=membership)

    setup_overrides(fake_db, make_user(user_id=100))

    try:
        response = client.post(
            f"/memberships/requests/{request.id}/review",
            json={"approve": True},
        )

        assert response.status_code == 403
    finally:
        teardown_overrides()



def test_admin_cannot_review_request_from_another_organization():
    target_organization_id = uuid4()
    other_organization_id = uuid4()

    # The request belongs to a user in the target organization.
    target_membership = make_membership(
        target_organization_id,
        user_id=200,
        role="data_entry_operator",
    )
    request = make_request(target_membership.id)

    # The reviewer is an admin, but only in a different organization.
    reviewer_membership = make_membership(
        other_organization_id,
        user_id=100,
        role="admin",
        status="active",
    )

    fake_db = FakeDB(
        request=request,
        membership=target_membership,
        reviewer_membership=reviewer_membership,
    )

    setup_overrides(fake_db, make_user(user_id=100))

    try:
        response = client.post(
            f"/memberships/requests/{request.id}/review",
            json={"approve": True},
        )

        assert response.status_code == 403
    finally:
        teardown_overrides()



def test_missing_membership_request_returns_404():
    fake_db = FakeDB(request=None, membership=None)
    setup_overrides(fake_db)

    try:
        response = client.post(
            f"/memberships/requests/{uuid4()}/review",
            json={"approve": True},
        )

        assert response.status_code == 404
    finally:
        teardown_overrides()
