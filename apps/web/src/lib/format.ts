/**
 * Locale-aware formatting utilities for GreenCity.
 * Currency remains in VND across all locales without currency conversion.
 */
export function formatVnd(amountVnd: number, locale: string = "vi"): string {
  const formatted = new Intl.NumberFormat(locale === "en" ? "en-US" : "vi-VN").format(amountVnd);
  return locale === "en" ? `${formatted} VND` : `${formatted}đ`;
}

export function formatDate(value: Date | string | number, locale: string = "vi"): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString(locale === "en" ? "en-US" : "vi-VN");
}

export function formatDateTime(value: Date | string | number, locale: string = "vi"): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString(locale === "en" ? "en-US" : "vi-VN");
}

export function formatNumber(value: number, locale: string = "vi"): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "vi-VN").format(value);
}

const CATEGORY_TRANSLATIONS_EN: Record<string, string> = {
  "Chai nhựa PET": "PET Plastic Bottles",
  "Chai thủy tinh": "Glass Bottles",
  "Giấy carton": "Cardboard",
  "Lon nhôm": "Aluminum Cans",
  "Sắt vụn": "Scrap Iron",
};

export function formatCategoryName(categoryName: string, locale: string = "vi"): string {
  if (locale === "en" && CATEGORY_TRANSLATIONS_EN[categoryName]) {
    return CATEGORY_TRANSLATIONS_EN[categoryName];
  }
  return categoryName;
}

