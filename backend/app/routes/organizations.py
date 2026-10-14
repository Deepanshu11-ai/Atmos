
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.dependencies.authentication import get_current_user
from app.dependencies.permissions import check_organization_membership
from app.models.membership import OrganizationMembership
from app.models.organization import Organization
from app.models.user import User
from app.services.membership_service import create_organization

router = APIRouter(prefix="/organizations", tags=["Organizations"])


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class OrganizationResponse(BaseModel):
    id: UUID
    name: str

    model_config = {"from_attributes": True}


class OrganizationMemberResponse(BaseModel):
    user_id: int
    name: str
    email: str
    role: str
    status: str


@router.post(
    "",
    response_model=OrganizationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_organization_endpoint(
    payload: OrganizationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_organization(
        db,
        name=payload.name,
        creator_id=current_user.user_id,
    )


@router.get(
    "/{organization_id}",
    response_model=OrganizationResponse,
)
def get_organization(
    organization_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_organization_membership(
        db,
        user_id=current_user.user_id,
        organization_id=organization_id,
    )

    organization = db.get(Organization, organization_id)

    if organization is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    return organization


@router.get(
    "/{organization_id}/members",
    response_model=list[OrganizationMemberResponse],
)
def list_organization_members(
    organization_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_organization_membership(
        db,
        user_id=current_user.user_id,
        organization_id=organization_id,
        allowed_roles={"admin"},
    )

    statement = (
        select(
            User.user_id,
            User.name,
            User.email,
            OrganizationMembership.role,
            OrganizationMembership.status,
        )
        .join(
            OrganizationMembership,
            OrganizationMembership.user_id == User.user_id,
        )
        .where(
            OrganizationMembership.organization_id == organization_id,
        )
        .order_by(User.name)
    )

    rows = db.execute(statement).mappings().all()
    return [dict(row) for row in rows]
