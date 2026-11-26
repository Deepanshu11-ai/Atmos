"""Optional transactional email delivery over SMTP."""

import logging
import os
import smtplib
from email.message import EmailMessage

logger = logging.getLogger(__name__)


def send_email(
    recipient: str,
    subject: str,
    text: str,
    attachment: tuple[str, bytes, str] | None = None,
) -> bool:
    """Deliver an email when SMTP is configured; never interrupt product flows."""
    host = os.getenv("SMTP_HOST")
    sender = os.getenv("SMTP_FROM")
    if not host or not sender:
        logger.info("Email not sent because SMTP is not configured", extra={"recipient": recipient})
        return False
    message = EmailMessage()
    message["From"] = sender
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(text)
    if attachment is not None:
        filename, content, media_type = attachment
        maintype, subtype = media_type.split("/", 1)
        message.add_attachment(content, maintype=maintype, subtype=subtype, filename=filename)
    port = int(os.getenv("SMTP_PORT", "587"))
    username = os.getenv("SMTP_USERNAME")
    password = os.getenv("SMTP_PASSWORD")
    use_ssl = os.getenv("SMTP_USE_SSL", "false").lower() in ("1", "true", "yes")
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() not in ("0", "false", "no")
    if use_ssl and use_tls:
        logger.warning("SMTP_USE_SSL takes precedence over SMTP_USE_TLS")
    try:
        smtp_factory = smtplib.SMTP_SSL if use_ssl else smtplib.SMTP
        with smtp_factory(host, port, timeout=15) as smtp:
            smtp.ehlo()
            if use_tls and not use_ssl:
                smtp.starttls()
                smtp.ehlo()
            if username and password:
                smtp.login(username, password)
            smtp.send_message(message)
        return True
    except (OSError, smtplib.SMTPException, ValueError):
        logger.exception("Transactional email delivery failed", extra={"recipient": recipient})
        return False


def send_welcome_email(name: str, recipient: str) -> bool:
    return send_email(
        recipient,
        "Welcome to Atmos",
        f"Hi {name},\n\nWelcome to Atmos. Your account is ready. Create your first department when you're ready to invite your team and manage credits.\n\n— The Atmos team",
    )


def send_purchase_receipt(name: str, recipient: str, department_name: str, credits: int, amount: int, currency: str) -> bool:
    formatted_amount = f"{currency} {amount / 100:,.2f}"
    return send_email(
        recipient,
        "Your Atmos credit purchase is confirmed",
        f"Hi {name},\n\nYour purchase of {credits:,} credits for {department_name} is confirmed. Amount paid: {formatted_amount}.\n\nThe credits are now available to your department.\n\n— The Atmos team",
    )
