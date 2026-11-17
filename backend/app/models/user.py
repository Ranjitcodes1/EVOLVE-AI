import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer
from sqlalchemy.orm import relationship
from app.database import Base

def gen_uuid():
    return str(uuid.uuid4())

class Profile(Base):
    """
    Core User Profile for Authentication & Identity.
    Strictly 2 Roles: 'faculty' and 'student'.
    Includes token_version for instant remote session revocation.
    """
    __tablename__ = "profiles"

    id = Column(String, primary_key=True, default=gen_uuid)
    institution_id = Column(String, ForeignKey("institutions.id", ondelete="SET NULL"), nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # 'faculty' or 'student'
    status = Column(String, default="active")  # 'active', 'suspended', 'pending'
    token_version = Column(Integer, default=1, nullable=False)  # Incremented to revoke all active sessions
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    institution = relationship("Institution", back_populates="profiles")
    student = relationship("Student", back_populates="profile", uselist=False, cascade="all, delete-orphan")
    teacher = relationship("Teacher", back_populates="profile", uselist=False, cascade="all, delete-orphan")

class Student(Base):
    """
    Enrolled Student Profile.
    Auto-binds to AcademicOfferings based on Department, Division, and Semester.
    """
    __tablename__ = "students"

    id = Column(String, primary_key=True, default=gen_uuid)
    profile_id = Column(String, ForeignKey("profiles.id", ondelete="CASCADE"), unique=True, nullable=False)
    urn = Column(String, unique=True, index=True, nullable=False)  # University Registration Number
    full_name = Column(String, nullable=False)
    department_id = Column(String, ForeignKey("departments.id"), nullable=True)
    division_id = Column(String, ForeignKey("divisions.id"), nullable=True)
    academic_year = Column(String, nullable=False, default="2026-2027")
    semester = Column(Integer, nullable=False, default=3)
    roll_number = Column(String, nullable=True)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    profile = relationship("Profile", back_populates="student")
    department = relationship("Department", back_populates="students")
    division = relationship("Division", back_populates="students")
    enrollments = relationship("StudentEnrollment", back_populates="student", cascade="all, delete-orphan")
    face_embeddings = relationship("StudentFaceEmbedding", back_populates="student", cascade="all, delete-orphan")
    attendance_records = relationship("AttendanceRecord", back_populates="student")

class Teacher(Base):
    """
    Faculty Member Profile.
    Manages course offerings, captures roll-call photos, and confirms attendance.
    """
    __tablename__ = "teachers"

    id = Column(String, primary_key=True, default=gen_uuid)
    profile_id = Column(String, ForeignKey("profiles.id", ondelete="CASCADE"), unique=True, nullable=False)
    faculty_id = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    department_id = Column(String, ForeignKey("departments.id"), nullable=True)
    designation = Column(String, default="Assistant Professor")
    status = Column(String, default="active")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    profile = relationship("Profile", back_populates="teacher")
    department = relationship("Department", back_populates="teachers")
    offerings = relationship("TeacherOffering", back_populates="teacher", cascade="all, delete-orphan")
    sessions = relationship("AttendanceSession", back_populates="teacher")
