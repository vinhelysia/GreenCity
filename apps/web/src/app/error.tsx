"use client";

import Link from "next/link";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <div className="min-w-0 max-w-prose">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
        Đã xảy ra lỗi
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted">
        Không thể hiển thị trang này. Bạn có thể thử lại hoặc quay về trang chủ.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-muted">Mã: {error.digest}</p>
      ) : null}
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-paper hover:opacity-90"
        >
          Thử lại
        </button>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-edge bg-paper px-4 py-2 text-sm font-medium text-ink hover:border-accent"
        >
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
