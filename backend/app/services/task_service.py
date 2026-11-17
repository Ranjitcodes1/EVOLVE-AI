import uuid
import time
import threading
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any, Optional

class TaskService:
    """
    Unified In-Memory & Celery Task Coordinator.
    Provides live stage progression, progress percentage (0-100%),
    and hardware-clamped sequential execution for RAJWORKSTATION (2-core i3).
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(TaskService, cls).__new__(cls)
            cls._instance._tasks: Dict[str, Dict[str, Any]] = {}
            cls._instance._session_to_task: Dict[str, str] = {}
            cls._instance._lock = threading.Lock()
            # Hardware Clamping: max_workers=1 ensures background vision processing
            # runs sequentially without saturating the 2 CPU cores.
            cls._instance._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="snapclass_vision_worker")
        return cls._instance

    def create_task(self, session_id: str) -> str:
        task_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        with self._lock:
            task_info = {
                "task_id": task_id,
                "session_id": session_id,
                "status": "queued",
                "stage": "Waiting in queue...",
                "progress_pct": 5,
                "faces_detected": 0,
                "summary": {},
                "error": None,
                "created_at": now,
                "started_at": None,
                "completed_at": None,
                "duration_ms": None
            }
            self._tasks[task_id] = task_info
            self._session_to_task[session_id] = task_id
        return task_id

    def update_task(
        self,
        task_id: str,
        status: Optional[str] = None,
        stage: Optional[str] = None,
        progress_pct: Optional[int] = None,
        faces_detected: Optional[int] = None,
        summary: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None
    ) -> None:
        with self._lock:
            if task_id not in self._tasks:
                return
            t = self._tasks[task_id]
            if status:
                t["status"] = status
                if status in ("in_progress", "detecting", "matching") and not t["started_at"]:
                    t["started_at"] = datetime.now(timezone.utc)
                elif status in ("completed", "failed"):
                    now = datetime.now(timezone.utc)
                    t["completed_at"] = now
                    if t["started_at"]:
                        t["duration_ms"] = int((now - t["started_at"]).total_seconds() * 1000)
            if stage:
                t["stage"] = stage
            if progress_pct is not None:
                t["progress_pct"] = max(0, min(100, progress_pct))
            if faces_detected is not None:
                t["faces_detected"] = faces_detected
            if summary is not None:
                t["summary"] = summary
            if error is not None:
                t["error"] = error

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._tasks.get(task_id)

    def get_task_for_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            task_id = self._session_to_task.get(session_id)
            if task_id:
                return self._tasks.get(task_id)
            return None

    def submit_job(self, fn, *args, **kwargs):
        """Dispatches job to the background worker pool."""
        return self._executor.submit(fn, *args, **kwargs)

task_service = TaskService()

