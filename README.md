# Handcrafted Hearthwood

A luxury, artisan woodcraft e-commerce platform: a **headless FastAPI backend** (catalog,
orders, cart, promotions, analytics) paired with a **React / TanStack Start storefront and
admin UI** (Persian / RTL). The whole system — database, cache, object storage, API and
storefront — runs as a single Docker Compose stack, on your laptop or on a VPS.

## Monorepo layout

```
site/
├── backend/                  # FastAPI API (Python 3.13, async SQLAlchemy 2.0)
│   ├── main.py               # app entry point (uvicorn main:app)
│   ├── api/  core/  db/  schemas/  services/
│   ├── alembic/              # DB migrations (applied automatically at container start)
│   ├── scripts/seed.py       # idempotent catalog/media seed
│   ├── Dockerfile            # python:3.13-slim + Uvicorn on :8010
│   └── docker-entrypoint.sh  # wait for Postgres -> alembic upgrade head -> uvicorn
├── frontend/                 # TanStack Start (React 19, Nitro, Tailwind 4)
│   ├── src/                  # storefront + admin, SSR via Nitro
│   └── Dockerfile            # multi-stage: bun build (NITRO_PRESET=node-server) -> node:22-alpine :8080
├── docker-compose.yml        # postgres + redis + minio + backend + frontend
├── .env.example              # unified environment template (copy to .env)
├── setup_git.sh              # phased 4-commit git history initializer
└── README.md
```

## Tech stack

| Layer      | Technology                                                        |
| ---------- | ----------------------------------------------------------------- |
| Backend    | Python 3.13, FastAPI, SQLAlchemy 2.0 (async), Alembic, Uvicorn    |
| Database   | PostgreSQL 16                                                      |
| Cache/cart | Redis 7 (ephemeral carts + traffic analytics counters)            |
| Storage    | MinIO (S3-compatible; bucket auto-created on first use)           |
| Frontend   | React 19, TanStack Start / Router / Query, Nitro (node-server), Tailwind CSS 4, Vite, Bun |
| Runtime    | Docker + Docker Compose (5 services, health-gated startup)        |

## Prerequisites

- **Docker Engine** with the **Compose v2** plugin (`docker compose version` works).
- **Git** (only needed for `setup_git.sh`).
- ~5 GB of free disk for images + build caches.

No local Python/Node/Postgres/Redis/MinIO installation is required — everything runs in
containers.

## Quick start (local or VPS — the same commands)

```bash
# 1. Clone / enter the monorepo
cd /path/to/site

# 2. Create the environment file and set STRONG secrets
cp .env.example .env
#    -> edit .env: POSTGRES_PASSWORD, REDIS_PASSWORD, MINIO_ROOT_PASSWORD

# 3. Build and start the whole stack (5 containers)
docker compose up -d --build

# 4. (First run only) seed the catalog + media from the frontend assets
docker compose exec backend python scripts/seed.py
```

Once the containers are healthy (check with `docker compose ps`):

| What                    | URL                                    |
| ----------------------- | -------------------------------------- |
| Storefront (frontend)   | http://localhost:8080                  |
| API (FastAPI)           | http://localhost:8010/api/v1           |
| API docs (Swagger)      | http://localhost:8010/docs             |
| MinIO console           | http://localhost:9001                  |

> On a VPS, replace `localhost` with your server's IP/domain where the ports are
> reachable (see **VPS deployment** below).

### Startup order & data

- `backend` waits until `postgres`, `redis` and `minio` are **healthy** (compose
  `depends_on: service_healthy`), then runs `alembic upgrade head` automatically before
  starting Uvicorn — a fresh database is fully migrated on first boot.
- Data lives in named Docker volumes: `hearthwood_postgres_data`,
  `hearthwood_redis_data`, `hearthwood_minio_data`. `docker compose down` keeps them;
  `docker compose down -v` destroys them.
- `scripts/seed.py` is **idempotent** (never overwrites existing rows) — safe to re-run.

> **Migrating from the old `backend/docker-compose.yml`?** That file has been moved to the
> repo root and the compose project name changed from `hearthwood-backend` to `hearthwood`.
> If the old `hh_postgres` / `hh_redis` / `hh_minio` containers are still running, remove
> them first — the new stack reuses the same container names and host ports:
>
> ```bash
> docker rm -f hh_postgres hh_redis hh_minio
> ```
>
> Note the new stack uses fresh volumes (`hearthwood_*`); data from the old
> `hearthwood-backend_*` volumes is not migrated automatically. A fresh start is fully
> usable after seeding (step 4 above).

## Environment

All configuration flows from the **root `.env`** (templated by `.env.example`) and is
injected by `docker-compose.yml` into the two application containers:

| Section       | Variables                                                                 | Consumed by |
| ------------- | ------------------------------------------------------------------------- | ----------- |
| Infrastructure| `POSTGRES_USER/PASSWORD/DB/PORT`, `REDIS_PASSWORD/PORT/DB`, `MINIO_ROOT_USER/PASSWORD`, `MINIO_API_PORT`, `MINIO_CONSOLE_PORT` | postgres / redis / minio containers **and** backend |
| Backend       | `DEBUG`, `BACKEND_PORT`, `S3_REGION`, `S3_BUCKET`, `CORS_ORIGINS` (JSON list), optional `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` (default = MinIO root creds) | backend |
| Frontend      | `FRONTEND_PORT`, `VITE_API_BASE_URL` (bake-time build arg)                | frontend |

Inside the network the backend talks to `postgres:5432`, `redis:6379`,
`minio:9000` — no `localhost` needed.

> **Note on `VITE_API_BASE_URL`:** the currently committed frontend has the API base URL
> hard-coded in `frontend/src/lib/api.ts` (`http://localhost:8010/api/v1`). The variable is
> wired into the Docker build (`ARG`/`ENV`) and the compose file so the app can be made
> env-driven later without changing the build pipeline. Because the URL is a
> browser-reachable `localhost` address, it works out of the box with the exposed
> `BACKEND_PORT`.

## Operations

```bash
docker compose ps                  # container + health status
docker compose logs -f backend     # follow a service's logs
docker compose restart backend
docker compose up -d --build       # rebuild changed images and roll
docker compose down                # stop containers (keeps data)
docker compose down -v             # stop and DELETE all data
```

## VPS deployment (production notes)

The stack is deployment-ready as-is; on a VPS, additionally:

1. **Secrets** — set real, strong, unique values for `POSTGRES_PASSWORD`,
   `REDIS_PASSWORD`, `MINIO_ROOT_PASSWORD` in `.env`. Never reuse the placeholders.
2. **Reverse proxy + TLS** — put Caddy/Nginx in front and terminate HTTPS. For a minimal
   Caddyfile:
   ```
   shop.example.com {
       reverse_proxy localhost:8080
   }
   api.example.com {
       reverse_proxy localhost:8010
   }
   ```
3. **CORS** — when serving the storefront from a real domain, update `CORS_ORIGINS` in
   `.env` to your public origin (e.g. `["https://shop.example.com"]`) and remember the
   browser-facing API URL (`VITE_API_BASE_URL`, see note above).
4. **Firewall** — expose only `80`/`443` (and SSH). The raw service ports
   (`8010`, `8080`, `9000`, `9001`, `5432`, `6379`) need no public access.
5. **Resilience** — containers use `restart: unless-stopped`; pair with log rotation /
   monitoring as needed. For more API throughput, adjust the Uvicorn `CMD`
   (`uvicorn main:app --host 0.0.0.0 --port 8010 --workers 2`) in `backend/Dockerfile`.

## Git history

To build a clean, logical 4-commit history at the monorepo root (workspace/docs →
backend → frontend → dockerization), run manually:

```bash
bash setup_git.sh
```

The script removes nested `.git` folders (e.g. a previous `frontend/` sub-repo), inits the
root repo on branch `main`, and creates:

1. `chore: init monorepo workspace and docs`
2. `feat(backend): implement FastAPI headless core and DB models`
3. `feat(frontend): implement React TanStack storefront and admin UI`
4. `ops: fully dockerize frontend and backend services`

> If `frontend/` was previously pushed to a remote (Lovable/GitHub), removing its `.git`
> orphans that history locally; the remotes are unaffected.

## License

Private — all rights reserved.