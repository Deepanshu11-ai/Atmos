from fastapi import FastAPI
from app.routes.auth import router as auth_router
from app.routes.memberships import router as memberships_router
from app.routes.organizations import router as organizations_router

app = FastAPI(title="Atomos API")


@app.get("/")
def home():
    return {"message": "system working"}


app.include_router(auth_router)
app.include_router(memberships_router)
app.include_router(organizations_router)
