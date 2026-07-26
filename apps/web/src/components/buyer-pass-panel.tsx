"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { SubscriptionState } from "@greencity/shared";
import { useAuth } from "@/components/auth-provider";
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
    // Private mode and blocked storage both throw. Checkout still works; the
    // return trip simply cannot be resumed automatically.
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
  // Starts "checking", not "idle": the checkout CTA must not be paintable
  // before this effect has had a chance to find a pending payment and switch
  // to "polling" — otherwise a click in that window starts a second checkout
  // for a payment that is already in flight.
  const [poll, setPoll] = useState<PollState>({ kind: "checking" });
  /** Bumped by "Kiểm tra lại" to restart a run that timed out. */
  const [pollRun, setPollRun] = useState(0);


  /**
   * Resumes the payment this tab started, by id only. payOS appends its own
   * result to the return URL — resultCode, orderId, transId — and none of it is
   * read here: those parameters are attacker-writable, and treating them as
   * proof of payment would hand out a pass for the price of editing an address
   * bar. The owner-only status endpoint is the single source of truth.
   */
  useEffect(() => {
    if (authStatus !== "authenticated") return;
    const paymentId = readPendingPaymentId();
    if (!paymentId) {
      setPoll({ kind: "idle" });
      return;
    }

    // Local to this run. A ref shared across runs lets the previous effect's
    // cleanup cancel the new run, or a stale chain resume once a later run
    // resets the flag.
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    setPoll({ kind: "polling" });

    // Chained timeouts rather than an interval: a slow reply must delay the
    // next request, not stack another one behind it.
    const tick = async (): Promise<void> => {
      attempts += 1;
      const result = checkAuthExpiry(
        await fetchSubscriptionPaymentStatus(paymentId),
        clearSessionAndRedirect,
      );
      if (cancelled) return;

      if (!result.ok) {
        if (result.status === 404) {
          // The id is stale — cleared, so the next visit starts clean.
          clearPendingPaymentId();
          setPoll({
            kind: "failed",
            message: paymentErrorMessage(result.error),
          });
          return;
        }
        if (result.status === 401) return; // redirecting to sign in
        // A network blip is not a verdict. Keep the id and keep trying.
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

      // Still PENDING. Giving up on the clock says nothing about the payment,
      // so the id stays and the reader is offered a manual re-check.
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

    // Stored before navigating, not after: once assign() runs this page is
    // gone, and an unstored id means the return trip has nothing to poll.
    try {
      window.sessionStorage.setItem(PENDING_PAYMENT_KEY, result.data.paymentId);
    } catch {
      /* storage unavailable; the payment itself is unaffected */
    }
    // Same tab: payOS returns the payer to us, and a popup would be blocked or
    // orphaned. Only payUrl is used — nothing from the provider is persisted.
    window.location.assign(result.data.payUrl);
  }, [starting, clearSessionAndRedirect]);

  const active = load.kind === "ready" && load.state.eligible;
  const expiresAt =
    load.kind === "ready" ? load.state.subscription?.expiresAt : undefined;

  /**
   * The body for a signed-in reader. A second payment must be impossible while
   * the first is unresolved, and while a settled one is still being applied:
   * offering the button again there is how someone pays 100.000đ for one
   * 30-day pass.
   */
  function signedInBody() {
    if (poll.kind === "checking") {
      return <div aria-hidden="true" className="skeleton mt-3 h-12 w-full" />;
    }

    if (poll.kind === "polling") {
      return (
        <p
          role="status"
          data-testid="payment-polling"
          className="mt-2 text-sm text-muted"
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
          className="mt-2 text-sm text-muted"
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
            className="mt-2 inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md border border-edge bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors duration-quick ease-out hover:border-accent"
          >
            Kiểm tra lại
          </button>
        </div>
      );
    }

    // Only while the refetch is still in flight or has not started. A failed
    // refetch (load.kind === "error") must fall through to the error branch
    // below instead — otherwise a payment that was in fact received is stuck
    // behind "đang cập nhật quyền…" forever, with no retry offered.
    if (poll.kind === "paid" && !active && load.kind !== "error") {
      return (
        <p
          role="status"
          data-testid="payment-applying"
          className="mt-2 text-sm font-medium text-accent"
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
            className="mt-2 text-sm font-medium text-accent"
          >
            Thanh toán thành công. Gói người mua của bạn đã được kích hoạt.
          </p>
        ) : null}

        {poll.kind === "failed" ? (
          <p
            role="alert"
            data-testid="payment-failed"
            className="mt-2 text-sm text-red-800"
          >
            {poll.message}
          </p>
        ) : null}

        {active ? (
          <p className="mt-2 text-sm leading-relaxed text-muted">
            <span className="font-medium text-ink">Đang hoạt động</span>
            {expiresAt ? (
              <>
                {" · hết hạn "}
                {new Date(expiresAt).toLocaleDateString("vi-VN")}
              </>
            ) : null}
          </p>
        ) : load.kind === "error" ? (
          // Never claim checkout is unavailable when the truth is that we could
          // not ask. Those are different problems with different fixes.
          <div
            role="alert"
            data-testid="subscription-error"
            className="mt-2 text-sm text-red-800"
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
              className="mt-2 inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md border border-edge bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors duration-quick ease-out hover:border-accent"
            >
              Thử lại
            </button>
          </div>
        ) : load.kind === "ready" && load.state.checkoutAvailable ? (
          <>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              <span className="font-medium text-ink">
                {PRICE_LABEL} / 30 ngày
              </span>
              {" · chuyển khoản VietQR một lần · không tự động gia hạn"}
            </p>
            <button
              type="button"
              data-testid="buyer-pass-checkout"
              disabled={starting}
              onClick={() => void onCheckout()}
              className="mt-3 inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-paper transition-opacity duration-quick ease-out hover:opacity-90 disabled:opacity-60"
            >
              {starting
                ? "Đang chuyển tới trang thanh toán…"
                : `Chuyển khoản ${PRICE_LABEL} qua VietQR`}
            </button>
            {checkoutError ? (
              <p
                role="alert"
                data-testid="checkout-error"
                className="mt-2 text-sm text-red-800"
              >
                {checkoutError}
              </p>
            ) : null}
          </>
        ) : (
          // Reached only when the server answered and said checkout is off.
          <p
            data-testid="checkout-unavailable"
            className="mt-2 max-w-prose text-sm leading-relaxed text-muted"
          >
            Thanh toán VietQR chưa được mở trên môi trường này, nên tạm thời chưa
            mua gói người mua được.
          </p>
        )}
      </>
    );
  }

  function body() {
    if (authStatus === "loading" || load.kind === "loading") {
      return <div aria-hidden="true" className="skeleton mt-3 h-12 w-full" />;
    }
    if (authStatus === "unauthenticated") {
      return (
        <>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
            Gói người mua cho phép bạn đặt giữ phế liệu trên chợ. Người bán vẫn
            đăng tin và xem giá bình thường mà không cần gói này.
          </p>
          <Link
            href="/dang-nhap"
            className="mt-3 inline-flex items-center whitespace-nowrap text-sm font-medium text-accent underline-offset-4 hover:underline"
          >
            Đăng nhập để mua gói &rarr;
          </Link>
        </>
      );
    }
    return signedInBody();
  }

  return (
    <section
      aria-labelledby="buyer-pass-heading"
      className="min-w-0 rounded-md border border-edge bg-paper-2 p-5 sm:p-6"
    >
      <h2
        id="buyer-pass-heading"
        className="font-display text-lg font-semibold tracking-tight text-ink"
      >
        Gói người mua
      </h2>
      {body()}
    </section>
  );
}
