"use client";

import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";
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
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutFailed, setLogoutFailed] = useState(false);
  const logoutInFlight = useRef(false);

  const handleLogout = useCallback(async () => {
    if (logoutInFlight.current) return;

    logoutInFlight.current = true;
    setIsLoggingOut(true);
    setLogoutFailed(false);
    try {
      const result = await logout();
      setLogoutFailed(!result.ok);
    } catch {
      // Do not expose unexpected client or server details in the header.
      setLogoutFailed(true);
    } finally {
      logoutInFlight.current = false;
      setIsLoggingOut(false);
    }
  }, [logout]);

  const cleanPath = pathname?.replace(/^\/en(?=\/|$)/, "") || "/";
  const loginActive = cleanPath === "/dang-nhap";
  const registerActive = cleanPath === "/dang-ky";
  const accountActive = cleanPath === "/tai-khoan" || cleanPath === "/account";

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
    const initial = label.charAt(0).toUpperCase();
    const isAdmin = user.roles.includes("ADMIN");
    return (
      <div className="relative flex shrink-0 items-center gap-2">
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
        <Link
          href="/tai-khoan"
          aria-current={accountActive ? "page" : undefined}
          className={[
            "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-edge bg-paper text-sm transition-colors sm:min-h-0 sm:min-w-0 sm:max-w-[10rem] sm:justify-start sm:rounded-none sm:border-0 sm:bg-transparent",
            accountActive
              ? "font-semibold text-primary"
              : "text-muted hover:text-ink",
          ].join(" ")}
          title={user.email}
          data-testid="header-account"
        >
          <span aria-hidden="true" className="font-semibold sm:hidden">
            {initial}
          </span>
          <span data-testid="header-user-label" className="hidden truncate sm:inline">
            {label}
          </span>
          <span className="sr-only sm:hidden">{tNav("account")}</span>
        </Link>
        <button
          type="button"
          data-testid="header-logout"
          disabled={isLoggingOut}
          aria-busy={isLoggingOut}
          aria-describedby={logoutFailed ? "header-logout-error" : undefined}
          className="inline-flex min-h-11 shrink-0 whitespace-nowrap items-center justify-center rounded-md border border-edge bg-paper px-3 py-2 text-sm font-medium text-ink transition-colors duration-quick ease-out hover:border-primary hover:text-primary disabled:cursor-wait disabled:opacity-70 sm:px-4"
          onClick={() => {
            void handleLogout();
          }}
        >
          {isLoggingOut ? tAuth("signingOut") : tAuth("signOut")}
        </button>
        {logoutFailed ? (
          <p
            id="header-logout-error"
            role="alert"
            className="absolute right-0 top-full z-10 mt-2 w-64 rounded-md border border-edge bg-paper p-3 text-sm leading-relaxed text-red-800 shadow-eco-sm"
          >
            {tAuth("logoutFailed")}
          </p>
        ) : null}
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
