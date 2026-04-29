# syntax=docker/dockerfile:1.6
FROM python:3.11-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps for cvxpy / HiGHS (only build essentials needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# The backend depends on the parent project's `src/` package for SDP code.
# Copy both into the image; the parent at /app/parent and backend at /app/backend.
COPY backend/pyproject.toml backend/README.md ./backend/
COPY backend/app ./backend/app
COPY src ./src
COPY pyproject.toml ./pyproject.toml

# Install the backend (installs cvxpy, fastapi, etc.)
RUN pip install -e ./backend

ENV PORT=8000
EXPOSE 8000

WORKDIR /app/backend

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 2"]
