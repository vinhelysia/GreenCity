"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type {
  HomeStats,
  MarketplaceListing,
  PublicCleanupReport,
} from "@greencity/shared";
import { CountUp } from "@/components/count-up";
import { EmptyState } from "@/components/empty-state";
import { Section } from "@/components/section";
import { Link } from "@/i18n/routing";
import {
  fetchHomeStats,
  fetchMarketplaceListings,
  fetchPublicCleanupReports,
} from "@/lib/api";
import { formatDate, formatVnd } from "@/lib/format";

type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

export function HomeHighlights() {
  const locale = useLocale();
  const tHome = useTranslations("home");
  const tHighlights = useTranslations("home.highlights");
  const tCommon = useTranslations("common");

  const [statsState, setStatsState] = useState<LoadState<HomeStats>>({
    status: "loading",
  });
  const [listingsState, setListingsState] = useState<
    LoadState<MarketplaceListing[]>
  >({ status: "loading" });
  const [cleanupState, setCleanupState] = useState<
    LoadState<PublicCleanupReport[]>
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const res = await fetchHomeStats();
      if (cancelled) return;
      if (!res.ok) {
        setStatsState({
          status: "error",
          message: "Không thể tải số liệu thống kê.",
        });
      } else {
        setStatsState({ status: "ready", data: res.data });
      }
    })();

    void (async () => {
      const res = await fetchMarketplaceListings();
      if (cancelled) return;
      if (!res.ok) {
        setListingsState({
          status: "error",
          message: "Không thể tải danh sách tin đăng.",
        });
      } else {
        setListingsState({ status: "ready", data: res.data.listings });
      }
    })();

    void (async () => {
      const res = await fetchPublicCleanupReports();
      if (cancelled) return;
      if (!res.ok) {
        setCleanupState({
          status: "error",
          message: "Chưa có báo cáo điểm rác nào được xác minh.",
        });
      } else {
        setCleanupState({ status: "ready", data: res.data.reports });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-w-0">
      <Section
        id="tac-dong"
        title={locale === "en" ? "Impact to Date" : "Tác động đến nay"}
        tone="band"
        lede={
          locale === "en"
            ? "Live operational stats recorded directly from our system."
            : "Số liệu đọc thẳng từ hệ thống đang chạy. Không có con số nào dựng sẵn."
        }
      >
        <div role="status" aria-live="polite">
          {statsState.status === "loading" ? (
            <div
              aria-hidden="true"
              className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4"
            >
              <div className="skeleton h-16 w-full" />
              <div className="skeleton h-16 w-full" />
              <div className="skeleton h-16 w-full" />
              <div className="skeleton h-16 w-full" />
            </div>
          ) : statsState.status === "error" ? (
            <p role="alert" className="text-sm leading-relaxed text-red-800">
              {statsState.message}
            </p>
          ) : (
            <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
              {[
                {
                  value: statsState.data.availableListings,
                  label: locale === "en" ? "active material listings" : "tin đang bán",
                },
                {
                  value: statsState.data.verifiedCleanupReports,
                  label: locale === "en" ? "verified dumping sites" : "điểm rác đã xác minh",
                },
                {
                  value: statsState.data.scrapWeightKg,
                  label: locale === "en" ? "kg scrap listed" : "kg phế liệu đã niêm yết",
                },
                {
                  value: statsState.data.totalPointsAwarded,
                  label: locale === "en" ? "reward points issued" : "điểm thưởng đã trao",
                },
              ].map((tile) => (
                <div key={tile.label} className="min-w-0 rounded-2xl border border-edge bg-card p-5 shadow-eco">
                  <dd>
                    <CountUp
                      value={tile.value}
                      className="block font-display text-4xl font-bold leading-none tracking-tight tabular-nums text-primary [overflow-wrap:anywhere] sm:text-5xl"
                    />
                  </dd>
                  <span
                    aria-hidden="true"
                    className="mt-3 block h-1 w-8 rounded-full bg-yellow"
                  />
                  <dt className="mt-3 text-sm font-medium text-muted">
                    {tile.label}
                  </dt>
                </div>
              ))}
            </dl>
          )}
        </div>
      </Section>

      <Section
        id="tin-dang-noi-bat"
        title={locale === "en" ? "Available on Marketplace" : "Đang bán trên chợ"}
        tone="open"
        lede={
          locale === "en"
            ? "Published pricing based on transparent rate bands for each material category."
            : "Giá niêm yết theo khung công khai của từng loại phế liệu."
        }
      >
        <div role="status" aria-live="polite" className="min-w-0">
          {listingsState.status === "loading" ? (
            <div
              aria-hidden="true"
              className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-edge bg-rule sm:grid-cols-2"
            >
              <div className="skeleton h-28 w-full" />
              <div className="skeleton h-28 w-full" />
            </div>
          ) : listingsState.status === "error" ? (
            <EmptyState
              testId="featured-listings-error"
              title={locale === "en" ? "Unable to load listings" : "Không thể tải tin đăng"}
              description={listingsState.message}
            />
          ) : listingsState.data.length === 0 ? (
            <EmptyState
              testId="featured-listings-empty"
              title={locale === "en" ? "No listings available" : "Chưa có tin đăng nào"}
              description={tHighlights("noListings")}
            />
          ) : (
            <div className="min-w-0 space-y-5">
              <ul className="grid min-w-0 grid-cols-1 gap-px overflow-hidden rounded-md border border-edge bg-rule sm:grid-cols-2">
                {listingsState.data.slice(0, 4).map((listing) => (
                  <li
                    key={listing.id}
                    className="flex min-w-0 flex-col justify-between gap-3 bg-paper p-5"
                  >
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-semibold tracking-tight text-ink">
                        {listing.categoryName}
                      </h3>
                      <p className="mt-1 text-sm tabular-nums text-muted">
                        {listing.estimatedWeightKg}kg ·{" "}
                        {formatVnd(listing.buyerPricePerKgVnd, locale)}
                        {tCommon("perKg")}
                      </p>
                    </div>
                    <p className="font-display text-xl font-bold tabular-nums text-ink">
                      {formatVnd(listing.estimatedTotalVnd, locale)}
                    </p>
                  </li>
                ))}
              </ul>
              <Link
                href="/cho-online"
                className="inline-flex items-center whitespace-nowrap text-sm font-medium text-primary hover:underline"
              >
                {locale === "en" ? "View all on Marketplace →" : "Xem tất cả trên Chợ online →"}
              </Link>
            </div>
          )}
        </div>
      </Section>

      <Section
        id="diem-rac-da-don"
        title={locale === "en" ? "Verified Dumping Sites" : "Điểm rác đã được xác minh"}
        tone="ruled"
        lede={
          locale === "en"
            ? "Citizens submit photo evidence, which management verifies against local reports."
            : "Người dân gửi ảnh, ban quản lý đối chiếu và xác nhận là có thật. Việc thu gom do đơn vị vệ sinh của địa phương thực hiện, GreenCity chưa điều phối phần đó."
        }
        className="mt-12 sm:mt-16"
      >
        <div role="status" aria-live="polite" className="min-w-0">
          {cleanupState.status === "loading" ? (
            <div
              aria-hidden="true"
              className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
            >
              <div className="skeleton h-56 w-full" />
              <div className="skeleton h-56 w-full" />
              <div className="skeleton h-56 w-full" />
            </div>
          ) : cleanupState.status === "error" ||
            cleanupState.data.length === 0 ? (
            <EmptyState
              testId="public-cleanup-reports-empty"
              title={locale === "en" ? "No verified reports yet" : "Chưa có báo cáo nào được xác minh"}
              description={tHighlights("noReports")}
            />
          ) : (
            <ul className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2">
              {(cleanupState.data.length > 1
                ? cleanupState.data.slice(1, 3)
                : cleanupState.data
              ).map((report) => {
                const place = [report.district, report.city]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <li key={report.id} className="min-w-0">
                    <div className="aspect-[4/3] w-full overflow-hidden rounded-md border border-edge bg-paper-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api${report.photoPath}`}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <p className="mt-3 text-sm font-medium leading-relaxed text-ink">
                      {report.description}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {place ? `${place} · ` : ""}
                      {locale === "en" ? "verified " : "xác minh "}
                      {formatDate(report.verifiedAt, locale)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Section>
    </div>
  );
}
