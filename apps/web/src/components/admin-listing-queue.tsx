"use client";

import { AuthEntryLink } from "@/components/auth-entry-link";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { AdminListingList } from "@greencity/shared";
import { useAuth } from "@/components/auth-provider";
import { EmptyState } from "@/components/empty-state";
import { ReservationSummary } from "@/components/reservation-details";
import {
  checkAuthExpiry,
  completeReservation,
  cancelReservation,
  scheduleReservation,
  fetchAdminReservedListings,
  marketplaceErrorMessage,
} from "@/lib/api";

type LoadState =
  | { status: "loading" }
  | { status: "forbidden" }
  | { status: "error"; message: string }
  | { status: "ready"; data: AdminListingList["listings"]; nextCursor?: string };

export function AdminListingQueue() {
  const locale = useLocale();
  const tAdmin = useTranslations("admin");
  const tCommon = useTranslations("common");
  const tAuth = useTranslations("auth");
  const tErr = useTranslations("errors");
  const tCollection = useTranslations("collection");
  const { status: authStatus, user, clearSessionAndRedirect } = useAuth();
  const isAdmin = user?.roles.includes("ADMIN") ?? false;
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const loadMorePending = useRef(false);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    setLoadMoreError(null);
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
        message: marketplaceErrorMessage(result.error, locale),
      });
      return;
    }
    setState({
      status: "ready",
      data: result.data.listings,
      nextCursor: result.data.nextCursor,
    });
  }, [clearSessionAndRedirect, locale]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    void load();
  }, [authStatus, load]);

  const loadMore = useCallback(async () => {
    if (
      loadMorePending.current ||
      state.status !== "ready" ||
      !state.nextCursor
    ) {
      return;
    }
    const cursor = state.nextCursor;
    loadMorePending.current = true;
    setLoadingMore(true);
    setLoadMoreError(null);

    try {
      const result = checkAuthExpiry(
        await fetchAdminReservedListings({ cursor }),
        clearSessionAndRedirect,
      );
      if (!result.ok) {
        setLoadMoreError(tCommon("loadMoreError"));
        return;
      }
      setState((previous) => {
        if (previous.status !== "ready" || previous.nextCursor !== cursor) {
          return previous;
        }
        return {
          status: "ready",
          data: [...previous.data, ...result.data.listings],
          nextCursor: result.data.nextCursor,
        };
      });
    } finally {
      loadMorePending.current = false;
      setLoadingMore(false);
    }
  }, [clearSessionAndRedirect, state, tCommon]);

  if (authStatus === "loading") {
    return (
      <p role="status" className="text-sm text-muted">
        Loading...
      </p>
    );
  }

  if (authStatus === "unauthenticated") {
    return (
      <EmptyState
        testId="admin-listing-queue-login-required"
        title={locale === "en" ? "Sign In Required" : "Cần đăng nhập"}
        description={
          <p>
            <AuthEntryLink
              href="/dang-nhap"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {tAuth("loginButton")}
            </AuthEntryLink>{" "}
            {locale === "en" ? "with an administrator account." : "bằng tài khoản quản trị viên để xem giao dịch đang chờ."}
          </p>
        }
      />
    );
  }

  if (!isAdmin || state.status === "forbidden") {
    return (
      <EmptyState
        testId="admin-listing-queue-forbidden"
        title={locale === "en" ? "Access Denied" : "Không có quyền truy cập"}
        description={tErr("forbidden")}
      />
    );
  }

  return (
    <div role="status" aria-live="polite" className="min-w-0">
      <button type="button" disabled={state.status === "loading"} onClick={() => void load()} className="mb-4 inline-flex min-h-11 items-center rounded-md border border-edge px-4 text-sm font-semibold disabled:opacity-60">{tCollection("refresh")}</button>
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
          title={tAdmin("transactionQueueTitle")}
          description={tAdmin("noItems")}
        />
      ) : (
        <>
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
          {state.nextCursor ? (
            <div
              aria-busy={loadingMore}
              className="mt-5 flex flex-col items-start gap-2"
            >
              <button
                type="button"
                data-testid="admin-listings-load-more"
                disabled={loadingMore}
                onClick={() => void loadMore()}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-edge bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent disabled:opacity-60"
              >
                {loadingMore ? tCommon("loadingMore") : tCommon("loadMore")}
              </button>
              {loadMoreError ? (
                <p
                  role="alert"
                  data-testid="admin-listings-load-more-error"
                  className="text-sm text-red-800"
                >
                  {loadMoreError}
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function AdminListingRow({
  listing,
  onActionComplete,
  clearSessionAndRedirect,
}: {
  listing: AdminListingList["listings"][number];
  onActionComplete: () => void;
  clearSessionAndRedirect: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations("collection");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const reservation = listing.reservation;
  const inputClass = "mt-1 block min-h-11 w-full min-w-0 rounded-md border border-edge bg-paper px-3 py-2 text-sm";
  const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60";
  const localAppointment = reservation?.scheduledAt ? new Date(new Date(reservation.scheduledAt).getTime() - new Date(reservation.scheduledAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";

  async function onSubmit(event: FormEvent<HTMLFormElement>, action: "schedule" | "complete" | "cancel") {
    event.preventDefault();
    if (!reservation || submitting) return;
    const data = new FormData(event.currentTarget);
    const appointment = new Date(String(data.get("scheduledAt")));
    if (action === "schedule" && !Number.isFinite(appointment.getTime())) {
      setServerError(t("appointment"));
      return;
    }
    setServerError(null);
    setSubmitting(true);
    const result = checkAuthExpiry(
      await (action === "schedule"
        ? scheduleReservation(reservation.id, { scheduledAt: appointment.toISOString(), pickupLocation: String(data.get("pickupLocation")), coordinatorContact: String(data.get("coordinatorContact")) })
        : action === "complete"
          ? completeReservation(reservation.id, { actualWeightKg: Number(data.get("actualWeightKg")), sellerReceivedAmountVnd: Number(data.get("sellerReceivedAmountVnd")), receiptNote: String(data.get("receiptNote")) })
          : cancelReservation(reservation.id, { reason: String(data.get("reason")) })),
      clearSessionAndRedirect,
    );
    setSubmitting(false);
    if (!result.ok) {
      setServerError(marketplaceErrorMessage(result.error, locale));
      return;
    }
    onActionComplete();
  }

  return (
    <li className="min-w-0 rounded-md border border-edge bg-paper p-4">
      {reservation ? (
        <>
          <ReservationSummary reservation={reservation} />
          <fieldset disabled={submitting} className="mt-4 min-w-0 space-y-3 border-t border-rule pt-3 disabled:opacity-60">
            <details>
              <summary className="cursor-pointer py-3 font-semibold text-primary">{t("schedule")}</summary>
              <form onSubmit={event => void onSubmit(event, "schedule")} className="space-y-3 pb-3 text-sm">
                <label className="block">{t("appointment")}<input className={inputClass} name="scheduledAt" type="datetime-local" defaultValue={localAppointment} required /></label>
                <p className="text-xs text-muted">{t("timezone", { zone: Intl.DateTimeFormat().resolvedOptions().timeZone })}</p>
                <label className="block">{t("location")}<input className={inputClass} name="pickupLocation" minLength={3} maxLength={240} defaultValue={reservation.pickupLocation ?? ""} required /></label>
                <label className="block">{t("contact")}<input className={inputClass} name="coordinatorContact" minLength={3} maxLength={160} defaultValue={reservation.coordinatorContact ?? ""} required /></label>
                <button className={buttonClass} type="submit">{submitting ? t("processing") : t("saveSchedule")}</button>
              </form>
            </details>
            <details>
              <summary className="cursor-pointer py-3 font-semibold text-primary">{t("complete")}</summary>
              <form onSubmit={event => void onSubmit(event, "complete")} className="space-y-3 pb-3 text-sm">
                <p className="leading-6 text-muted">{t("manualNotice")}</p>
                <label className="block">{t("actualWeight")}<input className={inputClass} name="actualWeightKg" type="number" min="0.001" max="1000" step="0.001" required /></label>
                <label className="block">{t("receivedAmount")}<input className={inputClass} name="sellerReceivedAmountVnd" type="number" min="1" max="2147483647" step="1" required /></label>
                <label className="block">{t("receipt")}<textarea className={inputClass} name="receiptNote" minLength={3} maxLength={500} required /></label>
                <p className="text-xs text-muted">{t("pointsNotice")}</p>
                <button className={buttonClass} type="submit">{submitting ? t("processing") : t("complete")}</button>
              </form>
            </details>
            <details>
              <summary className="cursor-pointer py-3 font-semibold text-coral">{t("cancel")}</summary>
              <form onSubmit={event => void onSubmit(event, "cancel")} className="space-y-3 pb-3 text-sm">
                <p className="leading-6 text-muted">{t("cancelNotice")}</p>
                <label className="block">{t("cancelReason")}<textarea className={inputClass} name="reason" minLength={3} maxLength={500} required /></label>
                <button className="inline-flex min-h-11 items-center rounded-md border border-coral px-4 py-2 font-semibold text-coral disabled:opacity-60" type="submit">{submitting ? t("processing") : t("cancel")}</button>
              </form>
            </details>
          </fieldset>
        </>
      ) : <p className="text-sm text-muted">{t("noReservation")}</p>}

      {serverError ? (
        <p role="alert" className="mt-2 text-sm text-red-800">
          {serverError}
        </p>
      ) : null}
    </li>
  );
}
