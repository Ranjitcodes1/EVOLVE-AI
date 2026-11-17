import os
import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.attendance import AttendanceSession, AttendanceCaptureAsset
from app.models.academic import AcademicOffering
from app.services.storage_service import storage_service
from app.services.retention_service import retention_service

client = TestClient(app)

def test_milestone_2():
    print("=" * 80)
    print("  MILESTONE 2 VERIFICATION: STORAGE SERVICE & 30-DAY AUTO-PURGE RETENTION")
    print("=" * 80)

    # 1. Test Direct StorageService Operations
    print("\n1. Testing Direct StorageService CRUD...")
    sample_content = b"Mock image data for biometric test - 1234567890"
    test_key = "captures/test_session/sample_photo.jpg"

    # Upload
    res_key = storage_service.provider.upload_file(sample_content, test_key)
    assert storage_service.file_exists(test_key), "File was not written to storage"
    assert storage_service.get_file_size(test_key) == len(sample_content)
    print(f" [PASS] File uploaded successfully. Size: {len(sample_content)} bytes")

    # Read
    read_bytes = storage_service.get_file(test_key)
    assert read_bytes == sample_content, "Retrieved bytes do not match uploaded bytes"
    print(" [PASS] File retrieval verified. Exact byte match.")

    # Security: Path Traversal Defense
    print("\n2. Testing Path Traversal Defense...")
    traversal_blocked = False
    try:
        storage_service.provider.upload_file(sample_content, "../../etc/passwd")
    except ValueError:
        traversal_blocked = True
    assert traversal_blocked, "Failed to block directory traversal attack"
    print(" [PASS] Path traversal attempt (../../etc/passwd) rejected with security exception.")

    # Clean up test file
    storage_service.delete_file(test_key)
    assert not storage_service.file_exists(test_key), "Test file was not deleted"
    print(" [PASS] Storage delete operation verified.")

    # 3. Faculty Login & Create Attendance Session
    print("\n3. Testing Classroom Photo Upload with 30-Day Expiration Tag...")
    login_res = client.post("/api/v1/auth/login", json={
        "email": "faculty@snapclass.edu",
        "password": "Password123!"
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    db = SessionLocal()
    offering = db.query(AcademicOffering).first()
    assert offering is not None
    offering_id = offering.id
    db.close()

    # Create draft session
    sess_res = client.post("/api/v1/attendance/sessions", json={"offering_id": offering_id, "session_date": "2026-11-21"}, headers=headers)
    assert sess_res.status_code == 200
    session_id = sess_res.json()["session_id"]
    print(f" [PASS] Draft session created: {session_id}")

    # Upload classroom capture photo
    sample_img_bytes = b"\xFF\xD8\xFF\xE0\x00\x10JFIF" + b"\x00" * 2000 # Mock valid JPEG header
    files = [("files", ("classroom_shot1.jpg", sample_img_bytes, "image/jpeg"))]
    upload_res = client.post(f"/api/v1/attendance/sessions/{session_id}/assets", files=files, headers=headers)
    assert upload_res.status_code == 200, f"Asset upload failed: {upload_res.text}"
    upload_data = upload_res.json()
    assert upload_data["uploaded_count"] == 1
    assert "retention_expires_at" in upload_data
    print(f" [PASS] Classroom photo uploaded via API. Retention Expires At: {upload_data['retention_expires_at']}")

    # 4. Verify Asset in Database & Storage
    print("\n4. Verifying Asset Metadata & Storage Integrity...")
    db = SessionLocal()
    asset = db.query(AttendanceCaptureAsset).filter(AttendanceCaptureAsset.session_id == session_id).order_by(AttendanceCaptureAsset.created_at.desc()).first()
    assert asset is not None
    assert asset.purged_at is None
    now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
    assert asset.expires_at > now_naive
    asset_id = asset.id
    asset_key = asset.object_key
    assert storage_service.file_exists(asset_key), "Physical file missing in storage"
    print(f" [PASS] Database asset record confirmed: Key='{asset_key}', Expires='{asset.expires_at.date()}'")
    db.close()

    # Stream asset via authenticated endpoint
    stream_res = client.get(f"/api/v1/attendance/sessions/{session_id}/assets/{asset_id}", headers=headers)
    assert stream_res.status_code == 200
    assert len(stream_res.content) == len(sample_img_bytes)
    print(" [PASS] Authenticated asset image streaming verified (HTTP 200).")

    # 5. Test Retention Daemon on Active Assets (Should NOT purge)
    print("\n5. Testing Retention Daemon on Active Assets...")
    db = SessionLocal()
    dry_run = retention_service.purge_expired_capture_assets(db, force_all=False)
    assert dry_run["purged_count"] == 0, "Active asset should not have been purged"
    assert storage_service.file_exists(asset_key), "Active asset file was mistakenly deleted"
    print(" [PASS] Active asset safely preserved by retention daemon (0 purged).")

    # 6. Test Retention Daemon on Expired Asset (Simulating Day 31)
    print("\n6. Simulating Day 31: Testing Ephemeral Auto-Purge of Expired Captures...")
    # Artificially expire the asset to 1 day ago
    asset_to_expire = db.query(AttendanceCaptureAsset).filter(AttendanceCaptureAsset.id == asset_id).first()
    asset_to_expire.expires_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1)
    db.commit()

    # Run retention daemon
    purge_result = retention_service.purge_expired_capture_assets(db, force_all=False)
    assert purge_result["purged_count"] >= 1, f"Expected at least 1 purged asset, got: {purge_result}"
    print(f" [PASS] Retention Daemon executed! Purged {purge_result['purged_count']} expired assets ({purge_result['freed_bytes']} bytes freed).")

    # Verify physical file is gone
    assert not storage_service.file_exists(asset_key), "Physical file was not removed from storage"
    print(" [PASS] Physical image file was permanently deleted from disk/storage.")

    # Verify database record reflects purged status
    db.refresh(asset_to_expire)
    assert asset_to_expire.purged_at is not None
    assert asset_to_expire.processing_state == "purged"
    print(f" [PASS] Database asset record updated: purged_at='{asset_to_expire.purged_at.isoformat()}', state='purged'.")

    # Verify endpoint returns 410 Gone
    gone_res = client.get(f"/api/v1/attendance/sessions/{session_id}/assets/{asset_id}", headers=headers)
    assert gone_res.status_code == 410, f"Expected HTTP 410 for purged asset, got: {gone_res.status_code}"
    print(" [PASS] Accessing purged asset returned HTTP 410 Gone per privacy policy.")

    db.close()

    print("\n" + "=" * 80)
    print("  ALL MILESTONE 2 TESTS PASSED SUCCESSFULLY! (6/6)")
    print("=" * 80)

if __name__ == "__main__":
    test_milestone_2()
