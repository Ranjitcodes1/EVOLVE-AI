"""
Classroom Multi-Face Cross-Matching Benchmark
----------------------------------------------
Evaluates YuNet (Detection) + SFace (128-d) vs ArcFace (512-d)
on real classroom captures with 20-40+ seated students.
"""

import sys
import os
import time
from pathlib import Path
import cv2
import numpy as np
import onnxruntime as ort

BASE_DIR = Path(__file__).resolve().parent.parent
WEIGHTS_DIR = BASE_DIR / "backend" / "weights"

YUNET_PATH = str(WEIGHTS_DIR / "face_detection_yunet_2023mar.onnx")
SFACE_PATH = str(WEIGHTS_DIR / "face_recognition_sface_2021dec.onnx")
ARCFACE_PATH = str(WEIGHTS_DIR / "arcface_512d.onnx")

def run_classroom_test(enrollment_photo: str, classroom_photo: str, student_name: str = "Ranjit"):
    print("=" * 80)
    print(f"  SNAPCLASS AI - CLASSROOM ROLL-CALL MATCHING BENCHMARK")
    print("=" * 80)
    print(f"1. Enrolled Student Portrait : {enrollment_photo}")
    print(f"2. Classroom Roll-Call Photo: {classroom_photo}")
    print(f"3. Target Student Name      : {student_name}\n")

    # Check file existence
    if not os.path.exists(enrollment_photo) or not os.path.exists(classroom_photo):
        print(f"Error: Could not locate photo files.")
        return

    # Load neural models
    print("Loading models (YuNet, SFace 128-d, ArcFace 512-d)...")
    yunet = cv2.FaceDetectorYN.create(YUNET_PATH, "", (320, 320), score_threshold=0.4)
    sface = cv2.FaceRecognizerSF.create(SFACE_PATH, "")
    arcface = ort.InferenceSession(ARCFACE_PATH, providers=["CPUExecutionProvider"])
    arc_input = arcface.get_inputs()[0].name
    arc_output = arcface.get_outputs()[0].name

    # Step 1: Detect & Enroll Student
    img_enroll = cv2.imread(enrollment_photo)
    if img_enroll is None:
        print("Failed to read enrollment image.")
        return
    h_e, w_e = img_enroll.shape[:2]
    yunet.setInputSize((w_e, h_e))
    _, faces_enroll = yunet.detect(img_enroll)

    if faces_enroll is None or len(faces_enroll) == 0:
        print("Error: No face found in enrollment photo.")
        return

    # Select primary subject (largest detected bounding box)
    faces_sorted = sorted(faces_enroll, key=lambda f: f[2] * f[3], reverse=True)
    target_face = faces_sorted[0]
    aligned_target = sface.alignCrop(img_enroll, target_face)
    print(f"[Enrollment] Detected primary face crop: {int(target_face[2])}x{int(target_face[3])} px")

    # Extract SFace vector
    t0 = time.perf_counter()
    sface_enroll = sface.feature(aligned_target).flatten()
    sface_enroll = sface_enroll / np.linalg.norm(sface_enroll)
    sface_enroll_lat = (time.perf_counter() - t0) * 1000

    # Extract ArcFace vector
    t1 = time.perf_counter()
    res_enroll = cv2.resize(aligned_target, (112, 112)).astype(np.float32)
    res_enroll = (res_enroll - 127.5) / 128.0
    arc_enroll = arcface.run([arc_output], {arc_input: np.expand_dims(res_enroll, axis=0)})[0].flatten()
    arc_enroll = arc_enroll / np.linalg.norm(arc_enroll)
    arc_enroll_lat = (time.perf_counter() - t1) * 1000

    # Step 2: Classroom Multi-Face Detection
    img_class = cv2.imread(classroom_photo)
    if img_class is None:
        print("Failed to read classroom image.")
        return
    h_c, w_c = img_class.shape[:2]
    yunet.setInputSize((w_c, h_c))
    t2 = time.perf_counter()
    _, class_faces = yunet.detect(img_class)
    det_lat = (time.perf_counter() - t2) * 1000

    if class_faces is None or len(class_faces) == 0:
        print("No students detected in the classroom photograph.")
        return

    num_detected = len(class_faces)
    print(f"[Classroom] Scanned full lecture hall ({w_c}x{h_c} px in {det_lat:.1f} ms)")
    print(f"[Classroom] Successfully detected {num_detected} seated students!\n")

    # Step 3: Match against all students in the classroom
    sface_results = []
    arcface_results = []
    sface_times = []
    arcface_times = []

    for idx, face in enumerate(class_faces):
        aligned = sface.alignCrop(img_class, face)

        # SFace inference
        ts0 = time.perf_counter()
        s_vec = sface.feature(aligned).flatten()
        s_norm = np.linalg.norm(s_vec)
        s_sim = float(np.dot(sface_enroll, s_vec / s_norm)) if s_norm > 0 else 0.0
        sface_times.append((time.perf_counter() - ts0) * 1000)
        sface_results.append((idx + 1, s_sim, face))

        # ArcFace inference
        ta0 = time.perf_counter()
        res = cv2.resize(aligned, (112, 112)).astype(np.float32)
        res = (res - 127.5) / 128.0
        a_vec = arcface.run([arc_output], {arc_input: np.expand_dims(res, axis=0)})[0].flatten()
        a_norm = np.linalg.norm(a_vec)
        a_sim = float(np.dot(arc_enroll, a_vec / a_norm)) if a_norm > 0 else 0.0
        arcface_times.append((time.perf_counter() - ta0) * 1000)
        arcface_results.append((idx + 1, a_sim, face))

    sface_sorted = sorted(sface_results, key=lambda x: x[1], reverse=True)
    arcface_sorted = sorted(arcface_results, key=lambda x: x[1], reverse=True)

    # Step 4: Display Comparison Metrics
    print("-" * 80)
    print("                     TOP MATCH RANKINGS IN CLASSROOM")
    print("-" * 80)
    print(f"{'Rank':<6} | {'Candidate':<15} | {'SFace (128-d) Sim':<20} | {'Candidate':<15} | {'ArcFace (512-d) Sim':<20}")
    print("-" * 80)
    for r in range(min(5, num_detected)):
        s_id, s_sim, _ = sface_sorted[r]
        a_id, a_sim, _ = arcface_sorted[r]
        print(f"#{r+1:<5} | Student #{s_id:<9} | {s_sim:.4f}{' [MATCH]' if r == 0 else '        '} | Student #{a_id:<9} | {a_sim:.4f}{' [MATCH]' if r == 0 else '        '}")
    print("-" * 80)

    # Separation Margin
    s_margin = sface_sorted[0][1] - sface_sorted[1][1]
    a_margin = arcface_sorted[0][1] - arcface_sorted[1][1]
    print(f"\nSeparation Margin (Confidence gap between #1 match and nearest other student):")
    print(f" - SFace (128-d) Margin  : +{s_margin:.4f}  (Score: {sface_sorted[0][1]:.4f} vs {sface_sorted[1][1]:.4f})")
    print(f" - ArcFace (512-d) Margin: +{a_margin:.4f}  (Score: {arcface_sorted[0][1]:.4f} vs {arcface_sorted[1][1]:.4f})")
    print(f" -> ArcFace provides {((a_margin - s_margin)/s_margin)*100:.1f}% stronger discriminative margin against false positives!\n")

    print(f"CPU Latency Breakdown:")
    print(f" - YuNet Detection : {det_lat:.1f} ms for full {w_c}x{h_c} classroom")
    print(f" - SFace Extract   : {np.mean(sface_times):.1f} ms/student ({np.mean(sface_times)*num_detected:.1f} ms total for all {num_detected} students)")
    print(f" - ArcFace Extract : {np.mean(arcface_times):.1f} ms/student ({np.mean(arcface_times)*num_detected:.1f} ms total for all {num_detected} students)")

    # Step 5: Save Annotated Visual Verification Image
    annotated = img_class.copy()
    matched_id = arcface_sorted[0][0]
    matched_face = arcface_sorted[0][2]

    for idx, f in enumerate(class_faces):
        x, y, w, h = int(f[0]), int(f[1]), int(f[2]), int(f[3])
        cand_id = idx + 1
        if cand_id == matched_id:
            cv2.rectangle(annotated, (x, y), (x + w, y + h), (0, 255, 0), 6)
            label = f"MATCH: {student_name} (ArcFace: {arcface_sorted[0][1]:.3f})"
            cv2.putText(annotated, label, (x - 20, max(35, y - 15)), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 255, 0), 3)
        else:
            cv2.rectangle(annotated, (x, y), (x + w, y + h), (255, 160, 0), 2)
            cv2.putText(annotated, f"#{cand_id}", (x, max(20, y - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 160, 0), 2)

    out_path = BASE_DIR / "benchmark" / "ranjit_matched_classroom.jpg"
    cv2.imwrite(str(out_path), annotated)
    print(f"\n[Saved] Visual verification image: {out_path}")
    print("=" * 80)

if __name__ == "__main__":
    enroll = sys.argv[1] if len(sys.argv) > 1 else "benchmark_dataset/ranjit/Ranjit2.jpeg"
    classroom = sys.argv[2] if len(sys.argv) > 2 else "benchmark_dataset/ranjit/Ranjit1.jpeg"
    name = sys.argv[3] if len(sys.argv) > 3 else "Ranjit"
    run_classroom_test(enroll, classroom, name)

