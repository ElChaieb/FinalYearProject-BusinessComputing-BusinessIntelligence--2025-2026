from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.auth import verify_password, create_access_token, hash_password, require_role, get_current_user
from app.utils.email import send_password_email
from pydantic import BaseModel
import secrets

router = APIRouter(prefix="/auth", tags=["Auth"])

# --- Schemas ---
class CreateUserRequest(BaseModel):
    name: str
    email: str
    role: str

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

# --- Admin creates a new user ---
@router.post("/users/create")
def create_user(
    data: CreateUserRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("Administrateur BI"))
):
    existing = db.query(models.User).filter(models.User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Generate a random password
    generated_password = secrets.token_urlsafe(10)

    user = models.User(
        name=data.name,
        email=data.email,
        hashed_password=hash_password(generated_password),
        role=data.role
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Send email with credentials
    send_password_email(data.email, data.name, generated_password)

    return {"message": f"User {data.name} created and credentials sent to {data.email}"}

# --- Login ---
@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": user.email, "role": user.role})
    return {"access_token": token, "token_type": "bearer", "role": user.role}

# --- Change password ---
@router.put("/change-password")
def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if not verify_password(data.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Old password is incorrect")

    current_user.hashed_password = hash_password(data.new_password)
    db.commit()
    return {"message": "Password changed successfully"}