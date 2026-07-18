"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Login CTA with active state when on /dang-nhap. */
export function HeaderLoginLink() {
  const pathname = usePathname();
  const active = pathname === "/dang-nhap";

  return (
    <Link
      href="/dang-nhap"
      aria-current={active ? "page" : undefined}
      className={[
        "inline-flex min-h-11 items-center justify-center rounded-md border px-3 py-2 text-sm font-medium transition-colors duration-quick ease-out sm:px-4",
        active
          ? "border-accent bg-paper-2 text-accent"
          : "border-edge bg-paper text-ink hover:border-accent hover:text-accent",
      ].join(" ")}
    >
      Đăng nhập
    </Link>
  );
}
