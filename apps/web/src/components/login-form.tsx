"use client";

import { useLocale, useTranslations } from "next-intl";
import { FormEvent, useId, useState } from "react";
import { LoginRequestSchema } from "@greencity/shared";
import { useAuth } from "@/components/auth-provider";
import { Link } from "@/i18n/routing";
import { firstFieldErrors } from "@/lib/api";

type FormState = "idle" | "submitting" | "success";

export function LoginForm() {
  const locale = useLocale();
  const tAuth = useTranslations("auth");
  const tVal = useTranslations("validation");
  const tErr = useTranslations("errors");

  const emailId = useId();
  const passwordId = useId();
  const formErrorId = useId();
  const statusId = useId();
  const { login, status: authStatus, user } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [formState, setFormState] = useState<FormState>("idle");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const genericCredentials =
    locale === "en"
      ? "Incorrect email or password. Please try again."
      : "Email hoặc mật khẩu không đúng. Vui lòng thử lại.";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);
    setFieldErrors({});

    const form = event.currentTarget;
    const raw = {
      email: String(new FormData(form).get("email") ?? ""),
      password: String(new FormData(form).get("password") ?? ""),
    };

    const parsed = LoginRequestSchema.safeParse(raw);
    if (!parsed.success) {
      const flat = firstFieldErrors(parsed.error.flatten().fieldErrors);
      const localized: Record<string, string> = {};
      for (const [key, msg] of Object.entries(flat)) {
        if (key === "email") localized[key] = tVal("invalidEmail");
        else if (key === "password") localized[key] = tVal("required");
        else localized[key] = msg;
      }
      setFieldErrors(localized);
      setFormState("idle");
      return;
    }

    setFormState("submitting");
    const result = await login(parsed.data);
    if (!result.ok) {
      if (
        result.status === 401 ||
        result.error.code === "INVALID_CREDENTIALS"
      ) {
        setServerError(genericCredentials);
      } else if (result.status === 429) {
        setServerError(locale === "en" ? "Too many attempts. Please try again in a moment." : "Quá nhiều lần thử. Vui lòng đợi một chút rồi thử lại.");
      } else {
        setServerError(
          result.error.message || tErr("generic"),
        );
      }
      setFormState("idle");
      return;
    }

    setFormState("success");
  }

  if (authStatus === "authenticated" && user) {
    return (
      <div className="mt-8 max-w-md" role="status">
        <p className="text-sm leading-relaxed text-ink">
          {locale === "en" ? "Signed in as " : "Bạn đã đăng nhập với "}
          <span className="font-medium">{user.email}</span>.
        </p>
      </div>
    );
  }

  const emailError = fieldErrors.email;
  const passwordError = fieldErrors.password;
  const emailErrorId = `${emailId}-error`;
  const passwordErrorId = `${passwordId}-error`;

  return (
    <form
      className="mt-8 flex max-w-md flex-col gap-5"
      onSubmit={onSubmit}
      noValidate
      aria-describedby={statusId}
    >
      <div>
        <label htmlFor={emailId} className="block text-sm font-medium text-ink">
          {tAuth("emailLabel")}
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          disabled={formState === "submitting"}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? emailErrorId : undefined}
          className="mt-1.5 w-full min-h-11 rounded-xl border border-edge bg-card px-3.5 py-2.5 text-base text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          placeholder={tAuth("emailPlaceholder")}
        />
        {emailError ? (
          <p id={emailErrorId} className="mt-1.5 text-sm font-medium text-red-600" role="alert">
            {emailError}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor={passwordId} className="block text-sm font-semibold text-ink">
          {tAuth("passwordLabel")}
        </label>
        <div className="mt-1.5 flex min-w-0 gap-2">
          <input
            id={passwordId}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            disabled={formState === "submitting"}
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={passwordError ? passwordErrorId : undefined}
            placeholder={tAuth("passwordPlaceholder")}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-edge bg-card px-3.5 py-2.5 text-base text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="button"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-edge bg-card px-4 text-sm font-semibold text-ink hover:border-primary/40 hover:bg-mint-surface/30"
            aria-pressed={showPassword}
            aria-controls={passwordId}
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? (locale === "en" ? "Hide" : "Ẩn") : (locale === "en" ? "Show" : "Hiện")}
            <span className="sr-only"> {tAuth("passwordLabel")}</span>
          </button>
        </div>
        {passwordError ? (
          <p
            id={passwordErrorId}
            className="mt-1.5 text-sm font-medium text-red-600"
            role="alert"
          >
            {passwordError}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={formState === "submitting"}
        className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 py-3 text-base font-semibold text-white shadow-eco transition-colors hover:bg-primary-hover disabled:opacity-60"
      >
        {formState === "submitting" ? tAuth("loggingIn") : tAuth("loginButton")}
      </button>

      {serverError ? (
        <p
          id={formErrorId}
          role="alert"
          className="text-sm leading-relaxed text-red-800"
        >
          {serverError}
        </p>
      ) : null}

      <p
        id={statusId}
        role="status"
        className="text-sm leading-relaxed text-muted"
      >
        {formState === "submitting"
          ? tAuth("loggingIn")
          : formState === "success"
            ? tAuth("loginSuccess")
            : tAuth("noAccount")}
        {formState === "idle" && !serverError ? (
          <Link
            href="/dang-ky"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {tAuth("registerNow")}
          </Link>
        ) : null}
      </p>
    </form>
  );
}
