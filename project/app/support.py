"""Guardrailed, task-focused in-product help for Atmos users.

This is deliberately a workflow assistant, not a general-purpose AI agent. It
does not receive bill contents, account balances, payment data, credentials, or
other department data, and it cannot trigger product actions.
"""

from collections import defaultdict, deque
from time import monotonic
import re

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.auth import get_current_session
from app.database import User, UserSession

router = APIRouter(prefix="/support", tags=["support"])

MAX_MESSAGE_LENGTH = 500
RATE_WINDOW_SECONDS = 60
RATE_LIMIT = 12
requests_by_user: dict[int, deque[float]] = defaultdict(deque)

SENSITIVE_INPUT = re.compile(
    r"\b(?:password|passcode|api[ _-]?key|secret|access[ _-]?token|bearer|"
    r"razorpay[ _-]?(?:key|secret)|card[ _-]?number|cvv|otp|one[ _-]?time[ _-]?code)\b",
    re.IGNORECASE,
)
INJECTION_ATTEMPT = re.compile(
    r"(?:ignore (?:all |previous |the )?instructions|system prompt|developer message|"
    r"reveal (?:your |the )?(?:prompt|instructions)|jailbreak)",
    re.IGNORECASE,
)


class SupportMessage(BaseModel):
    message: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)


def allowed_message(user: User, message: str) -> str:
    normalized = " ".join(message.split())
    if not normalized:
        raise HTTPException(status_code=422, detail="Enter a question about using Atmos.")
    if SENSITIVE_INPUT.search(normalized):
        raise HTTPException(
            status_code=422,
            detail="For your security, do not send passwords, API keys, payment-card details, OTPs, or access tokens here.",
        )
    if INJECTION_ATTEMPT.search(normalized):
        raise HTTPException(status_code=422, detail="Atmos Help can only answer questions about using this workspace.")
    now = monotonic()
    recent = requests_by_user[user.user_id]
    while recent and now - recent[0] >= RATE_WINDOW_SECONDS:
        recent.popleft()
    if len(recent) >= RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Please wait a minute before sending more help questions.")
    recent.append(now)
    return normalized.lower()


def answer_for(message: str, role: str) -> tuple[str, str | None, str | None]:
    """Return an allow-listed help answer and optionally a safe navigation cue."""
    if any(term in message for term in ("bill", "upload", "pdf", "google drive")):
        allowed = role in {"admin", "data_officer"}
        text = "Open Bills, choose a PDF or Add from Google Drive, then upload it. Files stay with the selected department. PDFs must be 10 MB or smaller."
        if not allowed:
            text = "Bill upload is available to department admins and Data Officers. Ask a workspace administrator to upload the source PDF."
        return text, "bills" if allowed else None, "Open Bills" if allowed else None
    if any(term in message for term in ("emission", "analyse", "analyze", "carbon", "co2", "footprint")):
        if role not in {"admin", "compliance_manager"}:
            return "Emissions analysis is available to department admins and Compliance Managers. Ask one of them to review your department’s uploaded bills.", None, None
        return "Open Emissions, then choose Analyze pending bills. Atmos reads uploaded bill evidence, estimates emissions by period and source, and shows reduction suggestions. Review estimates before formal reporting.", "emissions", "Open Emissions"
    if any(term in message for term in ("credit", "buy", "purchase", "payment", "pay", "pack", "razorpay")):
        if role != "admin":
            return "Only a department admin can purchase credit packs or manage payments. You can view your department’s available credit balance in the workspace.", None, None
        return "Open Buy credits, select a pack, and complete the secure checkout. Credits are added only after payment verification. Atmos Help cannot take payment details or complete purchases for you.", "purchase", "Open Buy credits"
    if any(term in message for term in ("report", "email", "download")):
        if role not in {"admin", "compliance_manager"}:
            return "Reports are available to department admins and Compliance Managers. They include credit usage, bill analysis, and verified payment activity.", None, None
        return "Open Emissions and use Download report for a PDF or Email report to send the PDF to your signed-in email address. The report covers credit usage, analyzed bills, and verified payments.", "emissions", "Open Emissions"
    if any(term in message for term in ("team", "member", "invite", "department", "transfer")):
        if role != "admin":
            return "Department and team administration is available to department admins. Ask an admin to add members, create departments, or transfer credits.", None, None
        return "Use Team members to invite a Data Officer or Compliance Manager. Use Departments to create managed departments and transfer available credits between departments you own.", "team", "Open Team members"
    if any(term in message for term in ("login", "sign in", "password", "account", "access")):
        return "Never share passwords, one-time codes, payment details, API keys, or access tokens in chat. Use the sign-in page for account access; contact your workspace administrator if your role or department access is wrong.", None, None
    return "I can help with uploading bills, emissions analysis, credit packs, reports, payments, team access, and departments. I cannot access private records, handle payments, change settings, or provide legal, financial, or formal compliance advice. What would you like to do?", None, None


@router.post("/chat")
def support_chat(
    payload: SupportMessage,
    current: tuple[User, UserSession] = Depends(get_current_session),
) -> dict[str, str | None]:
    user, _ = current
    message = allowed_message(user, payload.message)
    answer, route, action_label = answer_for(message, user.role)
    return {"answer": answer, "route": route, "action_label": action_label}
