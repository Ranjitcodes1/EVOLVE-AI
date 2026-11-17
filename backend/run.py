import uvicorn
from app.seed import seed_database

if __name__ == "__main__":
    # Ensure database is created and seeded with baseline data
    seed_database()
    print("Starting SnapClass AI backend server on http://localhost:8000...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
