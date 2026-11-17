import json
from datetime import datetime, date, timezone
from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.config import settings
from app.models.academic import AcademicOffering, TeacherOffering, StudentEnrollment
from app.models.user import Student, Teacher, Profile
from app.models.biometric import StudentFaceEmbedding
from app.models.attendance import (
    AttendanceSession,
    AttendanceRecord,
    AttendanceAuditLog,
    AttendanceCaptureAsset
)
from app.services.vision_service import vision_service
from app.services.storage_service import storage_service
from app.schemas.attendance import UpdateRecordItem

class AttendanceService:
    @staticmethod
    def get_teacher_for_profile(db: Session, profile_id: str) -> Teacher:
        teacher = db.query(Teacher).filter(Teacher.profile_id == profile_id).first()
        if not teacher:
            raise HTTPException(status_code=403, detail="Current user is not a registered teacher")
        return teacher

    @staticmethod
    def create_session(db: Session, teacher_id: str, offering_id: str, session_date: Optional[date] = None) -> AttendanceSession:
        # Check authorization (Teacher must be assigned to offering)
        assignment = db.query(TeacherOffering).filter(
            TeacherOffering.teacher_id == teacher_id,
            TeacherOffering.offering_id == offering_id
        ).first()
        if not assignment:
            raise HTTPException(status_code=403, detail="Unauthorized: You are not assigned to this subject offering")

        target_date = session_date or date.today()

        # Check existing confirmed session
        existing = db.query(AttendanceSession).filter(
            AttendanceSession.offering_id == offering_id,
            AttendanceSession.session_date == target_date,
            AttendanceSession.status == "confirmed"
        ).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"A confirmed attendance session already exists for this class on {target_date}"
            )

        # Check existing draft session
        draft = db.query(AttendanceSession).filter(
            AttendanceSession.offering_id == offering_id,
            AttendanceSession.teacher_id == teacher_id,
            AttendanceSession.session_date == target_date,
            AttendanceSession.status.in_(["draft", "uploading", "processing", "review_required"])
        ).first()
        if draft:
            return draft

        new_session = AttendanceSession(
            offering_id=offering_id,
            teacher_id=teacher_id,
            session_date=target_date,
            status="draft"
        )
        db.add(new_session)
        db.commit()
        db.refresh(new_session)
        return new_session

    @staticmethod
    def get_session_enrolled_roster(db: Session, offering_id: str) -> List[Dict[str, Any]]:
        # Get students enrolled in offering (or division students)
        offering = db.query(AcademicOffering).filter(AcademicOffering.id == offering_id).first()
        if not offering:
            raise HTTPException(status_code=404, detail="Offering not found")

        # Query all students enrolled in this offering
        enrollments = db.query(StudentEnrollment).filter(
            StudentEnrollment.offering_id == offering_id,
            StudentEnrollment.status == "enrolled"
        ).all()

        student_ids = [e.student_id for e in enrollments]
        # Fallback to division students if specific enrollments aren't populated
        if not student_ids and offering.division_id:
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
            # Fetch active embedding
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
        return roster

    @staticmethod
    def process_session(db: Session, session_id: str, teacher_profile_id: str) -> Dict[str, Any]:
        session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Attendance session not found")

        # Verify teacher ownership
        teacher = db.query(Teacher).filter(Teacher.profile_id == teacher_profile_id).first()
        if not teacher or session.teacher_id != teacher.id:
            raise HTTPException(status_code=403, detail="Unauthorized to process this session")

        # Fetch assets
        assets = db.query(AttendanceCaptureAsset).filter(
            AttendanceCaptureAsset.session_id == session_id
        ).all()
        if not assets:
            raise HTTPException(status_code=400, detail="No classroom photos uploaded for this session")

        session.status = "processing"
        db.commit()

        # Run detection across all capture assets
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
            except Exception as e:
                asset.processing_state = "failed"
                print(f"Error processing asset {asset.id}: {e}")

        # Get roster
        roster = AttendanceService.get_session_enrolled_roster(db, session.offering_id)

        # Match proposals with deduplication
        likely_th = getattr(settings, "ARCFACE_THRESHOLD_LIKELY", getattr(settings, "SIMILARITY_THRESHOLD_LIKELY", 0.32))
        review_th = getattr(settings, "ARCFACE_THRESHOLD_REVIEW", getattr(settings, "SIMILARITY_THRESHOLD_REVIEW", 0.20))
        proposals, summary = vision_service.match_session_faces(
            all_detected_faces=all_detections,
            enrolled_roster=roster,
            likely_thresh=likely_th,
            review_thresh=review_th
        )

        # Persist or update AttendanceRecords
        for p in proposals:
            record = db.query(AttendanceRecord).filter(
                AttendanceRecord.session_id == session_id,
                AttendanceRecord.student_id == p["student_id"]
            ).first()

            if record:
                # Update proposed values if not manually corrected
                if record.marking_method != "manual":
                    record.status = p["proposed_status"]
                    record.recognition_similarity = p["similarity"]
                    record.review_state = p["review_state"]
                    record.marked_by = teacher_profile_id
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

        # Attach record_ids to proposals
        updated_records = {r.student_id: r.id for r in db.query(AttendanceRecord).filter(AttendanceRecord.session_id == session_id).all()}
        for p in proposals:
            p["record_id"] = updated_records.get(p["student_id"])

        return {
            "session_id": session.id,
            "offering_id": session.offering_id,
            "status": session.status,
            "summary": summary,
            "proposals": proposals
        }

    @staticmethod
    def get_proposals(db: Session, session_id: str) -> Dict[str, Any]:
        session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        records = db.query(AttendanceRecord, Student).join(
            Student, AttendanceRecord.student_id == Student.id
        ).filter(AttendanceRecord.session_id == session_id).all()

        proposals = []
        likely_count = 0
        review_count = 0
        not_detected_count = 0

        for r, s in records:
            if r.status == "present" and r.review_state == "accepted":
                likely_count += 1
            elif r.review_state == "needs_review":
                review_count += 1
            else:
                not_detected_count += 1

            proposals.append({
                "record_id": r.id,
                "student_id": s.id,
                "urn": s.urn,
                "full_name": s.full_name,
                "roll_number": s.roll_number,
                "proposed_status": r.status,
                "similarity": r.recognition_similarity,
                "review_state": r.review_state,
                "marking_method": r.marking_method,
                "correction_reason": r.correction_reason
            })

        order_map = {"needs_review": 0, "accepted": 1, "corrected": 2, "not_detected": 3}
        proposals.sort(key=lambda x: (order_map.get(x["review_state"], 4), x["urn"]))

        offering = session.offering
        summary = {
            "total_enrolled": len(proposals),
            "likely_matches": likely_count,
            "needs_review": review_count,
            "not_detected": not_detected_count,
            "unidentified_faces": 0
        }

        return {
            "session_id": session.id,
            "offering_id": session.offering_id,
            "subject_code": offering.subject.subject_code if offering else "",
            "subject_name": offering.subject.subject_name if offering else "",
            "division_name": offering.division.division_name if offering else "",
            "session_date": session.session_date,
            "status": session.status,
            "summary": summary,
            "proposals": proposals
        }

    @staticmethod
    def update_records(
        db: Session,
        session_id: str,
        teacher_profile_id: str,
        updates: List[UpdateRecordItem]
    ) -> Dict[str, Any]:
        session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Allow updates in draft, review_required, or confirmed (with audit trail)
        updated_count = 0
        for item in updates:
            record = db.query(AttendanceRecord).filter(
                AttendanceRecord.session_id == session_id,
                AttendanceRecord.student_id == item.student_id
            ).first()

            if not record:
                # Add record if missing
                record = AttendanceRecord(
                    session_id=session_id,
                    student_id=item.student_id,
                    status=item.status,
                    review_state="corrected",
                    marked_by=teacher_profile_id,
                    marking_method="manual",
                    correction_reason=item.reason
                )
                db.add(record)
                db.flush()
                # Audit log
                audit = AttendanceAuditLog(
                    attendance_record_id=record.id,
                    actor_profile_id=teacher_profile_id,
                    old_status="absent",
                    new_status=item.status,
                    reason=item.reason
                )
                db.add(audit)
                updated_count += 1
            else:
                old_st = record.status
                record.status = item.status
                record.review_state = "corrected"
                record.marking_method = "manual"
                record.marked_by = teacher_profile_id
                record.correction_reason = item.reason

                # Indelible audit log
                audit = AttendanceAuditLog(
                    attendance_record_id=record.id,
                    actor_profile_id=teacher_profile_id,
                    old_status=old_st,
                    new_status=item.status,
                    reason=item.reason
                )
                db.add(audit)
                updated_count += 1

        db.commit()
        return {"session_id": session_id, "updated_count": updated_count}

    @staticmethod
    def confirm_session(db: Session, session_id: str, teacher_profile_id: str) -> AttendanceSession:
        session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Ensure all enrolled students have a record
        roster = AttendanceService.get_session_enrolled_roster(db, session.offering_id)
        existing_student_ids = {r.student_id for r in session.records}

        for st in roster:
            if st["student_id"] not in existing_student_ids:
                new_rec = AttendanceRecord(
                    session_id=session_id,
                    student_id=st["student_id"],
                    status="absent",
                    review_state="not_detected",
                    marked_by=teacher_profile_id,
                    marking_method="ai_proposed"
                )
                db.add(new_rec)

        session.status = "confirmed"
        session.confirmed_at = datetime.now(timezone.utc)
        session.ended_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(session)
        return session

attendance_service = AttendanceService()
