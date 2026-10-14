"""Real database se integration check. Kuch bhejta NAHI, sirf dikhata hai.
Run (backend/ se, .env mein USE_STUBS=false):   python -m scripts.check_integration"""
from collections import Counter

from sqlalchemy import select

from app.models.user import User
from app.notifications.adapters import all_department_ids, get_budget_status, get_recipients
from app.notifications.config import settings
from app.notifications.database import SessionLocal
from app.notifications.rules import get_level


def mask_email(e: str | None) -> str:
    if not e or "@" not in e:
        return "-"
    name, _, domain = e.partition("@")
    return f"{name[:2]}***@{domain}"


def main() -> None:
    if settings.USE_STUBS:
        raise SystemExit("USE_STUBS=false karo (.env mein), phir dobara chalao.")
    db = SessionLocal()
    try:
        users = db.scalars(select(User)).all()
        print("Roles in DB     :", dict(Counter(u.role for u in users)))
        print("ADMIN_ROLES     :", settings.ADMIN_ROLES)
        print("MANAGER_ROLES   :", settings.MANAGER_ROLES)
        print("BUDGET_PERIOD   :", settings.BUDGET_PERIOD, "| UNIT:", settings.BUDGET_UNIT)
        print()
        for dept_id in all_department_ids(db):
            s = get_budget_status(db, dept_id)
            level = "NOT_SET" if s["budget"] is None else get_level(s["budget"], s["used"]).name
            print(f'Dept {dept_id} "{s["dept_name"]}": budget={s["budget"]} used={s["used"]} -> {level}')
            for lvl, label in ((1, "WARNING"), (3, "EXCEEDED")):
                who = [f'{r.name} <{mask_email(r.email)}> wa={"yes" if r.phone and r.whatsapp_opt_in else "no"}'
                       for r in get_recipients(db, dept_id, lvl)]
                print(f"    {label:9} -> {who or 'KOI RECIPIENT NAHI'}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
