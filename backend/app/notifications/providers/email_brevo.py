import httpx

from app.notifications.config import settings


def send_email(to: str, subject: str, html: str) -> str:
    # EMAIL_FROM format: "Name <mail@domain.com>"; Brevo mein sender verify hona chahiye
    name, _, rest = settings.EMAIL_FROM.partition("<")
    sender = {"name": name.strip() or "Atmos", "email": rest.rstrip(">").strip()}
    r = httpx.post(
        "https://api.brevo.com/v3/smtp/email",
        headers={"api-key": settings.BREVO_API_KEY},
        json={"sender": sender, "to": [{"email": to}], "subject": subject, "htmlContent": html},
        timeout=15,
    )
    r.raise_for_status()
    return r.json().get("messageId", "brevo-ok")