import httpx

from app.notifications.config import settings


def _post(payload: dict) -> httpx.Response:
    url = (f"https://graph.facebook.com/{settings.META_API_VERSION}/"
           f"{settings.META_PHONE_NUMBER_ID}/messages")
    return httpx.post(
        url,
        headers={"Authorization": f"Bearer {settings.META_ACCESS_TOKEN}"},
        json=payload,
        timeout=15,
    )


def send_whatsapp(to_phone: str, body: str, template_params: list[str] | None = None) -> str:
    to = to_phone.lstrip("+")

    # 1) free-form text (sirf 24 ghante ke window mein chalta hai)
    r = _post({"messaging_product": "whatsapp", "to": to,
               "type": "text", "text": {"body": body}})
    if r.status_code == 200:
        return r.json()["messages"][0]["id"]

    # 2) window band hai (usually error 131047) to approved template bhejo
    code = r.json().get("error", {}).get("code")
    if code == 131047 and template_params:
        r = _post({
            "messaging_product": "whatsapp", "to": to, "type": "template",
            "template": {
                "name": settings.META_TEMPLATE_NAME,
                "language": {"code": settings.META_TEMPLATE_LANG},
                "components": [{
                    "type": "body",
                    "parameters": [{"type": "text", "text": str(p)} for p in template_params],
                }],
            },
        })
        if r.status_code == 200:
            return r.json()["messages"][0]["id"]

    raise RuntimeError(f"WhatsApp send failed: {r.status_code} {r.text[:300]}")