from pydantic import BaseModel
from typing import Optional

class TeacherOfferingResponse(BaseModel):
    offering_id: str
    subject_code: str
    subject_name: str
    division_id: str
    division_name: str
    branch_code: str
    department_name: str
    academic_year: str
    semester: int
    enrolled_students_count: int

class TeacherProfileResponse(BaseModel):
    id: str
    faculty_id: str
    full_name: str
    email: str
    department_name: Optional[str] = None
    designation: Optional[str] = "Assistant Professor"

class TeacherRegisterRequest(BaseModel):
    email: str
    password: str
    faculty_id: str
    full_name: str
    department_name: Optional[str] = "Computer Science"
    designation: Optional[str] = "Assistant Professor"
    course_name: Optional[str] = "Computer Science & Engineering"
    branch_code: Optional[str] = "CSE"
    subject_code: Optional[str] = "CS302"
    subject_name: Optional[str] = "Computer Networks"
    division_name: Optional[str] = "A"
    semester: Optional[int] = 3
    academic_year: Optional[str] = "2026-2027"

class CustomOfferingRequest(BaseModel):
    course_name: Optional[str] = "Computer Science & Engineering"
    branch_code: Optional[str] = "CSE"
    subject_code: str
    subject_name: str
    division_name: Optional[str] = "A"
    semester: Optional[int] = 3
    academic_year: Optional[str] = "2026-2027"
