import pytest

from app.notifications.rules import Level, get_level


@pytest.mark.parametrize(
    "budget,used,expected",
    [
        (1000, 200, Level.OK),
        (1000, 699, Level.OK),
        (1000, 700, Level.WARNING),
        (1000, 899, Level.WARNING),
        (1000, 900, Level.CRITICAL),
        (1000, 999, Level.CRITICAL),
        (1000, 1000, Level.EXCEEDED),
        (1000, 1300, Level.EXCEEDED),
        (0, 0, Level.EXCEEDED),
    ],
)
def test_levels(budget, used, expected):
    assert get_level(budget, used) == expected