"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth-provider";
import { Link, usePathname } from "@/i18n/routing";

/**
 * Header auth control: login CTA when signed out, identity + logout when signed in.
 * Session presence comes only from AuthProvider (GET /api/auth/me) — never from cookies.
 */
export function HeaderLoginLink() {
  const pathname = usePathname();
  const { user, status, logout } = useAuth();
  const tNav = useTranslations("navigation");
  const tAuth = useTranslations("auth");
  const tFooter = useTranslations("footer");

  const cleanPath = pathname?.replace(/^\/en(?=\/|$)/, "") || "/";
  const loginActive = cleanPath === "/dang-nhap";
  const registerActive = cleanPath === "/dang-ky";

  if (status === "loading") {
    return (
      <span
        className="inline-flex min-h-11 min-w-[5.5rem] shrink-0 items-center justify-center rounded-md border border-rule bg-paper-2 px-3 py-2 text-sm text-muted"
        aria-hidden="true"
      >
        …
      </span>
    );
  }

  if (status === "authenticated" && user) {
    const label = user.displayName?.trim() || user.email;
    const isAdmin = user.roles.includes("ADMIN");
    return (
      <div className="flex shrink-0 items-center gap-2">
        {isAdmin ? (
          <Link
            href="/admin/giao-dich"
            data-testid="header-admin"
            aria-current={cleanPath.startsWith("/admin") ? "page" : undefined}
            className={[
              "inline-flex min-h-11 shrink-0 whitespace-nowrap items-center justify-center rounded-md px-2 py-2 text-sm font-medium transition-colors duration-quick ease-out sm:px-3",
              cleanPath.startsWith("/admin")
                ? "text-primary font-bold underline decoration-primary decoration-2 underline-offset-4"
                : "text-muted hover:text-ink",
            ].join(" ")}
          >
            {tNav("admin")}
          </Link>
        ) : null}
        <span
          className="hidden max-w-[10rem] truncate text-sm text-muted sm:inline"
          title={user.email}
          data-testid="header-user-label"
        >
          {label}
        </span>
        <button
          type="button"
          data-testid="header-logout"
          className="inline-flex min-h-11 shrink-0 whitespace-nowrap items-center justify-center rounded-md border border-edge bg-paper px-3 py-2 text-sm font-medium text-ink transition-colors duration-quick ease-out hover:border-primary hover:text-primary sm:px-4"
          onClick={() => {
            void logout();
          }}
        >
          {tAuth("signOut")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Link
        href="/dang-ky"
        aria-current={registerActive ? "page" : undefined}
        className={[
          "hidden min-h-11 shrink-0 whitespace-nowrap items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition-colors duration-quick ease-out sm:inline-flex",
          registerActive
            ? "text-primary font-bold"
            : "text-muted hover:text-ink",
        ].join(" ")}
      >
        {tFooter("register")}
      </Link>
      <Link
        href="/dang-nhap"
        aria-current={loginActive ? "page" : undefined}
        data-testid="header-login"
        className={[
          "inline-flex min-h-11 shrink-0 whitespace-nowrap items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition-colors duration-quick ease-out shadow-eco-sm",
          loginActive
            ? "bg-primary-hover text-white"
            : "bg-primary text-white hover:bg-primary-hover",
        ].join(" ")}
      >
        {tFooter("login")}
      </Link>
    </div>
  );
}
