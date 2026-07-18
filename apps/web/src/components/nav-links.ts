/** Public primary navigation — order matches teacher-approved wireframe. */
export const NAV_LINKS = [
  { href: "/", label: "Trang chủ" },
  { href: "/thung-rac", label: "Thùng rác" },
  { href: "/dich-vu", label: "Dịch vụ" },
  { href: "/dong-gop", label: "Đóng góp" },
  { href: "/cho-online", label: "Chợ online" },
] as const;

export type NavHref = (typeof NAV_LINKS)[number]["href"];

/** Active state: exact match for home; prefix match for nested routes later. */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
