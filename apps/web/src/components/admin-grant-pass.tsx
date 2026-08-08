"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { grantSubscription, marketplaceErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";

/**
 * Hands a buyer pass to an account without a payment.
 *
 * This is the only route to eligibility that works: the payOS checkout has
 * never run against a real merchant account, so without it a newly registered
 * account can browse the marketplace and never reserve anything.
 *
 * The reason field is required rather than optional — the server rejects a
 * blank one — because free access to a paid feature that nobody wrote a reason
 * for is indistinguishable from a mistake.
 */
export function AdminGrantPass() {
  const locale = useLocale();
  const t = useTranslations("admin");
  const emailId = useId();
  const daysId = useId();
  const noteId = useId();

  const [email, setEmail] = useState("");
  const [durationDays, setDurationDays] = useState(30);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [granted, setGranted] = useState<{
    email: string;
    expiresAt: string;
  } | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setGranted(null);

    const result = await grantSubscription({
      email: email.trim(),
      durationDays,
      note: note.trim(),
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(marketplaceErrorMessage(result.error, locale));
      return;
    }
    setGranted({
      email: result.data.userEmail,
      expiresAt: result.data.subscription.expiresAt,
    });
    setEmail("");
    setNote("");
  }

  return (
    <section
      aria-labelledby="grant-pass-heading"
      data-testid="admin-grant-pass"
      className="min-w-0 rounded-lg border border-rule bg-paper-2 px-5 py-6 sm:px-7"
    >
      <h2
        id="grant-pass-heading"
        className="font-display text-lg font-bold text-ink"
      >
        {t("grantPassTitle")}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
        {t("grantPassLede")}
      </p>

      <form onSubmit={onSubmit} className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <label
            htmlFor={emailId}
            className="block text-sm font-semibold text-ink"
          >
            {t("grantPassEmail")}
          </label>
          <input
            id={emailId}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-md border border-edge bg-paper px-3 py-2 text-sm text-ink"
          />
        </div>

        <div className="min-w-0">
          <label
            htmlFor={daysId}
            className="block text-sm font-semibold text-ink"
          >
            {t("grantPassDays")}
          </label>
          <input
            id={daysId}
            type="number"
            min={1}
            max={365}
            required
            value={durationDays}
            onChange={(e) => setDurationDays(Number(e.target.value))}
            className="mt-1 min-h-11 w-full rounded-md border border-edge bg-paper px-3 py-2 text-sm tabular-nums text-ink"
          />
        </div>

        <div className="min-w-0 sm:col-span-2">
          <label
            htmlFor={noteId}
            className="block text-sm font-semibold text-ink"
          >
            {t("grantPassNote")}
          </label>
          <input
            id={noteId}
            type="text"
            required
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-md border border-edge bg-paper px-3 py-2 text-sm text-ink"
          />
          <p className="mt-1 text-xs text-muted">{t("grantPassNoteHint")}</p>
        </div>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className="min-h-11 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? t("processing") : t("grantPassSubmit")}
          </button>
        </div>
      </form>

      <div role="status" aria-live="polite" className="mt-3">
        {granted ? (
          <p data-testid="grant-pass-success" className="text-sm text-ink">
            {t("grantPassDone", {
              email: granted.email,
              date: formatDate(granted.expiresAt, locale),
            })}
          </p>
        ) : null}
      </div>
      {error ? (
        <p
          role="alert"
          data-testid="grant-pass-error"
          className="mt-2 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}
