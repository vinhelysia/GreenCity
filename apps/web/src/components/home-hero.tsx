"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PublicCleanupReport } from "@greencity/shared";
import { fetchPublicCleanupReports } from "@/lib/api";

/**
 * Opening panel. Asymmetric on purpose — the proposition holds the left column
 * and a documented dump site holds the right, so the page opens on the problem
 * rather than on a centred slogan.
 *
 * The photograph is whichever cleanup report was verified most recently, so it
 * is never a stock image and never a hardcoded id. Its box keeps its aspect
 * ratio while loading, so nothing shifts when the image arrives.
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
      className="grid min-w-0 grid-cols-1 items-start gap-8 pb-10 sm:pb-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-12"
    >
      <div className="min-w-0">
        <h1
          id="hero-heading"
          className="font-display text-3xl font-semibold leading-tight tracking-tight text-ink [overflow-wrap:anywhere] sm:text-4xl md:text-[2.75rem]"
        >
          Rác có người mua. Điểm rác có người dọn.
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

      <figure className="min-w-0">
        <div className="aspect-[4/3] w-full overflow-hidden rounded-md border border-edge bg-paper-3">
          {report ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={`/api${report.photoPath}`}
              alt=""
              fetchPriority="high"
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <figcaption className="mt-2 text-xs leading-relaxed text-muted">
          {report ? (
            <>
              Điểm rác do người dân báo, đã được xác minh
              {place ? <> tại {place}</> : null}.
            </>
          ) : (
            "Ảnh điểm rác do người dân gửi, hiển thị sau khi được xác minh."
          )}
        </figcaption>
      </figure>
    </section>
  );
}
