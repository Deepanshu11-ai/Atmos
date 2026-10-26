"""AI-assisted carbon-emission analysis of department bills."""

import io
import json
import math
import os
import re
from collections import defaultdict
from datetime import timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pypdf import PdfReader
from sqlalchemy import func, select
from sqlalchemy.orm import Session, load_only

from app.auth import accessible_department, get_current_session
from app.database import Bill, CreditAccount, CreditTransaction, EmissionAnalysis, User, UserSession, get_db

router = APIRouter(prefix="/emissions", tags=["emissions"])
CATEGORIES = {"Electricity", "Natural Gas", "Fuel", "Travel", "Waste", "Water", "Other"}


def require_emissions_viewer(
    current: tuple[User, UserSession] = Depends(get_current_session),
) -> User:
    user, _ = current
    if user.role not in ("admin", "compliance_manager"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Compliance manager role required")
    return user


def target_department(db: Session, viewer: User, requested: int | None) -> int:
    target = requested or viewer.department_id
    if target is None:
        raise HTTPException(status_code=400, detail="A department is required for emissions analytics")
    if viewer.role == "admin":
        accessible_department(db, viewer, target)
    elif target != viewer.department_id:
        raise HTTPException(status_code=403, detail="Emissions belong to another department")
    return target


def foundry_settings() -> tuple[str, str, str] | None:
    endpoint = os.getenv("AZURE_AI_PROJECT_ENDPOINT") or os.getenv("FOUNDRY_PROJECT_ENDPOINT") or os.getenv("PROJECT_ENDPOINT")
    api_key = os.getenv("AZURE_AI_API_KEY") or os.getenv("FOUNDRY_API_KEY") or os.getenv("AZURE_API_KEY")
    model = os.getenv("AZURE_AI_MODEL") or os.getenv("FOUNDRY_MODEL_NAME") or os.getenv("MODEL_NAME")
    if not endpoint or not api_key or not model:
        return None
    parsed = urlsplit(endpoint)
    if parsed.scheme != "https" or not parsed.hostname or not parsed.hostname.endswith(".services.ai.azure.com"):
        raise HTTPException(status_code=500, detail="AZURE_AI_PROJECT_ENDPOINT is not a valid Foundry project endpoint")
    return f"{parsed.scheme}://{parsed.netloc}/openai/v1/", api_key, model


def pdf_text(content: bytes) -> str:
    try:
        pages = PdfReader(io.BytesIO(content)).pages
        text = "\n".join(page.extract_text() or "" for page in pages).strip()
    except Exception as error:
        raise ValueError("The PDF could not be read") from error
    if len(text) < 20:
        raise ValueError("The PDF has no readable text; upload a text-based PDF rather than a scanned image")
    return text[:30000]


def analyze_bill(bill: Bill, settings: tuple[str, str, str]) -> EmissionAnalysis:
    base_url, api_key, model = settings
    text = pdf_text(bill.content)
    prompt = f"""Analyze this utility or operational bill for organizational greenhouse-gas reporting.
Return one JSON object only with these fields:
- billing_period: YYYY-MM (use the bill period; if unavailable use {bill.created_at:%Y-%m})
- category: one of Electricity, Natural Gas, Fuel, Travel, Waste, Water, Other
- usage_value: numeric consumption or null
- usage_unit: short unit or null
- co2e_kg: estimated kilograms CO2e, non-negative
- confidence: number from 0 to 1
- summary: one concise sentence stating the activity, calculation basis, and any assumption
- suggestions: array of exactly 3 concise, practical reduction actions tailored to this bill

Use a recognized emissions factor appropriate to the bill location when available. If location or factor is
missing, make a conservative estimate, state the assumption in summary, and lower confidence. Do not invent
usage if the document does not contain enough information; use 0 CO2e and explain what data is missing.

Filename: {bill.filename}
Bill text:
{text}"""
    payload = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": "You are a careful carbon-accounting analyst. Output valid JSON only."},
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"},
    }).encode("utf-8")
    request = Request(
        f"{base_url}chat/completions",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "api-key": api_key,
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=90) as response:
            service_data = json.loads(response.read())
        raw = service_data["choices"][0]["message"]["content"] or "{}"
    except HTTPError as error:
        try:
            detail = json.loads(error.read()).get("error", {}).get("message")
        except Exception:
            detail = None
        raise ValueError(detail or f"Azure AI request failed ({error.code})") from error
    except (URLError, TimeoutError, KeyError, json.JSONDecodeError) as error:
        raise ValueError("Azure AI did not return a valid response") from error
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as error:
        raise ValueError("The AI model returned an invalid analysis") from error

    period = str(data.get("billing_period", ""))
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", period):
        period = bill.created_at.strftime("%Y-%m")
    category = str(data.get("category", "Other")).strip().title()
    if category not in CATEGORIES:
        category = "Other"
    co2e = max(0.0, float(data.get("co2e_kg") or 0))
    confidence = min(1.0, max(0.0, float(data.get("confidence") or 0)))
    suggestions = [str(item).strip()[:300] for item in data.get("suggestions", []) if str(item).strip()][:3]
    while len(suggestions) < 3:
        suggestions.append("Review this bill with the facilities team and set a measurable reduction target.")
    usage = data.get("usage_value")
    return EmissionAnalysis(
        bill_id=bill.id,
        department_id=bill.department_id,
        billing_period=period,
        category=category,
        usage_value=float(usage) if usage is not None else None,
        usage_unit=str(data.get("usage_unit"))[:30] if data.get("usage_unit") else None,
        co2e_kg=round(co2e, 3),
        confidence=round(confidence, 3),
        summary=str(data.get("summary") or "No analysis summary was returned.")[:1000],
        suggestions=suggestions,
        model_name=model[:100],
    )


def reconcile_carbon_credits(db: Session, analyses: list[EmissionAnalysis], actor_id: int) -> int:
    if not analyses:
        return 0
    credits = math.ceil(sum(item.co2e_kg for item in analyses) / 1000) if analyses else 0
    currently_used = sum(item.credits_used or 0 for item in analyses)
    adjustment = credits - currently_used
    account = db.scalar(
        select(CreditAccount).where(CreditAccount.department_id == analyses[0].department_id).with_for_update()
    )
    if account is None:
        raise ValueError("The department credit account is missing")
    if adjustment > 0 and account.balance < adjustment:
        raise ValueError(
            f"Insufficient carbon credits: {adjustment} additional credits required, {account.balance} available"
        )
    if adjustment:
        account.balance -= adjustment
        db.add(CreditTransaction(
            department_id=analyses[0].department_id,
            actor_id=actor_id,
            amount=-adjustment,
            balance_after=account.balance,
            kind="emission_offset" if adjustment > 0 else "emission_adjustment",
        ))
    for analysis in analyses:
        analysis.credits_used = 0
    if analyses:
        analyses[-1].credits_used = credits
    return credits


def analytics(db: Session, department_id: int) -> dict:
    records = list(db.scalars(
        select(EmissionAnalysis)
        .where(EmissionAnalysis.department_id == department_id)
        .order_by(EmissionAnalysis.billing_period, EmissionAnalysis.created_at)
    ))
    monthly = defaultdict(float)
    categories = defaultdict(float)
    suggestions = []
    seen_suggestions = set()
    for record in records:
        monthly[record.billing_period] += record.co2e_kg
        categories[record.category] += record.co2e_kg
        for suggestion in record.suggestions:
            if suggestion not in seen_suggestions:
                seen_suggestions.add(suggestion)
                suggestions.append(suggestion)
    bill_count = db.scalar(select(func.count()).select_from(Bill).where(Bill.department_id == department_id)) or 0
    latest = max((record.created_at for record in records), default=None)
    total_co2e = sum(record.co2e_kg for record in records)
    credits_used = sum(record.credits_used or 0 for record in records)
    required_credits = math.ceil(total_co2e / 1000) if total_co2e > 0 else 0
    return {
        "total_co2e_kg": round(total_co2e, 2),
        "credits_used": credits_used,
        "pending_credit_applications": int(
            any(record.credits_used is None for record in records) or credits_used != required_credits
        ),
        "analyzed_bills": len(records),
        "pending_bills": max(0, bill_count - len(records)),
        "monthly": [{"period": key, "co2e_kg": round(value, 2)} for key, value in sorted(monthly.items())],
        "categories": [{"category": key, "co2e_kg": round(value, 2)} for key, value in sorted(categories.items(), key=lambda item: item[1], reverse=True)],
        "suggestions": suggestions[:8],
        "records": [{
            "id": str(record.id), "bill_id": str(record.bill_id), "billing_period": record.billing_period,
            "category": record.category, "usage_value": record.usage_value, "usage_unit": record.usage_unit,
            "co2e_kg": record.co2e_kg, "credits_used": record.credits_used or 0,
            "confidence": record.confidence, "summary": record.summary,
        } for record in reversed(records)],
        "last_updated": latest.astimezone(timezone.utc).isoformat() if latest else None,
        "ai_configured": foundry_settings() is not None,
    }


@router.get("")
def emissions_dashboard(
    department_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
    viewer: User = Depends(require_emissions_viewer),
) -> dict:
    return analytics(db, target_department(db, viewer, department_id))


@router.post("/analyze")
def analyze_pending_bills(
    department_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
    viewer: User = Depends(require_emissions_viewer),
) -> dict:
    target = target_department(db, viewer, department_id)
    errors = []
    existing = list(db.scalars(
        select(EmissionAnalysis)
        .where(EmissionAnalysis.department_id == target)
        .order_by(EmissionAnalysis.created_at)
    ))
    expected_credits = math.ceil(sum(item.co2e_kg for item in existing) / 1000) if existing else 0
    if existing and (
        any(item.credits_used is None for item in existing)
        or sum(item.credits_used or 0 for item in existing) != expected_credits
    ):
        try:
            reconcile_carbon_credits(db, existing, viewer.user_id)
            db.commit()
        except Exception as error:
            db.rollback()
            errors.append({"bill_id": "", "filename": "Existing emissions total", "error": str(error)[:300]})

    analyzed_ids = select(EmissionAnalysis.bill_id)
    bills = list(db.scalars(
        select(Bill)
        .options(load_only(Bill.id, Bill.department_id, Bill.filename, Bill.content, Bill.created_at))
        .where(Bill.department_id == target, Bill.id.not_in(analyzed_ids))
        .order_by(Bill.created_at)
        .limit(5)
    ))
    settings = foundry_settings()
    if bills and settings is None:
        raise HTTPException(
            status_code=503,
            detail="Configure AZURE_AI_PROJECT_ENDPOINT, AZURE_AI_API_KEY, and AZURE_AI_MODEL on the backend",
        )
    for bill in bills:
        try:
            analysis = analyze_bill(bill, settings)
            db.add(analysis)
            db.flush()
            department_analyses = list(db.scalars(
                select(EmissionAnalysis)
                .where(EmissionAnalysis.department_id == target)
                .order_by(EmissionAnalysis.created_at)
            ))
            reconcile_carbon_credits(db, department_analyses, viewer.user_id)
            db.commit()
        except Exception as error:
            db.rollback()
            errors.append({"bill_id": str(bill.id), "filename": bill.filename, "error": str(error)[:300]})
    result = analytics(db, target)
    result["processed"] = len(bills) - len([error for error in errors if error["filename"] != "Existing emissions total"])
    result["errors"] = errors
    return result
