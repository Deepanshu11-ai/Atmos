"""Notifications module ki apni settings.
Alag file isliye ki teammates ki shared config se conflict na ho.
extra='ignore' se .env mein dusron ke variables hone par error nahi aata.

.env ka location: repo root (Atmos/.env). Agar backend/.env bhi ho to woh
root wali ko override karti hai."""
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Is file ka path: Atmos/backend/app/notifications/config.py
BACKEND_DIR = Path(__file__).resolve().parents[2]   # .../Atmos/backend
ROOT_DIR = BACKEND_DIR.parent                       # .../Atmos


class NotificationSettings(BaseSettings):
    # Tuple mein baad wali file pehle wali ko override karti hai.
    model_config = SettingsConfigDict(
        env_file=(ROOT_DIR / ".env", BACKEND_DIR / ".env"),
        extra="ignore",
    )

    # --- mode: True = teammates ke fake versions (sirf standalone development) ---
    USE_STUBS: bool = False
    DEV_TEST_EMAIL: str = ""
    DEV_TEST_PHONE: str = ""

    # --- alert rules ---
    WARN_PCT: float = 70          # itna % use hone par WARNING
    CRITICAL_PCT: float = 90      # itna % par CRITICAL
    ALERT_TONE: str = "formal"    # templates.py ke hisaab se
    REMINDER_HOURS: int = 24      # EXCEEDED mein kitne ghante baad reminder
    CRON_SECRET: str = "change-me"

    # --- teammates ke data se jodna (bills, users, roles) ---
    BUDGET_UNIT: str = "kg CO2e"       # bills.carbon_emitted ki unit; messages mein dikhegi
    BUDGET_PERIOD: str = "all"         # all | month | quarter | year (kitne time ka usage gino)
    DEFAULT_DEPT_BUDGET: float = 0     # 0 = default nahi: budget set na ho to alert skip
    EXCLUDE_SUSPICIOUS: bool = False   # True: is_suspicious bills usage mein na ginein
    BILL_STATUSES: str = ""            # comma list (jaise "approved,paid"); khali = saare bills
    AUTO_TRIGGER: bool = True          # bills commit hote hi automatic check
    ADMIN_ROLES: str = "admin"
    MANAGER_ROLES: str = "manager,compliance_manager,department_manager,dept_manager"
    DATA_OFFICER_ROLES: str = "data_officer"

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
    TWILIO_WHATSAPP_FROM: str = "whatsapp:+14155238886"   # sandbox number
    TWILIO_CONTENT_SID: str = ""
    META_ACCESS_TOKEN: str = ""
    META_PHONE_NUMBER_ID: str = ""
    META_API_VERSION: str = "v21.0"
    META_TEMPLATE_NAME: str = "budget_alert"
    META_TEMPLATE_LANG: str = "en"

    @field_validator("DEV_TEST_PHONE", "TWILIO_WHATSAPP_FROM")
    @classmethod
    def _clean_phone(cls, v: str) -> str:
        return "".join(v.split())          # saare spaces hata do

    @field_validator("TWILIO_WHATSAPP_FROM")
    @classmethod
    def _wa_prefix(cls, v: str) -> str:
        if v and not v.startswith("whatsapp:"):
            v = "whatsapp:" + v
        return v


settings = NotificationSettings()
