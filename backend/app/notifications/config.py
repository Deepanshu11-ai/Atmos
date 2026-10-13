"""Notifications module ki apni settings.
Alag file isliye ki teammates ki shared config se conflict na ho.
extra='ignore' se .env mein dusron ke variables hone par error nahi aata.

.env ka location: repo root (Atmos/.env). Agar backend/.env bhi ho to woh
root wali ko override karti hai."""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Is file ka path: Atmos/backend/app/notifications/config.py
BACKEND_DIR = Path(__file__).resolve().parents[2]   # .../Atmos/backend
ROOT_DIR = BACKEND_DIR.parent                       # .../Atmos


class NotificationSettings(BaseSettings):
    # Tuple mein baad wali file pehle wali ko override karti hai.
    # Isse chahe terminal kisi bhi folder se chalao, .env mil jayegi.
    model_config = SettingsConfigDict(
        env_file=(ROOT_DIR / ".env", BACKEND_DIR / ".env"),
        extra="ignore",
    )

    # --- mode: True = teammates ke fake versions (sirf development) ---
    USE_STUBS: bool = False
    DEV_TEST_EMAIL: str = ""
    DEV_TEST_PHONE: str = ""

    # --- alert rules ---
    WARN_PCT: float = 70          # itna % use hone par WARNING
    CRITICAL_PCT: float = 90      # itna % par CRITICAL
    ALERT_TONE: str = "friendly"  # friendly | roast
    REMINDER_HOURS: int = 24      # EXCEEDED mein kitne ghante baad reminder
    CRON_SECRET: str = "change-me"

    # --- email ---
    EMAIL_PROVIDER: str = "smtp"  # smtp | brevo
    EMAIL_FROM: str = ""
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    BREVO_API_KEY: str = ""

    # --- whatsapp ---
    WHATSAPP_PROVIDER: str = "twilio"  # twilio | meta
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_WHATSAPP_FROM: str = "whatsapp:+14155238886"
    META_ACCESS_TOKEN: str = ""
    META_PHONE_NUMBER_ID: str = ""
    META_API_VERSION: str = "v21.0"
    META_TEMPLATE_NAME: str = "budget_alert"
    META_TEMPLATE_LANG: str = "en"


settings = NotificationSettings()