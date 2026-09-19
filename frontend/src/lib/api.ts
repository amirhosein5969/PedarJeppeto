/**
 * Secure API client (Phase 5).
 *
 * - One shared Axios instance pointed at the FastAPI backend.
 * - **Session**: a UUIDv4 is generated on first client use and persisted in
 *   `localStorage`; it is attached as the `X-Session-Id` header to EVERY
 *   request (it addresses the Redis cart server-side).
 * - **Idempotency**: `withIdempotencyKey()` mints a fresh UUIDv4 per mutation
 *   call so a retried checkout can never double-book the cart.
 * - **Errors**: Axios errors are normalized into `ApiError` (status + a
 *   human-readable `detail`) so UI code never touches `error.response`.
 *
 * SSR note: the browser API is only touched on the client (guarded by
 * `typeof window`); during SSR the hooks simply skip the network.
 */
import axios, { type AxiosError, type AxiosRequestConfig } from "axios";

const SESSION_STORAGE_KEY = "hc-session-id";
const SESSION_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
/** Mirrors the STORAGE_KEY in src/hooks/useAuth.tsx (mock OTP login). */
const AUTH_STORAGE_KEY = "choobkar-auth-user";

/** The backend base URL (dev: uvicorn on :8010). */
export const API_BASE_URL = "http://localhost:8010/api/v1";

/**
 * UUIDv4 generator — `crypto.randomUUID()` where available, with an
 * RFC 4122 §4.4 fallback for older engines. (Browser-native, zero deps.)
 */
export function newUuidv4(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Lazily create (and persist) the per-browser cart session id. */
function getSessionId(): string {
  let id = "";
  try {
    id = window.localStorage.getItem(SESSION_STORAGE_KEY) ?? "";
  } catch {
    // Storage blocked (private mode) — fall through to a fresh id per call.
  }
  if (!SESSION_ID_RE.test(id)) {
    id = newUuidv4();
    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY, id);
    } catch {
      // Non-fatal: the id still rides on this request.
    }
  }
  return id;
}

/** Read one field of the persisted auth record (`useAuth`'s storage). */
function readAuthField(field: "phone" | "token"): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    const value = parsed?.[field];
    return typeof value === "string" && value !== "" ? value : null;
  } catch {
    return null;
  }
}

/**
 * The logged-in customer's phone (from the secure OTP login). Used to gate
 * the auth-only queries so SSR (no localStorage) never fires a 401.
 */
export function getAuthPhone(): string | null {
  return readAuthField("phone");
}

/** The JWT access token issued by `POST /auth/verify-otp`, or null. */
export function getAuthToken(): string | null {
  return readAuthField("token");
}

/**
 * Clear the auth record and tell the `useAuth` provider to drop its state.
 * Fired when a protected call answers 401 (expired/invalid token).
 */
function clearAuthSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Non-fatal.
  }
  window.dispatchEvent(new Event("hc:auth-expired"));
}

/** Normalized API error — `status` 0 means network/timeout (no response). */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function extractDetail(data: unknown): string | null {
  if (typeof data === "string" && data.length > 0) return data;
  if (data && typeof data === "object") {
    const detail = (data as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.length > 0) return detail;
    if (Array.isArray(detail)) {
      // FastAPI 422 validation payload: [{loc, msg, type}, ...]
      const msgs = detail
        .map((d) => (d && typeof d === "object" ? (d as { msg?: string }).msg : undefined))
        .filter((m): m is string => typeof m === "string" && m.length > 0);
      if (msgs.length > 0) return msgs.join(" — ");
    }
  }
  return null;
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
});

// Attach the cart session + the JWT (secure OTP auth) to every outgoing
// request (client-side only).
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    config.headers.set("X-Session-Id", getSessionId());
    const token = getAuthToken();
    if (token) config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

// Normalize failures into ApiError (message already Persian-safe on the UI
// side — detail strings come from the backend). A 401 from a protected
// /users/me route means the token expired: drop the session and let
// `useAuth` react via the `hc:auth-expired` event.
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ detail?: unknown }>;
      const status = axiosError.response?.status ?? 0;
      const requestPath = axiosError.config?.url ?? "";
      if (status === 401 && requestPath.includes("/users/me")) {
        clearAuthSession();
      }
      const message =
        extractDetail(axiosError.response?.data) ??
        (status === 0 ? "اتصال به سرور برقرار نشد؛ اتصال اینترنت را بررسی کنید." : axiosError.message);
      return Promise.reject(new ApiError(status, message));
    }
    return Promise.reject(error);
  },
);

/**
 * Idempotency helper for mutations (checkout & friends): mint a fresh UUIDv4
 * per call and pass the returned config fragment into the Axios request.
 */
export function withIdempotencyKey(): Pick<AxiosRequestConfig, "headers"> {
  return { headers: { "Idempotency-Key": newUuidv4() } };
}

/**
 * Upload one admin-gallery image (a data URL from `readImageFiles`) to
 * MinIO via `POST /upload` and return its public URL. Existing MinIO URLs
 * should be passed through unchanged by the caller.
 */
export async function uploadImage(dataUrl: string): Promise<string> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const form = new FormData();
  form.append("file", blob, `image-${newUuidv4()}.jpg`);
  const { data } = await api.post<{ url: string }>("/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.url;
}