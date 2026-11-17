from pydantic import BaseModel, Field
from typing import Optional

class LoginRequest(BaseModel):
    email: str
    password: str
    remember_me: bool = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 3600  # seconds
    role: str               # 'faculty' or 'student'
    profile_id: str
    email: str
    name: str
    entity_id: Optional[str] = None  # student_id or teacher_id

class RefreshRequest(BaseModel):
    refresh_token: Optional[str] = None

class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 3600

class StudentRegisterRequest(BaseModel):
    """
    Student Self-Registration Payload with Academic Auto-Binding.
    """
    email: str
    password: str = Field(min_length=6)
    full_name: str
    urn: str = Field(description="University Registration Number")
    department_code: str = "CSE"
    division_name: str = "A"
    semester: int = 3
    academic_year: str = "2026-2027"
    roll_number: Optional[str] = None

class FacultyRegisterRequest(BaseModel):
    """
    Faculty Registration Payload.
    """
    email: str
    password: str = Field(min_length=6)
    full_name: str
    faculty_id: str = Field(description="Institutional Faculty ID")
    department_code: str = "CSE"
    designation: Optional[str] = "Assistant Professor"

class UserProfileResponse(BaseModel):
    id: str
    email: str
    role: str
    status: str
    name: str
    entity_id: Optional[str] = None
