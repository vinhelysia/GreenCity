"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { MarketplaceListing } from "@greencity/shared";
import { useAuth } from "@/components/auth-provider";
import {
  BuyerPassPanel,
  type SubscriptionLoad,
} from "@/components/buyer-pass-panel";
import { EmptyState } from "@/components/empty-state";
import {
  checkAuthExpiry,
  fetchMarketplaceListings,
  fetchSubscriptionState,
  marketplaceErrorMessage,
  reserveListing,
} from "@/lib/api";
import { formatVnd } from "@/lib/format";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: MarketplaceListing[] };


export function MarketplaceListings() {
  const { status: authStatus, clearSessionAndRedirect } = useAuth();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  // The whole SubscriptionState, not just the boolean: the pass panel needs the
  // expiry date and whether checkout is configured. A failed request is its own
  // state — collapsing it into null made the panel claim checkout was switched
  // off when the truth was that we never got an answer.
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
      setState({ status: "error", message: marketplaceErrorMessage(result.error) });
      return;
    }
    setState({ status: "ready", data: result.data.listings });
  }, []);

  useEffect(() => {
    void loadListings();
  }, [loadListings]);

  // Bumped after a payment settles, so the pass unlocks the reserve buttons
  // without the reader having to reload the page.
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
      // 401 already redirects; anything else is an honest "we could not ask".
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
      {/* One place to buy the pass, above the listings. Repeating the CTA on
          every card would ask for the same money in a dozen places. */}
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
          title="Chưa có tin đăng"
          description="Chưa có phế liệu nào được niêm yết để đặt giữ."
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
      setRowError(marketplaceErrorMessage(result.error));
      setReserving(false);
      if (result.status === 409) onReserved();
      return;
    }
    onReserved();
  }

  return (
    <li className="flex min-w-0 flex-col rounded-md border border-edge bg-paper p-4">
      {/* Type-led: the material and the price are what a buyer scans. The photo
          supports that decision rather than filling a banner above it. */}
      <div className="flex min-w-0 items-start gap-4">
        <div className="aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-md border border-edge bg-paper-3 sm:w-28">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/marketplace/listings/${listing.id}/photo`}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-semibold tracking-tight text-ink">
            {listing.categoryName}
          </h3>
          <p className="mt-1 text-sm tabular-nums text-muted">
            {listing.estimatedWeightKg}kg ·{" "}
            {formatVnd(listing.buyerPricePerKgVnd)}/kg
          </p>
          <p className="mt-2 font-display text-xl font-bold tabular-nums text-ink">
            {formatVnd(listing.estimatedTotalVnd)}
          </p>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="mt-4">
          {listing.isOwn ? (
            <span className="inline-flex items-center rounded-sm border border-edge bg-paper-2 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-muted">
              Tin của bạn
            </span>
          ) : listing.status !== "AVAILABLE" ? (
            <span className="inline-flex items-center rounded-sm border border-edge bg-paper-2 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-muted">
              Đã được đặt giữ
            </span>
          ) : authStatus === "unauthenticated" ? (
            <Link
              href="/dang-nhap"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-edge bg-paper px-4 py-2 text-sm font-medium text-ink hover:border-accent"
            >
              Đăng nhập để đặt giữ
            </Link>
          ) : eligible === "eligible" ? (
            <button
              type="button"
              disabled={reserving}
              onClick={() => void onReserve()}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-paper transition-opacity duration-quick ease-out hover:opacity-90 disabled:opacity-60"
            >
              {reserving ? "Đang đặt giữ…" : "Đặt giữ"}
            </button>
          ) : eligible === "unknown" || authStatus === "loading" ? (
            <span className="text-sm text-muted">Đang kiểm tra gói…</span>
          ) : eligible === "error" ? (
            // Do not leave this stuck on "checking" forever: say what happened
            // and point at the retry, which lives once, in the panel above.
            <div className="text-sm text-muted">
              <button
                type="button"
                disabled
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-edge bg-paper-2 px-4 py-2 text-sm font-medium text-muted opacity-60"
              >
                Đặt giữ
              </button>
              <p className="mt-1.5">
                Chưa kiểm tra được gói. Thử lại ở phần đầu trang.
              </p>
            </div>
          ) : (
            // Points at the one panel above rather than repeating the offer:
            // the same purchase asked for on every card reads as nagging.
            <div className="text-sm text-muted">
              <button
                type="button"
                disabled
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-edge bg-paper-2 px-4 py-2 text-sm font-medium text-muted opacity-60"
              >
                Đặt giữ
              </button>
              <p className="mt-1.5">
                Cần gói người mua. Mua ở phần đầu trang.
              </p>
            </div>
          )}
        </div>

        {rowError ? (
          <p role="alert" className="text-sm text-red-800">
            {rowError}
          </p>
        ) : null}
      </div>
    </li>
  );
}
