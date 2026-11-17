from app.schemas.auth import LoginRequest, TokenResponse, UserProfileResponse
from app.schemas.student import StudentRegisterRequest, StudentResponse
from app.schemas.teacher import TeacherOfferingResponse, TeacherProfileResponse
from app.schemas.attendance import (
    CreateSessionRequest,
    AttendanceProposalItem,
    SessionProposalsResponse,
    UpdateSessionRecordsRequest,
    AttendanceSessionSummary,
    StudentAttendanceDashboardResponse
)

__all__ = [
    "LoginRequest", "TokenResponse", "UserProfileResponse",
    "StudentRegisterRequest", "StudentResponse",
    "TeacherOfferingResponse", "TeacherProfileResponse",
    "CreateSessionRequest", "AttendanceProposalItem", "SessionProposalsResponse",
    "UpdateSessionRecordsRequest", "AttendanceSessionSummary", "StudentAttendanceDashboardResponse"
]
