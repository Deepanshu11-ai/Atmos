
from fastapi import FastAPI

from app.routes.auth import router as auth_router

app = FastAPI(title="Atomos API")

# Existing health-check endpoint
@app.get("/")
def home():
    return {"message": "system working"}

# Authentication endpoints
app.include_router(auth_router)

