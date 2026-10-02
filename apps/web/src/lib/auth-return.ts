import type { Pathnames } from "@/i18n/routing";

// Canonical routes only: next-intl maps these into the current language.
// Keep auth pages out so a successful login cannot redirect back into auth.
const RETURN_PATHS = new Set<Pathnames>([
  "/", "/thung-rac", "/dich-vu", "/ban-phe-lieu", "/dong-gop",
  "/cho-online", "/diem-thuong", "/tai-khoan",
  "/admin/bao-gia", "/admin/dong-gop", "/admin/giao-dich",
]);

export function getAuthReturnPath(value: unknown): Pathnames {
  return typeof value === "string" && RETURN_PATHS.has(value as Pathnames)
    ? (value as Pathnames)
    : "/tai-khoan";
}
