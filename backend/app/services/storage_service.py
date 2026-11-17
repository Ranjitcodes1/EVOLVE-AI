import os
import uuid
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional
from app.config import settings

class BaseStorageProvider(ABC):
    @abstractmethod
    def upload_file(self, file_bytes: bytes, object_key: str, content_type: str = "image/jpeg") -> str:
        """Uploads file bytes to storage and returns the object key."""
        pass

    @abstractmethod
    def get_file(self, object_key: str) -> bytes:
        """Retrieves raw file bytes."""
        pass

    @abstractmethod
    def delete_file(self, object_key: str) -> bool:
        """Deletes file from storage. Returns True if deleted or already absent."""
        pass

    @abstractmethod
    def file_exists(self, object_key: str) -> bool:
        """Checks if file exists in storage."""
        pass

    @abstractmethod
    def get_file_size(self, object_key: str) -> int:
        """Returns file size in bytes."""
        pass

class LocalStorageProvider(BaseStorageProvider):
    """
    Local Filesystem Storage Provider.
    Zero external dependencies, ideal for local development, workstation tests, and offline use.
    Includes path-traversal security defense.
    """
    def __init__(self, root_dir: str):
        self.root_path = Path(root_dir).resolve()
        self.root_path.mkdir(parents=True, exist_ok=True)

    def _resolve_safe_path(self, object_key: str) -> Path:
        # Sanitize object_key and prevent directory traversal (e.g., ../../../)
        clean_key = object_key.replace("\\", "/").lstrip("/")
        target_path = (self.root_path / clean_key).resolve()
        if not str(target_path).startswith(str(self.root_path)):
            raise ValueError(f"Security Alert: Directory traversal attempt detected: {object_key}")
        return target_path

    def upload_file(self, file_bytes: bytes, object_key: str, content_type: str = "image/jpeg") -> str:
        target_path = self._resolve_safe_path(object_key)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        with open(target_path, "wb") as f:
            f.write(file_bytes)
        return object_key

    def get_file(self, object_key: str) -> bytes:
        target_path = self._resolve_safe_path(object_key)
        if not target_path.exists():
            raise FileNotFoundError(f"Storage asset not found: {object_key}")
        with open(target_path, "rb") as f:
            return f.read()

    def delete_file(self, object_key: str) -> bool:
        try:
            target_path = self._resolve_safe_path(object_key)
            if target_path.exists():
                target_path.unlink()
                return True
            return True
        except Exception as e:
            print(f"LocalStorage delete error for {object_key}: {e}")
            return False

    def file_exists(self, object_key: str) -> bool:
        target_path = self._resolve_safe_path(object_key)
        return target_path.exists() and target_path.is_file()

    def get_file_size(self, object_key: str) -> int:
        target_path = self._resolve_safe_path(object_key)
        return target_path.stat().st_size if target_path.exists() else 0

class S3StorageProvider(BaseStorageProvider):
    """
    MinIO S3 / AWS S3 Storage Provider.
    Provides scalable object storage with encrypted private buckets.
    Falls back gracefully to LocalStorageProvider if boto3 or S3 is unavailable.
    """
    def __init__(self, endpoint_url: str, access_key: str, secret_key: str, bucket_name: str, region: str = "us-east-1"):
        self.bucket_name = bucket_name
        self.fallback = LocalStorageProvider(settings.STORAGE_LOCAL_ROOT)
        self.s3_client = None

        try:
            import boto3
            from botocore.client import Config
            self.s3_client = boto3.client(
                "s3",
                endpoint_url=endpoint_url,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                region_name=region,
                config=Config(signature_version="s3v4")
            )
            # Ensure bucket exists
            try:
                self.s3_client.head_bucket(Bucket=self.bucket_name)
            except Exception:
                try:
                    self.s3_client.create_bucket(Bucket=self.bucket_name)
                except Exception as b_err:
                    print(f"S3 create bucket error (using fallback): {b_err}")
                    self.s3_client = None
        except ImportError:
            print("boto3 not installed. S3StorageProvider defaulting to LocalStorageProvider.")
            self.s3_client = None
        except Exception as e:
            print(f"S3 connection failed ({e}). Defaulting to LocalStorageProvider.")
            self.s3_client = None

    def upload_file(self, file_bytes: bytes, object_key: str, content_type: str = "image/jpeg") -> str:
        if self.s3_client:
            try:
                clean_key = object_key.replace("\\", "/").lstrip("/")
                self.s3_client.put_object(
                    Bucket=self.bucket_name,
                    Key=clean_key,
                    Body=file_bytes,
                    ContentType=content_type
                )
                return clean_key
            except Exception as e:
                print(f"S3 upload failed ({e}), falling back to local...")
        return self.fallback.upload_file(file_bytes, object_key, content_type)

    def get_file(self, object_key: str) -> bytes:
        if self.s3_client:
            try:
                clean_key = object_key.replace("\\", "/").lstrip("/")
                resp = self.s3_client.get_object(Bucket=self.bucket_name, Key=clean_key)
                return resp["Body"].read()
            except Exception as e:
                print(f"S3 get failed ({e}), checking local fallback...")
        return self.fallback.get_file(object_key)

    def delete_file(self, object_key: str) -> bool:
        deleted = True
        if self.s3_client:
            try:
                clean_key = object_key.replace("\\", "/").lstrip("/")
                self.s3_client.delete_object(Bucket=self.bucket_name, Key=clean_key)
            except Exception as e:
                print(f"S3 delete error ({e}): {object_key}")
                deleted = False
        fallback_deleted = self.fallback.delete_file(object_key)
        return deleted or fallback_deleted

    def file_exists(self, object_key: str) -> bool:
        if self.s3_client:
            try:
                clean_key = object_key.replace("\\", "/").lstrip("/")
                self.s3_client.head_object(Bucket=self.bucket_name, Key=clean_key)
                return True
            except Exception:
                pass
        return self.fallback.file_exists(object_key)

    def get_file_size(self, object_key: str) -> int:
        if self.s3_client:
            try:
                clean_key = object_key.replace("\\", "/").lstrip("/")
                head = self.s3_client.head_object(Bucket=self.bucket_name, Key=clean_key)
                return head.get("ContentLength", 0)
            except Exception:
                pass
        return self.fallback.get_file_size(object_key)

class StorageService:
    """
    Unified Storage Interface for SnapClass AI.
    Handles classroom roll-call captures and student registration portraits.
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(StorageService, cls).__new__(cls)
            cls._instance._provider = None
            cls._instance._init_provider()
        return cls._instance

    def _init_provider(self):
        backend = settings.STORAGE_BACKEND.lower()
        if backend == "s3":
            print(f"StorageService: Initializing S3/MinIO Provider ({settings.S3_BUCKET_NAME})...")
            self._provider = S3StorageProvider(
                endpoint_url=settings.S3_ENDPOINT_URL or "http://localhost:9000",
                access_key=settings.S3_ACCESS_KEY or "minioadmin",
                secret_key=settings.S3_SECRET_KEY or "minioadmin",
                bucket_name=settings.S3_BUCKET_NAME,
                region=settings.S3_REGION
            )
        else:
            print(f"StorageService: Initializing Local Storage Provider ({settings.STORAGE_LOCAL_ROOT})...")
            self._provider = LocalStorageProvider(settings.STORAGE_LOCAL_ROOT)

    @property
    def provider(self) -> BaseStorageProvider:
        return self._provider

    def save_classroom_capture(self, session_id: str, file_bytes: bytes, filename: str = "capture.jpg") -> str:
        """Saves a classroom roll-call photograph."""
        ext = Path(filename).suffix.lower() or ".jpg"
        object_key = f"captures/{session_id}/{uuid.uuid4().hex}{ext}"
        return self._provider.upload_file(file_bytes, object_key, content_type="image/jpeg")

    def save_student_enrollment(self, student_id: str, file_bytes: bytes, filename: str = "portrait.jpg") -> str:
        """Saves a student registration portrait."""
        ext = Path(filename).suffix.lower() or ".jpg"
        object_key = f"enrollments/{student_id}_{uuid.uuid4().hex[:8]}{ext}"
        return self._provider.upload_file(file_bytes, object_key, content_type="image/jpeg")

    def get_file(self, object_key: str) -> bytes:
        return self._provider.get_file(object_key)

    def delete_file(self, object_key: str) -> bool:
        return self._provider.delete_file(object_key)

    def file_exists(self, object_key: str) -> bool:
        return self._provider.file_exists(object_key)

    def get_file_size(self, object_key: str) -> int:
        return self._provider.get_file_size(object_key)

storage_service = StorageService()

