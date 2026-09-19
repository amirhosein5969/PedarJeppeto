/**
 * Mock admin session (step 1 of the admin panel).
 * Real auth will replace this module; the rest of the admin code only talks
 * to these helpers, so swapping in Supabase/Passport later is a one-file job.
 */

const ADMIN_SESSION_KEY = "hc-admin-session";

export function readAdminSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ADMIN_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAdminSession(active: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (active) {
      window.localStorage.setItem(ADMIN_SESSION_KEY, "1");
    } else {
      window.localStorage.removeItem(ADMIN_SESSION_KEY);
    }
  } catch {
    // Private-mode storage failures are acceptable for the mock.
  }
}

export const ADMIN_PROFILE = {
  name: "مدیر چوب‌کار",
  phone: "09121112233",
} as const;
