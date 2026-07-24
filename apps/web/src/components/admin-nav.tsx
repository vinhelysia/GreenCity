"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ADMIN_LINKS = [
  { href: "/admin/giao-dich", label: "Xác nhận giao dịch" },
  { href: "/admin/bao-gia", label: "Báo giá" },
  { href: "/admin/dong-gop", label: "Duyệt báo cáo rác" },
] as const;

/** Moves between the three admin queues. Deliberately absent from public nav. */
export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Khu vực quản trị" className="min-w-0">
      <ul className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1 border-b border-rule pb-2">
        {ADMIN_LINKS.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={[
                  "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors duration-quick ease-out",
                  active
                    ? "bg-paper-2 text-accent"
                    : "text-muted hover:text-ink",
                ].join(" ")}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
