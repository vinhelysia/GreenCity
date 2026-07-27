import { useTranslations } from "next-intl";
import { APP_NAME } from "@greencity/shared";
import { Link } from "@/i18n/routing";
import { EcoBadge } from "./eco-badge";
import { IconLeaf, IconShieldCheck } from "./eco-icons";
import { NAV_LINKS } from "./nav-links";

/** Modern civic eco footer — identity, tagline, navigation, transparency badge. */
export function SiteFooter() {
  const tFooter = useTranslations("footer");
  const tNav = useTranslations("navigation");
  const tCommon = useTranslations("common");

  return (
    <footer className="mt-auto border-t border-edge bg-card text-ink">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-12 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 max-w-md">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white shadow-eco-sm">
              <IconLeaf className="h-4.5 w-4.5" />
            </span>
            <span className="font-display text-xl font-bold tracking-tight text-ink">
              {APP_NAME}
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {tCommon("slogan")}
          </p>
          <div className="mt-4 inline-flex items-center gap-2">
            <EcoBadge variant="mint" icon={<IconShieldCheck className="h-3.5 w-3.5" />}>
              {tCommon("platformTagline")}
            </EcoBadge>
          </div>
        </div>

        <nav aria-label={tFooter("navigation")} className="min-w-0">
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-ink">
            {tFooter("navigation")}
          </h3>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {NAV_LINKS.map(({ href, key, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="inline-flex min-h-11 items-center text-sm font-medium text-muted transition-colors hover:text-primary hover:underline"
                >
                  {tNav(key as any) || label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/dang-ky"
                className="inline-flex min-h-11 items-center text-sm font-medium text-muted transition-colors hover:text-primary hover:underline"
              >
                {tFooter("register")}
              </Link>
            </li>
            <li>
              <Link
                href="/dang-nhap"
                className="inline-flex min-h-11 items-center text-sm font-medium text-muted transition-colors hover:text-primary hover:underline"
              >
                {tFooter("login")}
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-edge bg-mint-surface/30 px-4 py-4 text-center text-xs text-muted">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>{tFooter("copyright", { year: new Date().getFullYear().toString() })}</p>
          <p>{tFooter("subline")}</p>
        </div>
      </div>
    </footer>
  );
}
