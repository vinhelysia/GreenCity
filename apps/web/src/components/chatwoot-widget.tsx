"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";

/**
 * Chatwoot support chat bubble.
 *
 * Fail-open by design: with either public value unset this injects nothing, so
 * local dev, previews, and a Chatwoot outage all leave GreenCity working
 * normally. Unsetting the two Vercel variables is therefore also the rollback —
 * it needs no code change.
 *
 * Only the website token and base URL belong in the browser. The inbox HMAC
 * secret is server-side and is deliberately absent here: this widget starts
 * anonymous conversations only, so agents must not treat a visitor's claimed
 * identity as verified.
 *
 * Injected by hand rather than with next/script: the `lazyOnload` strategy did
 * not inject the tag at all in this App Router layout, and `beforeInteractive`
 * is not allowed outside the root layout. The SDK is a third-party script with
 * documented load-order requirements (chatwootSettings must exist before run),
 * so explicit ordering is worth more here than the wrapper.
 */

// Next inlines NEXT_PUBLIC_* only for a literal property access, never a
// computed one — read both as full static expressions.
const BASE_URL = process.env.NEXT_PUBLIC_CHATWOOT_BASE_URL;
const WEBSITE_TOKEN = process.env.NEXT_PUBLIC_CHATWOOT_WEBSITE_TOKEN;

const SCRIPT_ID = "chatwoot-sdk";

declare global {
  interface Window {
    chatwootSettings?: Record<string, unknown>;
    chatwootSDK?: {
      run: (config: { websiteToken: string; baseUrl: string }) => void;
    };
  }
}

export function ChatwootWidget() {
  // Opens the widget in the language the page is already being read in.
  // ponytail: initial locale only. Switching language mid-session keeps the
  // widget's first locale until reload; syncing it live needs a
  // `chatwoot:ready` listener before $chatwoot.setLocale, which is worth adding
  // alongside the setUser call in the verified-identity task.
  const locale = useLocale();

  useEffect(() => {
    if (!BASE_URL || !WEBSITE_TOKEN) return;
    // One bubble per page, whatever re-runs this: App Router navigation, a
    // locale change, or StrictMode's double effect in development.
    if (document.getElementById(SCRIPT_ID)) return;

    // run() is what reads chatwootSettings, so it has to exist first.
    window.chatwootSettings = { locale, position: "right", type: "standard" };

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `${BASE_URL}/packs/js/sdk.js`;
    script.async = true;
    script.onload = () => {
      window.chatwootSDK?.run({
        websiteToken: WEBSITE_TOKEN,
        baseUrl: BASE_URL,
      });
    };
    script.onerror = () => {
      console.warn("[chatwoot] SDK failed to load; support chat unavailable.");
    };
    document.body.appendChild(script);
  }, [locale]);

  return null;
}
