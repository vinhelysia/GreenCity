"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

/**
 * Header auth control: login CTA when signed out, identity + logout when signed in.
 * Session presence comes only from AuthProvider (GET /api/auth/me) — never from cookies.
 */
export function HeaderLoginLink() {
  const pathname = usePathname();
  const { user, status, logout } = useAuth();
  const loginActive = pathname === "/dang-nhap";
  const registerActive = pathname === "/dang-ky";

  if (status === "loading") {
    return (
      <span
        className="inline-flex min-h-11 min-w-[5.5rem] items-center justify-center rounded-md border border-rule bg-paper-2 px-3 py-2 text-sm text-muted"
        aria-hidden="true"
      >
        …
      </span>
    );
  }

  if (status === "authenticated" && user) {
    const label = user.displayName?.trim() || user.email;
    return (
      <div className="flex min-w-0 items-center gap-2">
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
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-edge bg-paper px-3 py-2 text-sm font-medium text-ink transition-colors duration-quick ease-out hover:border-accent hover:text-accent sm:px-4"
          onClick={() => {
            void logout();
          }}
        >
          Đăng xuất
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Link
        href="/dang-ky"
        aria-current={registerActive ? "page" : undefined}
        className={[
          "hidden min-h-11 items-center justify-center rounded-md px-2 py-2 text-sm font-medium transition-colors duration-quick ease-out sm:inline-flex sm:px-3",
          registerActive
            ? "text-accent underline decoration-accent decoration-2 underline-offset-4"
            : "text-muted hover:text-ink",
        ].join(" ")}
      >
        Đăng ký
      </Link>
      <Link
        href="/dang-nhap"
        aria-current={loginActive ? "page" : undefined}
        data-testid="header-login"
        className={[
          "inline-flex min-h-11 items-center justify-center rounded-md border px-3 py-2 text-sm font-medium transition-colors duration-quick ease-out sm:px-4",
          loginActive
            ? "border-accent bg-paper-2 text-accent"
            : "border-edge bg-paper text-ink hover:border-accent hover:text-accent",
        ].join(" ")}
      >
        Đăng nhập
      </Link>
    </div>
  );
}
