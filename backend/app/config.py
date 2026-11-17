import os
from pathlib import Path
from typing import Optional
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent
WEIGHTS_DIR = BASE_DIR / "weights"
STORAGE_DIR = BASE_DIR / "storage"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

class Settings(BaseModel):
    APP_NAME: str = "SnapClass AI"
    VERSION: str = "2.0.0"
    API_PREFIX: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'snapclass.db'}")
    
    # JWT Authentication & Persistent Login
    SECRET_KEY: str = os.getenv("SECRET_KEY", "snapclass_super_secret_production_key_2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24-hour token for uninterrupted testing
    REFRESH_TOKEN_EXPIRE_DAYS: int = 60    # 60-day persistent session token
    
    # Storage Configuration (Dual-Mode: "local" or "s3")
    STORAGE_BACKEND: str = os.getenv("STORAGE_BACKEND", "local")
    STORAGE_LOCAL_ROOT: str = str(STORAGE_DIR)
    S3_ENDPOINT_URL: Optional[str] = os.getenv("S3_ENDPOINT_URL", "http://localhost:9000")
    S3_ACCESS_KEY: Optional[str] = os.getenv("S3_ACCESS_KEY", "minioadmin")
    S3_SECRET_KEY: Optional[str] = os.getenv("S3_SECRET_KEY", "minioadmin")
    S3_BUCKET_NAME: str = os.getenv("S3_BUCKET_NAME", "snapclass-captures")
    S3_REGION: str = os.getenv("S3_REGION", "us-east-1")
    
    # Computer Vision & Biometric Pipeline
    BIOMETRIC_MODEL: str = os.getenv("BIOMETRIC_MODEL", "arcface_512d")  # "arcface_512d" or "sface_128d"
    YUNET_PATH: str = str(WEIGHTS_DIR / "face_detection_yunet_2023mar.onnx")
    SFACE_PATH: str = str(WEIGHTS_DIR / "face_recognition_sface_2021dec.onnx")
    ARCFACE_PATH: str = str(WEIGHTS_DIR / "arcface_512d.onnx")
    
    # ArcFace (512-d) Confidence Thresholds
    ARCFACE_THRESHOLD_LIKELY: float = 0.32
    ARCFACE_THRESHOLD_REVIEW: float = 0.20
    SIMILARITY_THRESHOLD_LIKELY: float = 0.32
    SIMILARITY_THRESHOLD_REVIEW: float = 0.20
    
    # SFace (128-d) Confidence Thresholds (Fallback)
    SFACE_THRESHOLD_LIKELY: float = 0.45
    SFACE_THRESHOLD_REVIEW: float = 0.28
    
    # Raw Capture Retention (Days)
    RAW_CAPTURE_RETENTION_DAYS: int = 30
    
    # Presentation Attack Detection (PAD) / Liveness Verification
    ENABLE_LIVENESS_DETECTION: bool = True
    LIVENESS_THRESHOLD: float = 0.40

settings = Settings()
