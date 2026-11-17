import json
import time
from datetime import datetime, timezone
from typing import Dict, Any

from app.database import SessionLocal
from app.models.attendance import (
    AttendanceSession,
    AttendanceRecord,
    AttendanceCaptureAsset
)
from app.models.academic import AcademicOffering, StudentEnrollment
from app.models.user import Student, Teacher
from app.models.biometric import StudentFaceEmbedding
from app.services.vision_service import vision_service
from app.services.storage_service import storage_service
from app.services.task_service import task_service
from app.config import settings

def execute_session_vision_task(session_id: str, teacher_profile_id: str, task_id: str) -> None:
    """
    Asynchronous Background Worker Job.
    Loads classroom photos from StorageService, runs YuNet face detection,
    computes ArcFace 512-d similarities against the enrolled class roster,
    and updates session status to 'review_required'.
    """
    db = SessionLocal()
    try:
        task_service.update_task(
            task_id,
            status="in_progress",
            stage="Initializing vision worker...",
            progress_pct=10
        )

        session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
        if not session:
            task_service.update_task(task_id, status="failed", error="Session not found", progress_pct=100)
            return

        assets = db.query(AttendanceCaptureAsset).filter(
            AttendanceCaptureAsset.session_id == session_id
        ).all()
        if not assets:
            task_service.update_task(task_id, status="failed", error="No classroom photos uploaded", progress_pct=100)
            return

        session.status = "processing"
        db.commit()

        # Stage 1: Face Detection with YuNet
        task_service.update_task(
            task_id,
            status="detecting",
            stage=f"Scanning {len(assets)} classroom photos for seated students...",
            progress_pct=25
        )

        all_detections = []
        for asset in assets:
            try:
                try:
                    img_bytes = storage_service.get_file(asset.object_key)
                except Exception:
                    with open(asset.object_key, "rb") as f:
                        img_bytes = f.read()

                detections = vision_service.detect_classroom_faces(img_bytes)
                all_detections.extend(detections)
                asset.processing_state = "processed"
            except Exception as a_err:
                asset.processing_state = "failed"
                print(f"[Vision Worker Error] Failed to process asset {asset.id}: {a_err}")

        total_detected = len(all_detections)
        task_service.update_task(
            task_id,
            status="matching",
            stage=f"Detected {total_detected} student faces! Matching ArcFace 512-d embeddings...",
            progress_pct=60,
            faces_detected=total_detected
        )

        # Stage 2: Fetch Enrolled Division Roster
        offering = db.query(AcademicOffering).filter(AcademicOffering.id == session.offering_id).first()
        enrollments = db.query(StudentEnrollment).filter(
            StudentEnrollment.offering_id == session.offering_id,
            StudentEnrollment.status == "enrolled"
        ).all()
        student_ids = [e.student_id for e in enrollments]

        if not student_ids and offering and offering.division_id:
            students = db.query(Student).filter(
                Student.division_id == offering.division_id,
                Student.status == "active"
            ).all()
        else:
            students = db.query(Student).filter(
                Student.id.in_(student_ids),
                Student.status == "active"
            ).all()

        roster = []
        for s in students:
            emb_record = db.query(StudentFaceEmbedding).filter(
                StudentFaceEmbedding.student_id == s.id,
                StudentFaceEmbedding.active == True
            ).first()

            emb = None
            if emb_record and emb_record.embedding_json:
                try:
                    emb = json.loads(emb_record.embedding_json)
                except Exception:
                    emb = None

            roster.append({
                "student_id": s.id,
                "urn": s.urn,
                "full_name": s.full_name,
                "roll_number": s.roll_number,
                "embedding": emb
            })

        # Stage 3: Biometric Matching (ArcFace 512-d)
        proposals, summary = vision_service.match_session_faces(
            all_detected_faces=all_detections,
            enrolled_roster=roster,
            likely_thresh=settings.ARCFACE_THRESHOLD_LIKELY,
            review_thresh=settings.ARCFACE_THRESHOLD_REVIEW
        )

        task_service.update_task(
            task_id,
            stage="Recording attendance proposals...",
            progress_pct=85
        )

        # Stage 4: Persist Attendance Records
        for p in proposals:
            record = db.query(AttendanceRecord).filter(
                AttendanceRecord.session_id == session_id,
                AttendanceRecord.student_id == p["student_id"]
            ).first()

            if record:
                if record.marking_method != "manual":
                    record.status = p["proposed_status"]
                    record.recognition_similarity = p["similarity"]
                    record.review_state = p["review_state"]
                    record.marking_method = "ai_proposed"
            else:
                record = AttendanceRecord(
                    session_id=session_id,
                    student_id=p["student_id"],
                    status=p["proposed_status"],
                    recognition_similarity=p["similarity"],
                    review_state=p["review_state"],
                    marked_by=teacher_profile_id,
                    marking_method="ai_proposed"
                )
                db.add(record)

        session.status = "review_required"
        db.commit()

        # Stage 5: Completed
        stage_desc = f"Review Ready: {summary['likely_matches']} Present, {summary['not_detected']} Absent"
        task_service.update_task(
            task_id,
            status="completed",
            stage=stage_desc,
            progress_pct=100,
            faces_detected=total_detected,
            summary=summary
        )
        print(f"[Vision Worker] Completed session {session_id} successfully in {total_detected} faces.")

    except Exception as e:
        db.rollback()
        print(f"[Vision Worker Failure] Task {task_id} failed: {e}")
        task_service.update_task(
            task_id,
            status="failed",
            stage="Error processing classroom photos",
            progress_pct=100,
            error=str(e)
        )
        # Restore session status
        try:
            s_rec = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
            if s_rec:
                s_rec.status = "uploading"
                db.commit()
        except Exception:
            pass
    finally:
        db.close()

