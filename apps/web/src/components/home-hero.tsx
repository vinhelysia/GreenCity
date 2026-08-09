import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { EcoBadge } from "./eco-badge";
import { IconArrowRight, IconLeaf, IconSparkles } from "./eco-icons";

/**
 * Opening hero section — Server Component.
 * Proposition over a decorative eco-city panorama.
 * Exact H1 slogan:
 * - VI: "Rác có người mua! Người báo điểm rác!"
 * - EN: "Scrap finds a buyer! Report illegal dumping!"
 */
export async function HomeHero() {
  const locale = await getLocale();
  const t = await getTranslations("home");

  // Flat paper under the photograph. The three-stop diagonal gradient that used
  // to sit on this section was covered by the image anyway — it cost a tell and
  // bought nothing visible.
  return (
    <section
      aria-labelledby="hero-heading"
      className="home-hero relative isolate min-w-0 overflow-hidden rounded-2xl border border-edge bg-paper px-6 py-10 sm:px-8 sm:py-14 lg:min-h-[38rem] lg:px-12 lg:py-16"
    >
      <Image
        src="/eco-city-hero.png"
        alt=""
        fill
        priority
        quality={88}
        sizes="(max-width: 768px) 100vw, 1440px"
        className="home-hero-image object-cover"
      />
      <div aria-hidden="true" className="home-hero-veil absolute inset-0" />

      <div className="relative z-10 min-w-0 max-w-2xl">
        <div className="mb-4 inline-flex items-center gap-2">
          <EcoBadge variant="mint" icon={<IconLeaf className="h-3.5 w-3.5" />}>
            {t("heroTag")}
          </EcoBadge>
        </div>

        <h1
          id="hero-heading"
          className="font-display text-3xl font-extrabold leading-[1.15] tracking-tight text-ink [overflow-wrap:anywhere] sm:text-4xl md:text-5xl"
        >
          {t("heroTitle1")} <br className="hidden sm:inline" />
          <span className="text-primary underline decoration-yellow decoration-4 underline-offset-6">
            {t.rich("heroTitle2", {
              warm: (chunks) => <span className="text-warm-600">{chunks}</span>,
            })}
          </span>
        </h1>

        <p className="mt-5 max-w-prose text-base leading-relaxed text-muted sm:text-lg">
          {t("heroDesc")}
        </p>

        <div className="mt-8 flex min-w-0 flex-wrap items-center gap-3.5">
          <Link
            href="/ban-phe-lieu"
            className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-warm-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-warm-900"
          >
            <span>{t("sellAction")}</span>
            <IconArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/dong-gop"
            className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-edge bg-card px-6 py-3 text-base font-semibold text-ink transition-colors hover:border-primary/40 hover:bg-mint-surface/40"
          >
            <span>{t("reportAction")}</span>
          </Link>
          <Link
            href="/cho-online"
            className="inline-flex min-h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-3 text-sm font-semibold text-primary transition-colors hover:text-primary-hover hover:underline"
          >
            <IconSparkles className="h-4 w-4" />
            <span>{t("exploreMarketplace")}</span>
          </Link>
        </div>

        {/* One shield icon repeated three times said nothing three times. The
            rules already separate the claims; the text carries them. */}
        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
          <span>{t("prop1")}</span>
          <span className="h-3.5 w-px bg-edge" aria-hidden="true" />
          <span>{t("prop2")}</span>
          <span className="h-3.5 w-px bg-edge" aria-hidden="true" />
          <span>{t("prop3")}</span>
        </div>
      </div>
    </section>
  );
}
