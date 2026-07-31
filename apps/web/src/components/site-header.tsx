import { Suspense } from "react";
import { APP_NAME } from "@greencity/shared";
import { Link } from "@/i18n/routing";
import { IconLeaf } from "./eco-icons";
import { HeaderLoginLink } from "./header-login-link";
import { HeaderPointsPill } from "./header-points-pill";
import { LanguageSwitcher } from "./language-switcher";
import { SiteNav } from "./site-nav";

function LanguageSwitcherFallback() {
  return (
    <div
      aria-hidden="true"
      className="inline-flex h-9 w-[4.75rem] items-center rounded-lg border border-edge bg-paper-2 p-0.5 shadow-eco-sm"
    />
  );
}

/** Application header: eco identity left, navigation middle, language selection + auth right. */
export function SiteHeader() {
  return (
    <header className="site-header sticky top-0 z-50 border-b border-edge bg-paper shadow-eco-sm">
      <div className="mx-auto flex h-[var(--header-height,4rem)] w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="group inline-flex shrink-0 items-center gap-2.5 rounded-lg text-ink transition-transform hover:scale-[1.01]"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white shadow-eco-sm transition-colors group-hover:bg-primary-hover">
            <IconLeaf className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight text-ink">
            {APP_NAME}
          </span>
        </Link>

        <div className="flex items-center gap-3 sm:gap-4">
          <SiteNav />
          <div className="flex shrink-0 items-center gap-2.5">
            <div className="hidden sm:block shrink-0">
              <Suspense fallback={<LanguageSwitcherFallback />}>
                <LanguageSwitcher />
              </Suspense>
            </div>
            <HeaderPointsPill />
            <HeaderLoginLink />
          </div>
        </div>
      </div>
    </header>
  );
}
