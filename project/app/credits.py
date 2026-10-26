"""Department credit catalog, purchases, balance, spending, and audit history."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import accessible_department, get_current_session, require_admin
from app.database import CreditAccount, CreditTransaction, Department, User, UserSession, get_db

router = APIRouter(tags=["credits"])

# Demo prices; no external payment is charged by this API.
PLANS = {
    "starter": {"credits": 100, "price_cents": 99900, "currency": "INR"},
    "growth": {"credits": 500, "price_cents": 399900, "currency": "INR"},
    "scale": {"credits": 2000, "price_cents": 1299900, "currency": "INR"},
}


class PurchaseRequest(BaseModel):
    plan: Literal["starter", "growth", "scale"]
    department_id: int | None = Field(default=None, gt=0)


class SpendRequest(BaseModel):
    credits: int = Field(gt=0, le=100000)


class TransferRequest(BaseModel):
    from_department_id: int = Field(gt=0)
    to_department_id: int = Field(gt=0)
    credits: int = Field(gt=0, le=100000)


class BalanceResponse(BaseModel):
    department_id: int
    department_name: str
    balance: int


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    department_id: int
    actor_id: int
    kind: str
    amount: int
    balance_after: int
    plan: str | None
    price_cents: int | None
    currency: str | None
    created_at: datetime


def locked_account(db: Session, department_id: int) -> CreditAccount:
    account = db.scalar(
        select(CreditAccount).where(CreditAccount.department_id == department_id).with_for_update()
    )
    if account is None:
        raise HTTPException(status_code=500, detail="Department credit account is missing")
    return account


@router.get("/credits/plans")
def list_plans() -> dict[str, dict[str, int | str]]:
    return PLANS


@router.get("/credits/balance", response_model=BalanceResponse)
def credit_balance(
    department_id: int | None = Query(default=None, gt=0),
    current: tuple[User, UserSession] = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> BalanceResponse:
    user, _ = current
    target = department_id or user.department_id
    if target is None:
        raise HTTPException(status_code=400, detail="Create a department before viewing credits")
    if target != user.department_id:
        if user.role != "admin":
            raise HTTPException(status_code=403, detail="Department is not managed by this account")
        accessible_department(db, user, target)
    account = db.scalar(select(CreditAccount).where(CreditAccount.department_id == target))
    department = db.get(Department, target)
    if account is None or department is None:
        raise HTTPException(status_code=500, detail="Department credit account is missing")
    return BalanceResponse(department_id=department.id, department_name=department.name, balance=account.balance)


@router.post("/admin/credits/purchases", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def purchase_credits(
    payload: PurchaseRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> CreditTransaction:
    plan = PLANS[payload.plan]
    target = payload.department_id or admin.department_id
    if target is None:
        raise HTTPException(status_code=400, detail="Create a department before purchasing credits")
    accessible_department(db, admin, target)
    account = locked_account(db, target)
    account.balance += plan["credits"]
    purchase = CreditTransaction(
        department_id=target,
        actor_id=admin.user_id,
        kind="purchase",
        amount=plan["credits"],
        balance_after=account.balance,
        plan=payload.plan,
        price_cents=plan["price_cents"],
        currency=plan["currency"],
    )
    db.add(purchase)
    db.commit()
    db.refresh(purchase)
    return purchase


@router.post("/credits/spend", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def spend_credits(
    payload: SpendRequest,
    current: tuple[User, UserSession] = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> CreditTransaction:
    user, _ = current
    if user.department_id is None:
        raise HTTPException(status_code=400, detail="Create a department before spending credits")
    account = locked_account(db, user.department_id)
    if account.balance < payload.credits:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Insufficient credits")
    account.balance -= payload.credits
    transaction = CreditTransaction(
        department_id=user.department_id,
        actor_id=user.user_id,
        kind="spend",
        amount=-payload.credits,
        balance_after=account.balance,
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction


@router.post("/admin/credits/transfers", response_model=list[TransactionResponse], status_code=status.HTTP_201_CREATED)
def transfer_credits(
    payload: TransferRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> list[CreditTransaction]:
    """Move shared credits between two departments managed by this admin."""
    source_id, destination_id = payload.from_department_id, payload.to_department_id
    if source_id == destination_id:
        raise HTTPException(status_code=400, detail="Choose two different departments")
    accessible_department(db, admin, source_id)
    accessible_department(db, admin, destination_id)
    # Lock in a stable order to avoid opposing transfers deadlocking.
    first_id, second_id = sorted((source_id, destination_id))
    accounts = {first_id: locked_account(db, first_id), second_id: locked_account(db, second_id)}
    source, destination = accounts[source_id], accounts[destination_id]
    if source.balance < payload.credits:
        raise HTTPException(status_code=409, detail="Insufficient credits in the source department")
    source.balance -= payload.credits
    destination.balance += payload.credits
    outgoing = CreditTransaction(
        department_id=source_id, actor_id=admin.user_id, kind="transfer_out",
        amount=-payload.credits, balance_after=source.balance,
    )
    incoming = CreditTransaction(
        department_id=destination_id, actor_id=admin.user_id, kind="transfer_in",
        amount=payload.credits, balance_after=destination.balance,
    )
    db.add_all((outgoing, incoming))
    db.commit()
    db.refresh(outgoing)
    db.refresh(incoming)
    return [outgoing, incoming]


@router.get("/admin/credits/transactions", response_model=list[TransactionResponse])
def credit_history(
    department_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> list[CreditTransaction]:
    target = department_id or admin.department_id
    if target is None:
        raise HTTPException(status_code=400, detail="Create a department before viewing transactions")
    accessible_department(db, admin, target)
    return list(db.scalars(
        select(CreditTransaction)
        .where(CreditTransaction.department_id == target)
        .order_by(CreditTransaction.created_at.desc(), CreditTransaction.id.desc())
    ))
