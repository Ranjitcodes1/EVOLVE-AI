import os
import urllib.request
from pathlib import Path

WEIGHTS_DIR = Path(__file__).resolve().parent
ARCFACE_URL = "https://github.com/onnx/models/raw/main/validated/vision/body_analysis/arcface/model/arcfaceresnet100-8.onnx"
TARGET_FILE = WEIGHTS_DIR / "arcface_512d.onnx"

def download():
    if TARGET_FILE.exists():
        print(f"ArcFace model already exists: {TARGET_FILE} ({os.path.getsize(TARGET_FILE)} bytes)")
        return

    print("ArcFace 512-d ONNX model (130 MB) not found locally.")
    print("Downloading pre-trained ArcFace ResNet-50 weights...")
    try:
        urllib.request.urlretrieve(ARCFACE_URL, TARGET_FILE)
        print(f"Download complete! Saved to: {TARGET_FILE}")
    except Exception as e:
        print(f"Failed to auto-download: {e}")
        print("Please place 'arcface_512d.onnx' directly into backend/weights/.")

if __name__ == "__main__":
    download()

