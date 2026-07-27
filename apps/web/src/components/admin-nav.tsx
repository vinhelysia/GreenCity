"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { Link, type Pathnames } from "@/i18n/routing";

const ADMIN_LINKS: { href: Pathnames; key: "transactionsTab" | "quotesTab" | "cleanupTab"; fallback: string }[] = [
  { href: "/admin/giao-dich", key: "transactionsTab", fallback: "Xác nhận giao dịch" },
  { href: "/admin/bao-gia", key: "quotesTab", fallback: "Báo giá" },
  { href: "/admin/dong-gop", key: "cleanupTab", fallback: "Duyệt báo cáo rác" },
];

/** Moves between the three admin queues. Deliberately absent from public nav. */
export function AdminNav() {
  const pathname = usePathname();
  const tAdmin = useTranslations("admin");
  const tCommon = useTranslations("common");

  const cleanPath = pathname?.replace(/^\/en(?=\/|$)/, "") || "/";

  return (
    <nav aria-label={tCommon("adminNavigation")} className="min-w-0">
      <ul className="flex min-w-0 flex-wrap items-center gap-2 border-b border-edge pb-3">
        {ADMIN_LINKS.map(({ href, key, fallback }) => {
          const active = cleanPath === href || cleanPath.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={[
                  "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-colors duration-quick ease-out",
                  active
                    ? "bg-primary text-white shadow-eco-sm"
                    : "bg-card border border-edge text-muted hover:border-primary/40 hover:text-ink",
                ].join(" ")}
              >
                {tAdmin(key) || fallback}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
