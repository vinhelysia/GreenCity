"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { MarketplaceListing } from "@greencity/shared";
import { useAuth } from "@/components/auth-provider";
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
  const [eligible, setEligible] = useState<
    "unknown" | "loading" | "eligible" | "not-eligible" | "error"
  >("unknown");

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

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setEligible("unknown");
      return;
    }
    let cancelled = false;
    (async () => {
      setEligible("loading");
      const result = checkAuthExpiry(
        await fetchSubscriptionState(),
        clearSessionAndRedirect,
      );
      if (cancelled) return;
      if (!result.ok) {
        setEligible("error");
        return;
      }
      setEligible(result.data.eligible ? "eligible" : "not-eligible");
    })();
    return () => {
      cancelled = true;
    };
  }, [authStatus, clearSessionAndRedirect]);

  return (
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
  eligible: "unknown" | "loading" | "eligible" | "not-eligible" | "error";
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
    <li className="flex min-w-0 flex-col overflow-hidden rounded-md border border-edge bg-paper">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/marketplace/listings/${listing.id}/photo`}
        alt=""
        className="h-40 w-full object-cover"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-4">
        <p className="font-medium text-ink">{listing.categoryName}</p>
        <p className="text-sm text-muted">{listing.estimatedWeightKg}kg</p>
        <p className="text-sm text-muted">
          {formatVnd(listing.buyerPricePerKgVnd)}/kg
        </p>
        <p className="text-sm font-medium text-ink">
          Ước tính: {formatVnd(listing.estimatedTotalVnd)}
        </p>

        <div className="mt-2">
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
          ) : eligible === "loading" || authStatus === "loading" ? (
            <span className="text-sm text-muted">Đang kiểm tra gói…</span>
          ) : (
            <div className="text-sm text-muted">
              <button
                type="button"
                disabled
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-edge bg-paper-2 px-4 py-2 text-sm font-medium text-muted opacity-60"
              >
                Đặt giữ
              </button>
              <p className="mt-1.5">
                Bạn cần gói người mua để đặt giữ. Gói demo — chưa xử lý thanh
                toán.
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
