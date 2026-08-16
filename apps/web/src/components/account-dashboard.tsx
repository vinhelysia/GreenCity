"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type {
  AccountHistory,
  CleanupReportDto,
  PointsBalance,
  PublicUser,
  ScrapRequestDto,
  SubscriptionState,
} from "@greencity/shared";
import { useAuth } from "@/components/auth-provider";
import { EcoBadge } from "@/components/eco-badge";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { SignInRequired } from "@/components/sign-in-required";
import { Link } from "@/i18n/routing";
import {
  checkAuthExpiry,
  fetchAccountHistory,
  fetchMyCleanupReports,
  fetchMyPoints,
  fetchMyScrapRequests,
  fetchSubscriptionState,
} from "@/lib/api";
import { formatCategoryName, formatDate, formatNumber, formatVnd } from "@/lib/format";

const DASHBOARD_LIMIT = 5;

/**
 * One list idiom for every record this page shows — points, sales,
 * reservations, payments, cleanup reports.
 *
 * Each of those used to be its own bordered card stacked inside a Section that
 * already draws a boundary, and some of them held a second tinted surface for
 * the rows: three levels of container for one list. Sharing the shell means the
 * page reads as one document rather than a wall of identical boxes, and the
 * records differ by what they say rather than by how they are framed.
 */
const LIST_SHELL = "divide-y divide-rule rounded-lg border border-edge bg-paper";
const LIST_ROW = "flex flex-wrap items-start justify-between gap-3 p-4";

type LoadState<T> =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: T };

function LoadingRows() {
  return (
    <div aria-hidden="true" className="space-y-3">
      <div className="skeleton h-16 w-full" />
      <div className="skeleton h-16 w-full" />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tAccount = useTranslations("account");
  const tStatus = useTranslations("status");

  const label = (() => {
    switch (status) {
      case "SUBMITTED":
        return tStatus("submitted");
      case "QUOTED":
        return tStatus("quoted");
      case "ACCEPTED":
        return tStatus("accepted");
      case "REJECTED":
        return tStatus("rejected");
      case "AVAILABLE":
        return tStatus("available");
      case "RESERVED":
        return tStatus("reserved");
      case "COMPLETED":
        return tStatus("completed");
      case "CANCELLED":
        return tStatus("cancelled");
      case "VERIFIED":
        return tStatus("verified");
      case "ACTIVE":
        return tAccount("statusActive");
      case "EXPIRED":
        return tAccount("statusExpired");
      case "PENDING":
        return tAccount("statusPending");
      case "PAID":
        return tAccount("statusPaid");
      case "FAILED":
        return tAccount("statusFailed");
      default:
        return status;
    }
  })();

  const variant = ["COMPLETED", "VERIFIED", "PAID", "ACTIVE"].includes(status)
    ? "primary"
    : ["REJECTED", "CANCELLED", "FAILED"].includes(status)
      ? "coral"
      : ["PENDING", "SUBMITTED", "QUOTED", "RESERVED"].includes(status)
        ? "yellow"
        : "gray";

  return <EcoBadge variant={variant}>{label}</EcoBadge>;
}

function SectionError({ testId }: { testId?: string }) {
  const tAccount = useTranslations("account");
  return (
    <EmptyState
      testId={testId}
      title={tAccount("loadError")}
    />
  );
}

/**
 * Account read model. It never owns a mutation: all actions link to their
 * existing flows, and the client only asks for five recent rows per endpoint.
 */
export function AccountDashboard() {
  const { status: authStatus, user, clearSessionAndRedirect } = useAuth();
  const tAccount = useTranslations("account");

  return (
    <div className="min-w-0 space-y-8">
      <PageHeader title={tAccount("title")} description={tAccount("lede")} />

      {authStatus === "unauthenticated" ? (
        <SignInRequired testId="account-login-required" />
      ) : authStatus === "loading" || !user ? (
        <section aria-label={tAccount("loading")} aria-busy="true">
          <LoadingRows />
        </section>
      ) : (
        <AuthenticatedAccountDashboard
          user={user}
          clearSessionAndRedirect={clearSessionAndRedirect}
        />
      )}
    </div>
  );
}

function AuthenticatedAccountDashboard({
  user,
  clearSessionAndRedirect,
}: {
  user: PublicUser;
  clearSessionAndRedirect: () => void;
}) {
  const locale = useLocale();
  const tAccount = useTranslations("account");
  const tCommon = useTranslations("common");
  const [points, setPoints] = useState<LoadState<PointsBalance>>({
    status: "loading",
  });
  const [sales, setSales] = useState<LoadState<ScrapRequestDto[]>>({
    status: "loading",
  });
  const [cleanup, setCleanup] = useState<LoadState<CleanupReportDto[]>>({
    status: "loading",
  });
  const [subscription, setSubscription] = useState<LoadState<SubscriptionState>>({
    status: "loading",
  });
  const [history, setHistory] = useState<LoadState<AccountHistory>>({
    status: "loading",
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const result = checkAuthExpiry(
        await fetchMyPoints({ limit: DASHBOARD_LIMIT }),
        clearSessionAndRedirect,
      );
      if (!cancelled) {
        setPoints(
          result.ok
            ? { status: "ready", data: result.data }
            : { status: "error" },
        );
      }
    })();

    void (async () => {
      const result = checkAuthExpiry(
        await fetchMyScrapRequests({ limit: DASHBOARD_LIMIT }),
        clearSessionAndRedirect,
      );
      if (!cancelled) {
        setSales(
          result.ok
            ? { status: "ready", data: result.data.requests }
            : { status: "error" },
        );
      }
    })();

    void (async () => {
      const result = checkAuthExpiry(
        await fetchMyCleanupReports({ limit: DASHBOARD_LIMIT }),
        clearSessionAndRedirect,
      );
      if (!cancelled) {
        setCleanup(
          result.ok
            ? { status: "ready", data: result.data.reports }
            : { status: "error" },
        );
      }
    })();

    void (async () => {
      const result = checkAuthExpiry(
        await fetchSubscriptionState(),
        clearSessionAndRedirect,
      );
      if (!cancelled) {
        setSubscription(
          result.ok
            ? { status: "ready", data: result.data }
            : { status: "error" },
        );
      }
    })();

    void (async () => {
      const result = checkAuthExpiry(
        await fetchAccountHistory({ limit: DASHBOARD_LIMIT }),
        clearSessionAndRedirect,
      );
      if (!cancelled) {
        setHistory(
          result.ok
            ? { status: "ready", data: result.data }
            : { status: "error" },
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clearSessionAndRedirect]);

  return (
    <div data-testid="account-dashboard" className="min-w-0 space-y-10">
      <Section id="account-profile" title={tAccount("profileTitle")} tone="open">
        {/* No card: the Section already bounds this, and identity reads better
            as a heading with details under it than as a boxed record. */}
        <div
          data-testid="account-profile"
          className="grid gap-4 sm:grid-cols-2"
        >
          <div>
            <p className="break-words font-display text-2xl font-bold tracking-tight text-ink">
              {user.displayName?.trim() || user.email}
            </p>
            <p className="mt-1 break-words text-sm text-muted">{user.email}</p>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-ink">{tAccount("phone")}</dt>
              <dd className="mt-0.5 text-muted">
                {user.phone?.trim() || tAccount("phoneMissing")}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">{tAccount("memberSince")}</dt>
              <dd className="mt-0.5 text-muted">{formatDate(user.createdAt, locale)}</dd>
            </div>
          </dl>
        </div>
      </Section>

      <Section id="account-points" title={tAccount("pointsTitle")} tone="ruled">
        <div data-testid="account-points" aria-live="polite" className="min-w-0 space-y-5">
          {points.status === "loading" ? (
            <LoadingRows />
          ) : points.status === "error" ? (
            <SectionError testId="account-points-error" />
          ) : (
            <>
              {/* The balance is one number, so it is set as one number rather
                  than boxed. The two ways to earn are a short list, not two
                  tinted pills inside a card inside a section. */}
              <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-warm-900">
                    {tAccount("pointsBalance")}
                  </p>
                  <p className="mt-2 font-display text-4xl font-bold tabular-nums text-warm-900">
                    {formatNumber(points.data.balance, locale)} {tCommon("points")}
                  </p>
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-bold text-ink">
                    {tAccount("pointsHow")}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {tAccount("pointsHowText")}
                  </p>
                  <ul className="mt-3 space-y-1 text-sm text-ink">
                    <li>{tAccount("pointsSale")}</li>
                    <li>{tAccount("pointsCleanup")}</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="font-display text-lg font-bold text-ink">
                  {tAccount("pointsRecent")}
                </h3>
                {points.data.entries.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">{tAccount("pointsEmpty")}</p>
                ) : (
                  <ul className="mt-3 divide-y divide-rule rounded-lg border border-edge bg-paper">
                    {points.data.entries.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex items-center justify-between gap-4 p-4"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-ink">
                            {entry.reason === "LISTING_COMPLETED"
                              ? tAccount("pointsSale")
                              : tAccount("pointsCleanup")}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {formatDate(entry.occurredAt, locale)}
                          </p>
                        </div>
                        <span className="shrink-0 font-display font-bold tabular-nums text-primary">
                          +{formatNumber(entry.delta, locale)} {tCommon("points")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
          <div className="rounded-lg border border-dashed border-edge bg-paper-2 p-4 text-sm leading-6 text-muted">
            <p data-testid="account-demo-notice">{tAccount("demoNotice")}</p>
            <Link
              href="/diem-thuong"
              className="mt-3 inline-flex font-semibold text-primary underline-offset-4 hover:underline"
            >
              {tAccount("viewRewards")}
            </Link>
          </div>
        </div>
      </Section>

      <Section id="account-sales" title={tAccount("salesTitle")} lede={tAccount("salesLede")}>
        <div data-testid="account-sales" aria-live="polite">
          {sales.status === "loading" ? (
            <LoadingRows />
          ) : sales.status === "error" ? (
            <SectionError testId="account-sales-error" />
          ) : sales.data.length === 0 ? (
            <EmptyState title={tAccount("salesEmpty")} />
          ) : (
            <ul className={LIST_SHELL}>
              {sales.data.map((sale) => (
                <li
                  key={sale.id}
                  className={LIST_ROW}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      {formatCategoryName(sale.category.name, locale)}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {formatNumber(sale.estimatedWeightKg, locale)} kg · {formatDate(sale.createdAt, locale)}
                    </p>
                    {sale.activeQuote ? (
                      <p className="mt-1 text-sm text-muted">
                        {formatVnd(sale.activeQuote.pricePerKgVnd, locale)}{tCommon("perKg")}
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge status={sale.status} />
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/ban-phe-lieu"
            className="mt-4 inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline"
          >
            {tAccount("viewSales")}
          </Link>
        </div>
      </Section>

      <Section
        id="account-reservations"
        title={tAccount("reservationsTitle")}
        lede={tAccount("reservationsLede")}
      >
        <div data-testid="account-reservations" aria-live="polite">
          {history.status === "loading" ? (
            <LoadingRows />
          ) : history.status === "error" ? (
            <EmptyState
              testId="account-history-error"
              title={tAccount("historyError")}
              description={tAccount("historyError")}
            />
          ) : history.data.reservations.length === 0 ? (
            <EmptyState title={tAccount("reservationsEmpty")} />
          ) : (
            <ul className={LIST_SHELL}>
              {history.data.reservations.map((reservation) => (
                <li
                  key={reservation.id}
                  className={LIST_ROW}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      {formatCategoryName(reservation.categoryName, locale)}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {formatNumber(reservation.estimatedWeightKg, locale)} kg · {formatVnd(reservation.buyerPricePerKgVnd, locale)}{tCommon("perKg")}
                    </p>
                    <p className="mt-1 font-semibold tabular-nums text-ink">
                      {formatVnd(reservation.estimatedTotalVnd, locale)}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {formatDate(reservation.createdAt, locale)}
                    </p>
                  </div>
                  <StatusBadge status={reservation.status} />
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/cho-online"
            className="mt-4 inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline"
          >
            {tAccount("viewMarketplace")}
          </Link>
        </div>
      </Section>

      <Section id="account-subscription" title={tAccount("subscriptionTitle")}>
        <div data-testid="account-subscription" aria-live="polite" className="grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="font-display text-lg font-bold text-ink">
              {tAccount("currentPass")}
            </h3>
            {subscription.status === "loading" ? (
              <div aria-hidden="true" className="mt-3 skeleton h-20 w-full" />
            ) : subscription.status === "error" ? (
              <div className="mt-3">
                <SectionError testId="account-subscription-error" />
              </div>
            ) : (
              <div className="mt-3">
                <p className="font-medium text-ink">
                  {subscription.data.eligible
                    ? tAccount("passActive")
                    : tAccount("passInactive")}
                </p>
                {subscription.data.subscription ? (
                  <p className="mt-1 text-sm text-muted">
                    {tAccount("passExpires", {
                      date: formatDate(subscription.data.subscription.expiresAt, locale),
                    })}
                  </p>
                ) : null}
              </div>
            )}
          </div>

          <div>
            <h3 className="font-display text-lg font-bold text-ink">
              {tAccount("subscriptionHistory")}
            </h3>
            {history.status === "loading" ? (
              <div aria-hidden="true" className="mt-3 skeleton h-20 w-full" />
            ) : history.status === "error" ? (
              <p className="mt-3 text-sm leading-6 text-muted">{tAccount("historyError")}</p>
            ) : history.data.subscriptions.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{tAccount("subscriptionsEmpty")}</p>
            ) : (
              <ul className={`mt-3 ${LIST_SHELL}`}>
                {history.data.subscriptions.map((item) => (
                  <li key={item.id} className={`${LIST_ROW} text-sm`}>
                    <span className="text-muted">
                      {formatDate(item.startsAt, locale)} – {formatDate(item.expiresAt, locale)}
                    </span>
                    <StatusBadge status={item.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="lg:col-span-2">
            <h3 className="font-display text-lg font-bold text-ink">
              {tAccount("paymentHistory")}
            </h3>
            {history.status === "loading" ? (
              <div aria-hidden="true" className="mt-3 skeleton h-20 w-full" />
            ) : history.status === "error" ? (
              <p className="mt-3 text-sm leading-6 text-muted">{tAccount("historyError")}</p>
            ) : history.data.payments.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{tAccount("paymentsEmpty")}</p>
            ) : (
              <ul className={`mt-3 ${LIST_SHELL}`}>
                {history.data.payments.map((payment) => (
                  <li
                    key={payment.id}
                    className={LIST_ROW}
                  >
                    <div>
                      <p className="font-medium tabular-nums text-ink">
                        {formatVnd(payment.amountVnd, locale)}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        {tAccount("paymentProvider", {
                          provider: payment.provider === "PAYOS" ? "payOS" : "MoMo",
                        })}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {payment.paidAt
                          ? tAccount("paymentPaidAt", {
                              date: formatDate(payment.paidAt, locale),
                            })
                          : formatDate(payment.createdAt, locale)}
                      </p>
                    </div>
                    <StatusBadge status={payment.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Section>

      <Section id="account-cleanup" title={tAccount("cleanupTitle")} lede={tAccount("cleanupLede")}>
        <div data-testid="account-cleanup" aria-live="polite">
          {cleanup.status === "loading" ? (
            <LoadingRows />
          ) : cleanup.status === "error" ? (
            <SectionError testId="account-cleanup-error" />
          ) : cleanup.data.length === 0 ? (
            <EmptyState title={tAccount("cleanupEmpty")} />
          ) : (
            <ul className={LIST_SHELL}>
              {cleanup.data.map((report) => (
                <li
                  key={report.id}
                  className={LIST_ROW}
                >
                  <div className="min-w-0">
                    <p className="break-words font-medium text-ink">{report.description}</p>
                    <p className="mt-1 text-sm text-muted">
                      {formatDate(report.createdAt, locale)}
                    </p>
                  </div>
                  <StatusBadge status={report.status} />
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/dong-gop"
            className="mt-4 inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline"
          >
            {tAccount("viewCleanup")}
          </Link>
        </div>
      </Section>

      <Section id="account-withdrawal" title={tAccount("withdrawalTitle")} tone="band">
        <div
          data-testid="account-withdrawal-not-supported"
          className="max-w-3xl border-l-2 border-coral pl-5"
        >
          <p className="font-display text-xl font-bold text-ink">
            {tAccount("withdrawalNoCash")}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted">
            {tAccount("withdrawalDetails")}
          </p>
        </div>
      </Section>
    </div>
  );
}
