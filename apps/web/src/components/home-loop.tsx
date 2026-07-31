"use client";

import { useTranslations } from "next-intl";
import { EcoBadge } from "@/components/eco-badge";

// ponytail: no real order state is wired to the homepage yet, so stage 3 is a
// fixed demo "active" step. Swap ACTIVE_STAGE for real order progress if this
// ever tracks a specific user's order.
const ACTIVE_STAGE = 3;

export function HomeLoop() {
  const tHome = useTranslations("home");

  const stages = [
    { n: 1, title: tHome("step1Title"), body: tHome("step1Desc") },
    { n: 2, title: tHome("step2Title"), body: tHome("step2Desc") },
    { n: 3, title: tHome("step3Title"), body: tHome("step3Desc") },
    { n: 4, title: tHome("step4Title"), body: tHome("step4Desc") },
    { n: 5, title: tHome("step5Title"), body: tHome("step5Desc") },
  ];

  return (
    <ol className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {stages.map((stage) => {
        const status =
          stage.n < ACTIVE_STAGE ? "done" : stage.n === ACTIVE_STAGE ? "active" : "future";
        return (
          <li
            key={stage.n}
            className={`group relative flex min-w-0 flex-col justify-between rounded-2xl border p-6 shadow-eco transition-shadow hover:shadow-eco-hover ${
              status === "active" ? "!border-[rgba(196,69,27,0.3)] bg-warm-050" : "border-edge bg-card"
            } ${status === "future" ? "opacity-50" : ""}`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span
                  aria-hidden="true"
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-xl font-display text-sm font-bold tabular-nums ${
                    status === "active"
                      ? "bg-warm-600 text-white ring-4 !ring-[rgba(196,69,27,0.16)]"
                      : status === "done"
                        ? "bg-primary text-white"
                        : "border-2 border-edge bg-card text-muted"
                  }`}
                >
                  {String(stage.n).padStart(2, "0")}
                </span>
                {status === "active" ? (
                  <EcoBadge variant="coral">{tHome("stepStatusActive")}</EcoBadge>
                ) : status === "done" ? (
                  <EcoBadge variant="mint">{tHome("stepStatusDone")}</EcoBadge>
                ) : null}
              </div>
              <h3 className="mt-4 font-display text-lg font-bold tracking-tight text-ink">
                {stage.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{stage.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
