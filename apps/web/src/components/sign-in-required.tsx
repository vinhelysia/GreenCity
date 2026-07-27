"use client";

import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";
import { Link } from "@/i18n/routing";

type SignInRequiredProps = {
  testId?: string;
  /**
   * Which dictionary key under `auth` names what the visitor was trying to do,
   * e.g. "actionSellScrap". A key rather than a string so the sentence is built
   * in the reader's language instead of whichever one the caller was written in.
   */
  actionKey?: "actionSellScrap" | "actionViewRewards" | "actionReportDumping";
};

/**
 * Shown when a signed-out visitor reaches something that needs an account.
 *
 * Five screens used to hand-roll this block, and every one of them offered
 * only a login link. Someone without an account was told to sign in and given
 * nowhere to go, so registering is offered here as well.
 */
export function SignInRequired({ testId, actionKey }: SignInRequiredProps) {
  const t = useTranslations("auth");

  return (
    <EmptyState
      testId={testId}
      title={
        actionKey
          ? t("signInRequiredForAction", { action: t(actionKey) })
          : t("signInRequiredGeneric")
      }
      description={
        <div className="space-y-3">
          <p>{t("signInRequiredBody1")}</p>
          <p>{t("signInRequiredBody2")}</p>
          <p className="flex flex-wrap gap-x-4 gap-y-2">
            {/* Locale-aware Link: on /en these must go to /en/login and
                /en/register, not the Vietnamese paths. */}
            <Link
              href="/dang-nhap"
              className="font-medium text-accent underline-offset-4 hover:underline"
            >
              {t("loginButton")}
            </Link>
            <Link
              href="/dang-ky"
              className="font-medium text-accent underline-offset-4 hover:underline"
            >
              {t("createNewAccount")}
            </Link>
          </p>
        </div>
      }
    />
  );
}
