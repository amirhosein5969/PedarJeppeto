/// <reference types="vite/client" />

/**
 * Build-time environment variables exposed to the app.
 *
 * `VITE_API_BASE_URL` is injected during `bun run build` via the Docker
 * build arg (see `frontend/Dockerfile` + `docker-compose.yml`); local dev
 * falls back to the uvicorn default in `src/lib/api.ts`.
 */
interface ImportMetaEnv {
  /** Base URL of the FastAPI backend (inlined at build time). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}