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
        _client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    return _client


def _recipient(to_phone: str) -> str:
    phone = "".join(to_phone.split())
    if phone.startswith("whatsapp:"):
        phone = phone[len("whatsapp:"):]
    if not phone.startswith("+"):
        raise ValueError("Recipient phone must use international format, e.g. +91XXXXXXXXXX.")
    return f"whatsapp:{phone}"


def _as_variables(params) -> dict[str, str] | None:
    """List ya dict dono accept: ["a","b"] -> {"1": "a", "2": "b"}."""
    if not params:
        return None
    if isinstance(params, dict):
        return {str(k): str(v) for k, v in params.items()}
    return {str(i): str(v) for i, v in enumerate(params, start=1)}


def send_whatsapp(
    to_phone: str,
    body: str | None = None,
    template_params: list[str] | dict[str, str] | None = None,
    content_sid: str | None = None,
) -> str:
    """Template mode: Content SID AUR variables dono ho.
    Warna free-form mode: sirf body (isme content_variables kabhi nahi jata).
    Dhyan: 'accepted' ka matlab 'delivered' nahi. Asli status get_status(sid) se dekho."""
    template_sid = (content_sid or settings.TWILIO_CONTENT_SID or "").strip()
    variables = _as_variables(template_params)

    args = {"from_": settings.TWILIO_WHATSAPP_FROM, "to": _recipient(to_phone)}

    if template_sid and variables:
        # variables SIRF yahin lagte hain, SID ke saath
        args["content_sid"] = template_sid
        args["content_variables"] = json.dumps(variables)
    elif body:
        args["body"] = body
    else:
        raise ValueError("Provide template variables (with a Content SID) or a message body.")

    return _get_client().messages.create(**args).sid


def get_status(sid: str) -> tuple[str, int | None, str | None]:
    """(status, error_code, error_message). status: queued/sent/delivered/read/failed/undelivered."""
    m = _get_client().messages(sid).fetch()
    return m.status, m.error_code, m.error_message




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



# import json

# from twilio.rest import Client

# from app.notifications.config import settings


# _client = None


# def _get_client() -> Client:
#     global _client

#     if _client is None:
#         if not settings.TWILIO_ACCOUNT_SID:
#             raise RuntimeError("TWILIO_ACCOUNT_SID is missing.")

#         if not settings.TWILIO_AUTH_TOKEN:
#             raise RuntimeError("TWILIO_AUTH_TOKEN is missing.")

#         _client = Client(
#             settings.TWILIO_ACCOUNT_SID,
#             settings.TWILIO_AUTH_TOKEN,
#         )

#     return _client


# def send_whatsapp(
#     to_phone: str,
#     body: str | None = None,
#     template_params: dict[str, str] | None = None,
#     content_sid: str | None = None,
# ) -> str:
#     """
#     Send a WhatsApp message through Twilio.

#     Use a Content SID for approved message templates.
#     Use body only when free-form messaging is permitted.
#     """

#     phone = "".join(to_phone.split())

#     if phone.startswith("whatsapp:"):
#         phone = phone[len("whatsapp:"):]

#     if not phone.startswith("+"):
#         raise ValueError(
#             "Recipient phone must use international format, e.g. +91XXXXXXXXXX."
#         )

#     recipient = f"whatsapp:{phone}"

#     template_sid = (
#         content_sid
#         or settings.TWILIO_CONTENT_SID.strip()
#     )

#     message_args = {
#         "from_": settings.TWILIO_WHATSAPP_FROM,
#         "to": recipient,
#     }

#     if template_sid:
#         message_args["content_sid"] = template_sid

#         if template_params:
#             message_args["content_variables"] = json.dumps(
#                 template_params
#             )
#     elif body:
#         message_args["body"] = body
#     else:
#         raise ValueError(
#             "Provide a Content SID or a message body."
#         )

#     message = _get_client().messages.create(**message_args)

#     return message.sid
