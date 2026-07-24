"use client";

import { useEffect, useState } from "react";
import type { PointsBalance } from "@greencity/shared";
import { useAuth } from "@/components/auth-provider";
import { CountUp } from "@/components/count-up";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { SignInRequired } from "@/components/sign-in-required";
import { fetchMyPoints } from "@/lib/api";

type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

const REASON_LABELS: Record<string, string> = {
  LISTING_COMPLETED: "Hoàn tất giao dịch bán phế liệu",
  CLEANUP_VERIFIED: "Báo cáo điểm rác được xác minh",
};

export default function DiemThuongPage() {
  const { status: authStatus } = useAuth();
  const [pointsState, setPointsState] = useState<LoadState<PointsBalance>>({
    status: "loading",
  });

  useEffect(() => {
    // Signed-out visitors get the sign-in panel below, not a failed request:
    // asking anyway would surface the API's own 401 text to the reader.
    if (authStatus !== "authenticated") return;
    let cancelled = false;

    void (async () => {
      const res = await fetchMyPoints();
      if (cancelled) return;
      if (!res.ok) {
        setPointsState({
          status: "error",
          message: "Không tải được điểm thưởng. Bạn thử tải lại trang nhé.",
        });
      } else {
        setPointsState({ status: "ready", data: res.data });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  const viFormatter = new Intl.NumberFormat("vi-VN");

  return (
    <div className="min-w-0 space-y-8">
      <PageHeader
        title="Điểm thưởng của tôi"
        description="Số dư điểm thưởng của bạn và lịch sử từng lần được cộng."
      />

      {authStatus === "unauthenticated" ? (
        <SignInRequired
          testId="points-login-required"
          action="xem điểm thưởng"
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
                className="font-display text-xs font-semibold uppercase tracking-widest text-accent"
              >
                Số dư điểm thưởng
              </h2>
              <div aria-hidden="true" className="mt-4">
                <div className="skeleton h-12 w-48" />
              </div>
            </section>
            <Section id="lich-su-diem" title="Lịch sử điểm thưởng">
              <div aria-hidden="true" className="space-y-3">
                <div className="skeleton h-16 w-full" />
                <div className="skeleton h-16 w-full" />
              </div>
            </Section>
          </>
        ) : pointsState.status === "error" ? (
          <Section id="lich-su-diem" title="Điểm thưởng">
            <EmptyState
              testId="points-error"
              title="Không thể tải thông tin điểm thưởng"
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
                className="font-display text-xs font-semibold uppercase tracking-widest text-accent"
              >
                Số dư điểm thưởng
              </h2>
              <div className="mt-3 flex items-baseline gap-2">
                <CountUp
                  value={pointsState.data.balance}
                  className="font-display text-4xl font-bold leading-none tracking-tight tabular-nums text-accent [overflow-wrap:anywhere] sm:text-5xl"
                />
                <span className="text-lg font-medium text-muted">điểm</span>
              </div>
            </section>

            <Section id="lich-su-diem" title="Lịch sử điểm thưởng">
              {pointsState.data.entries.length === 0 ? (
                <EmptyState
                  testId="points-empty"
                  title="Chưa có điểm nào"
                  description="Bạn chưa nhận được điểm thưởng nào. Hãy hoàn tất giao dịch bán phế liệu hoặc báo cáo điểm rác để tích điểm."
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
                          {REASON_LABELS[entry.reason] ?? entry.reason}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          {new Date(entry.occurredAt).toLocaleDateString(
                            "vi-VN",
                          )}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="font-display text-lg font-bold text-accent">
                          +{viFormatter.format(entry.delta)} điểm
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
