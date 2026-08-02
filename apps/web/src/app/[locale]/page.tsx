import { getTranslations, setRequestLocale } from "next-intl/server";
import { EcoBadge } from "@/components/eco-badge";
import { IconArrowRight, IconDumpster, IconPackage, IconRecycle } from "@/components/eco-icons";
import { HomeHero } from "@/components/home-hero";
import { HomeHighlights } from "@/components/home-highlights";
import { HomeLoop } from "@/components/home-loop";
import { Section } from "@/components/section";
import { Link } from "@/i18n/routing";

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

      {/* Core User Journey Cards */}
      <section aria-labelledby="journey-heading" className="min-w-0">
        <h2 id="journey-heading" className="sr-only">
          {t("journeyTitle")}
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div className="group relative flex flex-col justify-between rounded-2xl border border-edge border-t-[3px] border-t-primary bg-card p-6 shadow-eco-sm transition duration-300 hover:border-primary/40 hover:shadow-eco hover:-translate-y-1">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-mint-surface text-primary shadow-eco-sm group-hover:bg-primary group-hover:text-white transition-colors">
                  <IconRecycle className="h-6 w-6" />
                </span>
                <EcoBadge variant="mint" className="text-xs">{t("sellerRole")}</EcoBadge>
              </div>
              <h3 className="font-display text-xl font-bold text-ink">{t("sellerTitle")}</h3>
              <p className="text-sm leading-relaxed text-muted">
                {t("sellerDesc")}
              </p>
            </div>
            <div className="mt-6 border-t border-edge/60 pt-4">
              <Link
                href="/ban-phe-lieu"
                className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-warm-600 hover:underline underline-offset-4"
              >
                <span>{t("sellerLink")}</span>
                <IconArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="group relative flex flex-col justify-between rounded-2xl border border-edge border-t-[3px] border-t-yellow bg-card p-6 shadow-eco-sm transition duration-300 hover:border-primary/40 hover:shadow-eco hover:-translate-y-1">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-mint-surface text-primary shadow-eco-sm group-hover:bg-primary group-hover:text-white transition-colors">
                  <IconPackage className="h-6 w-6" />
                </span>
                <EcoBadge variant="yellow" className="text-xs">{t("buyerRole")}</EcoBadge>
              </div>
              <h3 className="font-display text-xl font-bold text-ink">{t("buyerTitle")}</h3>
              <p className="text-sm leading-relaxed text-muted">
                {t("buyerDesc")}
              </p>
            </div>
            <div className="mt-6 border-t border-edge/60 pt-4">
              <Link
                href="/cho-online"
                className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-warm-600 hover:underline underline-offset-4"
              >
                <span>{t("buyerLink")}</span>
                <IconArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="group relative flex flex-col justify-between rounded-2xl border border-edge border-t-[3px] border-t-warm-600 bg-card p-6 shadow-eco-sm transition duration-300 hover:border-coral/40 hover:shadow-eco hover:-translate-y-1">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-coral/10 text-coral shadow-eco-sm group-hover:bg-coral group-hover:text-white transition-colors">
                  <IconDumpster className="h-6 w-6" />
                </span>
                <EcoBadge variant="coral" className="text-xs">{t("communityRole")}</EcoBadge>
              </div>
              <h3 className="font-display text-xl font-bold text-ink">{t("communityTitle")}</h3>
              <p className="text-sm leading-relaxed text-muted">
                {t("communityDesc")}
              </p>
            </div>
            <div className="mt-6 border-t border-edge/60 pt-4">
              <Link
                href="/dong-gop"
                className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-warm-600 hover:underline underline-offset-4"
              >
                <span>{t("communityLink")}</span>
                <IconArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
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
            <div className="min-w-0 rounded-xl border border-primary/20 bg-card p-5 shadow-eco-sm">
              <dt className="font-display text-2xl font-bold tabular-nums tracking-tight text-primary sm:text-3xl">
                {t("pointRateTitle")}
              </dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted">
                {t("pointRateDesc")}
              </dd>
            </div>
            <div className="min-w-0 rounded-xl border border-coral/20 bg-card p-5 shadow-eco-sm">
              <dt className="font-display text-2xl font-bold tabular-nums tracking-tight text-coral sm:text-3xl">
                {t("cleanupRewardTitle")}
              </dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted">
                {t("cleanupRewardDesc")}
              </dd>
            </div>
          </dl>

          <div className="min-w-0 max-w-prose space-y-4 rounded-xl border border-edge bg-card p-6 shadow-eco-sm text-sm leading-relaxed text-muted">
            <p>{t("pointsNotice1")}</p>
            <p>{t("pointsNotice2")}</p>
            <div className="pt-2">
              <Link
                href="/diem-thuong"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover shadow-eco-sm"
              >
                <span>{t("viewPointsLedger")}</span>
                <IconArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </Section>

      {/* Final Eco Call-to-Action Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary via-primary-hover to-ink p-8 text-white shadow-eco sm:p-12">
        <div
          aria-hidden="true"
          className="absolute right-[-60px] top-[-60px] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(226,102,31,0.34)_0%,transparent_68%)]"
        />
        <div className="relative z-10 max-w-2xl space-y-4">
          <EcoBadge variant="mint" className="!bg-[rgba(242,160,61,0.2)] !text-[#F7C98B] !border-[rgba(242,160,61,0.45)] backdrop-blur-sm">
            {t("ctaTag")}
          </EcoBadge>
          <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
            {t("ctaTitle")}
          </h2>
          <p className="text-base text-primary-soft leading-relaxed">
            {t("ctaDesc")}
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-4">
            <Link
              href="/ban-phe-lieu"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-warm-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-warm-900 shadow-warm"
            >
              <span>{t("ctaSell")}</span>
              <IconArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/cho-online"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              <span>{t("ctaExplore")}</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
