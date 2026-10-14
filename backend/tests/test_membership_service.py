from types import SimpleNamespace
from uuid import uuid4
import pytest
from fastapi import HTTPException
from app.models.membership import OrganizationMembership
from app.models.membership_request import MembershipRequest
from app.services.membership_service import review_membership_request


class FakeDB:
    def __init__(self, request=None, membership=None, reviewer=None):
        self.request = request
        self.membership = membership
        self.reviewer = reviewer

    def scalar(self, statement):
        # Return the request or membership based on the SQLAlchemy query.
        # These tests supply only one request and one membership.
        if self.request is not None:
            return self.request
        return self.membership

    def get(self, model, object_id):
        if model.__name__ == "User":
            return self.reviewer
        return None

    def commit(self):
        pass

    def refresh(self, instance):
        pass

    def rollback(self):
        pass


def make_membership(user_id=200):
    return SimpleNamespace(
        id=uuid4(),
        user_id=user_id,
        organization_id=uuid4(),
        role="data_entry_operator",
        status="pending",
    )


def make_request(membership_id, decision="pending"):
    return SimpleNamespace(
        id=uuid4(),
        membership_id=membership_id,
        requested_role="data_entry_operator",
        decision=decision,
        reviewed_by=None,
        reviewed_at=None,
    )


def make_reviewer(user_id=100):
    return SimpleNamespace(user_id=user_id, is_active=True)


def test_approval_activates_membership():
    membership = make_membership()
    request = make_request(membership.id)
    db = FakeDB(
        request=request,
        membership=membership,
        reviewer=make_reviewer(),
    )

    # Make scalar return the right object for each query.
    results = iter([request, membership])
    db.scalar = lambda statement: next(results)

    result = review_membership_request(
        db,
        request_id=request.id,
        reviewer_id=100,
        approve=True,
    )

    assert result.decision == "approved"
    assert result.reviewed_by == 100
    assert membership.status == "active"
    assert membership.role == "data_entry_operator"


def test_rejection_declines_membership():
    membership = make_membership()
    request = make_request(membership.id)
    db = FakeDB(
        request=request,
        membership=membership,
        reviewer=make_reviewer(),
    )

    results = iter([request, membership])
    db.scalar = lambda statement: next(results)

    result = review_membership_request(
        db,
        request_id=request.id,
        reviewer_id=100,
        approve=False,
    )

    assert result.decision == "declined"
    assert membership.status == "declined"
    assert result.reviewed_by == 100


def test_requester_cannot_review_own_request():
    membership = make_membership(user_id=100)
    request = make_request(membership.id)
    db = FakeDB(request=request, membership=membership)

    db.scalar = lambda statement: request if db._calls == 0 else membership
    db._calls = 0

    def scalar(statement):
        db._calls += 1
        return request if db._calls == 1 else membership

    db.scalar = scalar

    with pytest.raises(HTTPException) as exc:
        review_membership_request(
            db,
            request_id=request.id,
            reviewer_id=100,
            approve=True,
        )

    assert exc.value.status_code == 403


def test_already_reviewed_request_returns_conflict():
    membership = make_membership()
    request = make_request(membership.id, decision="approved")
    db = FakeDB(request=request, membership=membership)
    db.scalar = lambda statement: request

    with pytest.raises(HTTPException) as exc:
        review_membership_request(
            db,
            request_id=request.id,
            reviewer_id=100,
            approve=True,
        )

    assert exc.value.status_code == 409


def test_missing_request_returns_not_found():
    db = FakeDB(request=None, membership=None)
    db.scalar = lambda statement: None

    with pytest.raises(HTTPException) as exc:
        review_membership_request(
            db,
            request_id=uuid4(),
            reviewer_id=100,
            approve=True,
        )

    assert exc.value.status_code == 404
