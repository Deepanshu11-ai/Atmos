# from app.notifications.config import settings
# from app.notifications.providers.whatsapp import send_whatsapp

# print(send_whatsapp(settings.DEV_TEST_PHONE, "Atmos test: WhatsApp kaam kar raha hai ✅"))

# print(send_whatsapp(settings.DEV_TEST_PHONE, "Atmos test", template_params=["12/1", "3pm"]))


# from twilio.base.exceptions import TwilioRestException

# from app.notifications.config import settings
# from app.notifications.providers.whatsapp_twilio import send_whatsapp


# def main():
#     if not settings.DEV_TEST_PHONE:
#         raise RuntimeError("DEV_TEST_PHONE is missing from .env.")

#     if not settings.TWILIO_CONTENT_SID:
#         raise RuntimeError("TWILIO_CONTENT_SID is missing from .env.")

#     try:
#         message_sid = send_whatsapp(
#             to_phone=settings.DEV_TEST_PHONE,
#             template_params={
#                 "1": "14 October 2026",
#                 "2": "10:00 AM",
#             },
#         )

#         print("Twilio accepted the WhatsApp message.")
#         print(f"Message SID: {message_sid}")
#         print("Check WhatsApp and your Twilio Messaging Logs.")

#     except TwilioRestException as exc:
#         print(f"Twilio error code: {exc.code}")
#         print(f"Twilio error message: {exc.msg}")
#         raise SystemExit(1)


# if __name__ == "__main__":
#     main()

import time

from twilio.base.exceptions import TwilioRestException

from app.notifications.config import settings
from app.notifications.providers.whatsapp import send_whatsapp
from app.notifications.providers.whatsapp_twilio import get_status
from app.notifications.templates import build_whatsapp, whatsapp_params

CTX = dict(name="Test User", dept="Logistics", pct=70, remaining=300, used=700, budget=1000)


def main():
    if not settings.DEV_TEST_PHONE:
        raise RuntimeError("DEV_TEST_PHONE is missing from .env.")

    mode = "template" if settings.TWILIO_CONTENT_SID else "free-form"
    print(f"Mode: {mode}")

    try:
        sid = send_whatsapp(
            settings.DEV_TEST_PHONE,
            build_whatsapp("WARNING", CTX),
            template_params=whatsapp_params("WARNING", CTX),
        )
        print(f"Twilio accepted the message. SID: {sid}")

        for _ in range(4):                       # delivery status thodi der mein badalta hai
            time.sleep(3)
            status, code, msg = get_status(sid)
            print(f"Status: {status} {code or ''} {msg or ''}")
            if status in ("delivered", "read", "failed", "undelivered"):
                break
    except TwilioRestException as exc:
        print(f"Twilio error code: {exc.code}\nTwilio error message: {exc.msg}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()