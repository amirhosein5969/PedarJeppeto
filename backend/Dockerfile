# syntax=docker/dockerfile:1
# =============================================================================
# Handcrafted Hearthwood — FastAPI backend (Python 3.13)
#
# Build (from repo root):   docker compose build backend
# Entrypoint:               waits for PostgreSQL, applies alembic migrations,
#                           then execs the CMD below (Uvicorn on :8010).
# =============================================================================
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Dependencies first — code changes won't bust the pip layer.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code + container entrypoint.
COPY . .
RUN chmod +x docker-entrypoint.sh

EXPOSE 8010

# docker-entrypoint.sh: wait for Postgres -> alembic upgrade head -> exec "$@"
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8010"]