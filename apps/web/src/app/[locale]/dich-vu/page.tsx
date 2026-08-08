import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Link } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "services" });
  return {
    title: t("title"),
    description: t("lede"),
  };
}

/**
 * A directory of what GreenCity actually does today, not a sales catalogue.
 * Every entry links to a route that works, and every entry carries the one
 * thing it cannot do — the limits are the point of the page, because a
 * catalogue that only lists capabilities is the kind that oversells.
 */
const SERVICES = [
  {
    href: "/ban-phe-lieu",
    titleKey: "sellTitle",
    descKey: "sellDesc",
    noteKey: "sellNote",
  },
  {
    href: "/cho-online",
    titleKey: "marketplaceTitle",
    descKey: "marketplaceDesc",
    noteKey: "marketplaceNote",
  },
  {
    href: "/dong-gop",
    titleKey: "cleanupTitle",
    descKey: "cleanupDesc",
    noteKey: "cleanupNote",
  },
  {
    href: "/diem-thuong",
    titleKey: "rewardsTitle",
    descKey: "rewardsDesc",
    noteKey: "rewardsNote",
  },
] as const;

export default async function DichVuPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "services" });

  return (
    <div className="min-w-0 space-y-8">
      <PageHeader title={t("title")} description={<p>{t("lede")}</p>} />

      <p className="max-w-3xl text-sm leading-6 text-muted">{t("catalogNote")}</p>

      <ul
        data-testid="service-catalog"
        className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2"
      >
        {SERVICES.map((service) => {
          const title = t(service.titleKey);
          return (
            <li
              key={service.href}
              className="flex min-w-0 flex-col rounded-md border border-edge bg-paper p-5"
            >
              <span className="inline-flex self-start rounded-full bg-paper-2 px-2.5 py-1 text-xs font-semibold text-primary">
                {t("statusLive")}
              </span>
              <h2 className="mt-4 font-display text-xl font-bold text-ink [overflow-wrap:anywhere]">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                {t(service.descKey)}
              </p>
              <p className="mt-3 border-t border-dashed border-rule pt-3 text-sm leading-6 text-muted">
                <span className="font-semibold text-ink">{t("limitLabel")}</span>{" "}
                {t(service.noteKey)}
              </p>
              <Link
                href={service.href}
                className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
              >
                {t("goTo", { name: title })}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
