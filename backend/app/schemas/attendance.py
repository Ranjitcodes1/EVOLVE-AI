from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime

class CreateSessionRequest(BaseModel):
    offering_id: str
    session_date: Optional[date] = None

class AttendanceProposalItem(BaseModel):
    record_id: Optional[str] = None
    student_id: str
    urn: str
    full_name: str
    roll_number: Optional[str] = None
    proposed_status: str  # present, absent, late, excused
    similarity: Optional[float] = None
    review_state: str  # accepted, needs_review, not_detected, corrected
    marking_method: str = "ai_proposed"
    correction_reason: Optional[str] = None

class SessionProposalsResponse(BaseModel):
    session_id: str
    offering_id: str
    subject_code: str
    subject_name: str
    division_name: str
    session_date: date
    status: str
    summary: dict
    proposals: List[AttendanceProposalItem]

class UpdateRecordItem(BaseModel):
    student_id: str
    status: str  # present, absent, late, excused
    reason: Optional[str] = "Manual faculty verification"

class UpdateSessionRecordsRequest(BaseModel):
    updates: List[UpdateRecordItem]

class ConfirmSessionRequest(BaseModel):
    pass

class AttendanceSessionSummary(BaseModel):
    id: str
    offering_id: str
    subject_name: str
    subject_code: str
    division_name: str
    session_date: date
    status: str
    total_enrolled: int
    present_count: int
    absent_count: int
    confirmed_at: Optional[datetime] = None

class StudentAttendanceRecordItem(BaseModel):
    session_id: str
    subject_code: str
    subject_name: str
    session_date: date
    status: str
    marking_method: str
    review_state: str

class StudentSubjectAttendanceSummary(BaseModel):
    subject_code: str
    subject_name: str
    total_classes: int
    attended_classes: int
    attendance_percentage: float
    safe_missable_classes: Optional[int] = 0
    recovery_classes_needed: Optional[int] = 0

class StudentAttendanceDashboardResponse(BaseModel):
    student_id: str
    full_name: str
    urn: str
    division_name: Optional[str] = None
    semester: Optional[int] = None
    academic_year: Optional[str] = None
    roll_number: Optional[str] = None
    overall_percentage: float
    total_classes: int
    attended_classes: int
    safe_missable_classes: Optional[int] = 0
    recovery_classes_needed: Optional[int] = 0
    subject_summaries: List[StudentSubjectAttendanceSummary]
    recent_records: List[StudentAttendanceRecordItem]
