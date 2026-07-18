"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { isNavActive, NAV_LINKS } from "./nav-links";

/**
 * Primary navigation: desktop inline links, mobile disclosure menu.
 * Keyboard: Escape closes menu and returns focus to the toggle.
 */
export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const closeAndFocusToggle = useCallback(() => {
    setOpen(false);
    toggleRef.current?.focus();
  }, []);

  // Close on route change (e.g. browser back while menu open).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll only while mobile menu is open (narrow viewports).
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
      aria-label="Điều hướng chính"
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
        <span className="sr-only">{open ? "Đóng menu" : "Mở menu"}</span>
        <span aria-hidden="true">{open ? "Đóng" : "Menu"}</span>
      </button>

      {/* Backdrop — mobile only when open */}
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-ink/20 lg:hidden"
          aria-label="Đóng menu điều hướng"
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
        {NAV_LINKS.map(({ href, label }) => {
          const active = isNavActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                onClick={close}
                className={[
                  "block rounded-md px-3 py-2.5 text-base font-medium transition-colors duration-quick ease-out",
                  "min-h-11 lg:min-h-0 lg:py-2 lg:text-sm",
                  active
                    ? "bg-paper-2 text-ink underline decoration-accent decoration-2 underline-offset-4"
                    : "text-muted hover:bg-paper-2 hover:text-ink",
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
