from app.notifications import service
from app.notifications.config import settings
from app.notifications.dev_stubs import FAKE_DEPTS, set_fake_usage
from app.notifications.models import AlertState, Notification


def _fake_providers(monkeypatch):
    calls = {"email": 0, "whatsapp": 0, "wa_params": []}

    def fake_email(*a, **k):
        calls["email"] += 1
        return "fake-email-id"

    def fake_wa(to, body=None, template_params=None):
        calls["whatsapp"] += 1
        calls["wa_params"].append(template_params)
        return "fake-wa-id"

    monkeypatch.setattr(service, "send_email", fake_email)
    monkeypatch.setattr(service, "send_whatsapp", fake_wa)
    return calls


def test_ok_department_sends_nothing(db, monkeypatch):
    calls = _fake_providers(monkeypatch)
    assert service.check_and_notify(db, 2)["sent"] == 0      # D2: 200/1000
    assert calls["email"] == 0 and calls["whatsapp"] == 0


def test_escalation_and_no_spam(db, monkeypatch):
    calls = _fake_providers(monkeypatch)

    assert service.check_and_notify(db, 3)["sent"] == 2      # 700 -> WARNING (manager)
    assert service.check_and_notify(db, 3)["sent"] == 0      # same level, spam nahi

    set_fake_usage(3, 900)
    assert service.check_and_notify(db, 3)["sent"] == 2      # CRITICAL

    set_fake_usage(3, 1000)
    assert service.check_and_notify(db, 3)["sent"] == 4      # EXCEEDED (manager + admin)

    assert calls["email"] == 4 and calls["whatsapp"] == 4
    assert db.query(Notification).count() == 8


def test_whatsapp_gets_four_template_variables(db, monkeypatch):
    calls = _fake_providers(monkeypatch)
    service.check_and_notify(db, 3)                           # D3 WARNING
    assert calls["wa_params"][0] == [
        "Carbon budget advisory", "D3", "70", f"300 {settings.BUDGET_UNIT}"]


def test_reset_when_budget_refilled(db, monkeypatch):
    _fake_providers(monkeypatch)
    service.check_and_notify(db, 3)                           # WARNING
    set_fake_usage(3, 100)                                    # credits mil gaye
    service.check_and_notify(db, 3)
    assert db.get(AlertState, 3).last_level == 0

    set_fake_usage(3, 750)                                    # phir WARNING par aaya
    assert service.check_and_notify(db, 3)["sent"] == 2


def test_no_budget_set_is_skipped(db, monkeypatch):
    calls = _fake_providers(monkeypatch)
    FAKE_DEPTS[3]["budget"] = None
    result = service.check_and_notify(db, 3)
    assert result["level"] == "NOT_SET" and result["sent"] == 0
    assert calls["email"] == 0


def test_failed_send_is_logged_not_raised(db, monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("provider down")

    monkeypatch.setattr(service, "send_email", boom)
    monkeypatch.setattr(service, "send_whatsapp", boom)
    assert service.check_and_notify(db, 3)["sent"] == 0
    assert db.query(Notification).filter_by(status="failed").count() == 2
