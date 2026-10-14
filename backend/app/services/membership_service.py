
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.membership import OrganizationMembership
from app.models.membership_request import MembershipRequest
from app.models.organization import Organization
from app.models.user import User


REQUESTABLE_ROLES = {"compliance_manager", "data_entry_operator"}
ADMIN_ROLE = "admin"


def create_organization(
    db: Session,
    *,
    name: str,
    creator_id: int,
) -> Organization:
    normalized_name = name.strip()

    if not normalized_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Organization name cannot be empty",
        )

    creator = db.get(User, creator_id)
    if creator is None or not creator.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="An active user is required",
        )

    organization = Organization(name=normalized_name)
    db.add(organization)

    try:
        db.flush()

        membership = OrganizationMembership(
            id=uuid4(),
            user_id=creator_id,
            organization_id=organization.id,
            role=ADMIN_ROLE,
            status="active",
        )
        db.add(membership)
        db.commit()
        db.refresh(organization)
        return organization
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not create organization",
        )


def request_membership(
    db: Session,
    *,
    user_id: int,
    organization_id: UUID,
    requested_role: str,
) -> MembershipRequest:
    if requested_role not in REQUESTABLE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid requested role",
        )

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="An active user is required",
        )

    organization = db.get(Organization, organization_id)
    if organization is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )


    existing = db.scalar(
        select(OrganizationMembership)
        .where(
            OrganizationMembership.user_id == user_id,
            OrganizationMembership.organization_id == organization_id,
        )
        .with_for_update()
    )


    if existing is not None:
        if existing.status in {"pending", "active", "suspended"}:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A membership already exists for this organization",
            )

        # Reuse the unique membership row after a declined membership.
        existing.status = "pending"
        existing.role = requested_role

        request = MembershipRequest(
            membership_id=existing.id,
            requested_role=requested_role,
            decision="pending",
        )
    else:
        membership = OrganizationMembership(
            id=uuid4(),
            user_id=user_id,
            organization_id=organization_id,
            role=requested_role,
            status="pending",
        )
        db.add(membership)
        db.flush()

        request = MembershipRequest(
            membership_id=membership.id,
            requested_role=requested_role,
            decision="pending",
        )

    db.add(request)

    try:
        db.commit()
        db.refresh(request)
        return request
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not submit membership request",
        )


def review_membership_request(
    db: Session,
    *,
    request_id: UUID,
    reviewer_id: int,
    approve: bool,
) -> MembershipRequest:
    request = db.scalar(
        select(MembershipRequest)
        .where(MembershipRequest.id == request_id)
        .with_for_update()
    )

    if request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership request not found",
        )

    if request.decision != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This request has already been reviewed",
        )

    membership = db.scalar(
        select(OrganizationMembership)
        .where(OrganizationMembership.id == request.membership_id)
        .with_for_update()
    )

    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership not found",
        )

    if membership.user_id == reviewer_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot review your own membership request",
        )

    reviewer = db.get(User, reviewer_id)
    if reviewer is None or not reviewer.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="An active reviewer is required",
        )

    request.decision = "approved" if approve else "declined"
    request.reviewed_by = reviewer_id
    request.reviewed_at = datetime.now(timezone.utc)

    if approve:
        membership.role = request.requested_role
        membership.status = "active"
    else:
        membership.status = "declined"

    try:
        db.commit()
        db.refresh(request)
        return request
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not review membership request",
        )
