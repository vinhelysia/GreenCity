"use client";

import { useTranslations } from "next-intl";
import { Suspense, useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/routing";
import { LanguageSwitcher } from "./language-switcher";
import { isNavActive, NAV_LINKS } from "./nav-links";

function LanguageSwitcherFallback() {
  return (
    <div
      aria-hidden="true"
      className="inline-flex h-9 w-[4.75rem] items-center rounded-lg border border-edge bg-paper-2 p-0.5 shadow-eco-sm"
    />
  );
}

/**
 * Primary navigation: desktop inline links, mobile disclosure menu.
 * Includes mobile LanguageSwitcher inside mobile drawer.
 * Keyboard: Escape closes menu and returns focus to the toggle.
 */
export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const tNav = useTranslations("navigation");
  const tCommon = useTranslations("common");

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const closeAndFocusToggle = useCallback(() => {
    setOpen(false);
    toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <nav
      aria-label={tCommon("mainNavigation")}
      className="min-w-0"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          closeAndFocusToggle();
        }
      }}
    >
      <button
        ref={toggleRef}
        type="button"
        className="nav-toggle inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-edge bg-paper px-3 text-sm font-medium text-ink lg:hidden"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="sr-only">{open ? tCommon("closeMenu") : tCommon("openMenu")}</span>
        <span aria-hidden="true">{open ? tCommon("closeShort") : tCommon("menuShort")}</span>
      </button>

      {/* Backdrop below header so the toggle stays clickable */}
      {open ? (
        <button
          type="button"
          className="fixed inset-x-0 bottom-0 top-[var(--header-height,3.5rem)] z-40 bg-ink/20 lg:hidden"
          aria-label={tCommon("dismissMenu")}
          onClick={closeAndFocusToggle}
        />
      ) : null}

      <ul
        id={menuId}
        className={[
          "z-50 flex flex-col gap-1 border-b border-rule bg-paper px-4 py-3",
          "max-lg:fixed max-lg:inset-x-0 max-lg:top-[var(--header-height,3.5rem)] max-lg:shadow-sm",
          open ? "max-lg:flex" : "max-lg:hidden",
          "lg:static lg:flex lg:flex-row lg:items-center lg:gap-1 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none",
        ].join(" ")}
      >
        {NAV_LINKS.map(({ href, key, label }) => {
          const active = isNavActive(pathname, href);
          const translatedLabel = tNav(key as any) || label;
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                onClick={close}
                className={[
                  "block whitespace-nowrap rounded-xl px-3.5 py-2.5 text-base font-medium transition-colors duration-quick ease-out",
                  "min-h-11 lg:min-h-0 lg:py-2 lg:text-sm",
                  active
                    ? "bg-mint-surface text-primary font-semibold"
                    : "text-muted hover:bg-mint-surface/50 hover:text-ink",
                ].join(" ")}
              >
                {translatedLabel}
              </Link>
            </li>
          );
        })}

        {/* Mobile Language Switcher inside Drawer */}
        <li className="mt-2 border-t border-edge/60 pt-2 lg:hidden">
          <Suspense fallback={<LanguageSwitcherFallback />}>
            <LanguageSwitcher onNavigate={close} />
          </Suspense>
        </li>
      </ul>
    </nav>
  );
}
