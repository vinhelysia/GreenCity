/**
 * Public primary navigation — order matches teacher-approved wireframe, with
 * Bán phế liệu added at integration: the seller flow is a core product tab and
 * must be reachable without typing a URL. Admin screens stay out of public nav.
 */
export const NAV_LINKS = [
  { href: "/", label: "Trang chủ" },
  { href: "/thung-rac", label: "Thùng rác" },
  { href: "/dich-vu", label: "Dịch vụ" },
  { href: "/ban-phe-lieu", label: "Bán phế liệu" },
  { href: "/dong-gop", label: "Đóng góp" },
  { href: "/cho-online", label: "Chợ online" },
  { href: "/diem-thuong", label: "Điểm thưởng" },
] as const;

export type NavHref = (typeof NAV_LINKS)[number]["href"];

/** Active state: exact match for home; prefix match for nested routes later. */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
