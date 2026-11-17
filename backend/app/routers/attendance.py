import os
import uuid
import io
import csv
from typing import List, Optional
from datetime import date, datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import Profile, Teacher, Student
from app.models.attendance import (
    AttendanceSession,
    AttendanceRecord,
    AttendanceCaptureAsset,
    AttendanceAuditLog
)
from app.schemas.attendance import (
    CreateSessionRequest,
    SessionProposalsResponse,
    UpdateSessionRecordsRequest,
    AttendanceSessionSummary
)
from app.services.auth_service import get_current_user, require_roles
from app.services.attendance_service import attendance_service
from app.services.storage_service import storage_service
from app.services.retention_service import retention_service
from app.services.task_service import task_service
from app.tasks.vision_tasks import execute_session_vision_task

router = APIRouter(prefix="/attendance", tags=["Attendance Sessions"])

@router.post("/sessions")
def create_session(
    payload: CreateSessionRequest,
    current_user: Profile = Depends(require_roles(["faculty", "teacher"])),
    db: Session = Depends(get_db)
):
    teacher = db.query(Teacher).filter(Teacher.profile_id == current_user.id).first()
    if not teacher:
        raise HTTPException(status_code=403, detail="Only faculty can start an attendance session")

    session = attendance_service.create_session(
        db=db,
        teacher_id=teacher.id,
        offering_id=payload.offering_id,
        session_date=payload.session_date
    )
    return {
        "session_id": session.id,
        "offering_id": session.offering_id,
        "session_date": str(session.session_date),
        "status": session.status
    }

@router.post("/sessions/{session_id}/assets")
async def upload_classroom_assets(
    session_id: str,
    files: List[UploadFile] = File(...),
    current_user: Profile = Depends(require_roles(["faculty", "teacher"])),
    db: Session = Depends(get_db)
):
    """
    Classroom Photo Upload with Ephemeral 30-Day Retention Tracking.
    Saves encrypted images to StorageService (Local or MinIO S3).
    """
    session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.RAW_CAPTURE_RETENTION_DAYS)
    saved_assets = []

    for file in files:
        content = await file.read()
        if len(content) == 0:
            continue

        # Upload via StorageService
        object_key = storage_service.save_classroom_capture(
            session_id=session_id,
            file_bytes=content,
            filename=file.filename or "capture.jpg"
        )

        asset = AttendanceCaptureAsset(
            session_id=session_id,
            object_key=object_key,
            processing_state="pending",
            expires_at=expires_at
        )
        db.add(asset)
        saved_assets.append(asset)

    session.status = "uploading"
    db.commit()

    return {
        "session_id": session_id,
        "uploaded_count": len(saved_assets),
        "status": session.status,
        "retention_expires_at": expires_at.isoformat()
    }

@router.get("/sessions/{session_id}/assets/{asset_id}")
def get_session_asset_image(
    session_id: str,
    asset_id: str,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Secure Authenticated Stream for Classroom Capture Photos."""
    asset = db.query(AttendanceCaptureAsset).filter(
        AttendanceCaptureAsset.id == asset_id,
        AttendanceCaptureAsset.session_id == session_id
    ).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    if asset.purged_at:
        raise HTTPException(status_code=410, detail="Capture photo has been purged per 30-day retention policy.")

    try:
        data = storage_service.get_file(asset.object_key)
        return Response(content=data, media_type="image/jpeg")
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Image file not available in storage: {e}")

@router.post("/sessions/{session_id}/process", status_code=status.HTTP_202_ACCEPTED)
def process_recognition(
    session_id: str,
    sync: bool = False,
    current_user: Profile = Depends(require_roles(["faculty", "teacher"])),
    db: Session = Depends(get_db)
):
    """
    Asynchronous Classroom Attendance Processing.
    Dispatches YuNet detection & ArcFace 512-d recognition to background worker.
    Returns immediately with task_id for live progress tracking.
    """
    session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Attendance session not found")

    teacher = db.query(Teacher).filter(Teacher.profile_id == current_user.id).first()
    if not teacher or session.teacher_id != teacher.id:
        raise HTTPException(status_code=403, detail="Unauthorized to process this session")

    assets_count = db.query(AttendanceCaptureAsset).filter(AttendanceCaptureAsset.session_id == session_id).count()
    if assets_count == 0:
        raise HTTPException(status_code=400, detail="No classroom photos uploaded for this session")

    if sync:
        attendance_service.process_session(db=db, session_id=session_id, teacher_profile_id=current_user.id)
        return attendance_service.get_proposals(db, session_id)

    task_id = task_service.create_task(session_id)
    session.status = "queued"
    db.commit()

    # Dispatch to background vision worker pool
    task_service.submit_job(execute_session_vision_task, session_id, current_user.id, task_id)

    return {
        "task_id": task_id,
        "session_id": session_id,
        "status": "queued",
        "message": "Classroom attendance recognition queued in background worker."
    }

@router.get("/sessions/{session_id}/status")
def get_session_status(
    session_id: str,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Live Progress & Stage Polling Endpoint for Active Sessions."""
    session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    task = task_service.get_task_for_session(session_id)
    if not task:
        is_ready = session.status in ("review_required", "confirmed")
        return {
            "session_id": session_id,
            "session_status": session.status,
            "task_id": None,
            "task_status": "completed" if is_ready else session.status,
            "stage": "Review Ready" if is_ready else "Idle",
            "progress_pct": 100 if is_ready else 0,
            "faces_detected": 0,
            "summary": {}
        }

    return {
        "session_id": session_id,
        "session_status": session.status,
        "task_id": task["task_id"],
        "task_status": task["status"],
        "stage": task["stage"],
        "progress_pct": task["progress_pct"],
        "faces_detected": task["faces_detected"],
        "summary": task["summary"],
        "error": task.get("error"),
        "duration_ms": task.get("duration_ms")
    }

@router.get("/sessions/{session_id}/proposals", response_model=SessionProposalsResponse)
def get_session_proposals(
    session_id: str,
    current_user: Profile = Depends(require_roles(["faculty", "teacher"])),
    db: Session = Depends(get_db)
):
    proposals_data = attendance_service.get_proposals(db, session_id)
    return proposals_data

@router.patch("/sessions/{session_id}/records")
def update_records(
    session_id: str,
    payload: UpdateSessionRecordsRequest,
    current_user: Profile = Depends(require_roles(["faculty", "teacher"])),
    db: Session = Depends(get_db)
):
    result = attendance_service.update_records(
        db=db,
        session_id=session_id,
        teacher_profile_id=current_user.id,
        updates=payload.updates
    )
    return result

@router.post("/sessions/{session_id}/confirm")
def confirm_session(
    session_id: str,
    current_user: Profile = Depends(require_roles(["faculty", "teacher"])),
    db: Session = Depends(get_db)
):
    confirmed = attendance_service.confirm_session(
        db=db,
        session_id=session_id,
        teacher_profile_id=current_user.id
    )
    return {
        "session_id": confirmed.id,
        "status": confirmed.status,
        "confirmed_at": confirmed.confirmed_at.isoformat() if confirmed.confirmed_at else None,
        "message": "Attendance successfully verified and locked."
    }

@router.get("/sessions/{session_id}/export")
def export_session_csv(
    session_id: str,
    current_user: Profile = Depends(require_roles(["faculty", "teacher"])),
    db: Session = Depends(get_db)
):
    session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    records = db.query(AttendanceRecord, Student).join(
        Student, AttendanceRecord.student_id == Student.id
    ).filter(AttendanceRecord.session_id == session_id).all()

    offering = session.offering
    subject_code = offering.subject.subject_code if offering and offering.subject else "N/A"
    subject_name = offering.subject.subject_name if offering and offering.subject else "N/A"
    division = offering.division.division_name if offering and offering.division else "N/A"

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["SnapClass AI - Official Attendance Record"])
    writer.writerow(["Subject Code", subject_code, "Subject Name", subject_name])
    writer.writerow(["Division", division, "Session Date", str(session.session_date)])
    writer.writerow(["Status", session.status, "Confirmed At", str(session.confirmed_at or "Draft")])
    writer.writerow([])
    writer.writerow(["URN", "Student Name", "Roll Number", "Status", "Marking Method", "Similarity", "Review Note", "Correction Reason"])

    for r, s in records:
        writer.writerow([
            s.urn,
            s.full_name,
            s.roll_number or "-",
            r.status.upper(),
            r.marking_method,
            f"{r.recognition_similarity:.2f}" if r.recognition_similarity is not None else "-",
            r.review_state,
            r.correction_reason or "-"
        ])

    output.seek(0)
    filename = f"attendance_{subject_code}_{division}_{session.session_date}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.post("/maintenance/purge-expired")
def trigger_purge_maintenance(
    force_all: bool = False,
    current_user: Profile = Depends(require_roles(["faculty", "teacher"])),
    db: Session = Depends(get_db)
):
    """Triggers 30-day raw capture auto-purge maintenance."""
    return retention_service.purge_expired_capture_assets(db, force_all=force_all)
