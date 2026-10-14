from app.notifications.config import settings


# def send_whatsapp(to_phone: str, body: str, template_params: list[str] | None = None) -> str:
#     if settings.WHATSAPP_PROVIDER == "meta":
#         from app.notifications.providers.whatsapp_meta import send_whatsapp as send
#     else:
#         from app.notifications.providers.whatsapp_twilio import send_whatsapp as send
#     return send(to_phone, body, template_params=template_params)

def send_whatsapp(
    to_phone: str,
    body: str | None = None,
    template_params: list[str] | None = None,
) -> str:
    """Common interface: template_params hamesha LIST (variables {{1}}, {{2}}... ke order mein)."""
    if settings.WHATSAPP_PROVIDER == "meta":
        from app.notifications.providers.whatsapp_meta import send_whatsapp as send
    else:
        from app.notifications.providers.whatsapp_twilio import send_whatsapp as send
    return send(to_phone, body, template_params=template_params)