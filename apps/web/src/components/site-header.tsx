import { Suspense } from "react";
import { APP_NAME } from "@greencity/shared";
import { Link } from "@/i18n/routing";
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
          className="group inline-flex min-w-0 shrink items-center gap-2.5 rounded-lg text-ink transition-transform hover:scale-[1.01]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-9 w-9 shrink-0" />
          {/* Wordmark yields below sm and truncates above it. At 320px the row
              needs ~359px for mark + nav + account + logout, and body is
              overflow-x: clip, so whatever loses that fight is not just
              off-screen but unreachable. Losing the wordmark beats losing the
              only way to sign out; the logo still identifies the site and
              sr-only keeps the link's accessible name intact. */}
          <span className="sr-only min-w-0 truncate font-display text-xl font-bold tracking-tight text-ink sm:not-sr-only">
            {APP_NAME}
          </span>
        </Link>

        {/* min-w-0 all the way down to the account label: body is overflow-x:
            clip, so anything pushed past the right edge is not merely off-screen
            but unreachable — there is no horizontal scroll to bring it back.
            The account label is the only part allowed to absorb the pressure. */}
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <SiteNav />
          <div className="flex min-w-0 items-center gap-2.5">
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
