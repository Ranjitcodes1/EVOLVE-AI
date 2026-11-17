@echo off
title EVOLVE AI Vision Suite
echo ===================================================
echo Starting EVOLVE Full-Stack Academic Vision Suite
echo ===================================================

echo [1/2] Launching FastAPI Backend on http://localhost:8000 ...
start "EVOLVE Backend (FastAPI)" cmd /k "cd /d ""%~dp0backend"" && python run.py"

echo [2/2] Launching Next.js Frontend on http://localhost:3000 ...
start "EVOLVE Frontend (Next.js)" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

echo ===================================================
echo All services launched!
echo Open your browser at: http://localhost:3000
echo ===================================================
