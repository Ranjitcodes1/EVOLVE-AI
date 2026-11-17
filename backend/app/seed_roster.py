import os
import json
import uuid
import numpy as np
from datetime import datetime, timezone, timedelta
from app.database import SessionLocal, engine, Base
from app.models.user import Profile, Student, Teacher
from app.models.academic import (
    Department,
    Branch,
    Division,
    Subject,
    AcademicOffering,
    TeacherOffering,
    StudentEnrollment,
)
from app.models.biometric import StudentFaceEmbedding
from app.models.attendance import AttendanceSession, AttendanceRecord, AttendanceAuditLog
from app.services.auth_service import get_password_hash

def seed_database():
    print("=" * 60)
    print("Starting EVOLVE Academic Division & Student Roster Seeder...")
    print("=" * 60)

    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Department & Branch
        dept = db.query(Department).filter(Department.department_code == "CSE").first()
        if not dept:
            dept = Department(
                department_code="CSE",
                department_name="Department of Computer Science & Engineering"
            )
            db.add(dept)
            db.flush()
            print(" [OK] Created Department: CSE")

        branch = db.query(Branch).filter(Branch.department_id == dept.id, Branch.branch_code == "CSE").first()
        if not branch:
            branch = Branch(
                department_id=dept.id,
                branch_code="CSE",
                branch_name="Computer Science & Engineering"
            )
            db.add(branch)
            db.flush()
            print(" [OK] Created Branch: CSE")

        # 2. Divisions (A and B for Semester 3, 2026-2027)
        div_a = db.query(Division).filter(
            Division.branch_id == branch.id,
            Division.division_name == "A",
            Division.semester == 3,
            Division.academic_year == "2026-2027"
        ).first()
        if not div_a:
            div_a = Division(
                branch_id=branch.id,
                division_name="A",
                academic_year="2026-2027",
                semester=3
            )
            db.add(div_a)
            db.flush()
            print(" [OK] Created Division: CSE Division A (Sem 3)")

        div_b = db.query(Division).filter(
            Division.branch_id == branch.id,
            Division.division_name == "B",
            Division.semester == 3,
            Division.academic_year == "2026-2027"
        ).first()
        if not div_b:
            div_b = Division(
                branch_id=branch.id,
                division_name="B",
                academic_year="2026-2027",
                semester=3
            )
            db.add(div_b)
            db.flush()
            print(" [OK] Created Division: CSE Division B (Sem 3)")

        # 3. Core Academic Subjects
        subject_defs = [
            ("CS301", "Computer Networks"),
            ("CS302", "Operating Systems"),
            ("CS303", "Database Management Systems"),
            ("CS304", "Data Structures & Algorithms"),
            ("CS305", "Theory of Computation"),
        ]

        subjects = []
        for code, name in subject_defs:
            subj = db.query(Subject).filter(Subject.subject_code == code, Subject.department_id == dept.id).first()
            if not subj:
                subj = Subject(subject_code=code, subject_name=name, department_id=dept.id)
                db.add(subj)
                db.flush()
                print(f" [OK] Created Subject: {code} - {name}")
            subjects.append(subj)

        # 4. Academic Offerings for Division A
        offerings_a = []
        for subj in subjects:
            off = db.query(AcademicOffering).filter(
                AcademicOffering.subject_id == subj.id,
                AcademicOffering.division_id == div_a.id,
                AcademicOffering.semester == 3,
                AcademicOffering.academic_year == "2026-2027"
            ).first()
            if not off:
                off = AcademicOffering(
                    subject_id=subj.id,
                    division_id=div_a.id,
                    academic_year="2026-2027",
                    semester=3,
                    section="Default",
                    status="active"
                )
                db.add(off)
                db.flush()
            offerings_a.append(off)
        print(f" [OK] Created {len(offerings_a)} Academic Offerings for Division A")

        # 5. Teacher (Dr. Sarah Jenkins)
        teacher = db.query(Teacher).filter(
            (Teacher.faculty_id == "FAC-2026-104") | (Teacher.full_name == "Dr. Sarah Jenkins")
        ).first()
        if not teacher:
            teacher_prof = db.query(Profile).filter(
                (Profile.email == "sarah.jenkins@evolve.edu") | (Profile.email == "teacher@snapclass.edu")
            ).first()
            if not teacher_prof:
                teacher_prof = Profile(
                    email="sarah.jenkins@evolve.edu",
                    password_hash=get_password_hash("password123"),
                    role="teacher",
                    status="active"
                )
                db.add(teacher_prof)
                db.flush()

            teacher = Teacher(
                profile_id=teacher_prof.id,
                faculty_id="FAC-2026-104",
                full_name="Dr. Sarah Jenkins",
                department_id=dept.id,
                designation="Associate Professor",
                status="active"
            )
            db.add(teacher)
            db.flush()
            print(" [OK] Created Teacher Profile: Dr. Sarah Jenkins (FAC-2026-104)")
        else:
            print(" [OK] Found existing Teacher: Dr. Sarah Jenkins (FAC-2026-104)")

        # Assign Dr. Sarah Jenkins to all Division A offerings
        for off in offerings_a:
            t_off = db.query(TeacherOffering).filter(
                TeacherOffering.teacher_id == teacher.id,
                TeacherOffering.offering_id == off.id
            ).first()
            if not t_off:
                db.add(TeacherOffering(teacher_id=teacher.id, offering_id=off.id))
        db.flush()
        print(" [OK] Assigned Teacher to all Division A Course Offerings")

        # 6. Seed 15 Realistic Students
        student_roster = [
            ("139811001", "Aarav Sharma", "01", "aarav.sharma@evolve.edu"),
            ("139811002", "Bhavna Patel", "02", "bhavna.patel@evolve.edu"),
            ("139811003", "Chirag Verma", "03", "chirag.verma@evolve.edu"),
            ("139811004", "Divya Rao", "04", "divya.rao@evolve.edu"),
            ("139811005", "Esha Gupta", "05", "esha.gupta@evolve.edu"),
            ("139811006", "Farhan Ali", "06", "farhan.ali@evolve.edu"),
            ("139811007", "Gaurav Nair", "07", "gaurav.nair@evolve.edu"),
            ("139811973", "Lucia Ferreira", "08", "student1@snapclass.edu"),  # Primary demo student
            ("139811009", "Ishan Joshi", "09", "ishan.joshi@evolve.edu"),
            ("139811010", "Jennifer Lawrence", "10", "jennifer.l@evolve.edu"),
            ("139811011", "Kabir Malhotra", "11", "kabir.m@evolve.edu"),
            ("139811012", "Lavanya Iyer", "12", "lavanya.i@evolve.edu"),
            ("139811013", "Manav Desai", "13", "manav.desai@evolve.edu"),
            ("139811014", "Neha Reddy", "14", "neha.reddy@evolve.edu"),
            ("139811015", "Omkar Kulkarni", "15", "omkar.k@evolve.edu"),
        ]

        seeded_students = []
        for idx, (urn, name, roll, email) in enumerate(student_roster):
            prof = db.query(Profile).filter(Profile.email == email).first()
            if not prof:
                prof = Profile(
                    email=email,
                    password_hash=get_password_hash("Password123!"),
                    role="student",
                    status="active"
                )
                db.add(prof)
                db.flush()

            stu = db.query(Student).filter(Student.urn == urn).first()
            if not stu:
                stu = Student(
                    profile_id=prof.id,
                    urn=urn,
                    full_name=name,
                    department_id=dept.id,
                    division_id=div_a.id,
                    academic_year="2026-2027",
                    semester=3,
                    roll_number=roll,
                    status="active"
                )
                db.add(stu)
                db.flush()

            # Enroll student into all Division A Offerings
            for off in offerings_a:
                enr = db.query(StudentEnrollment).filter(
                    StudentEnrollment.student_id == stu.id,
                    StudentEnrollment.offering_id == off.id
                ).first()
                if not enr:
                    db.add(StudentEnrollment(student_id=stu.id, offering_id=off.id, status="enrolled"))

            # Create or update ArcFace 512-d Biometric Template
            emb_record = db.query(StudentFaceEmbedding).filter(
                StudentFaceEmbedding.student_id == stu.id,
                StudentFaceEmbedding.active == True
            ).first()
            if not emb_record:
                # Generate a unique pseudo-random 512-d normalized unit vector
                rng = np.random.RandomState(int(urn.replace("FAC", "").replace("-", "")[-6:]))
                vec = rng.randn(512).astype(np.float32)
                norm = np.linalg.norm(vec)
                if norm > 0:
                    vec = vec / norm

                emb_record = StudentFaceEmbedding(
                    student_id=stu.id,
                    model_name="arcface_512d",
                    model_version="1.0",
                    embedding_dim=512,
                    embedding_json=json.dumps(vec.tolist()),
                    active=True
                )
                db.add(emb_record)

            seeded_students.append(stu)

        print(f" [OK] Seeded {len(seeded_students)} Enrolled Students in Division A with 512-d Templates")

        # 7. Pre-seed Historical Confirmed Attendance Sessions for Demo Student (Lucia Ferreira)
        lucia = next((s for s in seeded_students if s.urn == "139811973"), seeded_students[0])
        existing_records_count = db.query(AttendanceRecord).filter(AttendanceRecord.student_id == lucia.id).count()

        if existing_records_count < 8:
            print(" [..] Seeding realistic historical lecture attendance records...")
            today = datetime.now(timezone.utc).date()

            # Create 10 historical sessions across CS301, CS302, CS303
            historical_data = [
                (offerings_a[0], today - timedelta(days=12), "10:00 - 11:00 AM"),
                (offerings_a[1], today - timedelta(days=11), "11:15 - 12:15 PM"),
                (offerings_a[2], today - timedelta(days=10), "02:00 - 03:00 PM"),
                (offerings_a[0], today - timedelta(days=8), "10:00 - 11:00 AM"),
                (offerings_a[1], today - timedelta(days=7), "11:15 - 12:15 PM"),
                (offerings_a[3], today - timedelta(days=5), "09:00 - 10:00 AM"),
                (offerings_a[0], today - timedelta(days=4), "10:00 - 11:00 AM"),
                (offerings_a[2], today - timedelta(days=3), "02:00 - 03:00 PM"),
                (offerings_a[1], today - timedelta(days=2), "11:15 - 12:15 PM"),
                (offerings_a[0], today - timedelta(days=1), "10:00 - 11:00 AM"),
            ]

            for off, s_date, time_slot in historical_data:
                sess = AttendanceSession(
                    offering_id=off.id,
                    teacher_id=teacher.id,
                    session_date=s_date,
                    status="confirmed",
                    confirmed_at=datetime.now(timezone.utc)
                )
                db.add(sess)
                db.flush()

                # Generate attendance for all 15 students in this session
                for s in seeded_students:
                    # Lucia is present in 8 out of 10 sessions (80% attendance rate!)
                    is_present = True
                    if s.id == lucia.id:
                        if s_date == today - timedelta(days=8) or s_date == today - timedelta(days=3):
                            is_present = False
                    else:
                        is_present = np.random.rand() > 0.18

                    db.add(AttendanceRecord(
                        session_id=sess.id,
                        student_id=s.id,
                        status="present" if is_present else "absent",
                        recognition_similarity=0.88 if is_present else None,
                        review_state="accepted" if is_present else "not_detected",
                        marked_by=teacher.profile_id,
                        marking_method="ai_proposed"
                    ))

            print(" [OK] Seeded 10 Confirmed Attendance Sessions with realistic attendance records")

        db.commit()
        print("=" * 60)
        print("SUCCESS! Division A Roster successfully seeded with 15 students!")
        print("Teacher: Dr. Sarah Jenkins (teacher@snapclass.edu / Password123!)")
        print("Student: Lucia Ferreira (student1@snapclass.edu / Password123!)")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        print(f" [ERROR] Seeding failed: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
