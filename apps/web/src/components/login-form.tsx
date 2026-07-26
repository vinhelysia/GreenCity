"use client";

import Link from "next/link";
import { FormEvent, useId, useState } from "react";
import { LoginRequestSchema } from "@greencity/shared";
import { useAuth } from "@/components/auth-provider";
import { firstFieldErrors } from "@/lib/api";

type FormState = "idle" | "submitting" | "success";

const GENERIC_CREDENTIALS =
  "Email hoặc mật khẩu không đúng. Vui lòng thử lại.";

/**
 * Real login form — same-origin POST /api/auth/login with credentials.
 * Never accepts roles/status; never logs passwords.
 */
export function LoginForm() {
  const emailId = useId();
  const passwordId = useId();
  const formErrorId = useId();
  const statusId = useId();
  const { login, status: authStatus, user } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [formState, setFormState] = useState<FormState>("idle");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

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
        if (key === "email") localized[key] = "Email không hợp lệ.";
        else if (key === "password") localized[key] = "Vui lòng nhập mật khẩu.";
        else localized[key] = msg;
      }
      setFieldErrors(localized);
      setFormState("idle");
      return;
    }

    setFormState("submitting");
    const result = await login(parsed.data);
    if (!result.ok) {
      // Never distinguish unknown email vs wrong password.
      if (
        result.status === 401 ||
        result.error.code === "INVALID_CREDENTIALS"
      ) {
        setServerError(GENERIC_CREDENTIALS);
      } else if (result.status === 429) {
        setServerError("Quá nhiều lần thử. Vui lòng đợi một chút rồi thử lại.");
      } else {
        setServerError(
          result.error.message ||
            "Không thể đăng nhập. Vui lòng thử lại sau.",
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
          Bạn đã đăng nhập với{" "}
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
          Email
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
          placeholder="ban@example.com"
        />
        {emailError ? (
          <p id={emailErrorId} className="mt-1.5 text-sm font-medium text-red-600" role="alert">
            {emailError}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor={passwordId} className="block text-sm font-semibold text-ink">
          Mật khẩu
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
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-edge bg-card px-3.5 py-2.5 text-base text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="button"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-edge bg-card px-4 text-sm font-semibold text-ink hover:border-primary/40 hover:bg-mint-surface/30"
            aria-pressed={showPassword}
            aria-controls={passwordId}
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? "Ẩn" : "Hiện"}
            <span className="sr-only"> mật khẩu</span>
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
        {formState === "submitting" ? "Đang đăng nhập…" : "Đăng nhập"}
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
          ? "Đang gửi yêu cầu đăng nhập…"
          : formState === "success"
            ? "Đăng nhập thành công."
            : "Chưa có tài khoản? "}
        {formState === "idle" && !serverError ? (
          <Link
            href="/dang-ky"
            className="font-medium text-accent underline-offset-4 hover:underline"
          >
            Đăng ký
          </Link>
        ) : null}
      </p>
    </form>
  );
}
