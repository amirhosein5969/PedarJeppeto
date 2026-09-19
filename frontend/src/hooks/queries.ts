/**
 * TanStack Query hooks (Phase 5) — the single data-access layer.
 *
 * Caching strategy (performance):
 * - **Static catalog/settings**: 10-minute `staleTime` for `/products`,
 *   `/categories`, `/settings` — navigation between pages never re-hits the
 *   backend, and refetches only happen when data genuinely goes stale.
 * - **Cart**: kept snappy (short staleTime + refetch on window focus) with
 *   **optimistic** add/remove/quantity/oil mutations — the UI updates
 *   instantly; the server truth reconciles on settle, and any failure rolls
 *   the cache back.
 * - **Checkout**: a single idempotent mutation (fresh UUIDv4 per attempt).
 */
import { useMutation, useQuery, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, getAuthPhone, uploadImage, withIdempotencyKey, ApiError } from "@/lib/api";
import {
  buildProductDescription,
  toAdminOrder,
  toAdminProduct,
  toAdminUser,
  toCategory,
  toPromo,
  toShopProduct,
  toStoreSettings,
  toToman,
  fromToman,
  type PromoCreateInput,
} from "@/lib/api-map";
import type {
  ApiActivityFeed,
  ApiCart,
  ApiCartLine,
  ApiCategory,
  ApiMe,
  ApiMeUpdate,
  ApiMyOrder,
  ApiOrder,
  ApiPromo,
  ApiProduct,
  ApiSalesDay,
  ApiStoreSettings,
  ApiTrafficDay,
  ApiUser,
  ApiUserAddress,
  ApiUserAddressInput,
  ApiUserAddressUpdate,
} from "@/lib/api-types";
import type { AdminProduct } from "@/lib/admin-products";
import type { Product } from "@/lib/shop-data";
import type { StoreSettings } from "@/lib/admin-settings";
import { FREE_SHIPPING_FROM } from "@/lib/checkout";

// =============================================================================
// Query keys + cache timings
// =============================================================================

export const queryKeys = {
  products: ["products"] as const,
  categories: ["categories"] as const,
  settings: ["settings"] as const,
  cart: ["cart"] as const,
  promos: ["promos"] as const,
  orders: ["orders"] as const,
  order: (id: number) => ["orders", id] as const,
  users: ["users"] as const,
  analyticsSales: ["analytics", "sales"] as const,
  analyticsActivities: ["analytics", "activities"] as const,
  analyticsTraffic: ["analytics", "traffic"] as const,
  // Customer portal (Phase 6).
  me: ["me"] as const,
  meOrders: ["me", "orders"] as const,
  // Customer address book (Phase 7).
  meAddresses: ["me", "addresses"] as const,
};

/** Highly static endpoints — do NOT spam the backend while browsing. */
const STATIC_STALE_MS = 10 * 60 * 1000; // 10 minutes
const CART_STALE_MS = 30 * 1000;

// =============================================================================
// Catalog: categories + products (10-minute staleTime)
// =============================================================================

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: async () => (await api.get<ApiCategory[]>("/categories")).data,
    staleTime: STATIC_STALE_MS,
  });
}

export type CatalogData = {
  products: Product[];
  categories: { id: number; slug: string; title: string; short: string; image: string }[];
};

/**
 * The storefront catalog: products joined with their category slug (the API
 * has no slug on the product row, so we resolve it from the categories list).
 * `activeOnly` mirrors the backend `?active=` filter (storefront passes true).
 */
export function useCatalog(activeOnly = false): {
  data: CatalogData | undefined;
  isPending: boolean;
  isError: boolean;
} {
  return useQuery({
    queryKey: [queryKeys.products, activeOnly],
    queryFn: async (): Promise<CatalogData> => {
      const [productsRes, categoriesRes] = await Promise.all([
        api.get<ApiProduct[]>("/products", { params: { active: activeOnly } }),
        api.get<ApiCategory[]>("/categories"),
      ]);
      const slugById = new Map(categoriesRes.data.map((c) => [c.id, c.slug]));
      return {
        products: productsRes.data.map((p) =>
          toShopProduct(p, slugById.get(p.category_id) ?? ""),
        ),
        categories: categoriesRes.data.map(toCategory),
      };
    },
    staleTime: STATIC_STALE_MS,
  });
}

// =============================================================================
// Products: admin catalog (incl. soft-deleted) + save (create/update)
// =============================================================================

export type AdminCatalogData = {
  products: AdminProduct[];
  categories: { id: number; slug: string; title: string; short: string; image: string }[];
};

/** Admin catalog: EVERY product — `is_active` false ones included. */
export function useAdminCatalog(): {
  data: AdminCatalogData | undefined;
  isPending: boolean;
  isError: boolean;
} {
  return useQuery({
    queryKey: [queryKeys.products, "admin"],
    queryFn: async (): Promise<AdminCatalogData> => {
      const [productsRes, categoriesRes] = await Promise.all([
        api.get<ApiProduct[]>("/products"),
        api.get<ApiCategory[]>("/categories"),
      ]);
      const slugById = new Map(categoriesRes.data.map((c) => [c.id, c.slug]));
      return {
        products: productsRes.data.map((p) =>
          toAdminProduct(p, slugById.get(p.category_id) ?? ""),
        ),
        categories: categoriesRes.data.map(toCategory),
      };
    },
    staleTime: STATIC_STALE_MS,
  });
}

export type ProductSaveInput = {
  /** Omit to create; the numeric DB id to update. */
  id?: number | undefined;
  title: string;
  description: string;
  dimensions: string;
  material: string;
  color: string;
  /** Category slug — resolved to `category_id` inside the mutation. */
  categorySlug: string;
  /** قیمت اصلی (list price, toman) — the strikethrough price. */
  listPrice: number;
  /** Discount percentage 0-100. */
  discount: number;
  /** قیمت تمام‌شده (workshop cost, toman). */
  costPrice: number;
  stockCount: number;
  /** inStock ⇄ `is_active` (soft delete). */
  inStock: boolean;
  /** Gallery — `data:` URLs are uploaded to MinIO before the save. */
  images: string[];
};

/** Admin: create (POST /products) or update (PATCH /products/{id}). */
export function useSaveProduct(): UseMutationResult<ApiProduct, ApiError, ProductSaveInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input): Promise<ApiProduct> => {
      // 1) New images (data URLs from the gallery field) go to MinIO first.
      const images: string[] = [];
      for (const src of input.images) {
        images.push(src.startsWith("data:") ? await uploadImage(src) : src);
      }
      // 2) Category slug → id (cached categories, fetched as a fallback).
      let categories = qc.getQueryData<ApiCategory[]>(queryKeys.categories);
      if (!categories) {
        categories = (await api.get<ApiCategory[]>("/categories")).data;
        qc.setQueryData(queryKeys.categories, categories);
      }
      const categoryId = categories.find((c) => c.slug === input.categorySlug)?.id;
      if (!categoryId) {
        throw new ApiError(0, "دسته‌بندی انتخاب‌شده در فهرست نیست؛ دوباره تلاش کنید.");
      }
      // 3) Money: base = final, list = original (null when no discount),
      //    margin = final − cost (the API's profit-analytics field).
      const discount = Math.min(100, Math.max(0, input.discount));
      const final = Math.round((input.listPrice * (100 - discount)) / 100);
      const margin = Math.max(0, final - input.costPrice);
      const body = {
        title: input.title,
        description: buildProductDescription(
          input.description,
          input.dimensions,
          input.material,
          input.color,
        ),
        base_price: fromToman(final),
        list_price: input.listPrice > final ? fromToman(input.listPrice) : null,
        stock_count: input.stockCount,
        images,
        profit_margin: fromToman(margin),
        is_active: input.inStock,
        category_id: categoryId,
      };
      if (input.id !== undefined) {
        return (await api.patch<ApiProduct>(`/products/${input.id}`, body)).data;
      }
      return (await api.post<ApiProduct>("/products", body)).data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.products });
    },
  });
}

// =============================================================================
// Store settings (10-minute staleTime; admin PATCH invalidates it)
// =============================================================================

export function useSettings(): {
  data: StoreSettings | undefined;
  isPending: boolean;
  isError: boolean;
} {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: async () => toStoreSettings((await api.get<ApiStoreSettings>("/settings")).data),
    staleTime: STATIC_STALE_MS,
  });
}

/** Admin mutation: PATCH /settings — then drop the cached copy for everyone. */
export function useSaveSettings(): UseMutationResult<
  ApiStoreSettings,
  ApiError,
  StoreSettings
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: StoreSettings) => {
      const body = {
        store_name: settings.storeName,
        support_phone: settings.phone,
        email: settings.email,
        address: settings.address,
        zip_code: settings.zipCode,
        vat_percentage: fromToman(settings.vatPercentage),
        care_oil_price: fromToman(settings.careOilPrice),
        care_oil_enabled: settings.careOilEnabled,
        signature_packaging_price: fromToman(settings.giftBoxPrice),
        signature_packaging_enabled: settings.giftBoxEnabled,
        shipping_methods: settings.shippingMethods.map((m) => ({
          id: m.id,
          title: m.title,
          note: m.note,
          fee: fromToman(m.fee),
        })),
      };
      return (await api.patch<ApiStoreSettings>("/settings", body)).data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.settings });
    },
  });
}

// =============================================================================
// Cart — snappy + optimistic
// =============================================================================

export function useCart() {
  return useQuery({
    queryKey: queryKeys.cart,
    queryFn: async () => (await api.get<ApiCart>("/cart")).data,
    staleTime: CART_STALE_MS,
    refetchOnWindowFocus: true,
  });
}

function cartErrorToast(message: string) {
  toast.error(message, { description: "تغییرات سبد خرید به حالت قبل بازگشت." });
}

/**
 * Optimistically merge `vars` into the cached cart so the UI reacts instantly.
 * The line's subtotal is re-estimated from the cached product price (the
 * authoritative value arrives on the post-mutation refetch).
 */
function optimisticCart(prev: ApiCart | undefined, fn: (lines: ApiCartLine[]) => ApiCartLine[]) {
  if (!prev) return prev;
  const items = fn(prev.items);
  return { ...prev, items, count: items.reduce((sum, l) => sum + l.quantity, 0) };
}

/** Add (or merge) a line. Optimistic; rolls back on error. */
export function useAddToCart(): UseMutationResult<
  ApiCartLine,
  ApiError,
  {
    productId: number;
    quantity: number;
    oil: boolean;
    woodType?: string | null;
    color?: string | null;
  }
> {
  const qc = useQueryClient();
  const catalog = qc.getQueryData<CatalogData>([queryKeys.products, true]);
  return useMutation({
    mutationFn: async ({ productId, quantity, oil, woodType, color }) =>
      (
        await api.post<ApiCartLine>("/cart/add", {
          product_id: productId,
          quantity,
          care_oil_added: oil,
          wood_type: woodType ?? null,
          color: color ?? null,
        })
      ).data,
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: queryKeys.cart });
      const prev = qc.getQueryData<ApiCart>(queryKeys.cart);
      qc.setQueryData<ApiCart>(
        queryKeys.cart,
        optimisticCart(prev, (lines) => {
          const existing = lines.find((l) => l.product_id === vars.productId);
          if (existing) {
            return lines.map((l) =>
              l.product_id === vars.productId
                ? {
                    ...l,
                    quantity: Math.min(20, l.quantity + vars.quantity),
                    care_oil_added: l.care_oil_added || vars.oil,
                    // A bare re-add never wipes a previously chosen variant.
                    wood_type: vars.woodType ?? l.wood_type,
                    color: vars.color ?? l.color,
                  }
                : l,
            );
          }
          const unitPrice =
            catalog?.products.find((p) => p.id === String(vars.productId))?.price ?? 0;
          return [
            ...lines,
            {
              product_id: vars.productId,
              title: "",
              unit_price: fromToman(unitPrice),
              quantity: vars.quantity,
              care_oil_added: vars.oil,
              wood_type: vars.woodType ?? null,
              color: vars.color ?? null,
              line_subtotal: fromToman(unitPrice * vars.quantity),
            },
          ];
        }),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.cart, ctx.prev);
      cartErrorToast("افزودن به سبد خرید ناموفق بود.");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.cart });
    },
  });
}

/** Remove a line. Optimistic; rolls back on error. */
export function useRemoveFromCart(): UseMutationResult<
  { removed: boolean },
  ApiError,
  number
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (productId: number) =>
      (await api.delete<{ removed: boolean }>("/cart/remove", { params: { product_id: productId } }))
        .data,
    onMutate: async (productId) => {
      await qc.cancelQueries({ queryKey: queryKeys.cart });
      const prev = qc.getQueryData<ApiCart>(queryKeys.cart);
      qc.setQueryData<ApiCart>(
        queryKeys.cart,
        optimisticCart(prev, (lines) => lines.filter((l) => l.product_id !== productId)),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.cart, ctx.prev);
      cartErrorToast("حذف از سبد خرید ناموفق بود.");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.cart });
    },
  });
}

/** Set a line's absolute quantity (steppers). Optimistic. */
export function useUpdateCartLine(): UseMutationResult<
  ApiCartLine,
  ApiError,
  {
    productId: number;
    quantity: number;
    oil: boolean;
    woodType?: string | null;
    color?: string | null;
  }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, quantity, oil, woodType, color }) =>
      (
        await api.patch<ApiCartLine>("/cart/line", {
          product_id: productId,
          quantity,
          care_oil_added: oil,
          wood_type: woodType ?? null,
          color: color ?? null,
        })
      ).data,
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: queryKeys.cart });
      const prev = qc.getQueryData<ApiCart>(queryKeys.cart);
      qc.setQueryData<ApiCart>(
        queryKeys.cart,
        optimisticCart(prev, (lines) =>
          lines.map((l) =>
            l.product_id === vars.productId
              ? {
                  ...l,
                  quantity: vars.quantity,
                  care_oil_added: vars.oil,
                  wood_type: vars.woodType ?? l.wood_type,
                  color: vars.color ?? l.color,
                }
              : l,
          ),
        ),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.cart, ctx.prev);
      cartErrorToast("به‌روزرسانی سبد خرید ناموفق بود.");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.cart });
    },
  });
}

/** Clear the cart. Optimistic. */
export function useClearCart(): UseMutationResult<{ cleared: boolean }, ApiError, void> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.delete<{ cleared: boolean }>("/cart/clear")).data,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: queryKeys.cart });
      const prev = qc.getQueryData<ApiCart>(queryKeys.cart);
      qc.setQueryData<ApiCart>(queryKeys.cart, {
        items: [],
        count: 0,
        subtotal: "0.00",
        unavailable: [],
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.cart, ctx.prev);
      cartErrorToast("خالی کردن سبد خرید ناموفق بود.");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.cart });
    },
  });
}

/** Derived cart view-model used by the Header badge / cart page / checkout. */
export function useCartSummary() {
  const { data, isPending } = useCart();
  const { data: settings } = useSettings();
  const { data: catalog } = useCatalog(true);

  const subtotal = data ? toToman(data.subtotal) : 0;
  const count = data?.count ?? 0;
  const oilEnabled = settings?.careOilEnabled ?? false;
  const oilPrice = settings?.careOilPrice ?? 0;

  // Savings = the product-discount gap (list price − final) across lines.
  const savings = data
    ? data.items.reduce((sum, line) => {
        const product = catalog?.products.find((p) => p.id === String(line.product_id));
        if (!product) return sum;
        const final = Math.round((product.price * (100 - product.discount)) / 100);
        return sum + (product.price - final) * line.quantity;
      }, 0)
    : 0;

  return {
    items: data?.items ?? [],
    count,
    subtotal,
    savings,
    oilEnabled,
    oilPrice,
    isPending,
  };
}

// =============================================================================
// Promotions (checkout validation + admin CRUD)
// =============================================================================

export function usePromos() {
  return useQuery({
    queryKey: queryKeys.promos,
    queryFn: async () =>
      (await api.get<ApiPromo[]>("/promotions")).data.map(toPromo),
    staleTime: STATIC_STALE_MS,
  });
}

/** Checkout: POST /promotions/validate — the exact discount preview. */
export function useValidatePromo(): UseMutationResult<
  Awaited<ReturnType<typeof validateFn>>,
  ApiError,
  { code: string; cartSubtotal: number }
> {
  async function validateFn(vars: { code: string; cartSubtotal: number }) {
    return (
      await api.post<{
        code: string;
        valid: boolean;
        discount_percentage: string;
        max_discount_amount: string | null;
        min_purchase_amount: string;
        discount_amount: string;
      }>("/promotions/validate", {
        code: vars.code,
        cart_subtotal: fromToman(vars.cartSubtotal),
      })
    ).data;
  }
  return useMutation({ mutationFn: validateFn });
}

export function useSavePromo(): UseMutationResult<
  ApiPromo,
  ApiError,
  { id?: string | undefined; input: PromoCreateInput | Partial<PromoCreateInput> }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }) => {
      const body = {
        code: input.code,
        discount_percentage: fromToman(input.discountPercentage ?? 0),
        max_discount_amount:
          (input.maxDiscountAmount ?? 0) > 0 ? fromToman(input.maxDiscountAmount ?? 0) : null,
        min_purchase_amount: fromToman(input.minPurchaseAmount ?? 0),
        usage_limit: (input.usageLimit ?? 0) > 0 ? (input.usageLimit ?? 0) : null,
        ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
      };
      if (id) return (await api.patch<ApiPromo>(`/promotions/${id}`, body)).data;
      return (await api.post<ApiPromo>("/promotions", body)).data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.promos });
    },
  });
}

export function useDeletePromo(): UseMutationResult<void, ApiError, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/promotions/${id}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.promos });
    },
  });
}

// =============================================================================
// Orders: checkout (storefront) + admin board
// =============================================================================

export type CheckoutInput = {
  fullName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string;
  address: string;
  note?: string | undefined;
  shippingMethod: string;
  promoCode: string | null;
  signaturePackaging: boolean;
  /** Phase 7: a selected saved address (null = a brand-new address). */
  addressId?: number | null;
};

/**
 * Checkout: POST /orders with a fresh Idempotency-Key per attempt, so a
 * double-submit / network retry can never create two orders.
 */
export function usePlaceOrder(): UseMutationResult<ApiOrder, ApiError, CheckoutInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input) =>
      (
        await api.post<ApiOrder>(
          "/orders",
          {
            customer: {
              full_name: input.fullName,
              phone: input.phone,
              province: input.province,
              city: input.city,
              zip_code: input.postalCode || null,
              address: input.address,
              note: input.note || null,
              address_id: input.addressId ?? null,
            },
            shipping_method: input.shippingMethod,
            promo_code: input.promoCode,
            signature_packaging: input.signaturePackaging,
          },
          withIdempotencyKey(),
        )
      ).data,
    onSuccess: () => {
      // The cart was consumed server-side; drop it everywhere and refresh the
      // admin order board.
      void qc.invalidateQueries({ queryKey: queryKeys.cart });
      void qc.invalidateQueries({ queryKey: queryKeys.orders });
      // The order now belongs to the logged-in account (JWT auth) — refresh
      // the customer portal so "My Orders" shows it immediately, plus the
      // address book (a new address may have been auto-saved) + the admin board.
      void qc.invalidateQueries({ queryKey: queryKeys.meOrders });
      void qc.invalidateQueries({ queryKey: queryKeys.me });
      void qc.invalidateQueries({ queryKey: queryKeys.meAddresses });
      void qc.invalidateQueries({ queryKey: queryKeys.users });
    },
  });
}

/** Admin: the full order list (newest first). */
export function useAdminOrders() {
  return useQuery({
    queryKey: queryKeys.orders,
    queryFn: async () =>
      (await api.get<ApiOrder[]>("/orders")).data.map(toAdminOrder),
    staleTime: CART_STALE_MS,
  });
}

/** Admin: one order (printable invoice). */
export function useAdminOrder(id: number | undefined) {
  return useQuery({
    queryKey: queryKeys.order(id ?? -1),
    enabled: id !== undefined && id >= 0,
    queryFn: async () => toAdminOrder((await api.get<ApiOrder>(`/orders/${id}`)).data),
    staleTime: CART_STALE_MS,
  });
}

/** Admin: change an order's status. */
export function useUpdateOrderStatus(): UseMutationResult<
  ApiOrder,
  ApiError,
  { id: number; status: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }) =>
      (await api.patch<ApiOrder>(`/orders/${id}/status`, { status })).data,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.orders });
    },
  });
}

// =============================================================================
// Users (admin board + checkout prefill)
// =============================================================================

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: async () => (await api.get<ApiUser[]>("/users")).data.map(toAdminUser),
    staleTime: STATIC_STALE_MS,
  });
}

// =============================================================================
// Analytics (admin dashboard) — short staleTime: the panel should feel live
// =============================================================================

/** Admin: the 7-day daily revenue series (non-cancelled orders). */
export function useSales7d() {
  return useQuery({
    queryKey: queryKeys.analyticsSales,
    queryFn: async () => (await api.get<ApiSalesDay[]>("/analytics/sales")).data,
    staleTime: CART_STALE_MS,
  });
}

/** Admin: the combined recent-activity feed (orders + users + low stock). */
export function useActivityFeed() {
  return useQuery({
    queryKey: queryKeys.analyticsActivities,
    queryFn: async () => (await api.get<ApiActivityFeed>("/analytics/activities")).data,
    staleTime: CART_STALE_MS,
  });
}

/** Admin: the 7-day daily page-view series (Redis counters, Phase 6). */
export function useTraffic7d() {
  return useQuery({
    queryKey: queryKeys.analyticsTraffic,
    queryFn: async () => (await api.get<ApiTrafficDay[]>("/analytics/traffic")).data,
    staleTime: CART_STALE_MS,
  });
}

// =============================================================================
// Customer portal (Phase 6) — the /users/me family
// =============================================================================

/**
 * The logged-in customer's own profile. A 404 means "logged in but no DB
 * account yet" (never ordered / never saved) — the client renders an empty
 * form for it, so we don't retry it.
 */
export function useMyProfile() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => (await api.get<ApiMe>("/users/me")).data,
    staleTime: CART_STALE_MS,
    retry: (count, error) =>
      error instanceof ApiError && error.status === 404 ? false : count < 2,
  });
}

/** Save the profile (upsert by phone on the backend). */
export function useSaveProfile(): UseMutationResult<ApiMe, ApiError, ApiMeUpdate> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: ApiMeUpdate) =>
      (await api.patch<ApiMe>("/users/me", body)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.me });
      // The admin user board shows the same fields — refresh it too.
      void qc.invalidateQueries({ queryKey: queryKeys.users });
    },
  });
}

/** The logged-in customer's orders (newest first, items + first image). */
export function useMyOrders() {
  return useQuery({
    queryKey: queryKeys.meOrders,
    queryFn: async () => (await api.get<ApiMyOrder[]>("/users/me/orders")).data,
    staleTime: CART_STALE_MS,
  });
}

// =============================================================================
// Customer address book (Phase 7) — /users/me/addresses
// =============================================================================

/** The logged-in customer's saved addresses (default first). Empty = none yet.
 *
 *  Gated on the mock-auth phone so SSR (no localStorage) never fires the
 *  auth-gated call and gets a 401.
 */
export function useMyAddresses() {
  return useQuery({
    queryKey: queryKeys.meAddresses,
    queryFn: async () => (await api.get<ApiUserAddress[]>("/users/me/addresses")).data,
    staleTime: CART_STALE_MS,
    enabled: typeof window !== "undefined" && Boolean(getAuthPhone()),
  });
}

/** Create (POST) or update (PUT) one of the customer's saved addresses. */
export function useSaveAddress(): UseMutationResult<
  ApiUserAddress,
  ApiError,
  { id?: number | undefined; input: ApiUserAddressInput | ApiUserAddressUpdate }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }) => {
      if (id !== undefined) {
        return (
          await api.put<ApiUserAddress>(`/users/me/addresses/${id}`, input)
        ).data;
      }
      return (await api.post<ApiUserAddress>("/users/me/addresses", input)).data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.meAddresses });
      // The admin board surfaces the user's default address — keep it fresh.
      void qc.invalidateQueries({ queryKey: queryKeys.users });
    },
  });
}

/** Delete one of the customer's saved addresses. */
export function useDeleteAddress(): UseMutationResult<{ deleted: boolean }, ApiError, number> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) =>
      (await api.delete<{ deleted: boolean }>(`/users/me/addresses/${id}`)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.meAddresses });
      void qc.invalidateQueries({ queryKey: queryKeys.users });
    },
  });
}

export { FREE_SHIPPING_FROM };