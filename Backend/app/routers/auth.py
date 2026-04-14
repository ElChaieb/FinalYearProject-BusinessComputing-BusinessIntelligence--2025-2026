from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from app.database import get_db
from app import models
from app.auth import verify_password, create_access_token, hash_password, require_role, get_current_user
from app.utils.email import send_password_email
from app.utils.email import send_newpassword_email
from pydantic import BaseModel
import secrets

router = APIRouter(prefix="/auth", tags=["Auth"])


# ── Schemas ───────────────────────────────────────────────────
class CreateUserRequest(BaseModel):
    name:        str
    email:       str
    role:        str
    agency_name: str | None = None

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

class UpdateProfileRequest(BaseModel):
    name: str


# ── Login  (US-01) ────────────────────────────────────────────
@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    # Record last login timestamp (US-07 — shows in user list)
    user.last_login = func.now()
    db.commit()

    token = create_access_token({"sub": user.email, "role": user.role})
    return {"access_token": token, "token_type": "bearer", "role": user.role}


# ── Change password  (US-03) ──────────────────────────────────
@router.put("/change-password")
def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not verify_password(data.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Old password is incorrect")
    current_user.hashed_password = hash_password(data.new_password)
    db.commit()
    return {"message": "Password changed successfully"}


# ── View & update profile  (US-04) ───────────────────────────
@router.put("/profile")
def update_profile(
    data: UpdateProfileRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    current_user.name = data.name
    db.commit()
    return {"message": "Profile updated successfully"}


# ── Admin: create user  (US-05) ──────────────────────────────
@router.post("/users/create")
def create_user(
    data: CreateUserRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("Administrateur BI")),
):
    existing = db.query(models.User).filter(models.User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    generated_password = secrets.token_urlsafe(10)

    user = models.User(
        name=data.name,
        email=data.email,
        hashed_password=hash_password(generated_password),
        role=data.role,
        agency_name=data.agency_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    send_password_email(data.email, data.name, generated_password)
    return {"message": f"User {data.name} created and credentials sent to {data.email}"}


# ── Admin: list all users  (US-07) ────────────────────────────
@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    current_user=Depends(require_role("Administrateur BI")),
):
    users = db.query(models.User).order_by(models.User.created_at.desc()).all()
    return [
        {
            "id":          u.id,
            "name":        u.name,
            "email":       u.email,
            "role":        u.role,
            "is_active":   u.is_active,
            "agency_name": u.agency_name,
            "last_login":  u.last_login.isoformat() if u.last_login else None,
            "created_at":  u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


# ── Admin: enable / disable user  (US-06) ────────────────────
@router.patch("/users/{user_id}/toggle")
def toggle_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("Administrateur BI")),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot disable your own account")

    user.is_active = not user.is_active
    db.commit()
    status = "enabled" if user.is_active else "disabled"
    return {"message": f"User {user.name} has been {status}", "is_active": user.is_active}


# ── Admin: reset another user's password  (US-08) ────────────
@router.post("/users/{user_id}/reset-password")
def reset_password(
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("Administrateur BI")),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_password = secrets.token_urlsafe(10)
    user.hashed_password = hash_password(new_password)
    db.commit()

    send_newpassword_email(user.email, user.name, new_password, current_user.name)
    return {"message": f"Password reset and sent to {user.email}"}
