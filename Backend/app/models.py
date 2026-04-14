from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id               = Column(Integer, primary_key=True, index=True)
    name             = Column(String(100))
    email            = Column(String(100), unique=True, index=True)
    hashed_password  = Column(String)
    role             = Column(String(50))
    is_active        = Column(Boolean, default=True)
    created_at       = Column(DateTime, default=func.now())

    # US-07: needed for user list display
    last_login       = Column(DateTime, nullable=True)

    # Dashboard scoping: set by admin when creating Responsable/Commercial
    # NULL = no agency restriction (DG, DC, Admin)
    # When agency_id is needed for DWH queries, look it up from dim_agency by this name.
    agency_name      = Column(String(100), nullable=True)
