import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { APP_NAME } from "@greencity/shared";
import { IconArrowRight } from "@/components/eco-icons";
import { HomeHero } from "@/components/home-hero";
import { HomeHighlights } from "@/components/home-highlights";
import { HomeLoop } from "@/components/home-loop";
import { Section } from "@/components/section";
import { Link } from "@/i18n/routing";
import { getHomePageUrl } from "@/lib/site-url";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const homeUrl = getHomePageUrl(locale);
  const isEn = locale === "en";

  return {
    alternates: {
      canonical: homeUrl,
      languages: {
        "vi-VN": getHomePageUrl("vi"),
        "en-US": getHomePageUrl("en"),
      },
    },
    openGraph: {
      title: t("title"),
      description: t("description"),
      siteName: APP_NAME,
      locale: isEn ? "en_US" : "vi_VN",
      type: "website",
      url: homeUrl,
    },
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  return (
    <div className="min-w-0 space-y-14 sm:space-y-20">
      <HomeHero />

      {/*
        Three ruled rows, not three cards. The previous shape was the AI
        template exactly: equal thirds, an icon tile, a badge, and a coloured
        top-stripe doing the differentiating because nothing else was. These
        three routes are not equal — selling is the entry point, so it carries
        the weight, and the rows differ by content rather than by stripe colour.
      */}
      <section aria-labelledby="journey-heading" className="min-w-0">
        <h2
          id="journey-heading"
          className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl"
        >
          {t("journeyTitle")}
        </h2>

        <ul className="mt-6 min-w-0 divide-y divide-rule border-y border-rule">
          {([
            {
              href: "/ban-phe-lieu",
              role: t("sellerRole"),
              title: t("sellerTitle"),
              body: t("sellerDesc"),
              link: t("sellerLink"),
              lead: true,
            },
            {
              href: "/cho-online",
              role: t("buyerRole"),
              title: t("buyerTitle"),
              body: t("buyerDesc"),
              link: t("buyerLink"),
              lead: false,
            },
            {
              href: "/dong-gop",
              role: t("communityRole"),
              title: t("communityTitle"),
              body: t("communityDesc"),
              link: t("communityLink"),
              lead: false,
            },
            // as const: Link's href is a typed pathname union, and an untyped
            // array literal widens it to string.
          ] as const).map((row) => (
            <li
              key={row.href}
              className="grid min-w-0 grid-cols-1 gap-x-8 gap-y-3 py-6 lg:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] lg:py-8"
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                {row.role}
              </p>
              <div className="min-w-0">
                <h3
                  className={`font-display font-bold tracking-tight text-ink [overflow-wrap:anywhere] ${
                    row.lead ? "text-2xl sm:text-3xl" : "text-xl"
                  }`}
                >
                  {row.title}
                </h3>
                <p
                  className={`mt-2 text-sm leading-relaxed text-muted ${
                    row.lead ? "max-w-prose sm:text-base" : "max-w-prose"
                  }`}
                >
                  {row.body}
                </p>
                <Link
                  href={row.href}
                  className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-warm-600 underline-offset-4 hover:underline"
                >
                  <span>{row.link}</span>
                  <IconArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <HomeHighlights />

      <Section
        id="vong-lap"
        title={t("processTitle")}
        tone="open"
        lede={t("processLede")}
      >
        <HomeLoop />
      </Section>

      <Section
        id="cach-tinh-diem"
        title={t("pointsCalcTitle")}
        tone="band"
      >
        <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-2">
          <dl className="min-w-0 space-y-6">
            <div className="min-w-0 rounded-lg border-l-2 border-primary bg-card p-5">
              <dt className="font-display text-2xl font-bold tabular-nums tracking-tight text-primary sm:text-3xl">
                {t("pointRateTitle")}
              </dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted">
                {t("pointRateDesc")}
              </dd>
            </div>
            <div className="min-w-0 rounded-lg border-l-2 border-coral bg-card p-5">
              <dt className="font-display text-2xl font-bold tabular-nums tracking-tight text-coral sm:text-3xl">
                {t("cleanupRewardTitle")}
              </dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted">
                {t("cleanupRewardDesc")}
              </dd>
            </div>
          </dl>

          <div className="min-w-0 max-w-prose space-y-4 rounded-lg border border-edge bg-card p-6 text-sm leading-relaxed text-muted">
            <p>{t("pointsNotice1")}</p>
            <p>{t("pointsNotice2")}</p>
            <div className="pt-2">
              <Link
                href="/diem-thuong"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
              >
                <span>{t("viewPointsLedger")}</span>
                <IconArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </Section>

      {/*
        Flat ground, no orb. This closed on a diagonal three-stop gradient with
        a radial-gradient circle floating out of the top-right corner — the
        floating-orb tell, and nothing the copy needed. One solid colour reads
        as a deliberate band instead of a generated flourish.
      */}
      <section className="min-w-0 overflow-hidden rounded-2xl bg-primary p-8 text-white sm:p-12">
        <div className="max-w-2xl space-y-4">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {t("ctaTitle")}
          </h2>
          <p className="text-base text-primary-soft leading-relaxed">
            {t("ctaDesc")}
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-4">
            <Link
              href="/ban-phe-lieu"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-warm-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-warm-900"
            >
              <span>{t("ctaSell")}</span>
              <IconArrowRight className="h-4 w-4" />
            </Link>
            {/* Solid border, no backdrop-blur: there is nothing behind this
                band to blur, so the filter cost bought a look and no meaning. */}
            <Link
              href="/cho-online"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/40 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              <span>{t("ctaExplore")}</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
