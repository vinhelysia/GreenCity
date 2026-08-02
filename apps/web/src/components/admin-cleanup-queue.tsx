"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import type { CleanupReportDto } from "@greencity/shared";
import { useAuth } from "@/components/auth-provider";
import { EmptyState } from "@/components/empty-state";
import { ReportCoordinates } from "@/components/report-coordinates";
import { Link } from "@/i18n/routing";
import {
  checkAuthExpiry,
  fetchAdminCleanupReports,
  marketplaceErrorMessage,
  mediaUrl,
  rejectCleanupReport,
  verifyCleanupReport,
} from "@/lib/api";
import { formatDateTime } from "@/lib/format";

type LoadState =
  | { status: "loading" }
  | { status: "forbidden" }
  | { status: "error"; message: string }
  | { status: "ready"; data: CleanupReportDto[] };

export function AdminCleanupQueue() {
  const locale = useLocale();
  const tAdmin = useTranslations("admin");
  const tAuth = useTranslations("auth");
  const tErr = useTranslations("errors");
  const { status: authStatus, user, clearSessionAndRedirect } = useAuth();
  const isAdmin = user?.roles.includes("ADMIN") ?? false;
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    const result = checkAuthExpiry(
      await fetchAdminCleanupReports(),
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
    setState({ status: "ready", data: result.data.reports });
  }, [clearSessionAndRedirect, locale]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    void load();
  }, [authStatus, load]);

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
        testId="admin-cleanup-queue-login-required"
        title={locale === "en" ? "Sign In Required" : "Cần đăng nhập"}
        description={
          <p>
            <Link
              href="/dang-nhap"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {tAuth("loginButton")}
            </Link>{" "}
            {locale === "en" ? "with an administrator account." : "bằng tài khoản quản trị viên để xem hàng chờ báo cáo."}
          </p>
        }
      />
    );
  }

  if (!isAdmin || state.status === "forbidden") {
    return (
      <EmptyState
        testId="admin-cleanup-queue-forbidden"
        title={locale === "en" ? "Access Denied" : "Không có quyền truy cập"}
        description={tErr("forbidden")}
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
          testId="admin-cleanup-queue-empty"
          title={tAdmin("cleanupQueueTitle")}
          description={tAdmin("noItems")}
        />
      ) : (
        <ul className="flex min-w-0 flex-col gap-4">
          {state.data.map((report) => (
            <AdminCleanupRow
              key={report.id}
              report={report}
              onActionComplete={load}
              clearSessionAndRedirect={clearSessionAndRedirect}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AdminCleanupRow({
  report,
  onActionComplete,
  clearSessionAndRedirect,
}: {
  report: CleanupReportDto;
  onActionComplete: () => void;
  clearSessionAndRedirect: () => void;
}) {
  const locale = useLocale();
  const tAdmin = useTranslations("admin");
  const [submitting, setSubmitting] = useState<"verifying" | "rejecting" | null>(
    null,
  );
  const [serverError, setServerError] = useState<string | null>(null);

  const locationText = [
    report.addressLine,
    report.ward,
    report.district,
    report.city,
  ]
    .filter(Boolean)
    .join(", ");

  async function onVerify() {
    setServerError(null);
    setSubmitting("verifying");
    const result = checkAuthExpiry(
      await verifyCleanupReport(report.id),
      clearSessionAndRedirect,
    );
    if (!result.ok) {
      setServerError(marketplaceErrorMessage(result.error, locale));
      setSubmitting(null);
      return;
    }
    onActionComplete();
  }

  async function onReject() {
    setServerError(null);
    setSubmitting("rejecting");
    const result = checkAuthExpiry(
      await rejectCleanupReport(report.id),
      clearSessionAndRedirect,
    );
    if (!result.ok) {
      setServerError(marketplaceErrorMessage(result.error, locale));
      setSubmitting(null);
      return;
    }
    onActionComplete();
  }

  return (
    <li className="min-w-0 rounded-md border border-edge bg-paper p-4">
      <div className="flex min-w-0 flex-wrap gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mediaUrl(report.media.downloadPath)}
          alt=""
          className="h-20 w-20 shrink-0 rounded-md border border-edge object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">{report.description}</p>
          {locationText ? (
            <p className="mt-1 text-sm text-muted">
              {locale === "en" ? "Location: " : "Địa điểm: "}{locationText}
            </p>
          ) : null}
          <ReportCoordinates
            latitude={report.latitude}
            longitude={report.longitude}
          />
          <p className="mt-1 text-xs text-muted">
            {locale === "en" ? "Submitted: " : "Thời gian: "}{formatDateTime(report.createdAt, locale)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 border-t border-rule pt-3">
        <button
          type="button"
          disabled={submitting !== null}
          onClick={() => void onVerify()}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-eco-sm transition-opacity duration-quick ease-out hover:opacity-90 disabled:opacity-60"
        >
          {submitting === "verifying" ? tAdmin("processing") : tAdmin("verifyReport")}
        </button>
        <button
          type="button"
          disabled={submitting !== null}
          onClick={() => void onReject()}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-edge bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors duration-quick ease-out hover:border-primary disabled:opacity-60"
        >
          {submitting === "rejecting" ? tAdmin("processing") : tAdmin("rejectReport")}
        </button>
      </div>

      {serverError ? (
        <p role="alert" className="mt-2 text-sm text-red-800">
          {serverError}
        </p>
      ) : null}
    </li>
  );
}
