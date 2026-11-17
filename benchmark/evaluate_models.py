import os
import sys
import time
import json
import glob
import itertools
from pathlib import Path
from typing import List, Dict, Tuple, Any

import cv2
import numpy as np
import onnxruntime as ort

BASE_DIR = Path(__file__).resolve().parent.parent
WEIGHTS_DIR = BASE_DIR / "backend" / "weights"

YUNET_PATH = str(WEIGHTS_DIR / "face_detection_yunet_2023mar.onnx")
SFACE_PATH = str(WEIGHTS_DIR / "face_recognition_sface_2021dec.onnx")
ARCFACE_PATH = str(WEIGHTS_DIR / "arcface_512d.onnx")

class FacePipeline:
    def __init__(self):
        print("Initializing face detection & recognition backends...")
        # 1. YuNet Face Detector
        self.detector = cv2.FaceDetectorYN.create(
            YUNET_PATH, "", (320, 320), score_threshold=0.6, nms_threshold=0.3
        )
        
        # 2. SFace (128-d)
        self.sface = cv2.FaceRecognizerSF.create(SFACE_PATH, "")
        
        # 3. ArcFace (512-d)
        self.arcface_session = ort.InferenceSession(
            ARCFACE_PATH, providers=["CPUExecutionProvider"]
        )
        self.arcface_input_name = self.arcface_session.get_inputs()[0].name
        self.arcface_output_name = self.arcface_session.get_outputs()[0].name
        print("Both models (SFace 128-d and ArcFace 512-d) successfully loaded!\n")

    def detect_face(self, img: np.ndarray) -> Tuple[Optional[np.ndarray], Optional[np.ndarray]]:
        h, w, _ = img.shape
        self.detector.setInputSize((w, h))
        _, faces = self.detector.detect(img)
        if faces is None or len(faces) == 0:
            return None, None
        # Return primary face
        return faces[0], img

    def extract_sface(self, img: np.ndarray, face: np.ndarray) -> np.ndarray:
        aligned = self.sface.alignCrop(img, face)
        feat = self.sface.feature(aligned)
        vec = feat.flatten()
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec

    def extract_arcface(self, img: np.ndarray, face: np.ndarray) -> np.ndarray:
        aligned = self.sface.alignCrop(img, face)
        # Resize to ArcFace 112x112 NHWC
        resized = cv2.resize(aligned, (112, 112)).astype(np.float32)
        # Normalize to [-1, 1]
        resized = (resized - 127.5) / 128.0
        blob = np.expand_dims(resized, axis=0) # (1, 112, 112, 3)
        
        out = self.arcface_session.run([self.arcface_output_name], {self.arcface_input_name: blob})[0]
        vec = out.flatten()
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec

    @staticmethod
    def cosine_similarity(v1: np.ndarray, v2: np.ndarray) -> float:
        dot = np.dot(v1, v2)
        norm = np.linalg.norm(v1) * np.linalg.norm(v2)
        if norm == 0:
            return 0.0
        return float(dot / norm)

def calculate_metrics(similarities: List[float], labels: List[int], threshold: float) -> Dict[str, float]:
    tp = fp = tn = fn = 0
    for sim, label in zip(similarities, labels):
        pred = 1 if sim >= threshold else 0
        if pred == 1 and label == 1:
            tp += 1
        elif pred == 1 and label == 0:
            fp += 1
        elif pred == 0 and label == 0:
            tn += 1
        elif pred == 0 and label == 1:
            fn += 1

    total = len(labels)
    acc = (tp + tn) / total if total > 0 else 0.0
    prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 2 * (prec * rec) / (prec + rec) if (prec + rec) > 0 else 0.0
    far = fp / (fp + tn) if (fp + tn) > 0 else 0.0
    frr = fn / (tp + fn) if (tp + fn) > 0 else 0.0

    return {
        "threshold": threshold,
        "accuracy": round(acc * 100, 2),
        "precision": round(prec * 100, 2),
        "recall": round(rec * 100, 2),
        "f1": round(f1 * 100, 2),
        "far": round(far * 100, 2),
        "frr": round(frr * 100, 2),
        "tp": tp, "fp": fp, "tn": tn, "fn": fn
    }

def find_best_threshold(similarities: List[float], labels: List[int]) -> Dict[str, Any]:
    best_res = None
    best_f1 = -1.0
    for t_int in range(10, 95):
        t = t_int / 100.0
        res = calculate_metrics(similarities, labels, t)
        if res["f1"] > best_f1:
            best_f1 = res["f1"]
            best_res = res
    return best_res or calculate_metrics(similarities, labels, 0.5)

def run_benchmark(dataset_dir: str):
    pipeline = FacePipeline()
    dataset_path = Path(dataset_dir)
    
    # 1. Discover identities & images
    person_dirs = [d for d in dataset_path.iterdir() if d.is_dir()]
    if not person_dirs:
        print(f"Error: No person folders found in {dataset_dir}")
        print("Please structure your dataset as: dataset/<student_name>/<photo1.jpg>, <photo2.jpg>")
        return

    print(f"Discovered {len(person_dirs)} identities in dataset directory.")

    # 2. Extract embeddings for all images
    # data: { person_id: [ { path, sface_vec, arcface_vec, sface_time, arcface_time } ] }
    person_data = {}
    sface_latencies = []
    arcface_latencies = []
    total_images_processed = 0

    for p_dir in person_dirs:
        p_name = p_dir.name
        img_files = glob.glob(str(p_dir / "*.*"))
        person_data[p_name] = []

        for fpath in img_files:
            if not fpath.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                continue

            img = cv2.imread(fpath)
            if img is None:
                continue

            face, aligned_img = pipeline.detect_face(img)
            if face is None:
                print(f"Warning: No face detected in {fpath}. Skipping.")
                continue

            # SFace (128-d) timing
            t0 = time.perf_counter()
            sface_vec = pipeline.extract_sface(aligned_img, face)
            sface_dur = (time.perf_counter() - t0) * 1000.0
            sface_latencies.append(sface_dur)

            # ArcFace (512-d) timing
            t1 = time.perf_counter()
            arcface_vec = pipeline.extract_arcface(aligned_img, face)
            arcface_dur = (time.perf_counter() - t1) * 1000.0
            arcface_latencies.append(arcface_dur)

            person_data[p_name].append({
                "path": fpath,
                "sface_vec": sface_vec,
                "arcface_vec": arcface_vec
            })
            total_images_processed += 1

    print(f"Successfully processed {total_images_processed} valid face images.\n")

    # 3. Generate Pairs (Genuine Pairs vs Impostor Pairs)
    sface_sims = []
    arcface_sims = []
    labels = []

    # Genuine pairs (Same person, different photos)
    genuine_count = 0
    for p_name, items in person_data.items():
        if len(items) >= 2:
            for item1, item2 in itertools.combinations(items, 2):
                sface_sims.append(pipeline.cosine_similarity(item1["sface_vec"], item2["sface_vec"]))
                arcface_sims.append(pipeline.cosine_similarity(item1["arcface_vec"], item2["arcface_vec"]))
                labels.append(1) # Same person
                genuine_count += 1

    # Impostor pairs (Different people)
    impostor_count = 0
    all_persons = list(person_data.keys())
    for i in range(len(all_persons)):
        for j in range(i + 1, len(all_persons)):
            p1 = all_persons[i]
            p2 = all_persons[j]
            for item1 in person_data[p1]:
                for item2 in person_data[p2]:
                    sface_sims.append(pipeline.cosine_similarity(item1["sface_vec"], item2["sface_vec"]))
                    arcface_sims.append(pipeline.cosine_similarity(item1["arcface_vec"], item2["arcface_vec"]))
                    labels.append(0) # Different person
                    impostor_count += 1

    print(f"Formed Evaluation Pairs: {genuine_count} Genuine Pairs (Same Student) + {impostor_count} Impostor Pairs (Different Students)")
    print(f"Total verification tests conducted: {len(labels)}\n")

    if genuine_count == 0:
        print("Note: To measure accuracy, each person folder should contain at least 2 photos.")
        return

    # 4. Evaluate Both Models
    sface_best = find_best_threshold(sface_sims, labels)
    arcface_best = find_best_threshold(arcface_sims, labels)

    avg_sface_lat = np.mean(sface_latencies) if sface_latencies else 0.0
    avg_arcface_lat = np.mean(arcface_latencies) if arcface_latencies else 0.0

    sface_size_mb = os.path.getsize(SFACE_PATH) / (1024 * 1024)
    arcface_size_mb = os.path.getsize(ARCFACE_PATH) / (1024 * 1024)

    # Format metrics for clean table display
    s_th = f"{sface_best['threshold']:.2f}"
    a_th = f"{arcface_best['threshold']:.2f}"
    s_acc = f"{sface_best['accuracy']:.2f}%"
    a_acc = f"{arcface_best['accuracy']:.2f}%"
    s_f1 = f"{sface_best['f1']:.2f}%"
    a_f1 = f"{arcface_best['f1']:.2f}%"
    s_rec = f"{sface_best['recall']:.2f}%"
    a_rec = f"{arcface_best['recall']:.2f}%"
    s_far = f"{sface_best['far']:.2f}% (Proxy)"
    a_far = f"{arcface_best['far']:.2f}% (Proxy)"
    s_frr = f"{sface_best['frr']:.2f}% (Missed)"
    a_frr = f"{arcface_best['frr']:.2f}% (Missed)"

    # 5. Print Comparison Table
    print("=" * 80)
    print("        HEAD-TO-HEAD ACCURACY & PERFORMANCE BENCHMARK RESULTS")
    print("=" * 80)
    print(f"{'Metric':<32} | {'SFace (128-d)':<20} | {'ArcFace (512-d)':<20}")
    print("-" * 80)
    print(f"{'Embedding Dimension':<32} | {'128 dimensions':<20} | {'512 dimensions':<20}")
    print(f"{'Model File Size':<32} | {f'{sface_size_mb:.2f} MB':<20} | {f'{arcface_size_mb:.2f} MB':<20}")
    print(f"{'Average CPU Inference Speed':<32} | {f'{avg_sface_lat:.1f} ms / face':<20} | {f'{avg_arcface_lat:.1f} ms / face':<20}")
    print("-" * 80)
    print(f"{'Optimal Cosine Threshold':<32} | {s_th:<20} | {a_th:<20}")
    print(f"{'Accuracy':<32} | {s_acc:<20} | {a_acc:<20}")
    print(f"{'F1-Score':<32} | {s_f1:<20} | {a_f1:<20}")
    print(f"{'True Positive Rate (Recall)':<32} | {s_rec:<20} | {a_rec:<20}")
    print(f"{'False Acceptance Rate (FAR)':<32} | {s_far:<20} | {a_far:<20}")
    print(f"{'False Rejection Rate (FRR)':<32} | {s_frr:<20} | {a_frr:<20}")
    print("=" * 80)

    # Save results to json
    results = {
        "dataset_summary": {
            "total_identities": len(person_dirs),
            "total_images": total_images_processed,
            "genuine_pairs": genuine_count,
            "impostor_pairs": impostor_count
        },
        "sface_128d": {
            **sface_best,
            "average_latency_ms": round(avg_sface_lat, 2),
            "model_size_mb": round(sface_size_mb, 2)
        },
        "arcface_512d": {
            **arcface_best,
            "average_latency_ms": round(avg_arcface_lat, 2),
            "model_size_mb": round(arcface_size_mb, 2)
        }
    }

    out_file = BASE_DIR / "benchmark" / "benchmark_results.json"
    with open(out_file, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nDetailed evaluation results saved to: {out_file}\n")

if __name__ == "__main__":
    dataset_directory = sys.argv[1] if len(sys.argv) > 1 else "benchmark_dataset"
    run_benchmark(dataset_directory)
