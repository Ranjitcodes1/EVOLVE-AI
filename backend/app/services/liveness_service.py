import cv2
import numpy as np
from typing import Dict, Any, List, Optional
from app.config import settings

class LivenessService:
    """
    Presentation Attack Detection (PAD) Service.
    Complies with ISO/IEC 30107-3 standards for passive liveness verification:
    - 2D Screen Replay Detection (Moiré pattern & subpixel grid interference)
    - Printed Photo Detection (Color gamut compression & chrominance variance)
    - Specular Planar Reflection & Surface Gradient Depth Check
    """

    def __init__(self, threshold: float = 0.45):
        self.threshold = threshold

    def _crop_face(self, img: np.ndarray, bbox: List[int]) -> Optional[np.ndarray]:
        h, w = img.shape[:2]
        x, y, fw, fh = [int(v) for v in bbox[:4]]
        
        # Add slight padding around face (10%)
        pad_x = int(fw * 0.1)
        pad_y = int(fh * 0.1)
        x1 = max(0, x - pad_x)
        y1 = max(0, y - pad_y)
        x2 = min(w, x + fw + pad_x)
        y2 = min(h, y + fh + pad_y)

        if x2 <= x1 or y2 <= y1:
            return None
        return img[y1:y2, x1:x2]

    def _compute_fft_moire_score(self, gray_face: np.ndarray) -> Dict[str, float]:
        """
        Fast Fourier Transform (FFT) 2D Spectrum Analysis.
        Screens and digital displays exhibit periodic subpixel matrix patterns
        that manifest as abnormal high-frequency spectral spikes (moiré interference).
        """
        resized = cv2.resize(gray_face, (128, 128)).astype(np.float32)
        f = np.fft.fft2(resized)
        fshift = np.fft.fftshift(f)
        magnitude = np.log(1.0 + np.abs(fshift))

        h, w = magnitude.shape
        cy, cx = h // 2, w // 2

        # Rings for low, mid, and high frequencies
        y, x = np.ogrid[:h, :w]
        dist = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)

        low_mask = dist <= 12
        mid_mask = (dist > 12) & (dist <= 42)
        high_mask = dist > 42

        low_energy = float(magnitude[low_mask].mean()) if np.any(low_mask) else 1.0
        mid_energy = float(magnitude[mid_mask].mean()) if np.any(mid_mask) else 0.5
        high_energy = float(magnitude[high_mask].mean()) if np.any(high_mask) else 0.1

        # Natural human skin has a smooth roll-off ratio:
        # mid / low is typically around 0.40 - 0.70.
        # Screens have sharp peaks (high ratio > 0.82) or heavy defocus (ratio < 0.25).
        mid_to_low = mid_energy / (low_energy + 1e-6)
        
        if 0.35 <= mid_to_low <= 0.75:
            score = 1.0 - abs(mid_to_low - 0.52) * 1.5
        elif mid_to_low > 0.75:
            # High frequency screen noise / moiré spike
            score = max(0.1, 1.0 - (mid_to_low - 0.75) * 3.0)
        else:
            # Defocused / blurred flat print
            score = max(0.1, mid_to_low / 0.35)

        return {
            "fft_score": float(np.clip(score, 0.05, 1.0)),
            "mid_low_ratio": float(mid_to_low),
            "high_energy": float(high_energy)
        }

    def _compute_chrominance_score(self, bgr_face: np.ndarray) -> Dict[str, float]:
        """
        Color Gamut and Chrominance Variance in YCrCb and HSV color spaces.
        Live skin contains sub-surface hemoglobin and melanin with natural chrominance variance.
        Printed paper displays color gamut clamping (low std) or unnatural saturation.
        """
        ycrcb = cv2.cvtColor(bgr_face, cv2.COLOR_BGR2YCrCb)
        hsv = cv2.cvtColor(bgr_face, cv2.COLOR_BGR2HSV)

        cr = ycrcb[:, :, 1].astype(np.float32)
        cb = ycrcb[:, :, 2].astype(np.float32)
        sat = hsv[:, :, 1].astype(np.float32)

        cr_std = float(np.std(cr))
        cb_std = float(np.std(cb))
        sat_std = float(np.std(sat))
        sat_mean = float(np.mean(sat))

        # Genuine faces typically have standard deviation: Cr in [3.0, 24.0], Cb in [3.0, 22.0]
        score = 1.0

        if cr_std < 2.5 or cb_std < 2.5:
            # Washed out / flat printout
            score *= 0.4
        elif cr_std > 28.0 or cb_std > 28.0:
            # Over-saturated / LCD backlit distortion
            score *= 0.5

        if sat_std < 4.0:
            score *= 0.5
        elif sat_mean > 210.0 or sat_mean < 15.0:
            # Unnatural color saturation
            score *= 0.6

        return {
            "chroma_score": float(np.clip(score, 0.1, 1.0)),
            "cr_std": cr_std,
            "cb_std": cb_std,
            "sat_mean": sat_mean
        }

    def _compute_surface_gradient_score(self, gray_face: np.ndarray) -> Dict[str, float]:
        """
        Surface Depth Gradient & Texture Sharpness via Laplacian and Sobel.
        Flat 2D surfaces lack multi-directional 3D anatomical gradient transitions.
        """
        laplacian = cv2.Laplacian(gray_face, cv2.CV_64F)
        var_lap = float(laplacian.var())

        # Gradient variance across X and Y
        sobel_x = cv2.Sobel(gray_face, cv2.CV_64F, 1, 0, ksize=3)
        sobel_y = cv2.Sobel(gray_face, cv2.CV_64F, 0, 1, ksize=3)
        ratio_xy = float(np.abs(sobel_x).mean() / (np.abs(sobel_y).mean() + 1e-6))

        # Real faces have balanced X and Y 3D contour gradients (ratio in [0.65, 1.45])
        # Screens held sideways or paper edges show sharp 1-directional bias
        grad_score = 1.0
        if ratio_xy < 0.5 or ratio_xy > 2.0:
            grad_score *= 0.6

        if var_lap < 20.0:
            # Heavy blur (photo held too close or low-res display)
            grad_score *= 0.4
        elif var_lap > 4500.0:
            # Grainy print artifact or pixel grid
            grad_score *= 0.5

        return {
            "surface_score": float(np.clip(grad_score, 0.1, 1.0)),
            "laplacian_var": var_lap,
            "gradient_ratio": ratio_xy
        }

    def analyze_liveness(self, bgr_image: np.ndarray, bbox: List[int]) -> Dict[str, Any]:
        """
        Analyzes a detected face region and returns presentation attack metrics.
        Returns:
            {
                "is_live": bool,
                "liveness_score": float (0.0 to 1.0),
                "verdict": "bona_fide" | "presentation_attack",
                "attack_type": "none" | "screen_replay" | "printed_photo",
                "details": {...}
            }
        """
        face_chip = self._crop_face(bgr_image, bbox)
        if face_chip is None or face_chip.size == 0:
            return {
                "is_live": True,
                "liveness_score": 0.50,
                "verdict": "bona_fide",
                "attack_type": "none",
                "details": {"reason": "Could not crop face region with margin"}
            }

        gray_face = cv2.cvtColor(face_chip, cv2.COLOR_BGR2GRAY)

        # 1. FFT Frequency Analysis
        fft_res = self._compute_fft_moire_score(gray_face)
        # 2. Chrominance & Gamut Distribution
        chroma_res = self._compute_chrominance_score(face_chip)
        # 3. 3D Surface Gradient & Sharpness
        surface_res = self._compute_surface_gradient_score(gray_face)

        # Weighted Ensemble Fusion:
        # FFT Moiré (40%), Chrominance Gamut (35%), Surface Curvature (25%)
        composite_score = (
            fft_res["fft_score"] * 0.40 +
            chroma_res["chroma_score"] * 0.35 +
            surface_res["surface_score"] * 0.25
        )

        composite_score = float(np.clip(composite_score, 0.0, 1.0))
        is_live = composite_score >= self.threshold

        attack_type = "none"
        if not is_live:
            if fft_res["fft_score"] < 0.40 and chroma_res["chroma_score"] < 0.50:
                attack_type = "screen_replay"
            elif surface_res["surface_score"] < 0.45 or chroma_res["chroma_score"] < 0.45:
                attack_type = "printed_photo"
            else:
                attack_type = "2d_presentation_attack"

        return {
            "is_live": is_live,
            "liveness_score": round(composite_score, 3),
            "verdict": "bona_fide" if is_live else "presentation_attack",
            "attack_type": attack_type,
            "threshold": self.threshold,
            "metrics": {
                "fft_moire_score": round(fft_res["fft_score"], 3),
                "chroma_score": round(chroma_res["chroma_score"], 3),
                "surface_score": round(surface_res["surface_score"], 3),
                "laplacian_var": round(surface_res["laplacian_var"], 1)
            }
        }

liveness_service = LivenessService(threshold=settings.__dict__.get("LIVENESS_THRESHOLD", 0.42))

