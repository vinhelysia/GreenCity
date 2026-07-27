import Link from "next/link";
import { APP_NAME } from "@greencity/shared";
import { IconLeaf } from "./eco-icons";
import { HeaderLoginLink } from "./header-login-link";
import { SiteNav } from "./site-nav";

/** Application header: eco identity left, navigation + login right. */
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

        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <SiteNav />
          <HeaderLoginLink />
        </div>
      </div>
    </header>
  );
}
