"""Teammate ke upload endpoint se background mein chalta hai:
    bg.add_task(run_check, department_id)
Request wala DB session tab tak band ho chuka hota hai, isliye naya session khulta hai."""
import logging

from app.notifications.integration import SessionLocal
from app.notifications.service import check_and_notify

logger = logging.getLogger(__name__)


def run_check(dept_id: int) -> None:
    db = SessionLocal()
    try:
        check_and_notify(db, dept_id)
    except Exception:                           # noqa: BLE001
        logger.exception("Notification check failed for department %s", dept_id)
    finally:
        db.close()