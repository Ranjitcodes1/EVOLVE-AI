import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base

def gen_uuid():
    return str(uuid.uuid4())

class Department(Base):
    __tablename__ = "departments"

    id = Column(String, primary_key=True, default=gen_uuid)
    institution_id = Column(String, ForeignKey("institutions.id", ondelete="SET NULL"), nullable=True)
    department_code = Column(String, unique=True, nullable=False)
    department_name = Column(String, nullable=False)

    institution = relationship("Institution", back_populates="departments")
    branches = relationship("Branch", back_populates="department", cascade="all, delete-orphan")
    subjects = relationship("Subject", back_populates="department", cascade="all, delete-orphan")
    teachers = relationship("Teacher", back_populates="department")
    students = relationship("Student", back_populates="department")

class Branch(Base):
    __tablename__ = "branches"

    id = Column(String, primary_key=True, default=gen_uuid)
    department_id = Column(String, ForeignKey("departments.id"), nullable=False)
    branch_code = Column(String, nullable=False)
    branch_name = Column(String, nullable=False)

    __table_args__ = (UniqueConstraint("department_id", "branch_code", name="uq_dept_branch"),)

    department = relationship("Department", back_populates="branches")
    divisions = relationship("Division", back_populates="branch", cascade="all, delete-orphan")

class Division(Base):
    __tablename__ = "divisions"

    id = Column(String, primary_key=True, default=gen_uuid)
    branch_id = Column(String, ForeignKey("branches.id"), nullable=False)
    division_name = Column(String, nullable=False)
    academic_year = Column(String, nullable=False)
    semester = Column(Integer, nullable=False)

    __table_args__ = (UniqueConstraint("branch_id", "division_name", "academic_year", "semester", name="uq_division_term"),)

    branch = relationship("Branch", back_populates="divisions")
    students = relationship("Student", back_populates="division")
    offerings = relationship("AcademicOffering", back_populates="division", cascade="all, delete-orphan")

class Subject(Base):
    __tablename__ = "subjects"

    id = Column(String, primary_key=True, default=gen_uuid)
    subject_code = Column(String, nullable=False)
    subject_name = Column(String, nullable=False)
    department_id = Column(String, ForeignKey("departments.id"), nullable=False)

    __table_args__ = (UniqueConstraint("subject_code", "department_id", name="uq_subject_dept"),)

    department = relationship("Department", back_populates="subjects")
    offerings = relationship("AcademicOffering", back_populates="subject", cascade="all, delete-orphan")

class AcademicOffering(Base):
    """
    Course Offering for a specific Division and Term.
    e.g., CS201 Data Structures for CSE Division A, Semester 3.
    """
    __tablename__ = "academic_offerings"

    id = Column(String, primary_key=True, default=gen_uuid)
    subject_id = Column(String, ForeignKey("subjects.id"), nullable=False)
    division_id = Column(String, ForeignKey("divisions.id"), nullable=False)
    academic_year = Column(String, nullable=False)
    semester = Column(Integer, nullable=False)
    section = Column(String, default="Default")
    status = Column(String, default="active")

    __table_args__ = (UniqueConstraint("subject_id", "division_id", "academic_year", "semester", name="uq_offering_term"),)

    subject = relationship("Subject", back_populates="offerings")
    division = relationship("Division", back_populates="offerings")
    teacher_assignments = relationship("TeacherOffering", back_populates="offering", cascade="all, delete-orphan")
    student_enrollments = relationship("StudentEnrollment", back_populates="offering", cascade="all, delete-orphan")
    attendance_sessions = relationship("AttendanceSession", back_populates="offering", cascade="all, delete-orphan")

class TeacherOffering(Base):
    __tablename__ = "teacher_offerings"

    id = Column(String, primary_key=True, default=gen_uuid)
    teacher_id = Column(String, ForeignKey("teachers.id"), nullable=False)
    offering_id = Column(String, ForeignKey("academic_offerings.id"), nullable=False)
    role = Column(String, default="primary")

    __table_args__ = (UniqueConstraint("teacher_id", "offering_id", name="uq_teacher_offering"),)

    teacher = relationship("Teacher", back_populates="offerings")
    offering = relationship("AcademicOffering", back_populates="teacher_assignments")

class StudentEnrollment(Base):
    __tablename__ = "student_enrollments"

    id = Column(String, primary_key=True, default=gen_uuid)
    student_id = Column(String, ForeignKey("students.id"), nullable=False)
    offering_id = Column(String, ForeignKey("academic_offerings.id"), nullable=False)
    status = Column(String, default="enrolled")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (UniqueConstraint("student_id", "offering_id", name="uq_student_offering"),)

    student = relationship("Student", back_populates="enrollments")
    offering = relationship("AcademicOffering", back_populates="student_enrollments")
