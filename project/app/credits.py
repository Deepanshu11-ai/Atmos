"""Department credit catalog, Razorpay purchases, spending, and audit history."""

import base64
import hashlib
import hmac
import json
import os
from datetime import datetime, timezone
from typing import Literal
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import accessible_department, get_current_session, require_admin
from app.database import CreditAccount, CreditPurchase, CreditTransaction, Department, User, UserSession, get_db

router = APIRouter(tags=["credits"])

PLANS = {
    "starter": {"credits": 100, "price_cents": 99900, "currency": "INR"},
    "growth": {"credits": 500, "price_cents": 399900, "currency": "INR"},
    "scale": {"credits": 2000, "price_cents": 1299900, "currency": "INR"},
}


class PurchaseRequest(BaseModel):
    plan: Literal["starter", "growth", "scale"]
    department_id: int | None = Field(default=None, gt=0)


class PurchaseVerificationRequest(BaseModel):
    razorpay_order_id: str = Field(min_length=1, max_length=64)
    razorpay_payment_id: str = Field(min_length=1, max_length=64)
    razorpay_signature: str = Field(min_length=1, max_length=256)


class PurchaseOrderResponse(BaseModel):
    key_id: str
    order_id: str
    amount: int
    currency: str
    plan: str
    credits: int


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


def razorpay_credentials() -> tuple[str, str]:
    key_id = os.getenv("RAZORPAY_KEY_ID") or os.getenv("Test_API_Key") or os.getenv("Test_API_key")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET") or os.getenv("Test_Key_Secret")
    if not key_id or not key_secret:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Razorpay is not configured")
    return key_id, key_secret


def razorpay_request(method: str, path: str, payload: dict | None = None) -> dict:
    key_id, key_secret = razorpay_credentials()
    authorization = base64.b64encode(f"{key_id}:{key_secret}".encode()).decode()
    body = json.dumps(payload).encode() if payload is not None else None
    request = Request(
        f"https://api.razorpay.com/v1/{path}",
        data=body,
        method=method,
        headers={"Authorization": f"Basic {authorization}", "Content-Type": "application/json"},
    )
    try:
        with urlopen(request, timeout=15) as response:
            return json.loads(response.read())
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=502, detail="Razorpay could not process the payment request") from exc


def create_razorpay_order(payload: dict) -> dict:
    return razorpay_request("POST", "orders", payload)


def fetch_razorpay_payment(payment_id: str) -> dict:
    return razorpay_request("GET", f"payments/{quote(payment_id, safe='')}")


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


@router.post("/admin/credits/purchases", response_model=PurchaseOrderResponse, status_code=status.HTTP_201_CREATED)
def create_purchase_order(
    payload: PurchaseRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> PurchaseOrderResponse:
    plan = PLANS[payload.plan]
    target = payload.department_id or admin.department_id
    if target is None:
        raise HTTPException(status_code=400, detail="Create a department before purchasing credits")
    accessible_department(db, admin, target)
    key_id, _ = razorpay_credentials()
    purchase_id = UUID(bytes=os.urandom(16))
    order = create_razorpay_order({
        "amount": plan["price_cents"],
        "currency": plan["currency"],
        "receipt": purchase_id.hex,
        "notes": {"plan": payload.plan, "department_id": str(target)},
        "payment_capture": 1,
    })
    order_id = order.get("id")
    if not isinstance(order_id, str) or not order_id:
        raise HTTPException(status_code=502, detail="Razorpay returned an invalid order")
    purchase = CreditPurchase(
        id=purchase_id,
        razorpay_order_id=order_id,
        department_id=target,
        actor_id=admin.user_id,
        plan=payload.plan,
        credits=plan["credits"],
        amount=plan["price_cents"],
        currency=plan["currency"],
    )
    db.add(purchase)
    db.commit()
    return PurchaseOrderResponse(
        key_id=key_id,
        order_id=order_id,
        amount=purchase.amount,
        currency=purchase.currency,
        plan=purchase.plan,
        credits=purchase.credits,
    )


@router.post("/admin/credits/purchases/verify", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def verify_purchase(
    payload: PurchaseVerificationRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> CreditTransaction:
    purchase = db.scalar(select(CreditPurchase).where(
        CreditPurchase.razorpay_order_id == payload.razorpay_order_id
    ))
    if purchase is None or purchase.actor_id != admin.user_id:
        raise HTTPException(status_code=404, detail="Payment order not found")
    accessible_department(db, admin, purchase.department_id)
    _, key_secret = razorpay_credentials()
    expected = hmac.new(
        key_secret.encode(),
        f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, payload.razorpay_signature):
        raise HTTPException(status_code=400, detail="Payment signature is invalid")

    payment = fetch_razorpay_payment(payload.razorpay_payment_id)
    if (
        payment.get("id") != payload.razorpay_payment_id
        or payment.get("order_id") != purchase.razorpay_order_id
        or payment.get("amount") != purchase.amount
        or payment.get("currency") != purchase.currency
        or payment.get("status") != "captured"
    ):
        raise HTTPException(status_code=409, detail="Payment has not been captured for this order")

    purchase = db.scalar(
        select(CreditPurchase).where(CreditPurchase.id == purchase.id).with_for_update()
    )
    if purchase.status == "paid" and purchase.transaction_id is not None:
        transaction = db.get(CreditTransaction, purchase.transaction_id)
        if transaction is not None:
            return transaction
    existing_payment = db.scalar(select(CreditPurchase.id).where(
        CreditPurchase.razorpay_payment_id == payload.razorpay_payment_id,
        CreditPurchase.id != purchase.id,
    ))
    if existing_payment is not None:
        raise HTTPException(status_code=409, detail="Payment has already been applied")

    account = locked_account(db, purchase.department_id)
    account.balance += purchase.credits
    transaction = CreditTransaction(
        department_id=purchase.department_id,
        actor_id=admin.user_id,
        kind="purchase",
        amount=purchase.credits,
        balance_after=account.balance,
        plan=purchase.plan,
        price_cents=purchase.amount,
        currency=purchase.currency,
    )
    db.add(transaction)
    db.flush()
    purchase.razorpay_payment_id = payload.razorpay_payment_id
    purchase.transaction_id = transaction.id
    purchase.status = "paid"
    purchase.paid_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(transaction)
    return transaction


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
