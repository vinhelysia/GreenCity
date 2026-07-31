import Link from "next/link";


import { EcoBadge } from "@/components/eco-badge";
import { EcoCityHeroIllustration } from "@/components/eco-city-hero-illustration";
import { IconArrowRight, IconLeaf, IconRecycle, IconShieldCheck } from "@/components/eco-icons";


/**
 * Modern Eco Marketplace Hero Section.
 * Split-layout desktop, stacked mobile, with a controlled local illustration.
 */
export function HomeHero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="grid min-w-0 grid-cols-1 items-center gap-10 pb-12 pt-4 sm:pb-16 lg:grid-cols-12 lg:gap-8"
    >
      <div className="min-w-0 lg:col-span-7 space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <EcoBadge variant="mint" icon={<IconLeaf className="h-3.5 w-3.5" />}>
            Nền tảng tái chế cộng đồng
          </EcoBadge>
          <EcoBadge variant="yellow" icon={<IconShieldCheck className="h-3.5 w-3.5 text-coral" />}>
            Minh bạch &amp; Trực tiếp
          </EcoBadge>
        </div>

        <h1
          id="hero-heading"
          className="font-display text-3.5xl font-extrabold leading-[1.15] tracking-tight text-ink [overflow-wrap:anywhere] sm:text-4xl md:text-5xl"
        >
          Rác có người mua. Điểm rác có người báo.
        </h1>

        <p className="max-w-prose text-base leading-relaxed text-muted sm:text-lg">
          GreenCity kết nối người bán phế liệu, người mua và cộng đồng trong một nền tảng minh bạch, thuận tiện và dễ sử dụng. Bán phế liệu tái chế theo giá niêm yết hoặc báo điểm rác để nhận điểm thưởng.
        </p>

        <div className="flex min-w-0 flex-wrap items-center gap-3 pt-2">
          <Link
            href="/cho-online"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-eco transition duration-quick ease-out hover:bg-primary-hover hover:shadow-eco-hover hover:-translate-y-0.5"
          >
            <span>Khám phá chợ tái chế</span>
            <IconArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/ban-phe-lieu"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-edge bg-card px-6 py-3 text-sm font-semibold text-ink shadow-eco-sm transition duration-quick ease-out hover:border-primary hover:text-primary hover:-translate-y-0.5"
          >
            <IconRecycle className="h-4 w-4 text-primary" />
            <span>Bán phế liệu</span>
          </Link>
          <Link
            href="/dong-gop"
            className="inline-flex min-h-12 items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium text-muted underline-offset-4 hover:text-primary hover:underline"
          >
            <span>Báo điểm rác</span>
          </Link>
        </div>
      </div>

      <div className="min-w-0 lg:col-span-5 relative">
        {/* Main Vector Hero Visual Shell */}
        <div className="relative overflow-hidden rounded-2xl border border-edge/80 bg-card p-3 shadow-eco transition hover:shadow-eco-hover">
          <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-mint-surface/40">
            <EcoCityHeroIllustration />
          </div>
          {/* Controlled content only: report photos remain in the moderated report feed. */}
          <div className="mt-3 rounded-lg border border-edge bg-paper p-3 shadow-eco-sm">
            <EcoBadge variant="mint" icon={<IconShieldCheck className="h-3.5 w-3.5" />}>
              Marketplace · Báo điểm rác · Điểm thưởng
            </EcoBadge>
          </div>
        </div>
      </div>
    </section>
  );
}
