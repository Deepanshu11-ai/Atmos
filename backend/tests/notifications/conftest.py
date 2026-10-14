import os

# Import se PEHLE set hona chahiye, isliye sabse upar
os.environ["USE_STUBS"] = "true"
os.environ["DEV_TEST_EMAIL"] = "test@example.com"
os.environ["DEV_TEST_PHONE"] = "+910000000000"

import pytest


@pytest.fixture()
def db():
    from app.notifications import models  # noqa: F401  (tables register hon)
    from app.notifications.dev_stubs import Base, SessionLocal, engine, reset_fake_data

    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    reset_fake_data()
    session = SessionLocal()
    yield session
    session.close()
