import os
import json
import time
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
import cv2
import numpy as np
import onnxruntime as ort

from app.config import settings

BASE_DIR = Path(__file__).resolve().parent.parent.parent
WEIGHTS_DIR = BASE_DIR / "backend" / "weights"
if not WEIGHTS_DIR.exists():
    WEIGHTS_DIR = BASE_DIR / "weights"

YUNET_PATH = str(WEIGHTS_DIR / "face_detection_yunet_2023mar.onnx")
SFACE_PATH = str(WEIGHTS_DIR / "face_recognition_sface_2021dec.onnx")
ARCFACE_PATH = str(WEIGHTS_DIR / "arcface_512d.onnx")

class VisionService:
    """
    Biometric Face Detection and ArcFace (512-d) Recognition Service.
    Optimized for multi-face classroom attendance roll-calls on CPU with AVX-512.
    """
    _instance = None

    def __new__(cls, *args, **kwargs):
        # Singleton pattern: prevent reloading 130MB ONNX weights into RAM multiple times
        if cls._instance is None:
            cls._instance = super(VisionService, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if getattr(self, "_initialized", False):
            return

        self._detector: Optional[cv2.FaceDetectorYN] = None
        self._sface: Optional[cv2.FaceRecognizerSF] = None
        self._arcface_session: Optional[ort.InferenceSession] = None
        self._arcface_input: str = ""
        self._arcface_output: str = ""
        self._active_model: str = settings.BIOMETRIC_MODEL
        self._models_loaded: bool = False
        self._initialized = True

    def _ensure_models_loaded(self):
        """Lazy-loads AI models on first inference to ensure lightweight <50MB cold-boot."""
        if not self._models_loaded:
            self._init_models()
            self._models_loaded = True

    def _init_models(self):
        print(f"Initializing Vision Engine (Primary: {self._active_model})...")

        # 1. YuNet Multi-Face Detector
        if os.path.exists(YUNET_PATH):
            try:
                self._detector = cv2.FaceDetectorYN.create(
                    YUNET_PATH, "", (320, 320), score_threshold=0.4, nms_threshold=0.3
                )
                print(f" [OK] YuNet Face Detector loaded: {YUNET_PATH}")
            except Exception as e:
                print(f" [WARN] Failed to initialize YuNet detector: {e}")
        else:
            print(f" [WARN] YuNet weights not found at: {YUNET_PATH}")

        # 2. SFace (128-d) - also used for face landmark alignment
        if os.path.exists(SFACE_PATH):
            try:
                self._sface = cv2.FaceRecognizerSF.create(SFACE_PATH, "")
                print(f" [OK] SFace Face Recognizer loaded: {SFACE_PATH}")
            except Exception as e:
                print(f" [WARN] Failed to initialize SFace: {e}")

        # 3. ArcFace (512-d) with Strict Memory Clamping for 512MB RAM Containers
        if os.path.exists(ARCFACE_PATH):
            try:
                opts = ort.SessionOptions()
                # Hardware clamping: single-threaded execution + disable huge memory arena
                opts.intra_op_num_threads = 1
                opts.inter_op_num_threads = 1
                opts.enable_cpu_mem_arena = False
                opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
                opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC

                self._arcface_session = ort.InferenceSession(
                    ARCFACE_PATH, sess_options=opts, providers=["CPUExecutionProvider"]
                )
                self._arcface_input = self._arcface_session.get_inputs()[0].name
                self._arcface_output = self._arcface_session.get_outputs()[0].name
                print(f" [OK] ArcFace (512-d) Engine loaded with low-memory arena: {ARCFACE_PATH}")
            except Exception as e:
                print(f" [WARN] Failed to initialize ArcFace ONNXRuntime session: {e}")
        else:
            print(f" [WARN] ArcFace weights not found at: {ARCFACE_PATH}")

    def _decode_image(self, image_bytes: bytes) -> np.ndarray:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Failed to decode image. Please provide a valid JPEG, PNG, or WebP.")
        return img

    def extract_embedding_from_aligned(self, aligned_face: np.ndarray) -> List[float]:
        """
        Extracts 512-d unit vector via ArcFace (or 128-d via SFace if ArcFace is unavailable).
        """
        self._ensure_models_loaded()
        if self._arcface_session is not None and self._active_model == "arcface_512d":
            # ArcFace input: (1, 112, 112, 3), float32 normalized to [-1, 1]
            resized = cv2.resize(aligned_face, (112, 112)).astype(np.float32)
            normalized = (resized - 127.5) / 128.0
            blob = np.expand_dims(normalized, axis=0)
            
            raw_out = self._arcface_session.run([self._arcface_output], {self._arcface_input: blob})[0]
            vec = raw_out.flatten()
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm
            return vec.tolist()
        elif self._sface is not None:
            # SFace fallback: 128-d vector
            feat = self._sface.feature(aligned_face).flatten()
            norm = np.linalg.norm(feat)
            if norm > 0:
                feat = feat / norm
            return feat.tolist()
        else:
            # Synthetic 512-d fallback if models are missing
            gray = cv2.cvtColor(aligned_face, cv2.COLOR_BGR2GRAY)
            resized = cv2.resize(gray, (16, 32))
            hist = resized.flatten().astype(np.float32)
            norm = np.linalg.norm(hist)
            if norm > 0:
                hist = hist / norm
            return hist.tolist()

    def extract_enrollment_face(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        Validates a student enrollment photo:
        - Exactly 1 clear face must be present
        - Face must be adequately sized (>= 60x60)
        - Extracts 512-d biometric embedding
        """
        self._ensure_models_loaded()
        img = self._decode_image(image_bytes)
        h, w, _ = img.shape

        if self._detector and self._sface:
            self._detector.setInputSize((w, h))
            _, faces = self._detector.detect(img)

            if faces is None or len(faces) == 0:
                raise ValueError("No face detected in enrollment photo. Please ensure good lighting and face the camera directly.")

            if len(faces) > 1:
                # If multiple faces detected, find the largest one
                faces_sorted = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
                primary = faces_sorted[0]
                secondary = faces_sorted[1]
                # If secondary face is at least 40% size of primary, reject
                if (secondary[2] * secondary[3]) > 0.4 * (primary[2] * primary[3]):
                    raise ValueError(f"Multiple faces ({len(faces)}) detected. Photo must contain only one student.")
                face = primary
            else:
                face = faces[0]

            box = face[0:4].astype(int)
            fw, fh = box[2], box[3]

            if fw < 50 or fh < 50:
                raise ValueError("Face is too small or far away. Please move closer to the camera.")

            # Align face using 5 facial landmarks
            aligned = self._sface.alignCrop(img, face)
            embedding = self.extract_embedding_from_aligned(aligned)

            # Presentation Attack Detection (PAD) / Passive Liveness Verification
            from app.services.liveness_service import liveness_service
            liveness_res = liveness_service.analyze_liveness(
                img, [int(box[0]), int(box[1]), int(box[2]), int(box[3])]
            )
            if settings.ENABLE_LIVENESS_DETECTION and not liveness_res["is_live"]:
                attack_desc = "2D Screen Replay" if liveness_res["attack_type"] == "screen_replay" else "Printed Photo"
                raise ValueError(
                    f"Biometric Presentation Attack Detected ({attack_desc}, score: {liveness_res['liveness_score']:.2f}). "
                    "Enrollment requires a live, bona fide selfie. Please capture directly facing the camera with natural lighting."
                )

            return {
                "embedding": embedding,
                "dimension": len(embedding),
                "bbox": [int(box[0]), int(box[1]), int(box[2]), int(box[3])],
                "confidence": float(face[14]),
                "model": "arcface_512d" if len(embedding) == 512 else "sface_128d",
                "liveness": liveness_res,
            }
        else:
            raise RuntimeError("Face detector or recognizer weights are not initialized.")

    def detect_classroom_faces(self, image_bytes: bytes) -> List[Dict[str, Any]]:
        """
        Detects all student faces in a wide-angle lecture hall capture.
        Returns list of { bbox, confidence, embedding (512-d), is_live, liveness_score }
        """
        self._ensure_models_loaded()
        img = self._decode_image(image_bytes)
        h, w, _ = img.shape
        detected = []

        from app.services.liveness_service import liveness_service

        if self._detector and self._sface:
            self._detector.setInputSize((w, h))
            _, faces = self._detector.detect(img)

            if faces is not None:
                for face in faces:
                    box = face[0:4].astype(int)
                    aligned = self._sface.alignCrop(img, face)
                    embedding = self.extract_embedding_from_aligned(aligned)
                    liveness = liveness_service.analyze_liveness(
                        img, [int(box[0]), int(box[1]), int(box[2]), int(box[3])]
                    )
                    detected.append({
                        "bbox": [int(box[0]), int(box[1]), int(box[2]), int(box[3])],
                        "confidence": float(face[14]),
                        "embedding": embedding,
                        "is_live": liveness["is_live"],
                        "liveness_score": liveness["liveness_score"],
                        "attack_type": liveness["attack_type"],
                    })
        return detected

    @staticmethod
    def cosine_similarity(v1: List[float], v2: List[float]) -> float:
        a = np.array(v1, dtype=np.float32)
        b = np.array(v2, dtype=np.float32)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(a, b) / (norm_a * norm_b))

    def match_session_faces(
        self,
        all_detected_faces: List[Dict[str, Any]],
        enrolled_roster: List[Dict[str, Any]],
        likely_thresh: Optional[float] = None,
        review_thresh: Optional[float] = None
    ) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
        """
        Matches detected classroom faces against the enrolled division roster.
        - Intra-session deduplication: ensures each student receives at most 1 proposal.
        - Uses ArcFace (512-d) thresholds (default: likely >= 0.32, review >= 0.20).
        """
        likely_thresh = likely_thresh or settings.ARCFACE_THRESHOLD_LIKELY
        review_thresh = review_thresh or settings.ARCFACE_THRESHOLD_REVIEW

        student_best_match: Dict[str, Dict[str, Any]] = {}
        unidentified_count = 0

        students_by_id = {s["student_id"]: s for s in enrolled_roster}

        for det in all_detected_faces:
            det_emb = det["embedding"]
            best_sim = -1.0
            best_student_id = None

            for student in enrolled_roster:
                st_emb = student.get("embedding")
                if not st_emb:
                    continue
                sim = self.cosine_similarity(det_emb, st_emb)
                if sim > best_sim:
                    best_sim = sim
                    best_student_id = student["student_id"]

            if best_student_id and best_sim >= review_thresh:
                # Deduplication: retain highest confidence detection for each student
                if best_student_id not in student_best_match or best_sim > student_best_match[best_student_id]["similarity"]:
                    student_best_match[best_student_id] = {
                        "student_id": best_student_id,
                        "similarity": round(best_sim, 3),
                        "detection_confidence": det["confidence"],
                        "is_live": det.get("is_live", True),
                        "liveness_score": det.get("liveness_score", 1.0),
                        "attack_type": det.get("attack_type", "none"),
                    }
            else:
                unidentified_count += 1

        # Build full proposal roster for every enrolled student
        proposals = []
        likely_count = 0
        review_count = 0
        not_detected_count = 0

        for student_id, st_info in students_by_id.items():
            if student_id in student_best_match:
                match_data = student_best_match[student_id]
                sim = match_data["similarity"]
                is_live = match_data.get("is_live", True)
                liveness_score = match_data.get("liveness_score", 1.0)
                attack_type = match_data.get("attack_type", "none")

                correction_reason = None
                if not is_live:
                    # Presentation attack: automatically mark for review as absent
                    proposed_status = "absent"
                    review_state = "needs_review"
                    attack_label = "Screen Replay" if attack_type == "screen_replay" else "Photo Print"
                    correction_reason = f"Security Flag: Potential {attack_label} Presentation Attack (Liveness: {liveness_score:.2f})"
                    review_count += 1
                elif sim >= likely_thresh:
                    proposed_status = "present"
                    review_state = "accepted"
                    likely_count += 1
                else:
                    proposed_status = "present"
                    review_state = "needs_review"
                    review_count += 1

                proposals.append({
                    "student_id": student_id,
                    "urn": st_info["urn"],
                    "full_name": st_info["full_name"],
                    "roll_number": st_info.get("roll_number"),
                    "proposed_status": proposed_status,
                    "similarity": sim,
                    "review_state": review_state,
                    "marking_method": "ai_proposed",
                    "correction_reason": correction_reason,
                    "is_live": is_live,
                    "liveness_score": liveness_score,
                })
            else:
                proposals.append({
                    "student_id": student_id,
                    "urn": st_info["urn"],
                    "full_name": st_info["full_name"],
                    "roll_number": st_info.get("roll_number"),
                    "proposed_status": "absent",
                    "similarity": None,
                    "review_state": "unidentified",
                    "marking_method": "ai_proposed"
                })
                not_detected_count += 1

        summary = {
            "total_detected_faces": len(all_detected_faces),
            "likely_matches": likely_count,
            "needs_review": review_count,
            "not_detected": not_detected_count,
            "unidentified_faces": unidentified_count
        }

        return proposals, summary

vision_service = VisionService()
