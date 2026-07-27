import { type Pathnames } from "@/i18n/routing";

/**
 * Public primary navigation — order matches teacher-approved wireframe:
 * Trang chủ, Thùng rác, Dịch vụ, Bán phế liệu, Đóng góp, Chợ online, Điểm thưởng.
 */
export const NAV_LINKS = [
  { href: "/", key: "home", label: "Trang chủ" },
  { href: "/thung-rac", key: "recyclingBins", label: "Thùng rác" },
  { href: "/dich-vu", key: "services", label: "Dịch vụ" },
  { href: "/ban-phe-lieu", key: "sellScrap", label: "Bán phế liệu" },
  { href: "/dong-gop", key: "communityCleanup", label: "Đóng góp" },
  { href: "/cho-online", key: "marketplace", label: "Chợ online" },
  { href: "/diem-thuong", key: "rewards", label: "Điểm thưởng" },
] as const;

export type NavHref = (typeof NAV_LINKS)[number]["href"];

/** Active state: exact match for home; prefix match for nested routes. */
export function isNavActive(pathname: string, href: string): boolean {
  // Strip optional locale prefix (/en)
  const cleanPath = pathname.replace(/^\/en(?=\/|$)/, "") || "/";
  if (href === "/") return cleanPath === "/";
  return cleanPath === href || cleanPath.startsWith(`${href}/`);
}
