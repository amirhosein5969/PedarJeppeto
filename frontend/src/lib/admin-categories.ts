/**
 * Admin-side categories store (mock persistence — the backend exposes
 * categories read-only and has no category CRUD yet, so this panel keeps its
 * localStorage seed, inlined here since the storefront catalog now lives in
 * the database).
 */

export type AdminCategory = {
  id: string;
  title: string;
  slug: string;
  image: string;
};

import catKitchen from "@/assets/cat-kitchen.jpg";
import catOffice from "@/assets/cat-office.jpg";
import catDigital from "@/assets/cat-digital.jpg";
import catGift from "@/assets/cat-gift.jpg";

const seedCategories = (): AdminCategory[] => [
  { id: "cat-1", title: "ظروف و ابزار آشپزخانه چوبی", slug: "kitchen", image: catKitchen },
  { id: "cat-2", title: "دکوری و اداری چوبی", slug: "office", image: catOffice },
  { id: "cat-3", title: "لوازم جانبی دیجیتال چوبی", slug: "digital", image: catDigital },
  { id: "cat-4", title: "کادویی و تزئینی چوبی", slug: "gift", image: catGift },
];

const STORAGE_KEY = "hc-admin-categories";

export function loadAdminCategories(): AdminCategory[] {
  if (typeof window === "undefined") return seedCategories();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedCategories();
      saveAdminCategories(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AdminCategory[]) : seedCategories();
  } catch {
    return seedCategories();
  }
}

export function saveAdminCategories(items: AdminCategory[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage failures are acceptable during the mock phase.
  }
}

export const newAdminCategoryId = () => `cat-${Date.now().toString(36)}`;
