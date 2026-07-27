"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { SubscriptionState } from "@greencity/shared";
import { useAuth } from "@/components/auth-provider";
import { EcoBadge } from "@/components/eco-badge";
import { IconShieldCheck, IconSparkles } from "@/components/eco-icons";
import {
  checkAuthExpiry,
  createSubscriptionPayment,
  fetchSubscriptionPaymentStatus,
  paymentErrorMessage,
} from "@/lib/api";

/**
 * Survives the round trip to payOS and back, and no longer: the pass belongs to
 * the tab that started it, and a value left in localStorage would still be
 * there weeks later pointing at a payment nobody remembers.
 */
const PENDING_PAYMENT_KEY = "greencity.pendingSubscriptionPaymentId";

const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_ATTEMPTS = 30;

const PRICE_LABEL = "50.000đ";

type PollState =
  | { kind: "checking" }
  | { kind: "idle" }
  | { kind: "polling" }
  | { kind: "paid" }
  | { kind: "failed"; message: string }
  | { kind: "unconfirmed" };

/** What the parent knows about the subscription, including "we could not ask". */
export type SubscriptionLoad =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; state: SubscriptionState };

function readPendingPaymentId(): string | null {
  try {
    return window.sessionStorage.getItem(PENDING_PAYMENT_KEY);
  } catch {
    return null;
  }
}

function clearPendingPaymentId(): void {
  try {
    window.sessionStorage.removeItem(PENDING_PAYMENT_KEY);
  } catch {
    /* nothing to clean up if storage was never writable */
  }
}

export function BuyerPassPanel({
  load,
  onSubscriptionChange,
}: {
  load: SubscriptionLoad;
  onSubscriptionChange: () => void;
}) {
  const { status: authStatus, clearSessionAndRedirect } = useAuth();
  const [starting, setStarting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [poll, setPoll] = useState<PollState>({ kind: "checking" });
  const [pollRun, setPollRun] = useState(0);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    const paymentId = readPendingPaymentId();
    if (!paymentId) {
      setPoll({ kind: "idle" });
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    setPoll({ kind: "polling" });

    const tick = async (): Promise<void> => {
      attempts += 1;
      const result = checkAuthExpiry(
        await fetchSubscriptionPaymentStatus(paymentId),
        clearSessionAndRedirect,
      );
      if (cancelled) return;

      if (!result.ok) {
        if (result.status === 404) {
          clearPendingPaymentId();
          setPoll({
            kind: "failed",
            message: paymentErrorMessage(result.error),
          });
          return;
        }
        if (result.status === 401) return;
        if (attempts >= MAX_POLL_ATTEMPTS) {
          setPoll({ kind: "unconfirmed" });
          return;
        }
        timer = setTimeout(() => void tick(), POLL_INTERVAL_MS);
        return;
      }

      if (result.data.status === "PAID") {
        clearPendingPaymentId();
        setPoll({ kind: "paid" });
        onSubscriptionChange();
        return;
      }
      if (result.data.status === "FAILED") {
        clearPendingPaymentId();
        setPoll({
          kind: "failed",
          message: "Giao dịch không thành công. Bạn có thể thử lại.",
        });
        return;
      }

      if (attempts >= MAX_POLL_ATTEMPTS) {
        setPoll({ kind: "unconfirmed" });
        return;
      }
      timer = setTimeout(() => void tick(), POLL_INTERVAL_MS);
    };

    void tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [authStatus, clearSessionAndRedirect, onSubscriptionChange, pollRun]);

  const onCheckout = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    setCheckoutError(null);

    const result = checkAuthExpiry(
      await createSubscriptionPayment(),
      clearSessionAndRedirect,
    );
    if (!result.ok) {
      setCheckoutError(paymentErrorMessage(result.error));
      setStarting(false);
      return;
    }

    try {
      window.sessionStorage.setItem(PENDING_PAYMENT_KEY, result.data.paymentId);
    } catch {
      /* storage unavailable */
    }
    window.location.assign(result.data.payUrl);
  }, [starting, clearSessionAndRedirect]);

  const active = load.kind === "ready" && load.state.eligible;
  const expiresAt =
    load.kind === "ready" ? load.state.subscription?.expiresAt : undefined;

  function signedInBody() {
    if (poll.kind === "checking") {
      return <div aria-hidden="true" className="skeleton mt-3 h-12 w-full rounded-xl" />;
    }

    if (poll.kind === "polling") {
      return (
        <p
          role="status"
          data-testid="payment-polling"
          className="mt-3 text-sm font-medium text-primary"
        >
          Đang xác nhận giao dịch với ngân hàng…
        </p>
      );
    }

    if (poll.kind === "unconfirmed") {
      return (
        <div
          role="status"
          data-testid="payment-unconfirmed"
          className="mt-3 rounded-xl bg-yellow/10 p-4 text-sm text-ink border border-yellow/30"
        >
          <p>
            Chưa xác nhận được giao dịch. Chúng tôi chưa biết ngân hàng đã ghi
            nhận hay chưa, nên bạn đừng thanh toán lại. Hãy kiểm tra lại sau ít
            phút, hoặc mở ứng dụng ngân hàng để xem lịch sử giao dịch.
          </p>
          <button
            type="button"
            data-testid="payment-recheck"
            onClick={() => setPollRun((n) => n + 1)}
            className="mt-3 inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl border border-edge bg-card px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-primary/40"
          >
            Kiểm tra lại
          </button>
        </div>
      );
    }

    if (poll.kind === "paid" && !active && load.kind !== "error") {
      return (
        <p
          role="status"
          data-testid="payment-applying"
          className="mt-3 text-sm font-semibold text-primary"
        >
          Đã nhận thanh toán, đang cập nhật quyền cho tài khoản của bạn…
        </p>
      );
    }

    return (
      <>
        {poll.kind === "paid" ? (
          <p
            role="status"
            data-testid="payment-success"
            className="mt-3 text-sm font-semibold text-primary"
          >
            Thanh toán thành công. Gói người mua của bạn đã được kích hoạt.
          </p>
        ) : null}

        {poll.kind === "failed" ? (
          <p
            role="alert"
            data-testid="payment-failed"
            className="mt-3 text-sm font-medium text-coral"
          >
            {poll.message}
          </p>
        ) : null}

        {active ? (
          <div className="mt-3 flex items-center gap-2">
            <EcoBadge variant="primary" icon={<IconShieldCheck className="h-4 w-4" />}>
              Đang hoạt động
            </EcoBadge>
            {expiresAt ? (
              <span className="text-sm text-muted">
                hết hạn {new Date(expiresAt).toLocaleDateString("vi-VN")}
              </span>
            ) : null}
          </div>
        ) : load.kind === "error" ? (
          <div
            role="alert"
            data-testid="subscription-error"
            className="mt-3 text-sm text-coral"
          >
            <p>
              {poll.kind === "paid"
                ? "Thanh toán đã được ghi nhận, nhưng chúng tôi chưa kiểm tra được trạng thái gói người mua của bạn."
                : "Không kiểm tra được trạng thái gói người mua."}
            </p>
            <button
              type="button"
              data-testid="subscription-retry"
              onClick={onSubscriptionChange}
              className="mt-3 inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl border border-edge bg-card px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-primary/40"
            >
              Thử lại
            </button>
          </div>
        ) : load.kind === "ready" && load.state.checkoutAvailable ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              <span className="font-semibold text-ink">
                {PRICE_LABEL} / 30 ngày
              </span>
              {" · chuyển khoản VietQR một lần · không tự động gia hạn"}
            </p>
            <button
              type="button"
              data-testid="buyer-pass-checkout"
              disabled={starting}
              onClick={() => void onCheckout()}
              className="mt-4 inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-eco transition-colors hover:bg-primary-hover disabled:opacity-60"
            >
              <IconSparkles className="h-4 w-4" />
              <span>
                {starting
                  ? "Đang chuyển tới trang thanh toán…"
                  : `Chuyển khoản ${PRICE_LABEL} qua VietQR`}
              </span>
            </button>
            {checkoutError ? (
              <p
                role="alert"
                data-testid="checkout-error"
                className="mt-2 text-sm text-coral"
              >
                {checkoutError}
              </p>
            ) : null}
          </>
        ) : (
          <p
            data-testid="checkout-unavailable"
            className="mt-3 max-w-prose text-sm leading-relaxed text-muted"
          >
            Thanh toán VietQR chưa được mở trên môi trường này, nên tạm thời chưa
            mua gói người mua được.
          </p>
        )}
      </>
    );
  }

  function body() {
    if (authStatus === "unauthenticated") {
      return (
        <>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
            Gói người mua cho phép bạn đặt giữ phế liệu trên chợ. Người bán vẫn
            đăng tin và xem giá bình thường mà không cần gói này.
          </p>
          <Link
            href="/dang-nhap"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Đăng nhập để mua gói &rarr;
          </Link>
        </>
      );
    }
    if (authStatus === "loading" || load.kind === "loading") {
      return <div aria-hidden="true" className="skeleton mt-3 h-12 w-full rounded-xl" />;
    }
    return signedInBody();
  }

  return (
    <section
      aria-labelledby="buyer-pass-heading"
      className="min-w-0 rounded-2xl border border-edge bg-mint-surface/40 p-6 shadow-eco-sm"
    >
      <div className="flex items-center gap-2">
        <h2
          id="buyer-pass-heading"
          className="font-display text-xl font-bold tracking-tight text-ink"
        >
          Gói người mua
        </h2>
        <EcoBadge variant="mint">30 Ngày</EcoBadge>
      </div>
      {body()}
    </section>
  );
}
