import Image from "next/image";
import Link from "next/link";
import { EcoBadge } from "./eco-badge";
import { IconArrowRight, IconLeaf, IconShieldCheck, IconSparkles } from "./eco-icons";

/**
 * Opening hero section — Server Component.
 * Proposition over a controlled, decorative eco-city panorama.
 * Exact H1: "Rác có người mua. Điểm rác có người báo."
 */
export function HomeHero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="home-hero relative isolate min-w-0 overflow-hidden rounded-[2rem] border border-edge px-5 py-10 shadow-eco sm:px-8 sm:py-14 lg:min-h-[38rem] lg:px-12 lg:py-16"
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
            Nền tảng sinh thái số GreenCity
          </EcoBadge>
        </div>

        <h1
          id="hero-heading"
          className="font-display text-3.5xl font-extrabold leading-[1.15] tracking-tight text-ink [overflow-wrap:anywhere] sm:text-4xl md:text-5xl"
        >
          Rác có người mua. <br className="hidden sm:inline" />
          <span className="text-primary underline decoration-yellow decoration-4 underline-offset-6">
            Điểm rác có người báo.
          </span>
        </h1>

        <p className="mt-5 max-w-prose text-base leading-relaxed text-muted sm:text-lg">
          GreenCity kết nối hai hoạt động bảo vệ môi trường: bán phế liệu theo giá
          niêm yết minh bạch và báo cáo điểm rác tự phát để cộng đồng ghi nhận,
          xác minh.
        </p>

        <div className="mt-8 flex min-w-0 flex-wrap items-center gap-3.5">
          <Link
            href="/ban-phe-lieu"
            className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-6 py-3 text-base font-semibold text-white shadow-eco transition-colors hover:bg-primary-hover"
          >
            <span>Bán phế liệu</span>
            <IconArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/dong-gop"
            className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-edge bg-card px-6 py-3 text-base font-semibold text-ink shadow-eco-sm transition-colors hover:border-primary/40 hover:bg-mint-surface/40"
          >
            <span>Báo điểm rác</span>
          </Link>
          <Link
            href="/cho-online"
            className="inline-flex min-h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-3 text-sm font-semibold text-primary transition-colors hover:text-primary-hover hover:underline"
          >
            <IconSparkles className="h-4 w-4" />
            <span>Khám phá chợ online</span>
          </Link>
        </div>

        {/* Value Micro-props */}
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-edge pt-5 text-xs font-semibold text-muted">
          <span className="inline-flex items-center gap-1.5">
            <IconShieldCheck className="h-4 w-4 text-primary" />
            Giá phế liệu niêm yết
          </span>
          <span className="inline-flex items-center gap-1.5">
            <IconShieldCheck className="h-4 w-4 text-primary" />
            Báo cáo được duyệt thực tế
          </span>
          <span className="inline-flex items-center gap-1.5">
            <IconShieldCheck className="h-4 w-4 text-primary" />
            Điểm thưởng truy ngược được nguồn
          </span>
        </div>
      </div>

    </section>
  );
}
