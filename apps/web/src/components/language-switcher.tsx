"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { IconChevronDown, IconGlobe } from "./eco-icons";
import { getPathname, routing, type Locale, type Pathnames } from "@/i18n/routing";

/**
 * Each language is named in its own language, which is why these are not in the
 * dictionaries: someone who only reads English still needs to recognise
 * "Tiếng Việt" on an English page, and rendering it as "Vietnamese" there would
 * defeat the point.
 */
const LOCALE_LABELS: Record<Locale, string> = {
  vi: "Tiếng Việt",
  en: "English",
};

/**
 * Validate next/return URL to prevent open redirects.
 * Only allows relative paths starting with / (excluding //).
 */
function sanitizeReturnUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("/") && !url.startsWith("//")) {
    return url;
  }
  return null;
}

/**
 * Globe button that discloses the supported languages.
 *
 * The options stay real links, so a language still changes with JavaScript
 * disabled and can be opened in a new tab. This is a disclosure rather than a
 * listbox: there is no value to commit, only navigation.
 */
export function LanguageSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const currentLocale = useLocale() as Locale;
  const rawPathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("common");

  const [open, setOpen] = useState(false);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  const closeAndFocusButton = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    // Escape closes and hands focus back, matching the mobile nav.
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeAndFocusButton();
    }
    // Pointerdown rather than click, so the menu is gone before whatever was
    // clicked outside it reacts.
    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) close();
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, close, closeAndFocusButton]);

  // Determine current internal pathname for next-intl routing mapping
  let internalPathname: Pathnames = "/";
  if (rawPathname) {
    // Strip locale prefix if present
    const stripped = rawPathname.replace(/^\/(?:vi|en)(?=\/|$)/, "") || "/";

    // Reverse lookup in pathnames map
    for (const [key, value] of Object.entries(routing.pathnames)) {
      if (key === stripped) {
        internalPathname = key as Pathnames;
        break;
      }
      if (typeof value === "object") {
        if (value.vi === stripped || value.en === stripped) {
          internalPathname = key as Pathnames;
          break;
        }
      }
    }
  }

  const searchString = searchParams?.toString() ? `?${searchParams.toString()}` : "";

  const getUrlForLocale = (targetLocale: Locale): string => {
    try {
      const targetPath = getPathname({
        locale: targetLocale,
        href: internalPathname,
      });

      // Preserve query params if present, sanitizing next/returnUrl if present
      if (searchParams && searchParams.has("next")) {
        const nextVal = sanitizeReturnUrl(searchParams.get("next"));
        const newParams = new URLSearchParams(searchParams);
        if (nextVal) {
          newParams.set("next", nextVal);
        } else {
          newParams.delete("next");
        }
        const qs = newParams.toString();
        return `${targetPath}${qs ? `?${qs}` : ""}`;
      }

      return `${targetPath}${searchString}`;
    } catch {
      // Deterministic fallback to target locale homepage
      return targetLocale === "en" ? `/en${searchString}` : `/${searchString}`;
    }
  };

  const switchLabel: Record<Locale, string> = {
    vi: t("switchToVietnamese"),
    en: t("switchToEnglish"),
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-edge bg-paper-2 px-2.5 py-1.5 text-xs font-bold text-ink shadow-eco-sm transition-colors duration-quick ease-out hover:border-primary/40"
      >
        <IconGlobe className="h-4 w-4 text-muted" />
        {/* The code is the compact visual cue; the sr-only text names the
            language, so an icon is never the only indicator. */}
        <span aria-hidden="true">{currentLocale.toUpperCase()}</span>
        <span className="sr-only">
          {t("switchLanguage")}: {LOCALE_LABELS[currentLocale]}
        </span>
        <IconChevronDown
          className={[
            "h-3.5 w-3.5 text-muted transition-transform duration-quick ease-out",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {open ? (
        <ul
          id={menuId}
          className="absolute right-0 z-50 mt-1 min-w-[10rem] overflow-hidden rounded-lg border border-edge bg-paper py-1 shadow-eco"
        >
          {routing.locales.map((locale) => {
            const active = locale === currentLocale;
            return (
              <li key={locale}>
                <Link
                  href={getUrlForLocale(locale)}
                  aria-label={switchLabel[locale]}
                  aria-current={active ? "true" : undefined}
                  onClick={() => {
                    close();
                    onNavigate?.();
                  }}
                  className={[
                    "flex items-center justify-between gap-3 px-3 py-2 text-sm transition-colors duration-quick ease-out",
                    active
                      ? "font-semibold text-primary"
                      : "text-ink hover:bg-mint-surface/60",
                  ].join(" ")}
                >
                  <span>{LOCALE_LABELS[locale]}</span>
                  <span aria-hidden="true" className="text-xs font-bold text-muted">
                    {locale.toUpperCase()}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
