# Backend/app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, admin
from app.auth import get_current_user, require_role
from app.scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── startup ──────────────────────────────────────────────
    start_scheduler(interval_minutes=30)
    yield
    # ── shutdown ─────────────────────────────────────────────
    stop_scheduler()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)


@app.get("/")
def root():
    return {"message": "API is running"}


@app.get("/test-db")
def test_db():
    return {"message": "DB connected successfully"}


@app.get("/me")
def get_me(current_user=Depends(get_current_user)):
    return {"email": current_user.email, "role": current_user.role}


@app.get("/admin-only")
def admin_route(current_user=Depends(require_role("admin"))):
    return {"message": f"Hello admin {current_user.name}"}
