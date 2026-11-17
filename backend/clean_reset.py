import os
import shutil
import sys
from pathlib import Path

# Add backend to sys.path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.database import engine, SessionLocal, Base
from app.models.institution import Institution
from app.models.user import Profile, Student, Teacher
from app.models.academic import (
    Department, Branch, Division, Subject,
    AcademicOffering, TeacherOffering, StudentEnrollment
)
from app.models.biometric import StudentFaceEmbedding
from app.models.attendance import (
    AttendanceSession,
    AttendanceRecord,
    AttendanceAuditLog
)
from app.services.auth_service import get_password_hash

def clean_reset():
    print("[*] Starting Clean Database Reset...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Purge all transactional and attendance data
        print("  -> Deleting Attendance Audit Logs...")
        db.query(AttendanceAuditLog).delete()

        print("  -> Deleting Attendance Records...")
        db.query(AttendanceRecord).delete()

        print("  -> Deleting Attendance Sessions...")
        db.query(AttendanceSession).delete()

        print("  -> Deleting Biometric Face Embeddings...")
        db.query(StudentFaceEmbedding).delete()

        print("  -> Deleting Student Enrollments & Teacher Offerings...")
        db.query(StudentEnrollment).delete()
        db.query(TeacherOffering).delete()

        print("  -> Deleting all Students & Teachers...")
        db.query(Student).delete()
        db.query(Teacher).delete()

        print("  -> Deleting User Profiles...")
        db.query(Profile).delete()

        print("  -> Clearing Academic Offerings & Catalog...")
        db.query(AcademicOffering).delete()
        db.query(Subject).delete()
        db.query(Division).delete()
        db.query(Branch).delete()
        db.query(Department).delete()
        db.query(Institution).delete()
        db.commit()

        # 2. Re-create clean institutional base catalog (Zero users, clean structure)
        print("  -> Setting up clean Institutional Catalog (CSE, Division A, Semester 3)...")
        inst = Institution(
            name="Evolve Institute of Technology",
            slug="evolve-institute",
            subscription_tier="enterprise",
            subscription_status="active",
            max_students_quota=5000
        )
        db.add(inst)
        db.flush()

        dept = Department(
            department_code="CSE",
            department_name="Department of Computer Science & Engineering"
        )
        db.add(dept)
        db.flush()

        branch = Branch(
            department_id=dept.id,
            branch_code="CSE",
            branch_name="Computer Science & Engineering"
        )
        db.add(branch)
        db.flush()

        div_a = Division(
            branch_id=branch.id,
            division_name="A",
            academic_year="2026-2027",
            semester=3
        )
        db.add(div_a)
        db.flush()

        # Core curriculum subject catalog (Offerings are assigned dynamically by faculty)
        subjects_data = [
            ("CS301", "Computer Networks"),
            ("CS302", "Operating Systems"),
            ("CS303", "Database Management Systems"),
            ("CS304", "Data Structures & Algorithms"),
            ("CS305", "Theory of Computation"),
        ]
        for code, name in subjects_data:
            s = Subject(department_id=dept.id, subject_code=code, subject_name=name)
            db.add(s)
            db.flush()

        # Create one administrative compliance account for audit console
        admin_prof = Profile(
            email="admin@snapclass.edu",
            password_hash=get_password_hash("Password123!"),
            role="admin",
            status="active"
        )
        db.add(admin_prof)
        db.commit()

        # 3. Clean physical storage files (session captures)
        storage_captures = backend_dir / "storage" / "captures"
        if storage_captures.exists():
            print("  -> Purging physical capture directories in storage/captures...")
            for item in storage_captures.iterdir():
                if item.is_dir():
                    shutil.rmtree(item)
                else:
                    item.unlink()

        print("[OK] Database reset complete! Zero recorded attendance, zero teachers, zero students.")
        print("     Prisinte Base Catalog Ready: CSE Division A (Semester 3), Subjects CS301-CS305.")

    except Exception as e:
        db.rollback()
        print(f"[ERR] Reset failed: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    clean_reset()
