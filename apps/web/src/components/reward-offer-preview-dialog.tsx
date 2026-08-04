"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import type { RewardOffer } from "@greencity/shared";
import { formatNumber } from "@/lib/format";

/**
 * What a redemption *would* look like, for a catalog that cannot redeem
 * anything. Nothing here calls an API, deducts a point, or reports success —
 * the only action closes the dialog.
 *
 * Native <dialog> rather than a hand-rolled modal: showModal() already gives
 * Escape-to-dismiss, a focus trap, role="dialog" + aria-modal, inert content
 * behind it, and focus returned to the button that opened it. A React
 * reimplementation of those five would be the bug, not the feature.
 *
 * Kept mounted with a nullable offer, deliberately: unmounting the element is
 * what loses the browser's record of where focus came from.
 */
export function RewardOfferPreviewDialog({
  offer,
  onClose,
}: {
  offer: RewardOffer | null;
  onClose: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations("rewards");
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (offer && !el.open) {
      el.showModal();
      // showModal() already focuses the first focusable child, which is this
      // button today. Naming it keeps that true if a link is ever added above.
      closeRef.current?.focus();
    } else if (!offer && el.open) {
      el.close();
    }
  }, [offer]);

  const merchant = offer
    ? locale === "en"
      ? offer.merchantNameEn
      : offer.merchantNameVi
    : "";

  return (
    <dialog
      ref={ref}
      // Escape and the close button both land here, so parent state clears
      // either way and the two can never disagree about what is open.
      onClose={onClose}
      aria-labelledby="reward-preview-title"
      className="w-[min(32rem,calc(100vw-1.5rem))] rounded-lg border border-rule bg-paper p-0 text-ink backdrop:bg-black/50"
    >
      {offer ? (
        <div className="max-h-[85vh] overflow-y-auto p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            {t("previewPrototype")}
          </p>
          <h2
            id="reward-preview-title"
            className="mt-2 font-display text-xl font-bold text-ink"
          >
            {t("previewTitle")}
          </h2>

          <dl className="mt-5 space-y-3 border-y border-dashed border-rule py-4">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-widest text-muted">
                {t("illustrativePartner")}
              </dt>
              <dd className="mt-1 font-display text-lg font-bold text-ink [overflow-wrap:anywhere]">
                {merchant}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-widest text-muted">
                {t("previewOfferLabel")}
              </dt>
              <dd className="mt-1 text-sm leading-6 text-muted">
                {locale === "en" ? offer.offerEn : offer.offerVi}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-widest text-muted">
                {t("previewCostLabel")}
              </dt>
              <dd className="mt-1 font-display text-lg font-bold text-primary tabular-nums">
                {formatNumber(offer.pointsCost, locale)} {t("previewPoints")}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-widest text-muted">
                {t("previewCodeLabel")}
              </dt>
              <dd className="mt-1 font-mono text-sm text-ink">DEMO-ONLY</dd>
            </div>
          </dl>

          <ul className="mt-4 space-y-2 text-sm leading-6 text-muted">
            <li>{t("previewNoDeduction")}</li>
            <li>{t("previewNotValid")}</li>
            <li>{t("previewNoAffiliation", { merchant })}</li>
            <li>{t("previewNeedsPartner")}</li>
          </ul>

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="mt-6 min-h-11 w-full rounded-md border border-edge bg-paper-2 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-paper"
          >
            {t("previewClose")}
          </button>
        </div>
      ) : null}
    </dialog>
  );
}
