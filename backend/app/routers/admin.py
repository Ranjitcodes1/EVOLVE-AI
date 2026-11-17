from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.user import Profile, Student, Teacher
from app.models.academic import Department, Branch, Division, Subject, AcademicOffering, StudentEnrollment
from app.models.attendance import AttendanceSession, AttendanceRecord, AttendanceAuditLog
from app.services.auth_service import get_current_user, require_roles

router = APIRouter(prefix="/admin", tags=["Admin Console"])

@router.get("/audit")
def get_audit_trail(
    limit: int = Query(50, ge=1, le=200),
    current_user: Profile = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db)
):
    logs = db.query(AttendanceAuditLog, AttendanceRecord, Student, Profile).join(
        AttendanceRecord, AttendanceAuditLog.attendance_record_id == AttendanceRecord.id
    ).join(
        Student, AttendanceRecord.student_id == Student.id
    ).join(
        Profile, AttendanceAuditLog.actor_profile_id == Profile.id
    ).order_by(desc(AttendanceAuditLog.created_at)).limit(limit).all()

    results = []
    for log, rec, stu, prof in logs:
        results.append({
            "id": log.id,
            "session_id": rec.session_id,
            "student_urn": stu.urn,
            "student_name": stu.full_name,
            "actor_email": prof.email,
            "actor_role": prof.role,
            "old_status": log.old_status,
            "new_status": log.new_status,
            "reason": log.reason,
            "timestamp": log.created_at.isoformat()
        })
    return results

@router.get("/stats")
def get_system_stats(
    current_user: Profile = Depends(require_roles(["admin", "teacher"])),
    db: Session = Depends(get_db)
):
    total_students = db.query(Student).filter(Student.status == "active").count()
    total_teachers = db.query(Teacher).filter(Teacher.status == "active").count()
    total_offerings = db.query(AcademicOffering).count()
    total_sessions = db.query(AttendanceSession).count()
    confirmed_sessions = db.query(AttendanceSession).filter(AttendanceSession.status == "confirmed").count()

    return {
        "total_students": total_students,
        "total_teachers": total_teachers,
        "total_offerings": total_offerings,
        "total_sessions": total_sessions,
        "confirmed_sessions": confirmed_sessions
    }
