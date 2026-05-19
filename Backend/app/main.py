from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.sql import func
from app.routers import auth, admin
from app.auth import get_current_user
from app.routers import dashboard

from app.routers.ai_analysis import router as ai_router
from app.routers.dw_chat_router import router as dw_chat_router


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",       # Docker frontend (port 80)
        "http://localhost:5173",  # Vite dev server (local dev)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(dashboard.router)
app.include_router(ai_router)
app.include_router(dw_chat_router)

@app.get("/")
def root():
    return {"message": "API is running"}


# US-04: returns full profile including agency info for dashboard scoping
@app.get("/me")
def get_me(current_user=Depends(get_current_user)):
    return {
        "id":          current_user.id,
        "name":        current_user.name,
        "email":       current_user.email,
        "role":        current_user.role,
        "is_active":   current_user.is_active,
        "agency_name": current_user.agency_name,
        "last_login":  current_user.last_login.isoformat() if current_user.last_login else None,
    }
