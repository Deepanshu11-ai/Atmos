"""Main logic: budget dekho, level nikalo, sahi logon ko email/WhatsApp bhejo,
aur spam na ho isliye state yaad rakho.
Note: Notification.status 'sent' ka matlab provider ne message accept kiya, delivered nahi."""
from datetime import datetime, timedelta, timezone

from app.notifications.config import settings
from app.notifications.integeration import get_budget_status, get_recipients
from app.notifications.models import AlertState, Notification
from app.notifications.providers.email_sender import send_email
from app.notifications.providers.whatsapp import send_whatsapp
from app.notifications.rules import Level, get_level
from app.notifications.templates import build_message, build_whatsapp, to_html, whatsapp_params


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _num(x) -> int | float:
    """300.0 -> 300, 812.456 -> 812.46 (messages mein saaf dikhne ke liye)."""
    f = float(x)
    return int(f) if f.is_integer() else round(f, 2)


def _reminder_due(state: AlertState, level: Level) -> bool:
    """EXCEEDED mein har REMINDER_HOURS baad dobara yaad dilao."""
    if level != Level.EXCEEDED or state.last_notified_at is None:
        return False
    last = state.last_notified_at
    if last.tzinfo is None:                     # SQLite naive datetime deta hai
        last = last.replace(tzinfo=timezone.utc)
    return _utcnow() - last > timedelta(hours=settings.REMINDER_HOURS)


def _deliver(db, dept_id, user, channel, level, subject, body, ctx) -> bool:
    """Ek message bhejo aur result DB mein likho. Fail hone par crash nahi, status=failed."""
    n = Notification(
        department_id=dept_id, user_id=user.id, channel=channel,
        level=level.name, tone=settings.ALERT_TONE,
        subject=subject if channel == "email" else None,
        body=body, status="pending",
    )
    db.add(n)
    db.commit()
    try:
        if channel == "email":
            n.provider_id = send_email(
                user.email, subject, to_html(subject, body, level.name, ctx))
        else:
            n.provider_id = send_whatsapp(
                user.phone, body, template_params=whatsapp_params(level.name, ctx))
        n.status = "sent"
    except Exception as e:                      # noqa: BLE001
        n.status = "failed"
        n.error = str(e)[:500]
    db.commit()
    return n.status == "sent"


def check_and_notify(db, dept_id: int) -> dict:
    s = get_budget_status(db, dept_id)

    # Budget set hi nahi hai: na alert, na state change
    if s["budget"] is None:
        return {"department_id": dept_id, "level": "NOT_SET", "sent": 0,
                "reason": "no budget set"}

    level = get_level(s["budget"], s["used"])
    state = db.get(AlertState, dept_id) or AlertState(department_id=dept_id, last_level=0)

    # Sab theek hai ya budget refill hua (level neeche aaya): chupchaap reset
    if level == Level.OK or int(level) < (state.last_level or 0):
        state.last_level = int(level)
        db.merge(state)
        db.commit()
        return {"department_id": dept_id, "level": level.name, "sent": 0}

    # Same level par dobara alert nahi (sirf EXCEEDED mein reminder)
    if int(level) == (state.last_level or 0) and not _reminder_due(state, level):
        return {"department_id": dept_id, "level": level.name, "sent": 0,
                "reason": "already notified"}

    pct = round(s["used"] / s["budget"] * 100) if s["budget"] else 100
    remaining = _num(max(s["budget"] - s["used"], 0))
    sent = 0

    for user in get_recipients(db, dept_id, int(level)):
        ctx = dict(name=user.name, dept=s["dept_name"], pct=pct, remaining=remaining,
                   used=_num(s["used"]), budget=_num(s["budget"]))
        subject, email_body = build_message(settings.ALERT_TONE, level.name, ctx)
        wa_text = build_whatsapp(level.name, ctx)

        if getattr(user, "email", None):
            sent += _deliver(db, dept_id, user, "email", level, subject, email_body, ctx)
        if getattr(user, "phone", None) and getattr(user, "whatsapp_opt_in", False):
            sent += _deliver(db, dept_id, user, "whatsapp", level, subject, wa_text, ctx)

    state.last_level = int(level)
    state.last_notified_at = _utcnow()
    db.merge(state)
    db.commit()
    return {"department_id": dept_id, "level": level.name, "sent": sent}
