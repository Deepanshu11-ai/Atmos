from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from app.notifications import listeners  # noqa: F401  (bills par auto-trigger register karta hai)
from app.notifications.config import settings
from app.notifications.integeration import (
    all_department_ids,
    get_budget_status,
    get_db,
    is_admin,
    require_role,
    set_budget,
)
from app.notifications.models import Notification
from app.notifications.providers.email_sender import send_email
from app.notifications.providers.whatsapp import send_whatsapp
from app.notifications.rules import get_level
from app.notifications.service import check_and_notify
from app.notifications.templates import build_message, build_whatsapp, to_html, whatsapp_params

router = APIRouter(prefix="/notifications", tags=["Notifications"])

TEST_CTX = dict(name="Test User", dept="TEST", pct=70, remaining=300, used=700, budget=1000)


class TestIn(BaseModel):
    email: str | None = None
    phone: str | None = None


class BudgetIn(BaseModel):
    budget_limit: float = Field(gt=0, description="Department ka carbon budget")


def _user_id(user):
    return getattr(user, "user_id", None) or getattr(user, "id", None)


@router.get("/health")
def health():
    return {"success": True, "data": {
        "status": "notifications ok",
        "email_provider": settings.EMAIL_PROVIDER,
        "whatsapp_provider": settings.WHATSAPP_PROVIDER,
        "whatsapp_mode": "template" if settings.TWILIO_CONTENT_SID else "free-form",
        "tone": settings.ALERT_TONE,
        "stubs": settings.USE_STUBS,
        "auto_trigger": settings.AUTO_TRIGGER and not settings.USE_STUBS,
        "budget_period": settings.BUDGET_PERIOD,
    }}


@router.post("/test")
def send_test(body: TestIn, user=Depends(require_role("admin"))):
    """Admin: ek test email/WhatsApp bhejo (setup check karne ke liye)."""
    result = {}
    if body.email:
        try:
            subject, text = build_message(settings.ALERT_TONE, "WARNING", TEST_CTX)
            result["email"] = send_email(
                body.email, subject, to_html(subject, text, "WARNING", TEST_CTX))
        except Exception as e:                  # noqa: BLE001
            result["email_error"] = str(e)[:300]
    if body.phone:
        try:
            result["whatsapp"] = send_whatsapp(
                body.phone, build_whatsapp("WARNING", TEST_CTX),
                template_params=whatsapp_params("WARNING", TEST_CTX))
        except Exception as e:                  # noqa: BLE001
            result["whatsapp_error"] = str(e)[:300]
    return {"success": True, "data": result}


@router.get("/budgets")
def budgets_overview(db=Depends(get_db), user=Depends(require_role("admin", "manager"))):
    """Har department ka budget, usage aur level (dashboard cards ke liye).
    Manager ko sirf apna department dikhta hai."""
    dept_ids = all_department_ids(db)
    if not is_admin(user):
        dept_ids = [d for d in dept_ids if d == getattr(user, "department_id", None)]

    data = []
    for dept_id in dept_ids:
        s = get_budget_status(db, dept_id)
        row = {"department_id": dept_id, "dept_name": s["dept_name"], "budget": s["budget"],
               "used": s["used"], "remaining": s["remaining"], "unit": settings.BUDGET_UNIT}
        if s["budget"] is None:
            row.update(pct=None, level="NOT_SET")
        else:
            row.update(pct=round(s["used"] / s["budget"] * 100, 1) if s["budget"] else None,
                       level=get_level(s["budget"], s["used"]).name)
        data.append(row)
    return {"success": True, "data": data}


@router.put("/budgets/{dept_id}")
def update_budget(dept_id: int, body: BudgetIn, db=Depends(get_db),
                  user=Depends(require_role("admin"))):
    """Admin: department ka budget set/badlo. Turant status dobara check hota hai
    (budget badhne par alerts reset, kam hone par naye alerts)."""
    if dept_id not in all_department_ids(db):
        raise HTTPException(status_code=404, detail="Department not found")
    set_budget(db, dept_id, body.budget_limit, _user_id(user))
    return {"success": True, "data": check_and_notify(db, dept_id)}


@router.post("/check/{dept_id}")
def check_one(dept_id: int, db=Depends(get_db), user=Depends(require_role("admin"))):
    return {"success": True, "data": check_and_notify(db, dept_id)}


@router.post("/check-all")
def check_all(x_cron_secret: str = Header(...), db=Depends(get_db)):
    """Cron job ke liye (header: X-Cron-Secret). Backup safety net."""
    if x_cron_secret != settings.CRON_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")
    return {"success": True, "data": [check_and_notify(db, d) for d in all_department_ids(db)]}


@router.get("")
def history(
    limit: int = 50,
    dept_id: int | None = None,
    status: str | None = None,
    db=Depends(get_db),
    user=Depends(require_role("admin", "manager")),
):
    q = db.query(Notification)
    if not is_admin(user):                       # Manager sirf apne department ke alerts dekhe
        q = q.filter(Notification.department_id == getattr(user, "department_id", None))
    elif dept_id is not None:
        q = q.filter(Notification.department_id == dept_id)
    if status:
        q = q.filter(Notification.status == status)
    rows = q.order_by(Notification.id.desc()).limit(min(limit, 200)).all()
    return {"success": True, "data": [
        {"id": r.id, "department_id": r.department_id, "channel": r.channel,
         "level": r.level, "status": r.status, "subject": r.subject,
         "error": r.error, "created_at": r.created_at}
        for r in rows
    ]}


# Sirf stub mode mein: fake usage set karke turant alert chalao
if settings.USE_STUBS:
    from app.notifications.dev_stubs import set_fake_usage

    @router.post("/dev/simulate")
    def simulate(dept_id: int, used: float, db=Depends(get_db)):
        set_fake_usage(dept_id, used)
        return {"success": True, "data": check_and_notify(db, dept_id)}
