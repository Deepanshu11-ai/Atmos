"""Budget kitna use hua, uske hisaab se alert level."""
from enum import IntEnum

from app.notifications.config import settings


class Level(IntEnum):
    OK = 0
    WARNING = 1     # >= WARN_PCT
    CRITICAL = 2    # >= CRITICAL_PCT
    EXCEEDED = 3    # >= 100% (department lock)


def get_level(budget: float, used: float) -> Level:
    if budget <= 0:
        return Level.EXCEEDED
    pct = used / budget * 100
    if pct >= 100:
        return Level.EXCEEDED
    if pct >= settings.CRITICAL_PCT:
        return Level.CRITICAL
    if pct >= settings.WARN_PCT:
        return Level.WARNING
    return Level.OK