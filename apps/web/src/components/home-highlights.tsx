"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  HomeStats,
  MarketplaceListing,
  PublicCleanupReport,
} from "@greencity/shared";
import { EmptyState } from "@/components/empty-state";
import { Section } from "@/components/section";
import {
  fetchHomeStats,
  fetchMarketplaceListings,
  fetchPublicCleanupReports,
  mediaUrl,
} from "@/lib/api";
import { formatVnd } from "@/lib/format";

type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

export function HomeHighlights() {
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
        // Graceful error/empty state when endpoint 404s or fails
        setCleanupState({
          status: "error",
          message: "Chưa có báo cáo điểm rác đã dọn.",
        });
      } else {
        setCleanupState({ status: "ready", data: res.data.reports });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const viFormatter = new Intl.NumberFormat("vi-VN");

  return (
    <div className="min-w-0 space-y-8">
      {/* 1. Impact Strip */}
      <section
        aria-labelledby="impact-stats-heading"
        className="min-w-0 rounded-lg border border-rule bg-paper-2 px-5 py-6 sm:px-7 sm:py-7"
      >
        <h2
          id="impact-stats-heading"
          className="font-display text-xs font-semibold uppercase tracking-widest text-accent"
        >
          Tác động đến nay
        </h2>
        <div role="status" aria-live="polite" className="mt-5">
          {statsState.status === "loading" ? (
            <div
              aria-hidden="true"
              className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-4"
            >
              <div className="skeleton h-16 w-full" />
              <div className="skeleton h-16 w-full" />
              <div className="skeleton h-16 w-full" />
            </div>
          ) : statsState.status === "error" ? (
            <p role="alert" className="text-sm leading-relaxed text-red-800">
              {statsState.message}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-4">
              {[
                {
                  value: statsState.data.availableListings,
                  label: "tin đang bán",
                },
                {
                  value: statsState.data.verifiedCleanupReports,
                  label: "điểm rác đã dọn",
                },
                {
                  value: statsState.data.scrapWeightKg,
                  label: "kg phế liệu",
                },
              ].map((tile) => (
                <div key={tile.label} className="min-w-0">
                  <p className="font-display text-4xl font-bold leading-none tracking-tight text-accent [overflow-wrap:anywhere] sm:text-5xl">
                    {viFormatter.format(tile.value)}
                  </p>
                  <span
                    aria-hidden="true"
                    className="mt-3 block h-1 w-8 rounded-full bg-highlight"
                  />
                  <p className="mt-3 text-sm font-medium text-muted">
                    {tile.label}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 2. Tin đăng nổi bật */}
      <Section id="tin-dang-noi-bat" title="Tin đăng nổi bật">
        <div role="status" aria-live="polite" className="min-w-0">
          {listingsState.status === "loading" ? (
            <div aria-hidden="true" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="skeleton h-32 w-full" />
              <div className="skeleton h-32 w-full" />
            </div>
          ) : listingsState.status === "error" ? (
            <EmptyState
              testId="featured-listings-error"
              title="Không thể tải tin đăng"
              description={listingsState.message}
            />
          ) : listingsState.data.length === 0 ? (
            <EmptyState
              testId="featured-listings-empty"
              title="Chưa có tin đăng nào"
              description="Hiện chưa có tin đăng bán phế liệu nào khả dụng."
            />
          ) : (
            <div className="min-w-0 space-y-4">
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {listingsState.data.slice(0, 4).map((listing) => (
                  <li
                    key={listing.id}
                    className="flex min-w-0 gap-3 rounded-md border border-edge bg-paper p-4"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={mediaUrl(listing.mediaDownloadPath)}
                      alt=""
                      className="h-20 w-20 shrink-0 rounded-md border border-edge object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">
                        {listing.categoryName}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        Khối lượng: {listing.estimatedWeightKg}kg
                      </p>
                      <p className="text-sm text-muted">
                        Giá mua: {formatVnd(listing.buyerPricePerKgVnd)}/kg
                      </p>
                      <p className="mt-1 text-sm font-semibold text-ink">
                        Ước tính: {formatVnd(listing.estimatedTotalVnd)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="pt-2">
                <Link
                  href="/cho-online"
                  className="inline-flex items-center text-sm font-medium text-accent underline-offset-4 hover:underline"
                >
                  Xem tất cả tin đăng trên Chợ online &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* 3. Điểm rác đã được dọn */}
      <Section id="diem-rac-da-don" title="Điểm rác đã được dọn">
        <div role="status" aria-live="polite" className="min-w-0">
          {cleanupState.status === "loading" ? (
            <div aria-hidden="true" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="skeleton h-32 w-full" />
              <div className="skeleton h-32 w-full" />
            </div>
          ) : cleanupState.status === "error" ||
            cleanupState.data.length === 0 ? (
            <EmptyState
              testId="public-cleanup-reports-empty"
              title="Chưa có báo cáo điểm rác đã dọn"
              description="Các điểm rác được người dân báo cáo và ban quản lý xác minh dọn dẹp sẽ xuất hiện tại đây."
            />
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {cleanupState.data.map((report) => {
                const locationText = [report.district, report.city]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <li
                    key={report.id}
                    className="flex min-w-0 gap-3 rounded-md border border-edge bg-paper p-4"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api${report.photoPath}`}
                      alt=""
                      className="h-20 w-20 shrink-0 rounded-md border border-edge object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">
                        {report.description}
                      </p>
                      {locationText ? (
                        <p className="mt-1 text-sm text-muted">
                          Khu vực: {locationText}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted">
                        Đã xác minh:{" "}
                        {new Date(report.verifiedAt).toLocaleDateString(
                          "vi-VN",
                        )}
                      </p>
                    </div>
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
