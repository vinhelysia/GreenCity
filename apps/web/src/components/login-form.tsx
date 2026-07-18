"use client";

import { FormEvent, useId, useState } from "react";

/**
 * Visual login shell only — no API calls.
 * Submit is blocked client-side until backend auth exists.
 */
export function LoginForm() {
  const emailId = useId();
  const passwordId = useId();
  const noticeId = useId();
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(
      "Đăng nhập chưa khả dụng — tích hợp backend xác thực đang chờ hợp đồng API.",
    );
  }

  return (
    <form
      className="mt-8 flex max-w-md flex-col gap-5"
      onSubmit={onSubmit}
      noValidate
      aria-describedby={noticeId}
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
          className="mt-1.5 w-full min-h-11 rounded-md border border-edge bg-paper px-3 py-2 text-base text-ink"
          placeholder="ban@example.com"
        />
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
            autoComplete="current-password"
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
      </div>

      <button
        type="submit"
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-paper transition-opacity duration-quick ease-out hover:opacity-90"
      >
        Đăng nhập
      </button>

      <p
        id={noticeId}
        role="status"
        className="text-sm leading-relaxed text-muted"
      >
        {notice ??
          "Đây chỉ là giao diện. Chưa gửi yêu cầu tới máy chủ — xác thực backend đang được phát triển."}
      </p>
    </form>
  );
}
