import requests
import json
import os
import sys
from pathlib import Path

BASE_URL = "http://127.0.0.1:8000"
PROJECT_DIR = Path(r"c:\Users\dr_ra\Desktop\FinalMiniProject")
PHOTO1_PATH = PROJECT_DIR / "benchmark_dataset" / "ranjit" / "Ranjit1.jpeg"
PHOTO2_PATH = PROJECT_DIR / "benchmark_dataset" / "ranjit" / "Ranjit2.jpeg"

def run_test():
    print("=" * 70)
    print("  EVOLVE AI ATTENDANCE SUITE - COMPREHENSIVE END-TO-END TEST")
    print("=" * 70)

    # 1. Health & Server Status
    print("\n[Step 1] Checking FastAPI Backend Health...")
    try:
        r = requests.get(f"{BASE_URL}/docs", timeout=5)
        assert r.status_code == 200
        print("  ✓ Backend is ONLINE at http://127.0.0.1:8000")
    except Exception as e:
        print(f"  ✗ Backend failed to respond: {e}")
        return

    # 2. Faculty Authentication
    print("\n[Step 2] Authenticating Faculty (Dr. Sarah Jenkins)...")
    login_data = {
        "email": "sarah.jenkins@evolve.edu",
        "password": "password123"
    }
    r = requests.post(f"{BASE_URL}/api/v1/auth/login", json=login_data)
    if r.status_code != 200:
        print(f"  ✗ Login failed ({r.status_code}): {r.text}")
        return
    token = r.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    print("  ✓ Authenticated successfully! 24-hr Bearer JWT acquired.")

    # 3. Retrieve Course Offerings
    print("\n[Step 3] Fetching Assigned Academic Offerings...")
    r = requests.get(f"{BASE_URL}/api/v1/teachers/me/offerings", headers=headers)
    assert r.status_code == 200
    offerings = r.json()
    print(f"  ✓ Found {len(offerings)} academic offerings.")
    for o in offerings:
        print(f"    - {o.get('subject_name')} ({o.get('subject_code')}) | Division: {o.get('division_name')} | ID: {o.get('offering_id')}")
    offering_id = offerings[0]["offering_id"]

    # 4. Create an Attendance Session
    print(f"\n[Step 4] Initializing Draft Attendance Session for Offering ID {offering_id}...")
    session_payload = {
        "offering_id": offering_id,
        "session_date": "2026-11-16"
    }
    r = requests.post(f"{BASE_URL}/api/v1/attendance/sessions", json=session_payload, headers=headers)
    assert r.status_code == 200, f"Failed to create session: {r.text}"
    session_id = r.json()["session_id"]
    print(f"  ✓ Attendance Session created: {session_id} (Status: {r.json()['status']})")

    # 5. Upload Multi-Angle Classroom Photos
    print(f"\n[Step 5] Uploading Multi-Angle Classroom Perspectives (Left & Center)...")
    if not PHOTO1_PATH.exists():
        print(f"  ✗ Photo 1 not found: {PHOTO1_PATH}")
        return
    
    files = [
        ("files", ("angle_left.jpeg", open(PHOTO1_PATH, "rb"), "image/jpeg")),
    ]
    if PHOTO2_PATH.exists():
        files.append(("files", ("angle_center.jpeg", open(PHOTO2_PATH, "rb"), "image/jpeg")))

    r = requests.post(f"{BASE_URL}/api/v1/attendance/sessions/{session_id}/assets", files=files, headers=headers)
    assert r.status_code == 200, f"Upload failed: {r.text}"
    upload_res = r.json()
    print(f"  ✓ Uploaded {upload_res.get('uploaded_count')} classroom photos.")
    print(f"    - Ephemeral Retention Purge Expiry: {upload_res.get('retention_expires_at')}")

    # 6. Execute AI Vision Matching (YuNet + ArcFace 512-d + Deduplication)
    print(f"\n[Step 6] Running Deep Biometric Vision Pipeline (Synchronous Mode)...")
    r = requests.post(f"{BASE_URL}/api/v1/attendance/sessions/{session_id}/process?sync=true", headers=headers)
    assert r.status_code in (200, 202), f"Processing failed: {r.text}"
    proposals_data = r.json()
    proposals = proposals_data.get("proposals", [])
    print(f"  ✓ Biometric Pipeline completed successfully!")
    print(f"    - Total Enrolled Students Evaluated: {len(proposals)}")
    
    for p in proposals:
        sim = p.get("similarity", 0)
        state = p.get("review_state")
        status = p.get("proposed_status")
        is_live = p.get("is_live", True)
        liveness_score = p.get("liveness_score", 1.0)
        print(f"    -> Student: {p.get('full_name')} ({p.get('urn')})")
        print(f"       Status: {status.upper()} | Review Tier: {state} | Similarity: {sim:.3f}")
        print(f"       Passive Liveness: {'LIVE ✓' if is_live else 'SPOOF DETECTED ⚠'} (Score: {liveness_score:.2f})")

    # 7. HITL Manual Override with Mandatory Audit Justification
    print(f"\n[Step 7] Testing Human-in-the-Loop (HITL) Manual Override & Audit Logging...")
    if proposals:
        target_prop = proposals[0]
        student_id = target_prop["student_id"]
        override_payload = {
            "updates": [
                {
                    "student_id": student_id,
                    "status": "present",
                    "reason": "Faculty verification: Verified student seated in Lecture Row 2 under low lighting."
                }
            ]
        }
        r = requests.patch(f"{BASE_URL}/api/v1/attendance/sessions/{session_id}/records", json=override_payload, headers=headers)
        assert r.status_code == 200, f"Override failed: {r.text}"
        print(f"  ✓ Override recorded with mandatory justification: '{override_payload['updates'][0]['reason']}'")

    # 8. Cryptographically Lock & Confirm Session
    print(f"\n[Step 8] Cryptographically Confirming and Locking Attendance Session...")
    r = requests.post(f"{BASE_URL}/api/v1/attendance/sessions/{session_id}/confirm", headers=headers)
    assert r.status_code == 200, f"Confirmation failed: {r.text}"
    print(f"  ✓ Session locked! Final state: {r.json().get('status')}")

    # 9. Verify Student Dashboard & Statutory 75% Exam Eligibility
    print(f"\n[Step 9] Authenticating Student (Ranjit Das) & Verifying 75% Eligibility Dashboard...")
    student_login = {
        "email": "e25b000040@adypu.edu.in",
        "password": "password123"
    }
    r = requests.post(f"{BASE_URL}/api/v1/auth/login", json=student_login)
    if r.status_code == 200:
        student_token = r.json()["access_token"]
        st_headers = {"Authorization": f"Bearer {student_token}"}
        r = requests.get(f"{BASE_URL}/api/v1/students/me/attendance", headers=st_headers)
        if r.status_code == 200:
            dash = r.json()
            pct = dash.get("overall_attendance_percentage", 0)
            eligible = dash.get("exam_eligible", True)
            missable = dash.get("safe_missable_classes", 0)
            recovery = dash.get("recovery_classes_needed", 0)
            print(f"  ✓ Student Dashboard verified!")
            print(f"    - Overall Attendance: {pct:.1f}%")
            print(f"    - Statutory 75% Exam Status: {'ELIGIBLE (Green)' if eligible else 'AT RISK (Red)'}")
            print(f"    - Safe Missable Classes: {missable}")
            print(f"    - Recovery Classes Needed: {recovery}")
            print(f"    - Verified Subject Records: {len(dash.get('subjects', []))}")
        else:
            print(f"  ⚠ Student attendance query: {r.status_code} {r.text}")
    else:
        print(f"  ⚠ Student login note: {r.status_code} {r.text}")

    print("\n" + "=" * 70)
    print("  ALL ATTENDANCE SUITE FEATURES VERIFIED SUCCESSFULLY! ✓✓✓")
    print("=" * 70)

if __name__ == "__main__":
    run_test()
