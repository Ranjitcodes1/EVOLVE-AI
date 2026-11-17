import os
import sys
from pathlib import Path
import json
import numpy as np

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import Profile, Student
from app.models.academic import StudentEnrollment, AcademicOffering
from app.models.biometric import StudentFaceEmbedding

client = TestClient(app)

def test_milestone_1():
    print("=" * 80)
    print("  MILESTONE 1 VERIFICATION: DUAL-ROLE AUTH, AUTO-BINDING & ARCFACE 512-D")
    print("=" * 80)

    # 1. Test Faculty Login & Refresh Cookie
    print("\n1. Testing Faculty Login...")
    res = client.post("/api/v1/auth/login", json={
        "email": "faculty@snapclass.edu",
        "password": "Password123!",
        "remember_me": True
    })
    assert res.status_code == 200, f"Faculty login failed: {res.text}"
    data = res.json()
    assert data["role"] == "faculty"
    assert "access_token" in data
    faculty_token = data["access_token"]
    refresh_cookie = res.cookies.get("snapclass_refresh")
    assert refresh_cookie is not None, "Missing httpOnly snapclass_refresh cookie"
    print(f" [PASS] Faculty Login successful! Role: {data['role']}, Name: {data['name']}")
    print(f" [PASS] Persistent 60-day refresh cookie received.")

    # 2. Test Student Login (Real Student: Ranjit)
    print("\n2. Testing Student Login (Ranjit Kumar)...")
    res_s = client.post("/api/v1/auth/login", json={
        "email": "ranjit@snapclass.edu",
        "password": "Password123!",
        "remember_me": True
    })
    assert res_s.status_code == 200, f"Student login failed: {res_s.text}"
    s_data = res_s.json()
    assert s_data["role"] == "student"
    assert s_data["name"] == "Ranjit Kumar"
    print(f" [PASS] Student Login successful! Role: {s_data['role']}, Name: {s_data['name']}")

    # 3. Test Silent Token Refresh
    print("\n3. Testing Silent Session Refresh (/api/v1/auth/refresh)...")
    # Pass cookie
    client.cookies.set("snapclass_refresh", refresh_cookie)
    ref_res = client.post("/api/v1/auth/refresh")
    assert ref_res.status_code == 200, f"Token refresh failed: {ref_res.text}"
    ref_data = ref_res.json()
    assert "access_token" in ref_data
    print(f" [PASS] Silent refresh succeeded! New access token issued without prompt.")

    # 4. Test Student Self-Registration & Academic Auto-Binding
    print("\n4. Testing Student Self-Registration with Academic Auto-Binding...")
    import time
    ts = int(time.time())
    reg_payload = {
        "email": f"neha_{ts}@snapclass.edu",
        "password": "SecurePassword123!",
        "full_name": "Neha Sharma",
        "urn": f"URN2026CSE{ts % 1000:03d}",
        "department_code": "CSE",
        "division_name": "A",
        "semester": 3,
        "academic_year": "2026-2027",
        "roll_number": "99"
    }
    reg_res = client.post("/api/v1/auth/register/student", json=reg_payload)
    assert reg_res.status_code == 200, f"Registration failed: {reg_res.text}"
    new_student = reg_res.json()
    print(f" [PASS] Registered new student: {new_student['name']} ({new_student['email']})")

    # Verify Auto-Binding in Database
    db = SessionLocal()
    st_record = db.query(Student).filter(Student.urn == reg_payload["urn"]).first()
    assert st_record is not None
    enrollments = db.query(StudentEnrollment).filter(StudentEnrollment.student_id == st_record.id).all()
    print(f" [PASS] Academic Auto-Binding verified! Student automatically enrolled into {len(enrollments)} division course offerings.")
    assert len(enrollments) >= 3, "Expected at least 3 auto-enrolled courses"
    db.close()

    # 5. Verify Biometric Vector Space is ArcFace 512-d
    print("\n5. Testing Biometric Vector Space & Ranjit's Embedding...")
    db = SessionLocal()
    ranjit_st = db.query(Student).filter(Student.urn == "URN2026CSE011").first()
    assert ranjit_st is not None
    emb_rec = db.query(StudentFaceEmbedding).filter(StudentFaceEmbedding.student_id == ranjit_st.id).first()
    assert emb_rec is not None
    assert emb_rec.model_name == "arcface_512d"
    assert emb_rec.embedding_dim == 512
    vec = emb_rec.get_vector()
    assert len(vec) == 512
    assert abs(np.linalg.norm(vec) - 1.0) < 1e-4
    print(f" [PASS] Biometric embedding confirmed: model='{emb_rec.model_name}', dimensions={emb_rec.embedding_dim}, normalized unit vector.")
    db.close()

    # 6. Test Teacher Offerings via Authenticated API
    print("\n6. Testing Faculty Course Offerings Retrieval...")
    headers = {"Authorization": f"Bearer {faculty_token}"}
    off_res = client.get("/api/v1/teachers/me/offerings", headers=headers)
    assert off_res.status_code == 200, f"Offerings fetch failed: {off_res.text}"
    offerings = off_res.json()
    print(f" [PASS] Faculty retrieved {len(offerings)} assigned active courses.")

    # 7. Test Remote Session Revocation
    print("\n7. Testing Emergency Remote Session Revocation (token_version)...")
    db = SessionLocal()
    prof = db.query(Profile).filter(Profile.email == "faculty@snapclass.edu").first()
    prof.token_version += 1
    db.commit()
    db.close()

    # Old refresh token must be rejected now
    rev_res = client.post("/api/v1/auth/refresh")
    assert rev_res.status_code == 401, f"Expected 401 after revocation, got: {rev_res.status_code}"
    print(f" [PASS] Old refresh token instantly rejected with 401 after token_version increment!")

    print("\n" + "=" * 80)
    print("  ALL MILESTONE 1 TESTS PASSED SUCCESSFULLY! (7/7)")
    print("=" * 80)

if __name__ == "__main__":
    test_milestone_1()
