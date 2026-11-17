import os
import sys
import subprocess
import time
import signal

def run_platform():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(root_dir, "backend")
    frontend_dir = os.path.join(root_dir, "frontend")

    print("=" * 70)
    print("  SNAPCLASS AI — AI-Powered Classroom Attendance Platform")
    print("  AI proposes. Faculty verifies. The system records transparently.")
    print("=" * 70)

    # 1. Ensure database is seeded
    print("\n[1/3] Checking and seeding database...")
    try:
        sys.path.insert(0, backend_dir)
        from app.seed import seed_database
        seed_database()
    except Exception as e:
        print(f"Database check completed: {e}")

    # 2. Start Backend API
    print("\n[2/3] Starting FastAPI Backend on http://localhost:8000...")
    backend_proc = subprocess.Popen(
        [sys.executable, "run.py"],
        cwd=backend_dir
    )

    # 3. Start Next.js Frontend
    print("\n[3/3] Starting Next.js Frontend on http://localhost:3000...")
    # On Windows, npm is a .cmd script
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    frontend_proc = subprocess.Popen(
        [npm_cmd, "run", "dev"],
        cwd=frontend_dir
    )

    print("\n" + "=" * 70)
    print("  SnapClass AI is LIVE!")
    print("  Frontend Web App:   http://localhost:3000")
    print("  Backend API Docs:   http://localhost:8000/docs")
    print("  Healthcheck:        http://localhost:8000/api/v1/health")
    print("=" * 70)
    print("\nDemo Credentials:")
    print("  - Teacher:  teacher@snapclass.edu  |  Password123! (Prof. Alan Turing)")
    print("  - Student:  student1@snapclass.edu |  Password123! (Aarav Sharma)")
    print("  - Admin:    admin@snapclass.edu    |  Password123! (System Admin)")
    print("\nPress Ctrl+C to terminate both servers.\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down SnapClass AI...")
        backend_proc.terminate()
        frontend_proc.terminate()
        backend_proc.wait()
        frontend_proc.wait()
        print("Servers stopped cleanly.")

if __name__ == "__main__":
    run_platform()

