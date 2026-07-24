"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { MarketplaceListing } from "@greencity/shared";
import { useAuth } from "@/components/auth-provider";
import { EmptyState } from "@/components/empty-state";
import {
  checkAuthExpiry,
  completeListing,
  fetchAdminReservedListings,
  marketplaceErrorMessage,
} from "@/lib/api";
import { formatVnd } from "@/lib/format";

type LoadState =
  | { status: "loading" }
  | { status: "forbidden" }
  | { status: "error"; message: string }
  | { status: "ready"; data: MarketplaceListing[] };

export function AdminListingQueue() {
  const { status: authStatus, user, clearSessionAndRedirect } = useAuth();
  const isAdmin = user?.roles.includes("ADMIN") ?? false;
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    const result = checkAuthExpiry(
      await fetchAdminReservedListings(),
      clearSessionAndRedirect,
    );
    if (!result.ok) {
      if (result.status === 403) {
        setState({ status: "forbidden" });
        return;
      }
      setState({
        status: "error",
        message: marketplaceErrorMessage(result.error),
      });
      return;
    }
    setState({ status: "ready", data: result.data.listings });
  }, [clearSessionAndRedirect]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    void load();
  }, [authStatus, load]);

  if (authStatus === "loading") {
    return (
      <p role="status" className="text-sm text-muted">
        Đang kiểm tra đăng nhập…
      </p>
    );
  }

  if (authStatus === "unauthenticated") {
    return (
      <EmptyState
        testId="admin-listing-queue-login-required"
        title="Cần đăng nhập"
        description={
          <p>
            <Link
              href="/dang-nhap"
              className="font-medium text-accent underline-offset-4 hover:underline"
            >
              Đăng nhập
            </Link>{" "}
            bằng tài khoản quản trị viên để xem giao dịch đang chờ.
          </p>
        }
      />
    );
  }

  if (!isAdmin || state.status === "forbidden") {
    return (
      <EmptyState
        testId="admin-listing-queue-forbidden"
        title="Không có quyền truy cập"
        description="Chỉ quản trị viên mới có thể xác nhận giao dịch."
      />
    );
  }

  return (
    <div role="status" aria-live="polite" className="min-w-0">
      {state.status === "loading" ? (
        <div aria-hidden="true" className="flex flex-col gap-3">
          <div className="skeleton h-28 w-full" />
          <div className="skeleton h-28 w-full" />
        </div>
      ) : state.status === "error" ? (
        <p role="alert" className="text-sm leading-relaxed text-red-800">
          {state.message}
        </p>
      ) : state.data.length === 0 ? (
        <EmptyState
          testId="admin-listing-queue-empty"
          title="Không có giao dịch chờ xác nhận"
          description="Giao dịch sẽ xuất hiện tại đây sau khi người mua đặt giữ một tin đăng."
        />
      ) : (
        <ul className="flex min-w-0 flex-col gap-4">
          {state.data.map((listing) => (
            <AdminListingRow
              key={listing.id}
              listing={listing}
              onActionComplete={load}
              clearSessionAndRedirect={clearSessionAndRedirect}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AdminListingRow({
  listing,
  onActionComplete,
  clearSessionAndRedirect,
}: {
  listing: MarketplaceListing;
  onActionComplete: () => void;
  clearSessionAndRedirect: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function onComplete() {
    setServerError(null);
    setSubmitting(true);
    const result = checkAuthExpiry(
      await completeListing(listing.id),
      clearSessionAndRedirect,
    );
    if (!result.ok) {
      setServerError(marketplaceErrorMessage(result.error));
      setSubmitting(false);
      return;
    }
    onActionComplete();
  }

  return (
    <li className="min-w-0 rounded-md border border-edge bg-paper p-4">
      <div className="min-w-0">
        <p className="font-medium text-ink">{listing.categoryName}</p>
        <p className="mt-1 text-sm text-muted">
          Khối lượng: {listing.estimatedWeightKg}kg · Giá mua:{" "}
          {formatVnd(listing.buyerPricePerKgVnd)}/kg
        </p>
        <p className="mt-1 text-sm font-semibold text-ink">
          Ước tính: {formatVnd(listing.estimatedTotalVnd)}
        </p>
        <p className="mt-1 text-xs text-muted">
          Đã được đặt giữ, chờ xác nhận giao hàng.
        </p>
      </div>

      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 border-t border-rule pt-3">
        <button
          type="button"
          disabled={submitting}
          onClick={() => void onComplete()}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-paper transition-opacity duration-quick ease-out hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? "Đang xử lý…" : "Hoàn tất giao dịch"}
        </button>
        <p className="text-xs text-muted">
          Người bán được cộng điểm thưởng khi hoàn tất.
        </p>
      </div>

      {serverError ? (
        <p role="alert" className="mt-2 text-sm text-red-800">
          {serverError}
        </p>
      ) : null}
    </li>
  );
}
