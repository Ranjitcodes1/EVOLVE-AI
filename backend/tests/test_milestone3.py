import os
import sys
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.academic import AcademicOffering
from app.models.attendance import AttendanceSession, AttendanceRecord

client = TestClient(app)

def test_milestone_3():
    print("=" * 80)
    print("  MILESTONE 3 VERIFICATION: ASYNC VISION WORKER & TASK QUEUE PIPELINE")
    print("=" * 80)

    # 1. Faculty Login
    print("\n1. Authenticating Faculty...")
    login_res = client.post("/api/v1/auth/login", json={
        "email": "faculty@snapclass.edu",
        "password": "Password123!"
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print(" [PASS] Faculty authenticated.")

    # 2. Create Attendance Session
    print("\n2. Creating Classroom Attendance Session...")
    db = SessionLocal()
    offering = db.query(AcademicOffering).first()
    assert offering is not None
    offering_id = offering.id
    db.close()

    sess_res = client.post("/api/v1/attendance/sessions", json={"offering_id": offering_id, "session_date": "2026-11-22"}, headers=headers)
    assert sess_res.status_code == 200
    session_id = sess_res.json()["session_id"]
    print(f" [PASS] Session initialized: {session_id}")

    # 3. Upload Real Classroom Image
    print("\n3. Uploading Real Classroom Photo (Ranjit1.jpeg)...")
    real_photo_path = BASE_DIR.parent / "benchmark_dataset" / "ranjit" / "Ranjit1.jpeg"
    if not real_photo_path.exists():
        real_photo_path = Path("benchmark_dataset/ranjit/Ranjit1.jpeg")

    with open(str(real_photo_path), "rb") as f:
        img_bytes = f.read()

    files = [("files", ("classroom_lecture.jpg", img_bytes, "image/jpeg"))]
    upload_res = client.post(f"/api/v1/attendance/sessions/{session_id}/assets", files=files, headers=headers)
    assert upload_res.status_code == 200
    print(f" [PASS] Classroom photo uploaded ({len(img_bytes)} bytes).")

    # 4. Trigger Asynchronous Processing & Measure Latency
    print("\n4. Triggering Asynchronous Recognition Pipeline...")
    t0 = time.perf_counter()
    proc_res = client.post(f"/api/v1/attendance/sessions/{session_id}/process", headers=headers)
    dispatch_latency = (time.perf_counter() - t0) * 1000.0

    assert proc_res.status_code == 202, f"Expected 202 Accepted, got: {proc_res.status_code}"
    proc_data = proc_res.json()
    assert "task_id" in proc_data
    assert proc_data["status"] == "queued"
    task_id = proc_data["task_id"]
    print(f" [PASS] Immediate 202 Accepted received in {dispatch_latency:.1f} ms! Task ID: {task_id}")
    assert dispatch_latency < 500, "Dispatch took longer than expected"

    # 5. Poll Status Endpoint for Live Stage Progression
    print("\n5. Polling Live Task Status (/api/v1/attendance/sessions/{id}/status)...")
    completed = False
    stages_seen = set()

    for poll_idx in range(60):  # Poll up to 30 seconds
        time.sleep(0.5)
        stat_res = client.get(f"/api/v1/attendance/sessions/{session_id}/status", headers=headers)
        assert stat_res.status_code == 200
        stat_data = stat_res.json()
        stage = stat_data.get("stage", "")
        pct = stat_data.get("progress_pct", 0)
        task_status = stat_data.get("task_status", "")

        stages_seen.add(task_status)
        print(f"    [Poll #{poll_idx+1}] Progress: {pct}% | Task: {task_status:<12} | Stage: {stage}")

        if task_status == "completed":
            completed = True
            break
        elif task_status == "failed":
            raise RuntimeError(f"Vision worker task failed: {stat_data.get('error')}")

    assert completed, "Task did not complete within timeout"
    print(f" [PASS] Background vision worker completed successfully! Execution time: {stat_data.get('duration_ms')} ms")
    print(f" [PASS] Total student faces detected: {stat_data.get('faces_detected')}")
    print(f" [PASS] Summary: {stat_data.get('summary')}")

    # 6. Verify Attendance Proposals & Ranjit's Recognition
    print("\n6. Verifying Attendance Proposals & Biometric Matches...")
    prop_res = client.get(f"/api/v1/attendance/sessions/{session_id}/proposals", headers=headers)
    assert prop_res.status_code == 200
    prop_data = prop_res.json()
    proposals = prop_data.get("proposals", [])
    assert len(proposals) > 0, "No proposals returned"

    # Find Ranjit in proposals
    ranjit_prop = next((p for p in proposals if p["full_name"] == "Ranjit Kumar"), None)
    assert ranjit_prop is not None, "Ranjit Kumar not found in roster proposals"
    print(f" [PASS] Real Student Verified: {ranjit_prop['full_name']} -> Status: {ranjit_prop['proposed_status'].upper()} (ArcFace Sim: {ranjit_prop.get('similarity')})")
    assert ranjit_prop["proposed_status"] == "present", "Ranjit should have been detected and marked present"

    # 7. Faculty Review: 1-Click Manual Override with Audit Log
    print("\n7. Testing Faculty 1-Click Status Override with Audit Logging...")
    # Find an absent student to mark present
    absent_student = next((p for p in proposals if p["proposed_status"] == "absent"), None)
    target_student_id = absent_student["student_id"] if absent_student else proposals[0]["student_id"]

    patch_payload = {
        "updates": [
            {
                "student_id": target_student_id,
                "status": "present",
                "reason": "Student verified seated in row 4; manual override"
            }
        ]
    }
    patch_res = client.patch(f"/api/v1/attendance/sessions/{session_id}/records", json=patch_payload, headers=headers)
    assert patch_res.status_code == 200
    print(" [PASS] Manual record update successful with audit justification.")

    # 8. Confirm & Lock Session
    print("\n8. Testing Session Confirmation & Final Lock...")
    conf_res = client.post(f"/api/v1/attendance/sessions/{session_id}/confirm", headers=headers)
    assert conf_res.status_code == 200
    conf_data = conf_res.json()
    assert conf_data["status"] == "confirmed"
    assert conf_data["confirmed_at"] is not None
    print(f" [PASS] Attendance session locked: Status={conf_data['status']}, ConfirmedAt={conf_data['confirmed_at']}")

    print("\n" + "=" * 80)
    print("  ALL MILESTONE 3 TESTS PASSED SUCCESSFULLY! (8/8)")
    print("=" * 80)

if __name__ == "__main__":
    test_milestone_3()
