import uuid
import json
from datetime import datetime, timezone
from typing import List
import numpy as np
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Text, Integer
from sqlalchemy.orm import relationship
from app.database import Base

def gen_uuid():
    return str(uuid.uuid4())

class StudentFaceEmbedding(Base):
    """
    Biometric Face Embedding Record.
    Stores ArcFace (512-d) normalized vector.
    """
    __tablename__ = "student_face_embeddings"

    id = Column(String, primary_key=True, default=gen_uuid)
    student_id = Column(String, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    model_name = Column(String, default="arcface_512d", nullable=False)
    model_version = Column(String, default="1.0", nullable=False)
    embedding_dim = Column(Integer, default=512, nullable=False)
    embedding_json = Column(Text, nullable=False)  # Serialized 512 float values
    photo_object_key = Column(String, nullable=True)  # Reference in private storage
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    retired_at = Column(DateTime, nullable=True)

    student = relationship("Student", back_populates="face_embeddings")

    def get_vector(self) -> np.ndarray:
        """Returns normalized float32 numpy vector."""
        vec = np.array(json.loads(self.embedding_json), dtype=np.float32)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec

    def set_vector(self, vec: np.ndarray):
        """Serializes and stores normalized float32 array."""
        arr = np.array(vec, dtype=np.float32).flatten()
        norm = np.linalg.norm(arr)
        if norm > 0:
            arr = arr / norm
        self.embedding_dim = len(arr)
        self.embedding_json = json.dumps(arr.tolist())
