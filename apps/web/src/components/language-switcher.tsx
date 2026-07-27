"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getPathname, routing, type Locale, type Pathnames } from "@/i18n/routing";

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

export function LanguageSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const currentLocale = useLocale() as Locale;
  const rawPathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("common");

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

  return (
    <nav
      aria-label={t("switchLanguage")}
      className="inline-flex items-center rounded-lg border border-edge bg-paper-2 p-0.5 shadow-eco-sm"
    >
      <Link
        href={getUrlForLocale("vi")}
        aria-label={t("switchToVietnamese")}
        aria-current={currentLocale === "vi" ? "true" : undefined}
        onClick={onNavigate}
        className={[
          "inline-flex min-h-8 min-w-8 items-center justify-center rounded-md px-2.5 text-xs font-bold transition duration-quick ease-out",
          currentLocale === "vi"
            ? "bg-primary text-white shadow-eco-sm"
            : "text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-primary",
        ].join(" ")}
      >
        VI
      </Link>
      <Link
        href={getUrlForLocale("en")}
        aria-label={t("switchToEnglish")}
        aria-current={currentLocale === "en" ? "true" : undefined}
        onClick={onNavigate}
        className={[
          "inline-flex min-h-8 min-w-8 items-center justify-center rounded-md px-2.5 text-xs font-bold transition duration-quick ease-out",
          currentLocale === "en"
            ? "bg-primary text-white shadow-eco-sm"
            : "text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-primary",
        ].join(" ")}
      >
        EN
      </Link>
    </nav>
  );
}
