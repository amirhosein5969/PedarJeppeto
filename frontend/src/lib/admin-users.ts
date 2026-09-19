/**
 * Admin-side user model (Phase 5: live API-backed).
 *
 * Data comes from `GET /api/v1/users` (mapped in `api-map.ts`). Customers are
 * created/updated automatically at checkout; this module only owns the
 * **type**. The localStorage seed + load/save were removed with the mock
 * phase. User mutations (role/block) are not exposed by the API yet.
 */

export type UserRole = "admin" | "customer";

/** Address block collected at checkout; shown in the user details sheet. */
export type UserAddress = {
  province: string;
  city: string;
  /** 10-digit Iranian postal code, e.g. "1418735421". */
  zipCode: string;
  address: string;
};

export type AdminUser = {
  /** Stringified DB id. */
  id: string;
  name: string;
  /** Iranian mobile number, e.g. "09123456789". */
  phone: string;
  role: UserRole;
  /** Jalali join date, e.g. "۱۴۰۳/۰۲/۱۵". */
  joinDate: string;
  active: boolean;
  address: UserAddress;
  /** Number of orders placed (live from the API). */
  orderCount: number;
  /** Sum of non-cancelled order totals in toman (live from the API). */
  totalSpent: number;
};