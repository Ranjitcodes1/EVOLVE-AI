import uuid
from datetime import datetime, date, timezone
from sqlalchemy import Column, String, DateTime, Date, ForeignKey, Float, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base

def gen_uuid():
    return str(uuid.uuid4())

class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"

    id = Column(String, primary_key=True, default=gen_uuid)
    offering_id = Column(String, ForeignKey("academic_offerings.id"), nullable=False)
    teacher_id = Column(String, ForeignKey("teachers.id"), nullable=False)
    session_date = Column(Date, default=date.today, nullable=False)
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    ended_at = Column(DateTime, nullable=True)
    status = Column(String, default="draft")  # draft, uploading, processing, review_required, confirmed, cancelled
    confirmed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    offering = relationship("AcademicOffering", back_populates="attendance_sessions")
    teacher = relationship("Teacher", back_populates="sessions")
    records = relationship("AttendanceRecord", back_populates="session", cascade="all, delete-orphan")
    assets = relationship("AttendanceCaptureAsset", back_populates="session", cascade="all, delete-orphan")

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(String, primary_key=True, default=gen_uuid)
    session_id = Column(String, ForeignKey("attendance_sessions.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(String, ForeignKey("students.id"), nullable=False)
    status = Column(String, nullable=False, default="absent")  # present, absent, late, excused
    recognition_similarity = Column(Float, nullable=True)
    review_state = Column(String, default="needs_review")  # accepted, needs_review, unidentified, corrected
    marked_by = Column(String, ForeignKey("profiles.id"), nullable=False)
    marking_method = Column(String, default="ai_proposed")  # ai_proposed, manual
    correction_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (UniqueConstraint("session_id", "student_id", name="uq_session_student"),)

    session = relationship("AttendanceSession", back_populates="records")
    student = relationship("Student", back_populates="attendance_records")
    audit_logs = relationship("AttendanceAuditLog", back_populates="record", cascade="all, delete-orphan")

class AttendanceAuditLog(Base):
    __tablename__ = "attendance_audit_logs"

    id = Column(String, primary_key=True, default=gen_uuid)
    attendance_record_id = Column(String, ForeignKey("attendance_records.id", ondelete="CASCADE"), nullable=False)
    actor_profile_id = Column(String, ForeignKey("profiles.id"), nullable=False)
    old_status = Column(String, nullable=False)
    new_status = Column(String, nullable=False)
    reason = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    record = relationship("AttendanceRecord", back_populates="audit_logs")

class AttendanceCaptureAsset(Base):
    __tablename__ = "attendance_capture_assets"

    id = Column(String, primary_key=True, default=gen_uuid)
    session_id = Column(String, ForeignKey("attendance_sessions.id", ondelete="CASCADE"), nullable=False)
    object_key = Column(String, nullable=False)
    processing_state = Column(String, default="pending")  # pending, processed, failed
    expires_at = Column(DateTime, nullable=True)
    purged_at = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    session = relationship("AttendanceSession", back_populates="assets")
