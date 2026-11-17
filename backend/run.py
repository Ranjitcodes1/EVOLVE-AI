import os
import uvicorn
from app.seed import seed_database
from app.seed_roster import seed_database as seed_roster_database

if __name__ == "__main__":
    # Ensure database is created and seeded with baseline data
    try:
        seed_database()
    except Exception as e:
        print(f"[Seed Warning] Base seeder note: {e}")
    try:
        seed_roster_database()
    except Exception as e:
        print(f"[Seed Warning] Roster seeder note: {e}")

    port = int(os.getenv("PORT", 8000))
    print(f"Starting EVOLVE backend server on port {port}...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
