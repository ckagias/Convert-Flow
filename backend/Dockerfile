# backend/Dockerfile
# ─────────────────────────────────────────────────────────────────
#  Multi-stage build for ConvertFlow Backend
#
#  Base image: python:3.11-slim (Debian bookworm)
#  Extra system packages:
#    - fonts-dejavu-core  → needed by Pillow for text rendering (PPTX slides)
#    - poppler-utils      → required by pdf2image for PDF→image conversions
#    - curl               → used by the Docker healthcheck
# ─────────────────────────────────────────────────────────────────

FROM python:3.11-slim AS base

# Prevent Python from buffering stdout (important for Docker log streaming)
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# ── System dependencies ────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        fonts-dejavu-core \
        poppler-utils \
        curl \
    && rm -rf /var/lib/apt/lists/*

# ── Python dependencies ────────────────────────────────────────
# Copy requirements first to leverage Docker layer caching.
# Only re-runs pip install if requirements.txt changes.
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

# ── Application code ───────────────────────────────────────────
COPY . .

# ── Runtime directories ────────────────────────────────────────
# These will be overridden by Docker named volumes at runtime,
# but creating them ensures the image works standalone too.
RUN mkdir -p /app/uploads /app/outputs /app/db

# ── Expose & run ──────────────────────────────────────────────
EXPOSE 8000

# --reload is safe here because the source is volume-mounted in dev.
# For strict production swap to: uvicorn main:app --host 0.0.0.0 --port 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
