"use client";

import Link from "next/link";
import { FormEvent, useId, useState } from "react";
import { RegisterRequestSchema } from "@greencity/shared";
import { useAuth } from "@/components/auth-provider";
import { firstFieldErrors } from "@/lib/api";

type FormState = "idle" | "submitting" | "success";

/** Vietnamese field hints aligned with shared Zod contracts. */
function localizeFieldError(field: string, message: string): string {
  if (field === "email") {
    if (/email/i.test(message)) return "Email không hợp lệ.";
    return message;
  }
  if (field === "password") {
    if (/at least 8|min/i.test(message)) {
      return "Mật khẩu phải có ít nhất 8 ký tự.";
    }
    return message;
  }
  if (field === "displayName") {
    if (/at most 80|max/i.test(message)) {
      return "Tên hiển thị tối đa 80 ký tự.";
    }
    if (/at least 1|min/i.test(message)) {
      return "Tên hiển thị không được để trống.";
    }
    return message;
  }
  return message;
}

/**
 * Registration form — POST /api/auth/register.
 * Never sends roles/status. Maps EMAIL_TAKEN to the email field.
 */
export function RegisterForm() {
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
        localized[k] = localizeFieldError(k, v);
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
          email: "Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác.",
        });
        setFormState("idle");
        return;
      }
      if (result.status === 429) {
        setServerError("Quá nhiều lần thử. Vui lòng đợi một chút rồi thử lại.");
      } else if (result.error.code === "VALIDATION_ERROR") {
        setServerError("Thông tin chưa hợp lệ. Vui lòng kiểm tra lại form.");
      } else {
        setServerError(
          result.error.message ||
            "Không thể đăng ký. Vui lòng thử lại sau.",
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
          Tài khoản đã sẵn sàng. Bạn đang đăng nhập với{" "}
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
          Tên hiển thị{" "}
          <span className="font-normal text-muted">(tuỳ chọn)</span>
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
          className="mt-1.5 w-full min-h-11 rounded-md border border-edge bg-paper px-3 py-2 text-base text-ink"
          placeholder="Nguyễn Văn A"
        />
        {displayNameError ? (
          <p
            id={displayNameErrorId}
            className="mt-1.5 text-sm text-red-800"
            role="alert"
          >
            {displayNameError}
          </p>
        ) : null}
      </div>

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
          className="mt-1.5 w-full min-h-11 rounded-md border border-edge bg-paper px-3 py-2 text-base text-ink"
          placeholder="ban@example.com"
        />
        {emailError ? (
          <p id={emailErrorId} className="mt-1.5 text-sm text-red-800" role="alert">
            {emailError}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor={passwordId} className="block text-sm font-medium text-ink">
          Mật khẩu
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
            className="min-h-11 min-w-0 flex-1 rounded-md border border-edge bg-paper px-3 py-2 text-base text-ink"
          />
          <button
            type="button"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md border border-edge bg-paper px-3 text-sm font-medium text-ink hover:border-accent"
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
            className="mt-1.5 text-sm text-red-800"
            role="alert"
          >
            {passwordError}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={formState === "submitting"}
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-paper transition-opacity duration-quick ease-out hover:opacity-90 disabled:opacity-60"
      >
        {formState === "submitting" ? "Đang đăng ký…" : "Đăng ký"}
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
          ? "Đang tạo tài khoản…"
          : formState === "success"
            ? "Đăng ký thành công."
            : "Đã có tài khoản? "}
        {formState === "idle" && !serverError ? (
          <Link
            href="/dang-nhap"
            className="font-medium text-accent underline-offset-4 hover:underline"
          >
            Đăng nhập
          </Link>
        ) : null}
      </p>
    </form>
  );
}
