# from app.notifications.config import settings
# from app.notifications.providers.whatsapp import send_whatsapp

# print(send_whatsapp(settings.DEV_TEST_PHONE, "Atmos test: WhatsApp kaam kar raha hai ✅"))

# print(send_whatsapp(settings.DEV_TEST_PHONE, "Atmos test", template_params=["12/1", "3pm"]))


from twilio.base.exceptions import TwilioRestException

from app.notifications.config import settings
from app.notifications.providers.whatsapp_twilio import send_whatsapp


def main():
    if not settings.DEV_TEST_PHONE:
        raise RuntimeError("DEV_TEST_PHONE is missing from .env.")

    if not settings.TWILIO_CONTENT_SID:
        raise RuntimeError("TWILIO_CONTENT_SID is missing from .env.")

    try:
        message_sid = send_whatsapp(
            to_phone=settings.DEV_TEST_PHONE,
            template_params={
                "1": "14 October 2026",
                "2": "10:00 AM",
            },
        )

        print("Twilio accepted the WhatsApp message.")
        print(f"Message SID: {message_sid}")
        print("Check WhatsApp and your Twilio Messaging Logs.")

    except TwilioRestException as exc:
        print(f"Twilio error code: {exc.code}")
        print(f"Twilio error message: {exc.msg}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
