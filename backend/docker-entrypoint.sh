#!/bin/sh
# =============================================================================
# Handcrafted Hearthwood — backend container entrypoint
#   1. Wait until PostgreSQL accepts TCP connections.
#      (docker compose already gates on `service_healthy`; this is a
#      belt-and-suspenders guard for manual `docker run`.)
#   2. Apply database migrations (alembic upgrade head).
#   3. exec the CMD (uvicorn).
# =============================================================================
set -eu

python - <<'PY'
import os, socket, sys, time

host = os.getenv("POSTGRES_HOST", "postgres")
port = int(os.getenv("POSTGRES_PORT", "5432"))
deadline = time.time() + 120

while True:
    try:
        socket.create_connection((host, port), timeout=2).close()
        break
    except OSError:
        if time.time() > deadline:
            print(f"ERROR: PostgreSQL at {host}:{port} never became ready", file=sys.stderr)
            sys.exit(1)
        time.sleep(1)

print(f"[entrypoint] PostgreSQL {host}:{port} is reachable", file=sys.stderr)
PY

echo "[entrypoint] applying database migrations (alembic upgrade head)..."
alembic upgrade head

echo "[entrypoint] starting: $*"
exec "$@"