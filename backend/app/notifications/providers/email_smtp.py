import smtplib
from email.message import EmailMessage

from app.notifications.config import settings


def send_email(to: str, subject: str, html: str) -> str:
    msg = EmailMessage()
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content("Please open this email in an HTML-supported client.")
    msg.add_alternative(html, subtype="html")

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)
    return "smtp-ok"