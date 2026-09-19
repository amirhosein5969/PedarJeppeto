/**
 * Global wood-type (جنس چوب) store (mock persistence).
 *
 * Holds the shared list of wood options managed from the admin panel
 * («جزئیات محصولات») plus the global switch that decides how material is
 * handled everywhere:
 *  - customerSelectionEnabled true  → customers pick the wood from a dropdown
 *    on the product page and admins pick it from the same list in the product
 *    editor.
 *  - customerSelectionEnabled false → both sides fall back to a free-text
 *    material description.
 */

export type WoodSettings = {
  /** Global wood options (Persian labels), e.g. ["گردو", "راش", "بلوط"]. */
  woodTypes: string[];
  /** انتخاب جنس توسط مشتری از فهرست چوب‌ها فعال است؟ */
  customerSelectionEnabled: boolean;
};

const STORAGE_KEY = "hc-admin-wood-types-v1";

export const DEFAULT_WOOD_SETTINGS: WoodSettings = {
  woodTypes: ["گردو", "راش", "بلوط", "نراد"],
  customerSelectionEnabled: true,
};

export function loadWoodSettings(): WoodSettings {
  if (typeof window === "undefined") return DEFAULT_WOOD_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WOOD_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<WoodSettings>;
    const woodTypes = Array.isArray(parsed.woodTypes)
      ? parsed.woodTypes
          .filter((w): w is string => typeof w === "string")
          .map((w) => w.trim())
          .filter(Boolean)
      : [...DEFAULT_WOOD_SETTINGS.woodTypes];
    return {
      woodTypes: [...new Set(woodTypes)],
      customerSelectionEnabled:
        typeof parsed.customerSelectionEnabled === "boolean"
          ? parsed.customerSelectionEnabled
          : DEFAULT_WOOD_SETTINGS.customerSelectionEnabled,
    };
  } catch {
    return DEFAULT_WOOD_SETTINGS;
  }
}

export function saveWoodSettings(settings: WoodSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage failures are acceptable during the mock phase.
  }
}
