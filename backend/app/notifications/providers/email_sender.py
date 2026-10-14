from app.notifications.config import settings


def send_email(to: str, subject: str, html: str) -> str:
    if settings.EMAIL_PROVIDER == "brevo":
        from app.notifications.providers.email_brevo import send_email as send
    else:
        from app.notifications.providers.email_smtp import send_email as send
    return send(to, subject, html)