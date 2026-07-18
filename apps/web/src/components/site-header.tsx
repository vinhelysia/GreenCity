import Link from "next/link";
import { APP_NAME } from "@greencity/shared";
import { HeaderLoginLink } from "./header-login-link";
import { SiteNav } from "./site-nav";

/** Application header: identity left, navigation + login right. */
export function SiteHeader() {
  return (
    <header className="site-header sticky top-0 z-50 border-b border-rule bg-paper">
      <div className="mx-auto flex h-[var(--header-height)] w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="shrink-0 font-display text-lg font-semibold tracking-tight text-ink sm:text-xl"
        >
          {APP_NAME}
        </Link>

        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <SiteNav />
          <HeaderLoginLink />
        </div>
      </div>
    </header>
  );
}
