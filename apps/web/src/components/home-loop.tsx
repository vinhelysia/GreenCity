"use client";

import { useTranslations } from "next-intl";

export function HomeLoop() {
  const tHome = useTranslations("home");

  const stages = [
    {
      n: 1,
      title: tHome("step1Title"),
      body: tHome("step1Desc"),
    },
    {
      n: 2,
      title: tHome("step2Title"),
      body: tHome("step2Desc"),
    },
    {
      n: 3,
      title: tHome("step3Title"),
      body: tHome("step3Desc"),
    },
    {
      n: 4,
      title: tHome("step4Title"),
      body: tHome("step4Desc"),
    },
    {
      n: 5,
      title: tHome("step5Title"),
      body: tHome("step5Desc"),
    },
  ];

  return (
    <ol className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {stages.map((stage) => (
        <li
          key={stage.n}
          className="group relative flex min-w-0 flex-col justify-between rounded-2xl border border-edge bg-card p-6 shadow-eco transition-shadow hover:shadow-eco-hover"
        >
          <div>
            <span
              aria-hidden="true"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-mint-surface font-display text-sm font-bold tabular-nums text-primary"
            >
              {String(stage.n).padStart(2, "0")}
            </span>
            <h3 className="mt-4 font-display text-lg font-bold tracking-tight text-ink">
              {stage.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{stage.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
