"""Department ka budget set karo.  Run (backend/ se):  python -m scripts.set_budget 1 1000"""
import sys

from app.notifications.adapters import set_budget
from app.notifications.database import SessionLocal

if len(sys.argv) != 3:
    sys.exit("Usage: python -m scripts.set_budget <dept_id> <budget>")
db = SessionLocal()
try:
    set_budget(db, int(sys.argv[1]), float(sys.argv[2]))
    print(f"Department {sys.argv[1]} ka budget {sys.argv[2]} set ho gaya.")
finally:
    db.close()
