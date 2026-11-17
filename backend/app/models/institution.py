import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.orm import relationship
from app.database import Base

def gen_uuid():
    return str(uuid.uuid4())

class Institution(Base):
    """
    Multi-tenant Organization & Institution Model.
    Supports future subscription tiers ('free', 'pro', 'enterprise'),
    SaaS quotas, and campus-wide licensing.
    """
    __tablename__ = "institutions"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False, default="Apex Autonomous Institute of Technology")
    slug = Column(String, unique=True, index=True, nullable=False, default="apex-institute")
    subscription_tier = Column(String, default="free")  # 'free', 'pro', 'enterprise'
    subscription_status = Column(String, default="active")  # 'active', 'past_due', 'trialing'
    max_students_quota = Column(Integer, default=500)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    profiles = relationship("Profile", back_populates="institution")
    departments = relationship("Department", back_populates="institution")

