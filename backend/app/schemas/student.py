from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class StudentRegisterRequest(BaseModel):
    email: str
    password: str
    urn: str
    full_name: str
    department_code: str = "CSE"
    branch_code: str = "CSE"
    division_name: str = "A"
    academic_year: str = "2026-2027"
    semester: int = 3
    roll_number: Optional[str] = None

class StudentResponse(BaseModel):
    id: str
    profile_id: str
    urn: str
    full_name: str
    email: str
    division_name: Optional[str] = None
    semester: int
    academic_year: str
    roll_number: Optional[str] = None
    status: str
    has_face_enrolled: bool = False
    created_at: datetime

    class Config:
        from_attributes = True
