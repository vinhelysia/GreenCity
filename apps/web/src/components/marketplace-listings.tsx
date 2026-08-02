"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import type { MarketplaceListing } from "@greencity/shared";
import { useAuth } from "@/components/auth-provider";
import {
  BuyerPassPanel,
  type SubscriptionLoad,
} from "@/components/buyer-pass-panel";
import { EcoBadge } from "@/components/eco-badge";
import { EmptyState } from "@/components/empty-state";
import { Link } from "@/i18n/routing";
import {
  checkAuthExpiry,
  fetchMarketplaceListings,
  fetchSubscriptionState,
  marketplaceErrorMessage,
  reserveListing,
} from "@/lib/api";
import { formatCategoryName, formatVnd } from "@/lib/format";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: MarketplaceListing[] };

export function MarketplaceListings() {
  const locale = useLocale();
  const tMkt = useTranslations("marketplace");
  const { status: authStatus, clearSessionAndRedirect } = useAuth();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [load, setLoad] = useState<SubscriptionLoad>({ kind: "loading" });
  const eligible: "unknown" | "error" | "eligible" | "not-eligible" =
    authStatus !== "authenticated"
      ? "unknown"
      : load.kind === "error"
        ? "error"
        : load.kind === "loading"
          ? "unknown"
          : load.state.eligible
            ? "eligible"
            : "not-eligible";

  const loadListings = useCallback(async () => {
    setState({ status: "loading" });
    const result = await fetchMarketplaceListings();
    if (!result.ok) {
      setState({ status: "error", message: marketplaceErrorMessage(result.error, locale) });
      return;
    }
    setState({ status: "ready", data: result.data.listings });
  }, [locale]);

  useEffect(() => {
    void loadListings();
  }, [loadListings]);

  const [subscriptionRun, setSubscriptionRun] = useState(0);
  const refreshSubscription = useCallback(() => {
    setSubscriptionRun((n) => n + 1);
  }, []);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setLoad({ kind: "loading" });
      return;
    }
    let cancelled = false;
    (async () => {
      setLoad({ kind: "loading" });
      const result = checkAuthExpiry(
        await fetchSubscriptionState(),
        clearSessionAndRedirect,
      );
      if (cancelled) return;
      setLoad(
        result.ok ? { kind: "ready", state: result.data } : { kind: "error" },
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [authStatus, clearSessionAndRedirect, subscriptionRun]);

  return (
    <div className="min-w-0 space-y-6">
      <BuyerPassPanel load={load} onSubscriptionChange={refreshSubscription} />

      <div role="status" aria-live="polite" className="min-w-0">
        {state.status === "loading" ? (
          <div aria-hidden="true" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="skeleton h-64 w-full" />
            <div className="skeleton h-64 w-full" />
            <div className="skeleton h-64 w-full" />
          </div>
        ) : state.status === "error" ? (
          <p role="alert" className="text-sm leading-relaxed text-red-800">
            {state.message}
          </p>
        ) : state.data.length === 0 ? (
          <EmptyState
            testId="cho-online-listings-empty"
            title={locale === "en" ? "No listings available" : "Chưa có tin đăng"}
            description={tMkt("noListings")}
          />
        ) : (
          <ul className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {state.data.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                authStatus={authStatus}
                eligible={eligible}
                clearSessionAndRedirect={clearSessionAndRedirect}
                onReserved={loadListings}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ListingCard({
  listing,
  authStatus,
  eligible,
  clearSessionAndRedirect,
  onReserved,
}: {
  listing: MarketplaceListing;
  authStatus: "loading" | "authenticated" | "unauthenticated";
  eligible: "unknown" | "error" | "eligible" | "not-eligible";
  clearSessionAndRedirect: () => void;
  onReserved: () => void;
}) {
  const locale = useLocale();
  const tMkt = useTranslations("marketplace");
  const [reserving, setReserving] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  async function onReserve() {
    setReserving(true);
    setRowError(null);
    const result = checkAuthExpiry(
      await reserveListing(listing.id),
      clearSessionAndRedirect,
    );
    if (!result.ok) {
      setRowError(marketplaceErrorMessage(result.error, locale));
      setReserving(false);
      if (result.status === 409) onReserved();
      return;
    }
    onReserved();
  }

  return (
    <li className="flex min-w-0 flex-col justify-between rounded-2xl border border-edge bg-card p-5 shadow-eco transition-shadow hover:shadow-eco-hover">
      <div className="flex min-w-0 items-start gap-4">
        <div className="aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-xl border border-edge bg-mint-surface/30 sm:w-28">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/marketplace/listings/${listing.id}/photo`}
            alt={
              locale === "en"
                ? `Photo of ${formatCategoryName(listing.categoryName, locale)}`
                : `Ảnh ${formatCategoryName(listing.categoryName, locale)}`
            }
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center gap-1.5 mb-1">
            <EcoBadge variant="mint" className="text-[11px] font-bold">
              {locale === "en" ? "Recyclables" : "Phế liệu"}
            </EcoBadge>
          </div>
          <h3 className="font-display text-lg font-bold tracking-tight text-ink">
            {formatCategoryName(listing.categoryName, locale)}
          </h3>
          <p className="mt-1 text-sm tabular-nums text-muted">
            {tMkt("quantity", { weight: listing.estimatedWeightKg })} ·{" "}
            {tMkt("unitPrice", { price: formatVnd(listing.buyerPricePerKgVnd, locale) })}
          </p>
          <p className="text-[11px] tabular-nums text-muted">
            {tMkt("priceBand", {
              min: formatVnd(listing.priceBandMinVnd, locale),
              max: formatVnd(listing.priceBandMaxVnd, locale),
            })}
          </p>
          <p className="mt-2 font-display text-xl font-extrabold tabular-nums text-warm-600">
            {formatVnd(listing.estimatedTotalVnd, locale)}
          </p>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-end gap-1.5 pt-4">
        <div>
          {listing.isOwn ? (
            <EcoBadge variant="gray" className="py-1">
              {locale === "en" ? "Your Listing" : "Tin của bạn"}
            </EcoBadge>
          ) : listing.status !== "AVAILABLE" ? (
            <EcoBadge variant="coral" className="py-1">
              {locale === "en" ? "Reserved" : "Đã được đặt giữ"}
            </EcoBadge>
          ) : authStatus === "unauthenticated" ? (
            <Link
              href="/dang-nhap"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-edge bg-card px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-primary/40 hover:bg-mint-surface/30"
            >
              {tMkt("loginToReserve")}
            </Link>
          ) : eligible === "eligible" ? (
            <button
              type="button"
              disabled={reserving}
              onClick={() => void onReserve()}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white shadow-eco-sm transition-colors hover:bg-primary-hover disabled:opacity-60"
            >
              {reserving ? tMkt("reserving") : tMkt("reserve")}
            </button>
          ) : eligible === "unknown" || authStatus === "loading" ? (
            <span className="text-sm text-muted">{locale === "en" ? "Checking pass..." : "Đang kiểm tra gói…"}</span>
          ) : eligible === "error" ? (
            <div className="text-sm text-muted">
              <button
                type="button"
                disabled
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-edge bg-paper-2 px-4 py-2 text-sm font-medium text-muted opacity-60"
              >
                {tMkt("reserve")}
              </button>
              <p className="mt-1.5">
                {locale === "en" ? "Unable to check Buyer Pass." : "Chưa kiểm tra được gói. Thử lại ở phần đầu trang."}
              </p>
            </div>
          ) : (
            <div className="text-sm text-muted">
              <button
                type="button"
                disabled
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-edge bg-paper-2 px-4 py-2 text-sm font-medium text-muted opacity-60"
              >
                {tMkt("reserve")}
              </button>
              <p className="mt-1.5">
                {tMkt("needPassToReserve")}
              </p>
            </div>
          )}
        </div>

        {rowError ? (
          <p role="alert" className="text-sm font-medium text-coral">
            {rowError}
          </p>
        ) : null}
      </div>
    </li>
  );
}
