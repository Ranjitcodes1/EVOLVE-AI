import os
import sys
import json
from pathlib import Path
from datetime import date, datetime, timedelta, timezone
import numpy as np

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from sqlalchemy.orm import Session
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

BASE_DIR = Path(__file__).resolve().parent.parent

def seed_database(force_reseed: bool = False):
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        # Check if already seeded and not force_reseed
        existing_profile = db.query(Profile).first()
        if existing_profile and not force_reseed:
            print("Database already contains seed data. Run with force_reseed=True to reset.")
            return

        if force_reseed:
            print("Purging existing data for clean reseed...")
            db.query(AttendanceAuditLog).delete()
            db.query(AttendanceRecord).delete()
            db.query(AttendanceSession).delete()
            db.query(StudentFaceEmbedding).delete()
            db.query(StudentEnrollment).delete()
            db.query(TeacherOffering).delete()
            db.query(AcademicOffering).delete()
            db.query(Subject).delete()
            db.query(Student).delete()
            db.query(Teacher).delete()
            db.query(Division).delete()
            db.query(Branch).delete()
            db.query(Department).delete()
            db.query(Profile).delete()
            db.query(Institution).delete()
            db.commit()

        print("Seeding SnapClass AI (Version 2.0 with ArcFace 512-d & Multi-Tenant SaaS Schema)...")

        # 1. Institution
        inst = Institution(
            name="Apex Autonomous Institute of Technology",
            slug="apex-institute",
            subscription_tier="free",
            subscription_status="active",
            max_students_quota=500
        )
        db.add(inst)
        db.flush()

        # 2. Department & Branch
        dept = Department(
            institution_id=inst.id,
            department_code="CSE",
            department_name="Computer Science & Engineering"
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

        # 3. Division
        division = Division(
            branch_id=branch.id,
            division_name="A",
            academic_year="2026-2027",
            semester=3
        )
        db.add(division)
        db.flush()

        # 4. Subjects
        sub1 = Subject(
            subject_code="CS201",
            subject_name="Data Structures and Algorithms",
            department_id=dept.id
        )
        sub2 = Subject(
            subject_code="CS202",
            subject_name="Database Management Systems",
            department_id=dept.id
        )
        sub3 = Subject(
            subject_code="CS203",
            subject_name="Computer Organization and Architecture",
            department_id=dept.id
        )
        sub4 = Subject(
            subject_code="CS401",
            subject_name="Object Oriented Programming",
            department_id=dept.id
        )
        db.add_all([sub1, sub2, sub3, sub4])
        db.flush()

        # 5. Academic Offerings
        offering1 = AcademicOffering(
            subject_id=sub1.id,
            division_id=division.id,
            academic_year="2026-2027",
            semester=3,
            section="A"
        )
        offering2 = AcademicOffering(
            subject_id=sub2.id,
            division_id=division.id,
            academic_year="2026-2027",
            semester=3,
            section="A"
        )
        offering3 = AcademicOffering(
            subject_id=sub3.id,
            division_id=division.id,
            academic_year="2026-2027",
            semester=3,
            section="A"
        )
        offering4 = AcademicOffering(
            subject_id=sub4.id,
            division_id=division.id,
            academic_year="2026-2027",
            semester=3,
            section="A"
        )
        db.add_all([offering1, offering2, offering3, offering4])
        db.flush()

        default_password = get_password_hash("Password123!")

        # 6. Faculty Profile & Entity
        prof_faculty = Profile(
            institution_id=inst.id,
            email="faculty@snapclass.edu",
            password_hash=default_password,
            role="faculty",
            status="active"
        )
        # Also alias teacher@snapclass.edu and sarah.jenkins@evolve.edu
        prof_teacher = Profile(
            institution_id=inst.id,
            email="teacher@snapclass.edu",
            password_hash=default_password,
            role="faculty",
            status="active"
        )
        prof_sarah = Profile(
            institution_id=inst.id,
            email="sarah.jenkins@evolve.edu",
            password_hash=default_password,
            role="teacher",
            status="active"
        )
        db.add_all([prof_faculty, prof_teacher, prof_sarah])
        db.flush()

        faculty_member = Teacher(
            profile_id=prof_sarah.id,
            faculty_id="FAC-2026-104",
            full_name="Dr. Sarah Jenkins",
            department_id=dept.id,
            designation="Associate Professor",
            status="active"
        )
        teacher_alias = Teacher(
            profile_id=prof_teacher.id,
            faculty_id="FAC-CSE-002",
            full_name="Prof. Alan Turing (Alias)",
            department_id=dept.id,
            designation="Professor",
            status="active"
        )
        db.add_all([faculty_member, teacher_alias])
        db.flush()

        # Assign Faculty to CS201, CS202 and CS401
        db.add(TeacherOffering(teacher_id=faculty_member.id, offering_id=offering1.id, role="primary"))
        db.add(TeacherOffering(teacher_id=faculty_member.id, offering_id=offering2.id, role="primary"))
        db.add(TeacherOffering(teacher_id=faculty_member.id, offering_id=offering4.id, role="primary"))
        db.add(TeacherOffering(teacher_id=teacher_alias.id, offering_id=offering1.id, role="secondary"))
        db.flush()

        # 7. Students (10 synthetic + 1 Real Student: Ranjit)
        sample_students_data = [
            ("Aarav Sharma", "URN2026CSE001", "01"),
            ("Ananya Patel", "URN2026CSE002", "02"),
            ("Rohan Gupta", "URN2026CSE003", "03"),
            ("Priya Nair", "URN2026CSE004", "04"),
            ("Vikram Singh", "URN2026CSE005", "05"),
            ("Sneha Rao", "URN2026CSE006", "06"),
            ("Kabir Mehta", "URN2026CSE007", "07"),
            ("Diya Sen", "URN2026CSE008", "08"),
            ("Arjun Verma", "URN2026CSE009", "09"),
            ("Tanvi Joshi", "URN2026CSE010", "10"),
        ]

        created_students = []
        np.random.seed(42)

        for i, (name, urn, roll) in enumerate(sample_students_data, 1):
            s_prof = Profile(
                institution_id=inst.id,
                email=f"student{i}@snapclass.edu",
                password_hash=default_password,
                role="student",
                status="active"
            )
            db.add(s_prof)
            db.flush()

            st = Student(
                profile_id=s_prof.id,
                urn=urn,
                full_name=name,
                department_id=dept.id,
                division_id=division.id,
                academic_year="2026-2027",
                semester=3,
                roll_number=roll,
                status="active"
            )
            db.add(st)
            db.flush()
            created_students.append(st)

            # Auto-enroll in all division offerings
            db.add(StudentEnrollment(student_id=st.id, offering_id=offering1.id, status="enrolled"))
            db.add(StudentEnrollment(student_id=st.id, offering_id=offering2.id, status="enrolled"))
            db.add(StudentEnrollment(student_id=st.id, offering_id=offering3.id, status="enrolled"))
            db.add(StudentEnrollment(student_id=st.id, offering_id=offering4.id, status="enrolled"))

            # Generate synthetic 512-d unit vector
            vec = np.random.randn(512).astype(np.float32)
            vec = (vec / np.linalg.norm(vec)).tolist()

            emb = StudentFaceEmbedding(
                student_id=st.id,
                model_name="arcface_512d",
                model_version="1.0",
                embedding_dim=512,
                embedding_json=json.dumps(vec),
                active=True
            )
            db.add(emb)

        # 8. Add REAL Student: Ranjit with his extracted 512-d ArcFace vector!
        ranjit_vec_path = Path("benchmark/ranjit_512d.npy")
        if not ranjit_vec_path.exists():
            ranjit_vec_path = BASE_DIR.parent / "benchmark" / "ranjit_512d.npy"

        if ranjit_vec_path.exists():
            ranjit_vec = np.load(str(ranjit_vec_path)).astype(np.float32).tolist()
            print(" -> Loaded real ArcFace 512-d vector for Ranjit from:", ranjit_vec_path)
        else:
            print(" [WARN] ranjit_512d.npy not found, using random seed vector.")
            np.random.seed(99)
            rv = np.random.randn(512).astype(np.float32)
            ranjit_vec = (rv / np.linalg.norm(rv)).tolist()

        ranjit_prof = Profile(
            institution_id=inst.id,
            email="ranjit@snapclass.edu",
            password_hash=default_password,
            role="student",
            status="active"
        )
        db.add(ranjit_prof)
        db.flush()

        ranjit_student = Student(
            profile_id=ranjit_prof.id,
            urn="URN2026CSE011",
            full_name="Ranjit Kumar",
            department_id=dept.id,
            division_id=division.id,
            academic_year="2026-2027",
            semester=3,
            roll_number="11",
            status="active"
        )
        db.add(ranjit_student)
        db.flush()
        created_students.append(ranjit_student)

        db.add(StudentEnrollment(student_id=ranjit_student.id, offering_id=offering1.id, status="enrolled"))
        db.add(StudentEnrollment(student_id=ranjit_student.id, offering_id=offering2.id, status="enrolled"))
        db.add(StudentEnrollment(student_id=ranjit_student.id, offering_id=offering3.id, status="enrolled"))
        db.add(StudentEnrollment(student_id=ranjit_student.id, offering_id=offering4.id, status="enrolled"))

        ranjit_emb = StudentFaceEmbedding(
            student_id=ranjit_student.id,
            model_name="arcface_512d",
            model_version="1.0",
            embedding_dim=512,
            embedding_json=json.dumps(ranjit_vec),
            active=True
        )
        db.add(ranjit_emb)
        db.flush()

        # 9. Seed 2 Historical Confirmed Attendance Sessions (Past 2 Weeks)
        dates = [date.today() - timedelta(days=7), date.today() - timedelta(days=2)]
        for s_idx, s_date in enumerate(dates):
            session = AttendanceSession(
                offering_id=offering1.id,
                teacher_id=faculty_member.id,
                session_date=s_date,
                status="confirmed",
                confirmed_at=datetime.combine(s_date, datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=11)
            )
            db.add(session)
            db.flush()

            for st in created_students:
                # 85% attendance rate
                is_present = (hash(st.urn + str(s_idx)) % 100) < 85
                status_val = "present" if is_present else "absent"
                sim_val = round(float(np.random.uniform(0.48, 0.65)), 3) if is_present else None

                rec = AttendanceRecord(
                    session_id=session.id,
                    student_id=st.id,
                    status=status_val,
                    recognition_similarity=sim_val,
                    review_state="accepted" if is_present else "unidentified",
                    marked_by=prof_faculty.id,
                    marking_method="ai_proposed"
                )
                db.add(rec)
                db.flush()

                # Add sample audit log for one corrected record
                if st.roll_number == "05" and s_idx == 0:
                    rec.status = "present"
                    rec.review_state = "corrected"
                    rec.correction_reason = "Student entered slightly late; verified by faculty"
                    audit = AttendanceAuditLog(
                        attendance_record_id=rec.id,
                        actor_profile_id=prof_faculty.id,
                        old_status="absent",
                        new_status="present",
                        reason="Student entered slightly late; verified by faculty"
                    )
                    db.add(audit)

        db.commit()
        print("Database seeding completed successfully!")
        print(f" -> Institution: {inst.name} (Tier: {inst.subscription_tier})")
        print(f" -> Faculty Accounts: faculty@snapclass.edu, teacher@snapclass.edu (Password: Password123!)")
        print(f" -> Students Seeded: {len(created_students)} enrolled in CSE Div A (including real student Ranjit)")
        print(f" -> Biometric Vector Space: 512 dimensions (ArcFace)")
        print(f" -> Historical Sessions: 2 confirmed sessions with full audit trails")

    except Exception as e:
        db.rollback()
        print(f"Database seed failed: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    import sys
    force = "--reset" in sys.argv or "-f" in sys.argv
    seed_database(force_reseed=force)
