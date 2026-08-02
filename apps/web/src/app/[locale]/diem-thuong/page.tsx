"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { PointsBalance, RewardOfferList } from "@greencity/shared";
import { useAuth } from "@/components/auth-provider";
import { CountUp } from "@/components/count-up";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { SignInRequired } from "@/components/sign-in-required";
import { fetchMyPoints, fetchRewardOffers } from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/format";

type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

export default function DiemThuongPage() {
  const locale = useLocale();
  const t = useTranslations("rewards");
  const tCommon = useTranslations("common");
  const { status: authStatus } = useAuth();
  const [pointsState, setPointsState] = useState<LoadState<PointsBalance>>({
    status: "loading",
  });
  const [offersState, setOffersState] = useState<LoadState<RewardOfferList>>({
    status: "loading",
  });

  const reasonLabels: Record<string, string> = {
    LISTING_COMPLETED: locale === "en" ? "Completed scrap sale transaction" : "Hoàn tất giao dịch bán phế liệu",
    CLEANUP_VERIFIED: locale === "en" ? "Verified dumping site report" : "Báo cáo điểm rác được xác minh",
  };

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    let cancelled = false;

    void (async () => {
      const res = await fetchMyPoints();
      if (cancelled) return;
      if (!res.ok) {
        setPointsState({
          status: "error",
          message: locale === "en" ? "Unable to load reward points. Please refresh the page." : "Không tải được điểm thưởng. Bạn thử tải lại trang nhé.",
        });
      } else {
        setPointsState({ status: "ready", data: res.data });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authStatus, locale]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    let cancelled = false;

    void (async () => {
      const res = await fetchRewardOffers();
      if (cancelled) return;
      if (!res.ok) {
        setOffersState({
          status: "error",
          message: locale === "en" ? "Unable to load reward offers. Please refresh the page." : "Không tải được danh sách ưu đãi. Bạn thử tải lại trang nhé.",
        });
      } else {
        setOffersState({ status: "ready", data: res.data });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authStatus, locale]);

  return (
    <div className="min-w-0 space-y-8">
      <PageHeader
        title={t("title")}
        description={t("lede")}
      />

      {authStatus === "unauthenticated" ? (
        <SignInRequired
          testId="points-login-required"
          actionKey="actionViewRewards"
        />
      ) : (
        <div role="status" aria-live="polite" className="min-w-0 space-y-8">
          {authStatus === "loading" || pointsState.status === "loading" ? (
            <>
              <section
                aria-labelledby="balance-heading"
                className="min-w-0 rounded-lg border border-rule bg-paper-2 px-5 py-6 sm:px-7 sm:py-7"
              >
                <h2
                  id="balance-heading"
                  className="font-display text-xs font-semibold uppercase tracking-widest text-primary"
                >
                  {t("totalPoints")}
                </h2>
                <div aria-hidden="true" className="mt-4">
                  <div className="skeleton h-12 w-48" />
                </div>
              </section>
              <Section id="lich-su-diem" title={t("ledgerTitle")}>
                <div aria-hidden="true" className="space-y-3">
                  <div className="skeleton h-16 w-full" />
                  <div className="skeleton h-16 w-full" />
                </div>
              </Section>
            </>
          ) : pointsState.status === "error" ? (
            <Section id="lich-su-diem" title={t("title")}>
              <EmptyState
                testId="points-error"
                title={locale === "en" ? "Unable to load reward points" : "Không thể tải thông tin điểm thưởng"}
                description={pointsState.message}
              />
            </Section>
          ) : (
            <>
              <section
                aria-labelledby="balance-heading"
                className="min-w-0 rounded-lg border border-rule bg-paper-2 px-5 py-6 sm:px-7 sm:py-7"
              >
                <h2
                  id="balance-heading"
                  className="font-display text-xs font-semibold uppercase tracking-widest text-primary"
                >
                  {t("totalPoints")}
                </h2>
                <div className="mt-3 flex items-baseline gap-2">
                  <CountUp
                    value={pointsState.data.balance}
                    className="font-display text-4xl font-bold leading-none tracking-tight tabular-nums text-primary [overflow-wrap:anywhere] sm:text-5xl"
                  />
                  <span className="text-lg font-medium text-muted">{tCommon("points")}</span>
                </div>
              </section>

              <Section id="cach-nhan-diem" title={t("earnTitle")}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <article className="rounded-md border border-edge bg-paper p-5">
                    <h3 className="font-display text-lg font-bold text-ink">
                      {t("earnSellTitle")}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {t("earnSellDescription")}
                    </p>
                  </article>
                  <article className="rounded-md border border-edge bg-paper p-5">
                    <h3 className="font-display text-lg font-bold text-ink">
                      {t("earnCleanupTitle")}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {t("earnCleanupDescription")}
                    </p>
                  </article>
                </div>
              </Section>

              <Section id="doi-diem" title={t("redeemTitle")}>
                <p className="mb-4 max-w-3xl text-sm leading-6 text-muted">
                  {t("redeemNotice")}
                </p>
                {offersState.status === "loading" ? (
                  <div
                    aria-hidden="true"
                    className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  >
                    <div className="skeleton h-56 w-full" />
                    <div className="skeleton h-56 w-full" />
                    <div className="skeleton h-56 w-full" />
                  </div>
                ) : offersState.status === "error" ? (
                  <EmptyState
                    testId="offers-error"
                    title={t("offersErrorTitle")}
                    description={offersState.message}
                  />
                ) : offersState.data.offers.length === 0 ? (
                  <EmptyState
                    testId="offers-empty"
                    title={t("offersEmptyTitle")}
                    description={t("offersEmptyDescription")}
                  />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {offersState.data.offers.map((offer) => (
                      <article
                        key={offer.slug}
                        className="relative overflow-hidden rounded-md border border-dashed border-edge bg-paper p-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="inline-flex rounded-full bg-paper-2 px-2.5 py-1 text-xs font-semibold text-primary">
                            {t("demoBadge")}
                          </span>
                          <span className="font-display text-sm font-bold text-primary">
                            {formatNumber(offer.pointsCost, locale)} {tCommon("points")}
                          </span>
                        </div>
                        <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-muted">
                          {t("illustrativePartner")}
                        </p>
                        <h3 className="mt-1 font-display text-xl font-bold text-ink">
                          {offer.merchantName}
                        </h3>
                        <p className="mt-2 min-h-12 text-sm leading-6 text-muted">
                          {locale === "en" ? offer.offerEn : offer.offerVi}
                        </p>
                        <p className="mt-4 border-y border-dashed border-rule py-3 font-mono text-xs text-muted">
                          {t("demoCode")}
                        </p>
                        <button
                          type="button"
                          disabled
                          className="mt-4 w-full cursor-not-allowed rounded-md border border-edge bg-paper-2 px-4 py-2.5 text-sm font-semibold text-muted opacity-70"
                        >
                          {t("demoButton")}
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </Section>

              <Section id="lich-su-diem" title={t("ledgerTitle")}>
                {pointsState.data.entries.length === 0 ? (
                  <EmptyState
                    testId="points-empty"
                    title={locale === "en" ? "No points yet" : "Chưa có điểm nào"}
                    description={t("noEntries")}
                  />
                ) : (
                  <ul className="divide-y divide-rule rounded-md border border-edge bg-paper">
                    {pointsState.data.entries.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex items-center justify-between p-4"
                      >
                        <div className="min-w-0 flex-1 pr-4">
                          <p className="font-medium text-ink">
                            {reasonLabels[entry.reason] ?? entry.reason}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {formatDate(entry.occurredAt, locale)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="font-display text-lg font-bold text-primary">
                            +{formatNumber(entry.delta, locale)} {tCommon("points")}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </>
          )}
        </div>
      )}
    </div>
  );
}
