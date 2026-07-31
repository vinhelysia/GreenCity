"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  HomeStats,
  MarketplaceListing,
  PublicCleanupReport,
} from "@greencity/shared";
import { CountUp } from "@/components/count-up";
import { EcoBadge } from "@/components/eco-badge";
import {
  IconArrowRight,
  IconDumpster,
  IconLeaf,
  IconPackage,
  IconPoints,
  IconRecycle,
} from "@/components/eco-icons";
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
    <div className="min-w-0 space-y-12 sm:space-y-16">
      {/* Impact Section — Modern Eco Metrics Cards */}
      <Section
        id="tac-dong"
        title="Tác động đến nay"
        tone="band"
        lede="Số liệu cập nhật trực tiếp từ hệ thống thực tế đang hoạt động của GreenCity."
      >
        <div role="status" aria-live="polite">
          {statsState.status === "loading" ? (
            <div
              aria-hidden="true"
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              <div className="skeleton h-24 w-full rounded-xl" />
              <div className="skeleton h-24 w-full rounded-xl" />
              <div className="skeleton h-24 w-full rounded-xl" />
              <div className="skeleton h-24 w-full rounded-xl" />
            </div>
          ) : statsState.status === "error" ? (
            <p role="alert" className="text-sm leading-relaxed text-red-800">
              {statsState.message}
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  value: statsState.data.availableListings,
                  label: "Tin đang bán trên chợ",
                  icon: <IconPackage className="h-5 w-5 text-primary" />,
                  badge: "Đang niêm yết",
                },
                {
                  value: statsState.data.verifiedCleanupReports,
                  label: "Điểm rác đã xác minh",
                  icon: <IconDumpster className="h-5 w-5 text-coral" />,
                  badge: "Cộng đồng báo",
                },
                {
                  value: statsState.data.scrapWeightKg,
                  label: "kg phế liệu đã niêm yết",
                  icon: <IconRecycle className="h-5 w-5 text-primary" />,
                  badge: "Khối lượng",
                },
                {
                  value: statsState.data.totalPointsAwarded,
                  label: "Điểm thưởng đã trao",
                  icon: <IconPoints className="h-5 w-5 text-coral" />,
                  badge: "Ghi nhận",
                },
              ].map((tile) => (
                <li
                  key={tile.label}
                  className="group min-w-0 rounded-xl border border-edge bg-card p-5 shadow-eco-sm transition duration-quick hover:border-primary/40 hover:shadow-eco hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-mint-surface">
                      {tile.icon}
                    </span>
                    <EcoBadge variant="mint" className="text-[10px] px-2 py-0.5">
                      {tile.badge}
                    </EcoBadge>
                  </div>
                  <p className="mt-4">
                    <CountUp
                      value={tile.value}
                      className="block font-display text-3xl font-extrabold leading-none tracking-tight tabular-nums text-ink [overflow-wrap:anywhere] sm:text-4xl"
                    />
                  </p>
                  <p className="mt-2 text-xs font-semibold text-muted">
                    {tile.label}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      {/* Featured Marketplace Section */}
      <Section
        id="tin-dang-noi-bat"
        title="Đang bán trên chợ"
        tone="open"
        lede="Các lô phế liệu tái chế được niêm yết với mức giá minh bạch."
      >
        <div role="status" aria-live="polite" className="min-w-0">
          {listingsState.status === "loading" ? (
            <div
              aria-hidden="true"
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              <div className="skeleton h-36 w-full rounded-xl" />
              <div className="skeleton h-36 w-full rounded-xl" />
              <div className="skeleton h-36 w-full rounded-xl" />
              <div className="skeleton h-36 w-full rounded-xl" />
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
            <div className="min-w-0 space-y-6">
              <ul className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {listingsState.data.slice(0, 4).map((listing) => (
                  <li
                    key={listing.id}
                    className="flex min-w-0 flex-col justify-between gap-3 rounded-xl border border-edge bg-card p-5 shadow-eco-sm transition duration-quick hover:border-primary/40 hover:shadow-eco hover:-translate-y-0.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <EcoBadge variant="mint" className="text-[11px]">
                          {listing.categoryName}
                        </EcoBadge>
                        <span className="text-xs font-semibold text-primary">
                          Khu vực sẵn sàng
                        </span>
                      </div>
                      <p className="text-sm font-medium tabular-nums text-muted">
                        Khối lượng: <strong className="text-ink">{listing.estimatedWeightKg} kg</strong>
                      </p>
                      <p className="mt-1 text-xs tabular-nums text-muted">
                        Đơn giá: {formatVnd(listing.buyerPricePerKgVnd)}/kg
                      </p>
                    </div>
                    <div className="border-t border-edge/60 pt-3">
                      <p className="text-xs font-medium text-muted">Tổng ước tính</p>
                      <p className="font-display text-xl font-bold tabular-nums text-primary">
                        {formatVnd(listing.estimatedTotalVnd)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="pt-2">
                <Link
                  href="/cho-online"
                  className="inline-flex items-center gap-2 rounded-lg bg-mint-surface px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white"
                >
                  <span>Xem tất cả phế liệu trên Chợ online</span>
                  <IconArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* Verified Cleanup Reports Section */}
      <Section
        id="diem-rac-da-don"
        title="Điểm rác đã được xác minh"
        tone="ruled"
        lede="Ảnh chụp thực tế từ người dân báo cáo, được ban quản lý đối chiếu và ghi nhận điểm thưởng."
      >
        <div role="status" aria-live="polite" className="min-w-0">
          {cleanupState.status === "loading" ? (
            <div
              aria-hidden="true"
              className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
            >
              <div className="skeleton h-60 w-full rounded-xl" />
              <div className="skeleton h-60 w-full rounded-xl" />
            </div>
          ) : cleanupState.status === "error" ||
            cleanupState.data.length === 0 ? (
            <EmptyState
              testId="public-cleanup-reports-empty"
              title="Chưa có báo cáo nào được xác minh"
              description="Báo cáo điểm rác sau khi được ban quản lý xác minh là có thật sẽ xuất hiện tại đây."
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
                  <li
                    key={report.id}
                    className="group min-w-0 overflow-hidden rounded-xl border border-edge bg-card shadow-eco-sm transition hover:border-primary/40 hover:shadow-eco"
                  >
                    <div className="aspect-[16/9] w-full overflow-hidden bg-paper-3 relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api${report.photoPath}`}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute top-3 left-3">
                        <EcoBadge variant="primary" icon={<IconLeaf className="h-3 w-3" />}>
                          Đã xác minh
                        </EcoBadge>
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="text-sm font-semibold leading-relaxed text-ink line-clamp-2">
                        {report.description}
                      </p>
                      <p className="mt-2 text-xs font-medium text-muted">
                        {place ? `Vị trí: ${place} · ` : ""}
                        Ngày xác minh:{" "}
                        {new Date(report.verifiedAt).toLocaleDateString("vi-VN")}
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
