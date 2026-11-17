import os
import json
import uuid
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.config import settings
from app.database import get_db
from app.models.user import Profile, Student
from app.models.academic import Department, Branch, Division, AcademicOffering, StudentEnrollment
from app.models.biometric import StudentFaceEmbedding
from app.models.attendance import AttendanceRecord, AttendanceSession
from app.schemas.student import StudentRegisterRequest, StudentResponse
from app.schemas.attendance import (
    StudentAttendanceDashboardResponse,
    StudentSubjectAttendanceSummary,
    StudentAttendanceRecordItem
)
from app.services.auth_service import get_password_hash, get_current_user, require_roles
from app.services.vision_service import vision_service
from app.services.storage_service import storage_service

router = APIRouter(prefix="/students", tags=["Students"])

@router.post("/register", response_model=StudentResponse)
def register_student(payload: StudentRegisterRequest, db: Session = Depends(get_db)):
    # Check email uniqueness
    if db.query(Profile).filter(Profile.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Institutional email is already registered")

    # Check URN uniqueness
    if db.query(Student).filter(Student.urn == payload.urn).first():
        raise HTTPException(status_code=400, detail="URN (University Registration Number) is already registered")

    # Resolve or create division
    division = db.query(Division).filter(
        Division.division_name == payload.division_name,
        Division.semester == payload.semester
    ).first()
    if not division:
        dept = db.query(Department).first()
        if not dept:
            dept = Department(department_code=payload.department_code or "CSE", department_name="Department of Computer Science & Engineering")
            db.add(dept)
            db.flush()
        b_code = payload.branch_code or "CSE"
        branch = db.query(Branch).filter(Branch.department_id == dept.id, Branch.branch_code == b_code).first()
        if not branch:
            branch = Branch(department_id=dept.id, branch_code=b_code, branch_name="Computer Science & Engineering")
            db.add(branch)
            db.flush()
        division = Division(
            branch_id=branch.id,
            division_name=payload.division_name or "A",
            academic_year=payload.academic_year or "2026-2027",
            semester=payload.semester or 3
        )
        db.add(division)
        db.flush()

    # Create profile
    profile = Profile(
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role="student",
        status="active"
    )
    db.add(profile)
    db.flush()

    # Create student
    student = Student(
        profile_id=profile.id,
        urn=payload.urn,
        full_name=payload.full_name,
        division_id=division.id if division else None,
        academic_year=payload.academic_year,
        semester=payload.semester,
        roll_number=payload.roll_number,
        status="active"
    )
    db.add(student)
    db.flush()

    # Auto-enroll only into division offerings that have active faculty assignments
    if division:
        active_offerings = db.query(AcademicOffering).filter(
            AcademicOffering.division_id == division.id,
            AcademicOffering.teacher_assignments.any()
        ).all()
        for off in active_offerings:
            db.add(StudentEnrollment(student_id=student.id, offering_id=off.id, status="enrolled"))

    db.commit()
    db.refresh(student)

    return StudentResponse(
        id=student.id,
        profile_id=student.profile_id,
        urn=student.urn,
        full_name=student.full_name,
        email=profile.email,
        division_name=division.division_name if division else None,
        semester=student.semester,
        academic_year=student.academic_year,
        roll_number=student.roll_number,
        status=student.status,
        has_face_enrolled=False,
        created_at=student.created_at
    )

@router.post("/face-enrollment")
async def enroll_face(
    file: UploadFile = File(...),
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify student identity
    student = db.query(Student).filter(Student.profile_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=403, detail="Student profile not found for this account")

    image_bytes = await file.read()
    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty image file received")

    try:
        extraction = vision_service.extract_enrollment_face(image_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Save enrollment portrait via StorageService (Local or S3)
    object_key = storage_service.save_student_enrollment(
        student_id=student.id,
        file_bytes=image_bytes,
        filename=file.filename or "portrait.jpg"
    )

    # Deactivate prior embeddings
    db.query(StudentFaceEmbedding).filter(StudentFaceEmbedding.student_id == student.id).update({"active": False})

    # Store new ArcFace biometric embedding
    embedding_record = StudentFaceEmbedding(
        student_id=student.id,
        model_name=extraction.get("model", "arcface_512d"),
        model_version="1.0",
        embedding_dim=extraction.get("dimension", 512),
        embedding_json=json.dumps(extraction["embedding"]),
        photo_object_key=object_key,
        active=True
    )
    db.add(embedding_record)
    db.commit()

    return {
        "status": "success",
        "message": "Face enrolled successfully and 512-d biometric template stored securely.",
        "student_id": student.id,
        "model": extraction.get("model"),
        "dimension": extraction.get("dimension", 512),
        "confidence": extraction.get("confidence")
    }

@router.get("/me/portrait")
def get_my_portrait(
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Secure Authenticated Stream for Student Enrollment Portrait."""
    student = db.query(Student).filter(Student.profile_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    embedding_record = db.query(StudentFaceEmbedding).filter(
        StudentFaceEmbedding.student_id == student.id,
        StudentFaceEmbedding.active == True
    ).first()

    if not embedding_record or not embedding_record.photo_object_key:
        raise HTTPException(status_code=404, detail="No active biometric portrait enrolled")

    try:
        data = storage_service.get_file(embedding_record.photo_object_key)
        return Response(content=data, media_type="image/jpeg")
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Portrait image not available in storage: {e}")

@router.get("/me", response_model=StudentResponse)
def get_student_profile(
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    student = db.query(Student).filter(Student.profile_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    has_emb = db.query(StudentFaceEmbedding).filter(
        StudentFaceEmbedding.student_id == student.id,
        StudentFaceEmbedding.active == True
    ).first() is not None

    return StudentResponse(
        id=student.id,
        profile_id=student.profile_id,
        urn=student.urn,
        full_name=student.full_name,
        email=current_user.email,
        division_name=student.division.division_name if student.division else None,
        semester=student.semester,
        academic_year=student.academic_year,
        roll_number=student.roll_number,
        status=student.status,
        has_face_enrolled=has_emb,
        created_at=student.created_at
    )

@router.get("/me/attendance", response_model=StudentAttendanceDashboardResponse)
def get_my_attendance(
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    student = db.query(Student).filter(Student.profile_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    # Fetch confirmed attendance records
    records = db.query(AttendanceRecord, AttendanceSession).join(
        AttendanceSession, AttendanceRecord.session_id == AttendanceSession.id
    ).filter(
        AttendanceRecord.student_id == student.id,
        AttendanceSession.status == "confirmed"
    ).order_by(AttendanceSession.session_date.desc()).all()

    total_classes = len(records)
    attended_classes = sum(1 for r, s in records if r.status in ["present", "late"])
    overall_pct = round((attended_classes / total_classes * 100), 1) if total_classes > 0 else 0.0

    import math
    if total_classes == 0:
        safe_miss_overall = 0
        recovery_needed_overall = 0
    elif overall_pct >= 75.0:
        safe_miss_overall = max(0, int((attended_classes - 0.75 * total_classes) // 0.75))
        recovery_needed_overall = 0
    else:
        safe_miss_overall = 0
        recovery_needed_overall = max(1, math.ceil((0.75 * total_classes - attended_classes) / 0.25))

    # Teacher-Driven Subject Discovery:
    # Subjects appear if actively assigned to a faculty member for this division, or if confirmed sessions exist.
    subjects_map = {}
    if student.division_id:
        active_offerings = db.query(AcademicOffering).filter(
            AcademicOffering.division_id == student.division_id,
            AcademicOffering.teacher_assignments.any()
        ).all()
        for off in active_offerings:
            if off.subject:
                code = off.subject.subject_code
                name = off.subject.subject_name
                if code not in subjects_map:
                    subjects_map[code] = {"name": name, "total": 0, "attended": 0}

    recent_list = []
    for r, s in records:
        offering = s.offering
        subj_code = offering.subject.subject_code if offering and offering.subject else "GEN"
        subj_name = offering.subject.subject_name if offering and offering.subject else "General"

        if subj_code not in subjects_map:
            subjects_map[subj_code] = {"name": subj_name, "total": 0, "attended": 0}

        subjects_map[subj_code]["total"] += 1
        if r.status in ["present", "late"]:
            subjects_map[subj_code]["attended"] += 1

        recent_list.append(StudentAttendanceRecordItem(
            session_id=s.id,
            subject_code=subj_code,
            subject_name=subj_name,
            session_date=s.session_date,
            status=r.status,
            marking_method=r.marking_method,
            review_state=r.review_state
        ))

    subject_summaries = []
    for code, s_data in subjects_map.items():
        tot = s_data["total"]
        att = s_data["attended"]
        pct = round((att / tot * 100), 1) if tot > 0 else 0.0

        if tot == 0:
            sub_safe_miss = 0
            sub_recovery = 0
        elif pct >= 75.0:
            sub_safe_miss = max(0, int((att - 0.75 * tot) // 0.75))
            sub_recovery = 0
        else:
            sub_safe_miss = 0
            sub_recovery = max(1, math.ceil((0.75 * tot - att) / 0.25))

        subject_summaries.append(StudentSubjectAttendanceSummary(
            subject_code=code,
            subject_name=s_data["name"],
            total_classes=tot,
            attended_classes=att,
            attendance_percentage=pct,
            safe_missable_classes=sub_safe_miss,
            recovery_classes_needed=sub_recovery
        ))

    return StudentAttendanceDashboardResponse(
        student_id=student.id,
        full_name=student.full_name,
        urn=student.urn,
        division_name=student.division.division_name if student.division else None,
        semester=student.semester,
        academic_year=student.academic_year,
        roll_number=student.roll_number,
        overall_percentage=overall_pct,
        total_classes=total_classes,
        attended_classes=attended_classes,
        safe_missable_classes=safe_miss_overall,
        recovery_classes_needed=recovery_needed_overall,
        subject_summaries=subject_summaries,
        recent_records=recent_list[:60]
    )
