import { createFileRoute, redirect } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { hasAdminSession } from "@/lib/api";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
  head: () => ({
    meta: [{ title: "پنل مدیریت | پدر ژپتو" }],
  }),
  // AdminRoute guard — runs for /admin AND every /admin/* child match:
  // only the unified OTP login grants access, and only with role=admin.
  // localStorage exists in the browser only, so the check is client-guarded
  // (SSR never redirects); AdminLayout enforces it a second time at render
  // and the backend RBAC (get_current_admin_user → 401/403) is the real wall.
  beforeLoad: ({ location }) => {
    if (location.pathname === "/admin" || location.pathname === "/admin/") {
      throw redirect({ to: "/admin/dashboard" });
    }
    if (typeof document !== "undefined" && !hasAdminSession()) {
      throw redirect({ to: "/auth", search: { returnTo: location.pathname } });
    }
  },
});
