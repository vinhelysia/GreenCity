"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { useAuth } from "@/components/auth-provider";
import { fetchChatwootIdentity } from "@/lib/api";

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
    /** Only exists after the SDK fires `chatwoot:ready`. */
    $chatwoot?: {
      setUser: (
        identifier: string,
        attributes: { identifier_hash: string },
      ) => void;
      reset: () => void;
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
  const { user } = useAuth();
  const [sdkReady, setSdkReady] = useState(false);
  // Which account the widget is currently bound to. `null` means anonymous.
  const boundUserRef = useRef<string | null>(null);

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

  // The SDK publishes $chatwoot only when it fires `chatwoot:ready`; calling
  // setUser before that silently does nothing.
  useEffect(() => {
    if (window.$chatwoot) {
      setSdkReady(true);
      return;
    }
    const onReady = () => setSdkReady(true);
    window.addEventListener("chatwoot:ready", onReady);
    return () => window.removeEventListener("chatwoot:ready", onReady);
  }, []);

  /**
   * Bind the widget to whoever is signed in, and unbind on the way out.
   *
   * Keyed on the user id rather than on a login event so an account *switch* is
   * handled too: without the reset, the next person to use this browser
   * inherits the previous person's conversation — the exact leak that verified
   * identity exists to prevent.
   */
  useEffect(() => {
    if (!sdkReady) return;

    const currentId = user?.id ?? null;
    if (boundUserRef.current === currentId) return;

    // Covers logout and A→B switching. Skipped on the first bind, when there
    // is nothing to clear.
    if (boundUserRef.current !== null) window.$chatwoot?.reset();
    boundUserRef.current = currentId;

    if (!currentId) return;

    let cancelled = false;
    void (async () => {
      const result = await fetchChatwootIdentity();
      // Anonymous (401) and identity-validation-off (503) both land here and
      // both leave the widget usable, just unverified.
      if (cancelled || !result.ok) return;
      // A slow response must not bind a stale identity after another switch.
      if (boundUserRef.current !== currentId) return;
      window.$chatwoot?.setUser(result.data.userId, {
        identifier_hash: result.data.identifierHash,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [sdkReady, user?.id]);

  return null;
}
