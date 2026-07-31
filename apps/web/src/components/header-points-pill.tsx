"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/components/auth-provider";
import { IconPoints } from "@/components/eco-icons";
import { fetchMyPoints } from "@/lib/api";
import { formatNumber } from "@/lib/format";

/** Warm anchor in the header: reward points balance, shown only when signed in. */
export function HeaderPointsPill() {
  const { status: authStatus } = useAuth();
  const locale = useLocale();
  const tCommon = useTranslations("common");
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setBalance(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchMyPoints();
      if (!cancelled && res.ok) setBalance(res.data.balance);
    })();
    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  if (authStatus !== "authenticated" || balance === null) return null;

  return (
    <span className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-warm-100 bg-warm-100 px-3 text-[13px] font-bold text-warm-900">
      <IconPoints className="h-4 w-4 text-warm-600" />
      {tCommon("pointsVal", { count: formatNumber(balance, locale) })}
    </span>
  );
}
