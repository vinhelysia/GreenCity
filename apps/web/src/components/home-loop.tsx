"use client";

import { useTranslations } from "next-intl";
import { EcoMorphIcon, MORPH_PATHS } from "./morph-icon";

export function HomeLoop() {
  const tHome = useTranslations("home");

  const stages = [
    { n: 1, icon: MORPH_PATHS.price, title: tHome("step1Title"), body: tHome("step1Desc") },
    { n: 2, icon: MORPH_PATHS.camera, title: tHome("step2Title"), body: tHome("step2Desc") },
    { n: 3, icon: MORPH_PATHS.quote, title: tHome("step3Title"), body: tHome("step3Desc") },
    { n: 4, icon: MORPH_PATHS.truck, title: tHome("step4Title"), body: tHome("step4Desc") },
    { n: 5, icon: MORPH_PATHS.points, title: tHome("step5Title"), body: tHome("step5Desc") },
  ];

  return (
    <ol className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {stages.map((stage) => (
        <li key={stage.n} className="min-w-0 rounded-lg border border-edge bg-card p-5">
          <span aria-hidden="true" className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-mint-surface text-primary">
            <EcoMorphIcon icon={stage.icon} className="h-5 w-5" />
          </span>
          <h3 className="mt-4 font-display text-lg font-bold tracking-tight text-ink">{stage.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">{stage.body}</p>
        </li>
      ))}
    </ol>
  );
}
