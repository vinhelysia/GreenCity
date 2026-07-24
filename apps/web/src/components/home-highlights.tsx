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
} from "@/lib/api";
import { formatVnd } from "@/lib/format";

type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

const viFormatter = new Intl.NumberFormat("vi-VN");

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

  return (
    <div className="min-w-0">
      {/* Impact — a tinted band, not another bordered card. Every number here is
          a live count from the database. */}
      <Section
        id="tac-dong"
        title="Tác động đến nay"
        tone="band"
        lede="Số liệu đọc thẳng từ hệ thống đang chạy. Không có con số nào dựng sẵn."
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
                  label: "tin đang bán",
                },
                {
                  value: statsState.data.verifiedCleanupReports,
                  label: "điểm rác đã dọn",
                },
                { value: statsState.data.scrapWeightKg, label: "kg phế liệu" },
                {
                  value: statsState.data.totalPointsAwarded,
                  label: "điểm thưởng đã trao",
                },
              ].map((tile) => (
                <div key={tile.label} className="min-w-0">
                  <dd className="font-display text-4xl font-bold leading-none tracking-tight tabular-nums text-accent [overflow-wrap:anywhere] sm:text-5xl">
                    {viFormatter.format(tile.value)}
                  </dd>
                  <span
                    aria-hidden="true"
                    className="mt-3 block h-1 w-8 rounded-full bg-highlight"
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

      {/* Listings lead with type and price — what a buyer actually scans for. */}
      <Section
        id="tin-dang-noi-bat"
        title="Đang bán trên chợ"
        tone="open"
        lede="Giá niêm yết theo khung công khai của từng loại phế liệu."
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
            <div className="min-w-0 space-y-5">
              {/* One hairline grid, not four floating cards. */}
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
                        {formatVnd(listing.buyerPricePerKgVnd)}/kg
                      </p>
                    </div>
                    <p className="font-display text-xl font-bold tabular-nums text-ink">
                      {formatVnd(listing.estimatedTotalVnd)}
                    </p>
                  </li>
                ))}
              </ul>
              <Link
                href="/cho-online"
                className="inline-flex items-center whitespace-nowrap text-sm font-medium text-accent underline-offset-4 hover:underline"
              >
                Xem tất cả trên Chợ online &rarr;
              </Link>
            </div>
          )}
        </div>
      </Section>

      {/* Cleanup leads with the photograph — here the image IS the evidence. */}
      <Section
        id="diem-rac-da-don"
        title="Điểm rác đã được dọn"
        tone="ruled"
        lede="Người dân gửi ảnh, ban quản lý xác minh. Chỉ báo cáo đã xác minh mới hiện ở đây."
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
              title="Chưa có báo cáo điểm rác đã dọn"
              description="Các điểm rác được người dân báo cáo và ban quản lý xác minh dọn dẹp sẽ xuất hiện tại đây."
            />
          ) : (
            <ul className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {/* The hero already shows the newest report, so start after it —
                  unless it is the only one, where repeating beats an empty grid. */}
              {(cleanupState.data.length > 1
                ? cleanupState.data.slice(1, 4)
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
                      {place ? `${place} · ` : ""}xác minh{" "}
                      {new Date(report.verifiedAt).toLocaleDateString("vi-VN")}
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
