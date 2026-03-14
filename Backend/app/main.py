from fastapi import FastAPI, Depends
from app.routers import auth
from app.auth import get_current_user, require_role
from app.routers import admin


app = FastAPI()
app.include_router(admin.router)

## TEMPORARY:
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


##

app.include_router(auth.router)

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