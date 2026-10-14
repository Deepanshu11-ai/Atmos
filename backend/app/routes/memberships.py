from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.dependencies.permissions import check_organization_membership
from app.core.db import get_db
from app.dependencies.authentication import get_current_user
from app.models.membership import OrganizationMembership
from app.models.membership_request import MembershipRequest
from app.models.user import User
from app.services.membership_service import (
    request_membership,
    review_membership_request,
)

router = APIRouter(prefix="/memberships", tags=["Memberships"])


class MembershipRequestCreate(BaseModel):
    organization_id: UUID
    requested_role: str = Field(
        pattern=r"^(compliance_manager|data_entry_operator)$"
    )


class MembershipRequestResponse(BaseModel):
    id: UUID
    membership_id: UUID
    requested_role: str
    decision: str

    model_config = {"from_attributes": True}


class MembershipReview(BaseModel):
    approve: bool


@router.post("/requests", response_model=MembershipRequestResponse,
             status_code=status.HTTP_201_CREATED)
def create_request(
    payload: MembershipRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    request = request_membership(
        db,
        user_id=current_user.user_id,
        organization_id=payload.organization_id,
        requested_role=payload.requested_role,
    )
    return request


@router.get("/requests/mine", response_model=list[MembershipRequestResponse])
def get_my_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    statement = (
        select(MembershipRequest)
        .join(
            OrganizationMembership,
            MembershipRequest.membership_id == OrganizationMembership.id,
        )
        .where(OrganizationMembership.user_id == current_user.user_id)
        .order_by(MembershipRequest.requested_at.desc())
    )
    return db.scalars(statement).all()


@router.post(
    "/requests/{request_id}/review",
    response_model=MembershipRequestResponse,
)
def review_request(
    request_id: UUID,
    payload: MembershipReview,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership_request = db.get(MembershipRequest, request_id)
    if membership_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership request not found",
        )

    membership = db.get(
        OrganizationMembership,
        membership_request.membership_id,
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership not found",
        )

    check_organization_membership(
        db,
        user_id=current_user.user_id,
        organization_id=membership.organization_id,
        allowed_roles={"admin"},
    )

    return review_membership_request(
        db,
        request_id=request_id,
        reviewer_id=current_user.user_id,
        approve=payload.approve,
    )
