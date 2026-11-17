import os
import uvicorn
from app.seed import seed_database

if __name__ == "__main__":
    # Ensure database is created and seeded with baseline data
    seed_database()
    port = int(os.getenv("PORT", 8000))
    print(f"Starting EVOLVE backend server on port {port}...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
