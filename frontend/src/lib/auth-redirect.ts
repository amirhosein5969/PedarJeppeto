/**
 * Unified-login smart redirection rules (single source of truth, used by
 * both the sign-in form and the auth page's "already signed in"
 * auto-forward so an admin-only `returnTo` can never ping-pong a customer
 * between /auth and /admin/*).
 */
import type { UserRole } from "@/hooks/useAuth";

/**
 * * a return intent wins — UNLESS it targets /admin/* and the role is not
 *   admin (the AdminRoute guard would bounce right back → loop);
 * * admins with no intent land on the admin dashboard;
 * * customers land on the storefront home.
 */
export function postLoginPath(role: UserRole | undefined, returnTo: string | undefined): string {
  const isAdmin = role === "admin";
  if (returnTo && returnTo.startsWith("/admin")) {
    return isAdmin ? returnTo : "/";
  }
  if (returnTo) return returnTo;
  return isAdmin ? "/admin/dashboard" : "/";
}
