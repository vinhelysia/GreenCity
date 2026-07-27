"use client";

import { useLocale, useTranslations } from "next-intl";
import { FormEvent, useId, useState } from "react";
import { RegisterRequestSchema } from "@greencity/shared";
import { useAuth } from "@/components/auth-provider";
import { Link } from "@/i18n/routing";
import { firstFieldErrors } from "@/lib/api";

type FormState = "idle" | "submitting" | "success";

function localizeFieldError(field: string, message: string, locale: string): string {
  if (field === "email") {
    if (/email/i.test(message)) {
      return locale === "en" ? "Invalid email address." : "Email không hợp lệ.";
    }
    return message;
  }
  if (field === "password") {
    if (/at least 8|min/i.test(message)) {
      return locale === "en" ? "Password must be at least 8 characters." : "Mật khẩu phải có ít nhất 8 ký tự.";
    }
    return message;
  }
  if (field === "displayName") {
    if (/at most 80|max/i.test(message)) {
      return locale === "en" ? "Display name maximum 80 characters." : "Tên hiển thị tối đa 80 ký tự.";
    }
    if (/at least 1|min/i.test(message)) {
      return locale === "en" ? "Display name cannot be empty." : "Tên hiển thị không được để trống.";
    }
    return message;
  }
  return message;
}

export function RegisterForm() {
  const locale = useLocale();
  const tAuth = useTranslations("auth");
  const tVal = useTranslations("validation");
  const tErr = useTranslations("errors");

  const emailId = useId();
  const passwordId = useId();
  const displayNameId = useId();
  const statusId = useId();
  const { register, status: authStatus, user } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [formState, setFormState] = useState<FormState>("idle");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);
    setFieldErrors({});

    const fd = new FormData(event.currentTarget);
    const displayNameRaw = String(fd.get("displayName") ?? "").trim();
    const raw = {
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
      ...(displayNameRaw ? { displayName: displayNameRaw } : {}),
    };

    const parsed = RegisterRequestSchema.safeParse(raw);
    if (!parsed.success) {
      const flat = firstFieldErrors(parsed.error.flatten().fieldErrors);
      const localized: Record<string, string> = {};
      for (const [k, v] of Object.entries(flat)) {
        localized[k] = localizeFieldError(k, v, locale);
      }
      setFieldErrors(localized);
      setFormState("idle");
      return;
    }

    setFormState("submitting");
    const result = await register(parsed.data);
    if (!result.ok) {
      if (result.status === 409 || result.error.code === "EMAIL_TAKEN") {
        setFieldErrors({
          email: locale === "en" ? "Email is already registered. Please sign in or use another email." : "Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác.",
        });
        setFormState("idle");
        return;
      }
      if (result.status === 429) {
        setServerError(locale === "en" ? "Too many attempts. Please try again in a moment." : "Quá nhiều lần thử. Vui lòng đợi một chút rồi thử lại.");
      } else if (result.error.code === "VALIDATION_ERROR") {
        setServerError(locale === "en" ? "Invalid details. Please check the form." : "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại form.");
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
      <div className="mt-8 max-w-md" role="status" data-testid="register-success">
        <p className="text-sm leading-relaxed text-ink">
          {locale === "en" ? "Account ready. Signed in as " : "Tài khoản đã sẵn sàng. Bạn đang đăng nhập với "}
          <span className="font-medium">{user.email}</span>.
        </p>
      </div>
    );
  }

  const emailError = fieldErrors.email;
  const passwordError = fieldErrors.password;
  const displayNameError = fieldErrors.displayName;
  const emailErrorId = `${emailId}-error`;
  const passwordErrorId = `${passwordId}-error`;
  const displayNameErrorId = `${displayNameId}-error`;

  return (
    <form
      className="mt-8 flex max-w-md flex-col gap-5"
      onSubmit={onSubmit}
      noValidate
      aria-describedby={statusId}
    >
      <div>
        <label
          htmlFor={displayNameId}
          className="block text-sm font-medium text-ink"
        >
          {tAuth("displayNameLabel")}{" "}
          <span className="font-normal text-muted">({locale === "en" ? "optional" : "tuỳ chọn"})</span>
        </label>
        <input
          id={displayNameId}
          name="displayName"
          type="text"
          autoComplete="name"
          maxLength={80}
          disabled={formState === "submitting"}
          aria-invalid={displayNameError ? true : undefined}
          aria-describedby={displayNameError ? displayNameErrorId : undefined}
          className="mt-1.5 w-full min-h-11 rounded-xl border border-edge bg-card px-3.5 py-2.5 text-base text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          placeholder={tAuth("displayNamePlaceholder")}
        />
        {displayNameError ? (
          <p
            id={displayNameErrorId}
            className="mt-1.5 text-sm font-medium text-red-600"
            role="alert"
          >
            {displayNameError}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor={emailId} className="block text-sm font-semibold text-ink">
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
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
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
        {formState === "submitting" ? tAuth("registering") : tAuth("registerButton")}
      </button>

      {serverError ? (
        <p role="alert" className="text-sm leading-relaxed text-red-800">
          {serverError}
        </p>
      ) : null}

      <p
        id={statusId}
        role="status"
        className="text-sm leading-relaxed text-muted"
      >
        {formState === "submitting"
          ? tAuth("registering")
          : formState === "success"
            ? tAuth("registerSuccess")
            : tAuth("hasAccount")}
        {formState === "idle" && !serverError ? (
          <Link
            href="/dang-nhap"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {tAuth("loginNow")}
          </Link>
        ) : null}
      </p>
    </form>
  );
}
