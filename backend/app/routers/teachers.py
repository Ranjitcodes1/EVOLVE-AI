from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.user import Profile, Teacher, Student
from app.models.academic import (
    TeacherOffering,
    AcademicOffering,
    StudentEnrollment,
    Department,
    Branch,
    Division,
    Subject,
)
from app.models.attendance import AttendanceSession, AttendanceRecord
from app.schemas.teacher import (
    TeacherOfferingResponse,
    TeacherProfileResponse,
    TeacherRegisterRequest,
    CustomOfferingRequest,
)
from app.schemas.attendance import AttendanceSessionSummary
from app.services.auth_service import get_current_user, require_roles, get_password_hash

router = APIRouter(prefix="/teachers", tags=["Teachers"])

def resolve_or_create_offering(
    db: Session,
    dept: Department,
    branch_code: str,
    course_name: str,
    subject_code: str,
    subject_name: str,
    division_name: str,
    semester: int,
    academic_year: str = "2026-2027"
) -> AcademicOffering:
    # 1. Branch
    b_code = (branch_code or "CSE").strip().upper()
    b_name = (course_name or "Computer Science & Engineering").strip()
    branch = db.query(Branch).filter(
        Branch.department_id == dept.id,
        Branch.branch_code == b_code
    ).first()
    if not branch:
        branch = Branch(
            department_id=dept.id,
            branch_code=b_code,
            branch_name=b_name
        )
        db.add(branch)
        db.flush()

    # 2. Division
    d_name = (division_name or "A").strip().upper()
    div = db.query(Division).filter(
        Division.branch_id == branch.id,
        Division.division_name == d_name,
        Division.semester == semester,
        Division.academic_year == academic_year
    ).first()
    if not div:
        div = Division(
            branch_id=branch.id,
            division_name=d_name,
            semester=semester,
            academic_year=academic_year
        )
        db.add(div)
        db.flush()

    # 3. Subject
    s_code = (subject_code or "CS301").strip().upper()
    s_name = (subject_name or "Computer Networks").strip()
    subj = db.query(Subject).filter(
        Subject.department_id == dept.id,
        Subject.subject_code == s_code
    ).first()
    if not subj:
        subj = Subject(
            department_id=dept.id,
            subject_code=s_code,
            subject_name=s_name
        )
        db.add(subj)
        db.flush()
    elif s_name and subj.subject_name != s_name:
        subj.subject_name = s_name
        db.flush()

    # 4. Offering
    offering = db.query(AcademicOffering).filter(
        AcademicOffering.subject_id == subj.id,
        AcademicOffering.division_id == div.id,
        AcademicOffering.academic_year == academic_year,
        AcademicOffering.semester == semester
    ).first()
    if not offering:
        offering = AcademicOffering(
            subject_id=subj.id,
            division_id=div.id,
            academic_year=academic_year,
            semester=semester,
            status="active"
        )
        db.add(offering)
        db.flush()

    # Auto-enroll all students belonging to this division name and semester
    matching_divs = db.query(Division).filter(
        Division.division_name.ilike(d_name),
        Division.semester == semester
    ).all()
    matching_div_ids = [d.id for d in matching_divs]
    if div.id not in matching_div_ids:
        matching_div_ids.append(div.id)

    students = db.query(Student).filter(
        (Student.division_id.in_(matching_div_ids)) | (
            (Student.semester == semester) & Student.division.has(Division.division_name.ilike(d_name))
        ),
        Student.status == "active"
    ).all()
    for s in students:
        existing_enr = db.query(StudentEnrollment).filter(
            StudentEnrollment.student_id == s.id,
            StudentEnrollment.offering_id == offering.id
        ).first()
        if not existing_enr:
            db.add(StudentEnrollment(
                student_id=s.id,
                offering_id=offering.id,
                status="enrolled"
            ))
    db.flush()

    return offering

@router.post("/register", response_model=TeacherProfileResponse)
def register_teacher(payload: TeacherRegisterRequest, db: Session = Depends(get_db)):
    # Check email uniqueness
    if db.query(Profile).filter(Profile.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Institutional faculty email is already registered")

    # Check faculty_id uniqueness
    if db.query(Teacher).filter(Teacher.faculty_id == payload.faculty_id).first():
        raise HTTPException(status_code=400, detail="Faculty ID is already registered")

    # Create profile
    profile = Profile(
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role="teacher",
        status="active"
    )
    db.add(profile)
    db.flush()

    # Match department
    dept = db.query(Department).first()
    if payload.department_name:
        matched_dept = db.query(Department).filter(
            Department.department_name.ilike(f"%{payload.department_name}%")
        ).first()
        if matched_dept:
            dept = matched_dept
    if not dept:
        dept = Department(department_code="CSE", department_name="Department of Computer Science & Engineering")
        db.add(dept)
        db.flush()

    # Create teacher
    teacher = Teacher(
        profile_id=profile.id,
        faculty_id=payload.faculty_id,
        full_name=payload.full_name,
        department_id=dept.id if dept else None,
        designation=payload.designation or "Assistant Professor",
        status="active"
    )
    db.add(teacher)
    db.flush()

    # Track assigned offerings to prevent duplicate insertions in TeacherOffering
    assigned_offering_ids = set()

    # If custom subject/course/division provided, resolve or create it
    if payload.subject_code and payload.subject_name:
        chosen_offering = resolve_or_create_offering(
            db=db,
            dept=dept,
            branch_code=payload.branch_code or "CSE",
            course_name=payload.course_name or "Computer Science & Engineering",
            subject_code=payload.subject_code,
            subject_name=payload.subject_name,
            division_name=payload.division_name or "A",
            semester=payload.semester or 3,
            academic_year=payload.academic_year or "2026-2027"
        )
        db.add(TeacherOffering(teacher_id=teacher.id, offering_id=chosen_offering.id))
        assigned_offering_ids.add(chosen_offering.id)

    db.commit()
    db.refresh(teacher)

    return TeacherProfileResponse(
        id=teacher.id,
        faculty_id=teacher.faculty_id,
        full_name=teacher.full_name,
        email=profile.email,
        department_name=dept.department_name if dept else "Computer Science",
        designation=teacher.designation
    )

def get_or_create_teacher(profile: Profile, db: Session) -> Optional[Teacher]:
    teacher = profile.teacher or db.query(Teacher).filter(Teacher.profile_id == profile.id).first()
    if not teacher and profile.role in ("teacher", "faculty", "admin"):
        dept = db.query(Department).first()
        if not dept:
            dept = Department(department_code="CSE", department_name="Department of Computer Science & Engineering")
            db.add(dept)
            db.flush()
        teacher = Teacher(
            profile_id=profile.id,
            faculty_id=f"FAC-{profile.id[:8].upper()}",
            full_name=profile.email.split("@")[0].replace(".", " ").title(),
            department_id=dept.id if dept else None,
            designation="Faculty Member",
            status="active"
        )
        db.add(teacher)
        db.commit()
        db.refresh(teacher)
    return teacher

@router.post("/offerings/custom", response_model=TeacherOfferingResponse)
def create_custom_offering(
    payload: CustomOfferingRequest,
    current_user: Profile = Depends(require_roles(["teacher", "admin"])),
    db: Session = Depends(get_db)
):
    teacher = get_or_create_teacher(current_user, db)
    if not teacher and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Teacher profile not found")

    dept = teacher.department if teacher and teacher.department else db.query(Department).first()
    if not dept:
        dept = Department(department_code="CSE", department_name="Department of Computer Science & Engineering")
        db.add(dept)
        db.flush()

    offering = resolve_or_create_offering(
        db=db,
        dept=dept,
        branch_code=payload.branch_code or "CSE",
        course_name=payload.course_name or "Computer Science & Engineering",
        subject_code=payload.subject_code,
        subject_name=payload.subject_name,
        division_name=payload.division_name or "A",
        semester=payload.semester or 3,
        academic_year=payload.academic_year or "2026-2027"
    )

    if teacher:
        existing_assignment = db.query(TeacherOffering).filter(
            TeacherOffering.teacher_id == teacher.id,
            TeacherOffering.offering_id == offering.id
        ).first()
        if not existing_assignment:
            db.add(TeacherOffering(teacher_id=teacher.id, offering_id=offering.id))
            db.flush()

    db.commit()
    db.refresh(offering)

    count = db.query(StudentEnrollment).filter(
        StudentEnrollment.offering_id == offering.id,
        StudentEnrollment.status == "enrolled"
    ).count()
    if count == 0 and offering.division_id:
        count = db.query(Student).filter(
            Student.division_id == offering.division_id,
            Student.status == "active"
        ).count()

    return TeacherOfferingResponse(
        offering_id=offering.id,
        subject_code=offering.subject.subject_code if offering.subject else "",
        subject_name=offering.subject.subject_name if offering.subject else "",
        division_id=offering.division_id,
        division_name=offering.division.division_name if offering.division else "",
        branch_code=offering.division.branch.branch_code if offering.division and offering.division.branch else "",
        department_name=dept.department_name,
        academic_year=offering.academic_year,
        semester=offering.semester,
        enrolled_students_count=count
    )

@router.get("/me/offerings", response_model=List[TeacherOfferingResponse])
def get_my_offerings(
    current_user: Profile = Depends(require_roles(["teacher", "admin"])),
    db: Session = Depends(get_db)
):
    teacher = get_or_create_teacher(current_user, db)
    if not teacher and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Teacher profile not found")

    if teacher:
        assignments = db.query(TeacherOffering).filter(TeacherOffering.teacher_id == teacher.id).all()
        if not assignments:
            # Auto-assign active offerings in Division A so teacher has courses immediately available
            all_offerings = db.query(AcademicOffering).filter(AcademicOffering.status == "active").all()
            for off in all_offerings:
                db.add(TeacherOffering(teacher_id=teacher.id, offering_id=off.id))
            db.commit()
            assignments = db.query(TeacherOffering).filter(TeacherOffering.teacher_id == teacher.id).all()

        offering_ids = [a.offering_id for a in assignments]
        offerings = db.query(AcademicOffering).filter(AcademicOffering.id.in_(offering_ids)).all()
    else:
        offerings = db.query(AcademicOffering).all()

    result = []
    for off in offerings:
        # Count all students: explicit enrollments UNION all students registered in matching division
        enrolled_ids = set(
            e.student_id for e in db.query(StudentEnrollment.student_id).filter(
                StudentEnrollment.offering_id == off.id,
                StudentEnrollment.status == "enrolled"
            ).all()
        )
        if off.division:
            matching_div_ids = [
                d.id for d in db.query(Division.id).filter(
                    Division.division_name.ilike(off.division.division_name),
                    Division.semester == off.division.semester
                ).all()
            ]
            if off.division_id not in matching_div_ids:
                matching_div_ids.append(off.division_id)
            div_students = db.query(Student.id).filter(
                Student.status == "active",
                Student.division_id.in_(matching_div_ids)
            ).all()
            for (sid,) in div_students:
                enrolled_ids.add(sid)
        elif off.division_id:
            div_students = db.query(Student.id).filter(
                Student.division_id == off.division_id,
                Student.status == "active"
            ).all()
            for (sid,) in div_students:
                enrolled_ids.add(sid)

        count = len(enrolled_ids)

        result.append(TeacherOfferingResponse(
            offering_id=off.id,
            subject_code=off.subject.subject_code if off.subject else "",
            subject_name=off.subject.subject_name if off.subject else "",
            division_id=off.division_id,
            division_name=off.division.division_name if off.division else "",
            branch_code=off.division.branch.branch_code if off.division and off.division.branch else "",
            department_name=off.division.branch.department.department_name if off.division and off.division.branch and off.division.branch.department else "",
            academic_year=off.academic_year,
            semester=off.semester,
            enrolled_students_count=count
        ))

    return result

@router.delete("/offerings/{offering_id}")
def remove_teacher_offering(
    offering_id: str,
    current_user: Profile = Depends(require_roles(["teacher", "admin"])),
    db: Session = Depends(get_db)
):
    teacher = get_or_create_teacher(current_user, db)
    if not teacher and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Teacher profile not found")

    query = db.query(TeacherOffering).filter(TeacherOffering.offering_id == offering_id)
    if teacher:
        query = query.filter(TeacherOffering.teacher_id == teacher.id)

    assignment = query.first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Course offering not found in your teaching portfolio")

    db.delete(assignment)
    db.commit()

    return {"message": "Course offering removed from teaching portfolio", "offering_id": offering_id}

@router.get("/offerings/{offering_id}/roster")
def get_offering_student_roster(
    offering_id: str,
    current_user: Profile = Depends(require_roles(["teacher", "admin"])),
    db: Session = Depends(get_db)
):
    offering = db.query(AcademicOffering).filter(AcademicOffering.id == offering_id).first()
    if not offering:
        raise HTTPException(status_code=404, detail="Offering not found")

    # 1. Direct enrollments
    enrollments = db.query(StudentEnrollment).filter(
        StudentEnrollment.offering_id == offering_id,
        StudentEnrollment.status == "enrolled"
    ).all()
    student_ids = set(e.student_id for e in enrollments)

    # 2. Union all active students in matching division and auto-backfill enrollments
    if offering.division:
        matching_div_ids = [
            d.id for d in db.query(Division.id).filter(
                Division.division_name.ilike(offering.division.division_name),
                Division.semester == offering.division.semester
            ).all()
        ]
        if offering.division_id not in matching_div_ids:
            matching_div_ids.append(offering.division_id)
        div_students = db.query(Student).filter(
            Student.status == "active",
            Student.division_id.in_(matching_div_ids)
        ).all()
        for ds in div_students:
            student_ids.add(ds.id)
            existing_enr = db.query(StudentEnrollment).filter(
                StudentEnrollment.student_id == ds.id,
                StudentEnrollment.offering_id == offering_id
            ).first()
            if not existing_enr:
                db.add(StudentEnrollment(
                    student_id=ds.id,
                    offering_id=offering_id,
                    status="enrolled"
                ))
    elif offering.division_id:
        div_students = db.query(Student).filter(
            Student.division_id == offering.division_id,
            Student.status == "active"
        ).all()
        for ds in div_students:
            student_ids.add(ds.id)
            existing_enr = db.query(StudentEnrollment).filter(
                StudentEnrollment.student_id == ds.id,
                StudentEnrollment.offering_id == offering_id
            ).first()
            if not existing_enr:
                db.add(StudentEnrollment(
                    student_id=ds.id,
                    offering_id=offering_id,
                    status="enrolled"
                ))

    db.commit()

    students = db.query(Student).filter(
        Student.id.in_(list(student_ids)),
        Student.status == "active"
    ).order_by(Student.roll_number.asc(), Student.full_name.asc()).all()

    # Confirmed sessions for this offering
    confirmed_sessions = db.query(AttendanceSession).filter(
        AttendanceSession.offering_id == offering_id,
        AttendanceSession.status == "confirmed"
    ).all()
    session_ids = [s.id for s in confirmed_sessions]
    total_held = len(session_ids)

    roster_list = []
    at_risk_count = 0
    on_track_count = 0

    for s in students:
        if total_held > 0:
            attended = db.query(AttendanceRecord).filter(
                AttendanceRecord.session_id.in_(session_ids),
                AttendanceRecord.student_id == s.id,
                AttendanceRecord.status.in_(["present", "late"])
            ).count()
            pct = round((attended / total_held * 100), 1)
            is_at_risk = pct < 75.0
            if is_at_risk:
                at_risk_count += 1
            else:
                on_track_count += 1
        else:
            attended = 0
            pct = None
            is_at_risk = False

        roster_list.append({
            "student_id": s.id,
            "urn": s.urn,
            "full_name": s.full_name,
            "roll_number": s.roll_number or "—",
            "total_classes": total_held,
            "attended_classes": attended,
            "attendance_percentage": pct,
            "is_at_risk": is_at_risk,
            "status": s.status
        })

    return {
        "offering_id": offering.id,
        "subject_code": offering.subject.subject_code if offering.subject else "",
        "subject_name": offering.subject.subject_name if offering.subject else "",
        "division_name": offering.division.division_name if offering.division else "",
        "semester": offering.semester,
        "total_classes_held": total_held,
        "total_students": len(roster_list),
        "at_risk_count": at_risk_count,
        "on_track_count": on_track_count,
        "students": roster_list
    }

@router.get("/me/sessions", response_model=List[AttendanceSessionSummary])
def get_my_recent_sessions(
    current_user: Profile = Depends(require_roles(["teacher", "admin"])),
    db: Session = Depends(get_db)
):
    teacher = get_or_create_teacher(current_user, db)
    query = db.query(AttendanceSession)
    if teacher:
        query = query.filter(AttendanceSession.teacher_id == teacher.id)

    sessions = query.order_by(AttendanceSession.session_date.desc(), AttendanceSession.created_at.desc()).limit(20).all()

    results = []
    for s in sessions:
        offering = s.offering
        total = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == s.id).count()
        present = db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id == s.id,
            AttendanceRecord.status.in_(["present", "late"])
        ).count()
        absent = total - present

        results.append(AttendanceSessionSummary(
            id=s.id,
            offering_id=s.offering_id,
            subject_name=offering.subject.subject_name if offering and offering.subject else "",
            subject_code=offering.subject.subject_code if offering and offering.subject else "",
            division_name=offering.division.division_name if offering and offering.division else "",
            session_date=s.session_date,
            status=s.status,
            total_enrolled=total,
            present_count=present,
            absent_count=absent,
            confirmed_at=s.confirmed_at
        ))
    return results
