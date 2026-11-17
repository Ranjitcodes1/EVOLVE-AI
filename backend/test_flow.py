import urllib.request
import json

def test_api():
    # 1. Health
    req = urllib.request.Request("http://localhost:8000/api/v1/health")
    with urllib.request.urlopen(req) as resp:
        print("[OK] Healthcheck:", json.loads(resp.read().decode()))

    # 2. Teacher Login & Offerings
    t_payload = json.dumps({"email": "teacher@snapclass.edu", "password": "Password123!"}).encode()
    req = urllib.request.Request(
        "http://localhost:8000/api/v1/auth/login",
        data=t_payload,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        t_login = json.loads(resp.read().decode())
        print(f"[OK] Teacher Login: {t_login['name']} (Role: {t_login['role']})")
        t_token = t_login["access_token"]

    req = urllib.request.Request(
        "http://localhost:8000/api/v1/teachers/me/offerings",
        headers={"Authorization": f"Bearer {t_token}"}
    )
    with urllib.request.urlopen(req) as resp:
        offerings = json.loads(resp.read().decode())
        print(f"[OK] Teacher Courses ({len(offerings)}):")
        for o in offerings:
            print(f"     • {o['subject_code']}: {o['subject_name']} (Div {o['division_name']} • {o['enrolled_students_count']} Students Enrolled)")

    # 3. Student Login & Attendance Report (Lucia Ferreira)
    s_payload = json.dumps({"email": "student1@snapclass.edu", "password": "Password123!"}).encode()
    req = urllib.request.Request(
        "http://localhost:8000/api/v1/auth/login",
        data=s_payload,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        s_login = json.loads(resp.read().decode())
        print(f"[OK] Student Login: {s_login['name']} (URN: {s_login.get('entity_id', '139811973')})")
        s_token = s_login["access_token"]

    req = urllib.request.Request(
        "http://localhost:8000/api/v1/students/me/attendance",
        headers={"Authorization": f"Bearer {s_token}"}
    )
    with urllib.request.urlopen(req) as resp:
        att = json.loads(resp.read().decode())
        print(f"[OK] Student Attendance Rate: {att['overall_percentage']}% ({att['attended_classes']}/{att['total_classes']} classes attended)")
        print(f"[OK] Subjects Breakdown ({len(att['subject_summaries'])}):")
        for sub in att["subject_summaries"]:
            print(f"     • {sub['subject_code']} {sub['subject_name']}: {sub['attendance_percentage']}% ({sub['attended_classes']}/{sub['total_classes']})")
        print(f"[OK] Recent Transcript Sessions: {len(att['recent_records'])} records")

if __name__ == "__main__":
    test_api()

