from app.notifications.config import settings
from app.notifications.providers.email_sender import send_email

print(send_email(settings.DEV_TEST_EMAIL, "Atmos test", "<h3>Email kaam kar raha hai ✅</h3>"))