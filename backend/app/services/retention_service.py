import os
import sys
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Any
from sqlalchemy.orm import Session

BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BASE_DIR / "backend"))

from app.database import SessionLocal
from app.models.attendance import AttendanceCaptureAsset
from app.services.storage_service import storage_service
class RetentionService:
    """
    Automated Ephemeral Retention & 30-Day Biometric Purge Daemon.
    Permanently deletes raw classroom roll-call photographs after their retention window,
    ensuring student biometric privacy compliance and zero server disk bloat.
    """
    @staticmethod
    def purge_expired_capture_assets(db: Session, force_all: bool = False) -> Dict[str, Any]:
        now_utc = datetime.now(timezone.utc)
        now_naive = now_utc.replace(tzinfo=None)
        
        query = db.query(AttendanceCaptureAsset).filter(AttendanceCaptureAsset.purged_at.is_(None))
        if not force_all:
            query = query.filter(AttendanceCaptureAsset.expires_at <= now_naive)

        expired_assets = query.all()
        purged_count = 0
        freed_bytes = 0

        for asset in expired_assets:
            try:
                # Calculate file size before deletion
                size = storage_service.get_file_size(asset.object_key)
                
                # Delete physical file from storage (Local / S3)
                storage_service.delete_file(asset.object_key)

                # Update database record (Preserves metadata, marks purged)
                asset.purged_at = datetime.now(timezone.utc)
                asset.processing_state = "purged"
                
                purged_count += 1
                freed_bytes += size
            except Exception as e:
                print(f"[Retention Error] Failed to purge asset {asset.id} ({asset.object_key}): {e}")

        if purged_count > 0:
            db.commit()

        freed_mb = round(freed_bytes / (1024 * 1024), 2)
        print(f"[Retention Daemon] Purged {purged_count} expired classroom captures. Freed {freed_mb} MB.")

        return {
            "purged_count": purged_count,
            "freed_bytes": freed_bytes,
            "freed_mb": freed_mb,
            "status": "success",
            "executed_at": now_utc.isoformat()
        }

retention_service = RetentionService()

if __name__ == "__main__":
    db = SessionLocal()
    try:
        force = "--force-all" in sys.argv
        res = retention_service.purge_expired_capture_assets(db, force_all=force)
        print("Retention Run Result:", res)
    finally:
        db.close()
