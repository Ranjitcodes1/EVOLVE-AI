FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for OpenCV headless and networking
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend codebase
COPY . .

# Download ArcFace 512-d weights during build
RUN python weights/download_weights.py

# Expose default port (7860 for Hugging Face Spaces / 8000 for standard Docker)
EXPOSE 7860
ENV PORT=7860

# Run FastAPI backend server
CMD ["python", "run.py"]
