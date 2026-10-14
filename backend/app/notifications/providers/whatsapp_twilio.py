# from twilio.rest import Client

# from app.notifications.config import settings

# _client = None


# def _get_client() -> Client:
#     global _client
#     if _client is None:
#         _client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
#     return _client


# def send_whatsapp(to_phone: str, body: str, template_params: list[str] | None = None) -> str:
#     """to_phone E.164 format mein (+91XXXXXXXXXX). template_params Twilio sandbox mein use nahi hota."""
#     msg = _get_client().messages.create(
#         from_=settings.TWILIO_WHATSAPP_FROM,
#         to=f"whatsapp:{to_phone}",
#         body=body,
#     )
#     return msg.sid



import json

from twilio.rest import Client

from app.notifications.config import settings


_client = None


def _get_client() -> Client:
    global _client

    if _client is None:
        if not settings.TWILIO_ACCOUNT_SID:
            raise RuntimeError("TWILIO_ACCOUNT_SID is missing.")

        if not settings.TWILIO_AUTH_TOKEN:
            raise RuntimeError("TWILIO_AUTH_TOKEN is missing.")

        _client = Client(
            settings.TWILIO_ACCOUNT_SID,
            settings.TWILIO_AUTH_TOKEN,
        )

    return _client


def send_whatsapp(
    to_phone: str,
    body: str | None = None,
    template_params: dict[str, str] | None = None,
    content_sid: str | None = None,
) -> str:
    """
    Send a WhatsApp message through Twilio.

    Use a Content SID for approved message templates.
    Use body only when free-form messaging is permitted.
    """

    phone = "".join(to_phone.split())

    if phone.startswith("whatsapp:"):
        phone = phone[len("whatsapp:"):]

    if not phone.startswith("+"):
        raise ValueError(
            "Recipient phone must use international format, e.g. +91XXXXXXXXXX."
        )

    recipient = f"whatsapp:{phone}"

    template_sid = (
        content_sid
        or settings.TWILIO_CONTENT_SID.strip()
    )

    message_args = {
        "from_": settings.TWILIO_WHATSAPP_FROM,
        "to": recipient,
    }

    if template_sid:
        message_args["content_sid"] = template_sid

        if template_params:
            message_args["content_variables"] = json.dumps(
                template_params
            )
    elif body:
        message_args["body"] = body
    else:
        raise ValueError(
            "Provide a Content SID or a message body."
        )

    message = _get_client().messages.create(**message_args)

    return message.sid
