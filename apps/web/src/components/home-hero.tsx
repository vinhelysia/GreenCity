"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { PublicCleanupReport } from "@greencity/shared";
import { fetchPublicCleanupReports } from "@/lib/api";

/**
 * Hallmark · existing macrostructure: Narrative Workflow
 * enrichment: E8 generated editorial backdrop + verified documentary inset
 * generated: OpenAI imagegen · post-processed to local WebP
 *
 * The generated image sets the civic/nature mood but never replaces evidence:
 * the latest verified community report remains the foreground photograph.
 */
export function HomeHero() {
  const [report, setReport] = useState<PublicCleanupReport | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchPublicCleanupReports();
      if (cancelled || !res.ok) return;
      setReport(res.data.reports[0] ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const place = report
    ? [report.district, report.city].filter(Boolean).join(", ")
    : null;

  return (
    <section
      aria-labelledby="hero-heading"
      className="grid min-w-0 grid-cols-1 items-center gap-8 pb-10 sm:pb-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-12"
    >
      <div className="min-w-0">
        <h1
          id="hero-heading"
          className="font-display text-3xl font-semibold leading-tight tracking-tight text-ink [overflow-wrap:anywhere] sm:text-4xl md:text-[2.75rem]"
        >
          Rác có người mua. Điểm rác có người báo.
        </h1>
        <p className="mt-5 max-w-prose text-base leading-relaxed text-muted sm:text-lg">
          GreenCity nối hai việc vốn rời nhau: bán phế liệu tái chế theo giá
          niêm yết và báo điểm rác tự phát để được ghi nhận, xác minh. Làm xong
          việc nào bạn cũng được cộng điểm thưởng.
        </p>

        <div className="mt-7 flex min-w-0 flex-wrap items-center gap-3">
          <Link
            href="/ban-phe-lieu"
            className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-paper transition-opacity duration-quick ease-out hover:opacity-90"
          >
            Bán phế liệu
          </Link>
          <Link
            href="/dong-gop"
            className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md border border-edge bg-paper px-5 py-2.5 text-sm font-medium text-ink transition-colors duration-quick ease-out hover:border-accent"
          >
            Báo điểm rác
          </Link>
        </div>
      </div>

      <div className="relative min-h-[22rem] min-w-0 overflow-hidden rounded-md bg-paper-3 sm:min-h-[26rem] lg:min-h-[30rem]">
        <Image
          src="/images/home-hero-green-city.webp"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 45vw, 100vw"
          className="object-cover object-[58%_center]"
        />

        {report ? (
          <figure className="absolute bottom-4 left-4 right-10 min-w-0 sm:bottom-6 sm:left-6 sm:right-20">
            <div className="aspect-[16/10] w-full overflow-hidden border border-paper bg-paper-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api${report.photoPath}`}
                alt=""
                fetchPriority="high"
                className="h-full w-full object-cover"
              />
            </div>
            <figcaption className="mt-2 max-w-prose bg-paper px-2 py-1 text-xs leading-relaxed text-muted">
              Điểm rác do người dân báo, đã được xác minh
              {place ? <> tại {place}</> : null}.
            </figcaption>
          </figure>
        ) : null}
      </div>
    </section>
  );
}
