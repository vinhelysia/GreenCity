"use client";

import { Suspense, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { GoogleOAuthStatusSchema, GoogleOAuthUrlSchema } from "@greencity/shared";
import { apiFetch } from "@/lib/api";
import { getPathname, type Pathnames } from "@/i18n/routing";

export function GoogleAuthButton(props: { returnTo?: Pathnames; link?: boolean; disabled?: boolean }) {
  return <Suspense fallback={null}><GoogleAuthAction {...props} /></Suspense>;
}

function GoogleAuthAction({ returnTo = "/tai-khoan", link = false, disabled = false }: { returnTo?: Pathnames; link?: boolean; disabled?: boolean }) {
  const locale = useLocale();
  const t = useTranslations("auth");
  const params = useSearchParams();
  const [status, setStatus] = useState<{ enabled: boolean; linked: boolean } | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void apiFetch<unknown>("/api/auth/google/status").then(result => {
      if (!cancelled && result.ok) {
        const parsed = GoogleOAuthStatusSchema.safeParse(result.data);
        if (parsed.success) setStatus(parsed.data);
      }
    });
    return () => { cancelled = true; };
  }, []);

  async function start() {
    if (pending) return;
    setPending(true);
    setFailed(false);
    const result = await apiFetch<unknown>(link ? "/api/auth/google/link" : "/api/auth/google/start", {
      method: "POST", body: JSON.stringify({ returnTo: getPathname({ locale: locale === "en" ? "en" : "vi", href: returnTo }) }),
    });
    const parsed = result.ok ? GoogleOAuthUrlSchema.safeParse(result.data) : null;
    if (parsed?.success) { window.location.assign(parsed.data.url); return; }
    setFailed(true);
    setPending(false);
  }

  const callbackError = params.get("googleError");
  const error = failed || callbackError === "failed" ? t("googleFailed") : callbackError === "link_required" ? t("googleLinkRequired") : null;
  if (!status?.enabled && !error) return null;
  return (
    <div data-testid={link ? "google-link-panel" : "google-sign-in-panel"} className="space-y-3">
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {link && status?.linked ? <p role="status" className="text-sm text-primary">{t("googleLinked")}</p> : status?.enabled ? (
        <>
          <button type="button" onClick={() => { void start(); }} disabled={pending || disabled} aria-busy={pending}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2.5 rounded border border-[#747775] bg-white px-3 py-2.5 text-sm font-medium text-[#1f1f1f] hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60">
            {/* Official Google brand asset; decorative because the visible text names the provider. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/google-g-logo.png" width={20} height={20} alt="" className="h-5 w-5 shrink-0" />
            {pending ? t("googleRedirecting") : link ? t("googleLink") : t("googleSignIn")}
          </button>
          {link ? <p className="text-sm text-muted">{t("googleLinkHint")}</p> : <p className="text-center text-sm text-muted">{t("googleOrEmail")}</p>}
        </>
      ) : null}
    </div>
  );
}
