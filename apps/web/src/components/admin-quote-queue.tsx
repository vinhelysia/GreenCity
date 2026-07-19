"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { CreateQuoteRequestSchema, type ScrapRequestDto } from "@greencity/shared";
import { useAuth } from "@/components/auth-provider";
import { EmptyState } from "@/components/empty-state";
import {
  checkAuthExpiry,
  fetchAdminSubmittedScrapRequests,
  marketplaceErrorMessage,
  mediaUrl,
  postAdminQuote,
} from "@/lib/api";
import { formatVnd } from "@/lib/format";

type LoadState =
  | { status: "loading" }
  | { status: "forbidden" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ScrapRequestDto[] };

export function AdminQuoteQueue() {
  const { status: authStatus, user, clearSessionAndRedirect } = useAuth();
  const isAdmin = user?.roles.includes("ADMIN") ?? false;
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    const result = checkAuthExpiry(
      await fetchAdminSubmittedScrapRequests(),
      clearSessionAndRedirect,
    );
    if (!result.ok) {
      if (result.status === 403) {
        setState({ status: "forbidden" });
        return;
      }
      setState({ status: "error", message: marketplaceErrorMessage(result.error) });
      return;
    }
    setState({ status: "ready", data: result.data.requests });
  }, [clearSessionAndRedirect]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    // The client role check below is a UX shortcut only — this fetch is the
    // real gate, since ADMIN is enforced server-side, not by this `if`.
    void load();
  }, [authStatus, load]);

  if (authStatus === "loading") {
    return (
      <p role="status" className="text-sm text-muted">
        Đang kiểm tra đăng nhập…
      </p>
    );
  }

  if (authStatus === "unauthenticated") {
    return (
      <EmptyState
        testId="admin-queue-login-required"
        title="Cần đăng nhập"
        description={
          <p>
            <Link
              href="/dang-nhap"
              className="font-medium text-accent underline-offset-4 hover:underline"
            >
              Đăng nhập
            </Link>{" "}
            bằng tài khoản quản trị viên để xem hàng chờ báo giá.
          </p>
        }
      />
    );
  }

  if (!isAdmin || state.status === "forbidden") {
    return (
      <EmptyState
        testId="admin-queue-forbidden"
        title="Không có quyền truy cập"
        description="Chỉ quản trị viên mới có thể báo giá phế liệu."
      />
    );
  }

  return (
    <div role="status" aria-live="polite" className="min-w-0">
      {state.status === "loading" ? (
        <div aria-hidden="true" className="flex flex-col gap-3">
          <div className="skeleton h-28 w-full" />
          <div className="skeleton h-28 w-full" />
        </div>
      ) : state.status === "error" ? (
        <p role="alert" className="text-sm leading-relaxed text-red-800">
          {state.message}
        </p>
      ) : state.data.length === 0 ? (
        <EmptyState
          testId="admin-queue-empty"
          title="Không có yêu cầu chờ báo giá"
          description="Chưa có yêu cầu bán phế liệu nào cần báo giá."
        />
      ) : (
        <ul className="flex min-w-0 flex-col gap-4">
          {state.data.map((request) => (
            <AdminQuoteRow
              key={request.id}
              request={request}
              onQuoted={load}
              clearSessionAndRedirect={clearSessionAndRedirect}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AdminQuoteRow({
  request,
  onQuoted,
  clearSessionAndRedirect,
}: {
  request: ScrapRequestDto;
  onQuoted: () => void;
  clearSessionAndRedirect: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const { category } = request;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldError(null);
    setServerError(null);

    const raw = { pricePerKgVnd: Number(new FormData(event.currentTarget).get("price")) };
    const parsed = CreateQuoteRequestSchema.safeParse(raw);
    if (!parsed.success) {
      setFieldError("Vui lòng nhập giá hợp lệ.");
      return;
    }
    if (
      parsed.data.pricePerKgVnd < category.minPricePerKgVnd ||
      parsed.data.pricePerKgVnd > category.maxPricePerKgVnd
    ) {
      setFieldError(
        `Giá phải trong khoảng ${formatVnd(category.minPricePerKgVnd)}–${formatVnd(
          category.maxPricePerKgVnd,
        )}/kg.`,
      );
      return;
    }

    setSubmitting(true);
    const result = checkAuthExpiry(
      await postAdminQuote(request.id, parsed.data),
      clearSessionAndRedirect,
    );
    if (!result.ok) {
      setServerError(marketplaceErrorMessage(result.error));
      setSubmitting(false);
      return;
    }
    onQuoted();
  }

  return (
    <li className="min-w-0 rounded-md border border-edge bg-paper p-4">
      <div className="flex min-w-0 flex-wrap gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mediaUrl(request.media.downloadPath)}
          alt=""
          className="h-20 w-20 shrink-0 rounded-md border border-edge object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">{category.name}</p>
          <p className="text-sm text-muted">{request.estimatedWeightKg}kg</p>
          <p className="text-sm text-muted">
            Khoảng giá công khai: {formatVnd(category.minPricePerKgVnd)}–
            {formatVnd(category.maxPricePerKgVnd)}/kg
          </p>
          {request.note ? (
            <p className="mt-1 text-sm text-muted">{request.note}</p>
          ) : null}
        </div>
      </div>

      <form
        onSubmit={(event) => void onSubmit(event)}
        className="mt-3 flex min-w-0 flex-wrap items-end gap-2 border-t border-rule pt-3"
      >
        <div className="min-w-0">
          <label
            htmlFor={`price-${request.id}`}
            className="block text-sm font-medium text-ink"
          >
            Giá báo (đ/kg)
          </label>
          <input
            id={`price-${request.id}`}
            name="price"
            type="number"
            inputMode="numeric"
            min={category.minPricePerKgVnd}
            max={category.maxPricePerKgVnd}
            step={1}
            required
            disabled={submitting}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? `price-${request.id}-error` : undefined}
            className="mt-1.5 min-h-11 w-40 rounded-md border border-edge bg-paper px-3 py-2 text-base text-ink"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-paper transition-opacity duration-quick ease-out hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? "Đang gửi…" : "Gửi báo giá"}
        </button>
      </form>
      {fieldError ? (
        <p id={`price-${request.id}-error`} role="alert" className="mt-2 text-sm text-red-800">
          {fieldError}
        </p>
      ) : null}
      {serverError ? (
        <p role="alert" className="mt-2 text-sm text-red-800">
          {serverError}
        </p>
      ) : null}
    </li>
  );
}
