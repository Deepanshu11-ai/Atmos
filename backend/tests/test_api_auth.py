
from fastapi.testclient import TestClient

from main import app
from app.dependencies.authentication import get_current_user
from app.core.db import get_db


client = TestClient(app)


def test_me_requires_authentication():
    response = client.get("/auth/me")

    assert response.status_code == 401


def test_logout_without_session_is_safe():
    response = client.post("/auth/logout")

    # Logout should succeed even if the caller has no session cookie.
    assert response.status_code == 204


def test_root_health_check():
    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {"message": "system working"}
