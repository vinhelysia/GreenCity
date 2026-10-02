"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { ReservationDetail } from "@greencity/shared";
import { useAuth } from "@/components/auth-provider";
import { EcoBadge } from "@/components/eco-badge";
import { EcoMorphIcon, MORPH_PATHS } from "./morph-icon";
import { checkAuthExpiry, fetchReservation, marketplaceErrorMessage } from "@/lib/api";
import { formatCategoryName, formatDateTime, formatNumber, formatVnd } from "@/lib/format";

export function ReservationSummary({ reservation: r }: { reservation: ReservationDetail }) {
  const locale = useLocale();
  const t = useTranslations("collection");
  const tStatus = useTranslations("status");
  const stateKey = r.status === "RESERVED" ? "reserved" : r.status === "COMPLETED" ? "completed" : "cancelled";
  const statusIcon = r.status === "COMPLETED" ? MORPH_PATHS.check : r.status === "CANCELLED" ? MORPH_PATHS.close : MORPH_PATHS.clock;
  const currentStep = r.status === "COMPLETED" ? 2 : r.scheduledAt ? 1 : 0;
  const steps = [
    { label: tStatus("reserved"), icon: MORPH_PATHS.package },
    { label: t("schedule"), icon: MORPH_PATHS.calendar },
    { label: tStatus("completed"), icon: MORPH_PATHS.receipt },
  ];

  return (
    <div className="min-w-0 space-y-4" data-testid="reservation-summary">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="font-display text-lg font-bold text-ink">{formatCategoryName(r.categoryName, locale)}</h3>
        <EcoBadge icon={<EcoMorphIcon icon={statusIcon} size={16} />} variant={r.status === "COMPLETED" ? "primary" : r.status === "CANCELLED" ? "coral" : "yellow"}>{tStatus(stateKey)}</EcoBadge>
      </div>
      <p className="break-all text-xs text-muted">{t("orderId")}: {r.id}</p>
      <p className="text-sm tabular-nums text-muted">{t("estimate")}: {formatNumber(r.estimatedWeightKg, locale)} kg · {formatVnd(r.estimatedTotalVnd, locale)}</p>
      {r.status === "RESERVED" || (r.status === "COMPLETED" && r.scheduledAt) ? (
        <ol aria-label={t("title")} className="grid grid-cols-3 gap-2 border-t border-rule pt-4">
          {steps.map((step, index) => (
            <li key={step.label} aria-current={index === currentStep ? "step" : undefined} className={`min-w-0 border-t-2 pt-3 text-sm ${index <= currentStep ? "border-primary text-primary" : "border-edge text-muted"}`}>
              <EcoMorphIcon icon={index < currentStep ? MORPH_PATHS.check : step.icon} className="mb-2 h-5 w-5" />
              <span className={index === currentStep ? "font-semibold" : ""}>{step.label}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {r.scheduledAt ? (
        <dl className="space-y-2 border-t border-rule pt-3 text-sm">
          <div><dt className="flex items-center gap-2 font-semibold"><EcoMorphIcon icon={MORPH_PATHS.calendar} size={18} />{t("appointment")}</dt><dd className="pl-[26px]">{formatDateTime(r.scheduledAt, locale)}</dd></div>
          <div><dt className="flex items-center gap-2 font-semibold"><EcoMorphIcon icon={MORPH_PATHS.pin} size={18} />{t("location")}</dt><dd className="break-words pl-[26px]">{r.pickupLocation}</dd></div>
          <div><dt className="flex items-center gap-2 font-semibold"><EcoMorphIcon icon={MORPH_PATHS.phone} size={18} />{t("contact")}</dt><dd className="break-words whitespace-pre-wrap pl-[26px]">{r.coordinatorContact}</dd></div>
        </dl>
      ) : r.status === "RESERVED" ? <p className="text-sm text-muted">{t("pendingSchedule")}</p> : null}
      {r.status === "RESERVED" && r.scheduledAt ? <p className="text-sm text-muted">{t("changeNotice")}</p> : null}
      {r.status === "COMPLETED" ? (
        r.actualWeightKg !== null && r.sellerReceivedAmountVnd !== null ? (
          <div className="space-y-2 rounded-lg border border-primary/20 bg-mint-surface p-4 text-sm">
            <p>{t("actualWeight")}: <strong className="tabular-nums">{formatNumber(r.actualWeightKg, locale)}</strong></p>
            <p>{t("receivedAmount")}: <strong className="tabular-nums">{formatVnd(r.sellerReceivedAmountVnd, locale)}</strong></p>
            <p className="break-words whitespace-pre-wrap">{t("receipt")}: {r.receiptNote}</p>
            {r.completedAt ? <p>{t("completedAt")}: {formatDateTime(r.completedAt, locale)}</p> : null}
            <p className="text-xs leading-5 text-muted">{t("manualNotice")}</p>
          </div>
        ) : <p className="text-sm text-muted">{t("legacy")}</p>
      ) : null}
      {r.status === "CANCELLED" ? (
        <div className="border-t border-rule pt-3 text-sm">
          <p className="break-words whitespace-pre-wrap">{t("cancelReason")}: {r.cancelReason ?? "—"}</p>
          {r.cancelledAt ? <p>{t("cancelledAt")}: {formatDateTime(r.cancelledAt, locale)}</p> : null}
        </div>
      ) : null}
      {r.contacts ? (
        <dl className="grid gap-3 border-t border-rule pt-3 text-sm sm:grid-cols-2">
          {(["seller", "buyer"] as const).map(role => (
            <div key={role} className="min-w-0">
              <dt className="font-semibold">{t(role === "seller" ? "sellerContact" : "buyerContact")}</dt>
              <dd className="break-words">{r.contacts?.[role].displayName}<br />{r.contacts?.[role].email}<br />{r.contacts?.[role].phone}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

export function AccountReservationDetails() {
  return <Suspense><SelectedReservation /></Suspense>;
}

function SelectedReservation() {
  const id = useSearchParams().get("reservation");
  const { user, clearSessionAndRedirect } = useAuth();
  const locale = useLocale();
  const t = useTranslations("collection");
  const [run, setRun] = useState(0);
  const [state, setState] = useState<
    { id: string; status: "loading" } |
    { id: string; status: "error"; message: string } |
    { id: string; status: "ready"; data: ReservationDetail }
  >({ id: "", status: "loading" });

  useEffect(() => {
    if (!id || !user) return;
    let cancelled = false;
    setState({ id, status: "loading" });
    void (async () => {
      const result = checkAuthExpiry(await fetchReservation(id), clearSessionAndRedirect);
      if (cancelled) return;
      setState(result.ok ? { id, status: "ready", data: result.data } : { id, status: "error", message: marketplaceErrorMessage(result.error, locale) });
    })();
    return () => { cancelled = true; };
  }, [id, user, clearSessionAndRedirect, locale, run]);

  if (!id) return null;
  const loading = state.id !== id || state.status === "loading";
  return (
    <section data-testid="account-reservation-detail" aria-busy={loading} aria-live="polite" className="min-w-0 rounded-lg border border-edge bg-paper p-5">
      <h2 className="mb-4 font-display text-xl font-bold text-ink">{t("title")}</h2>
      {loading ? <p role="status">{t("loading")}</p> : state.status === "ready" ? <ReservationSummary reservation={state.data} /> : state.status === "error" ? <p role="alert" className="text-sm text-red-800">{state.message}</p> : null}
      <button type="button" disabled={loading} onClick={() => setRun(n => n + 1)} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md border border-edge px-4 text-sm font-semibold hover:bg-mint-surface disabled:opacity-60"><EcoMorphIcon icon={loading ? MORPH_PATHS.clock : MORPH_PATHS.refresh} />{t("refresh")}</button>
    </section>
  );
}
