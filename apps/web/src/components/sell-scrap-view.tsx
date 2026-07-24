"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useId,
  useState,
} from "react";
import {
  CreateScrapRequestSchema,
  type ScrapCategory,
  type ScrapRequestDto,
  type ScrapRequestStatus,
} from "@greencity/shared";
import { useAuth } from "@/components/auth-provider";
import { EmptyState } from "@/components/empty-state";
import { SignInRequired } from "@/components/sign-in-required";
import {
  acceptScrapRequestQuote,
  checkAuthExpiry,
  fetchMyScrapRequests,
  fetchScrapCategories,
  firstFieldErrors,
  marketplaceErrorMessage,
  mediaUrl,
  postScrapRequest,
  rejectScrapRequestQuote,
  uploadMedia,
} from "@/lib/api";
import { formatVnd } from "@/lib/format";

type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

const STATUS_LABEL: Record<ScrapRequestStatus, string> = {
  SUBMITTED: "Đã gửi",
  QUOTED: "Đã báo giá",
  ACCEPTED: "Đã chấp nhận",
  REJECTED: "Đã từ chối",
};

function StatusBadge({ status }: { status: ScrapRequestStatus }) {
  return (
    <span className="inline-flex items-center rounded-sm border border-edge bg-paper-2 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-muted">
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Public price bands — visible pre-login, the transparency half of the story. */
function PriceBandTable({ categories }: { categories: ScrapCategory[] }) {
  if (categories.length === 0) {
    return (
      <EmptyState
        testId="scrap-categories-empty"
        title="Chưa có bảng giá"
        description="Chưa có loại phế liệu nào được công bố giá."
      />
    );
  }
  return (
    <div className="min-w-0 overflow-x-auto rounded-md border border-edge">
      <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-edge bg-paper-2">
            <th scope="col" className="px-3 py-2.5 font-medium text-ink">
              Loại phế liệu
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium text-ink">
              Giá tối thiểu
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium text-ink">
              Giá tối đa
            </th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <tr key={category.id} className="border-b border-rule last:border-0">
              <td className="px-3 py-2.5 text-ink">{category.name}</td>
              <td className="px-3 py-2.5 text-muted">
                {formatVnd(category.minPricePerKgVnd)}/kg
              </td>
              <td className="px-3 py-2.5 text-muted">
                {formatVnd(category.maxPricePerKgVnd)}/kg
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SellScrapView() {
  const { status: authStatus, clearSessionAndRedirect } = useAuth();
  const [categoryState, setCategoryState] = useState<
    LoadState<ScrapCategory[]>
  >({ status: "loading" });
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetchScrapCategories();
      if (cancelled) return;
      if (!result.ok) {
        setCategoryState({
          status: "error",
          message: marketplaceErrorMessage(result.error),
        });
        return;
      }
      setCategoryState({ status: "ready", data: result.data.categories });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-w-0 space-y-8">
      <section aria-labelledby="scrap-price-heading" className="min-w-0">
        <h2
          id="scrap-price-heading"
          className="font-display text-xl font-semibold tracking-tight text-ink"
        >
          Bảng giá thu mua
        </h2>
        <div className="mt-4" role="status" aria-live="polite">
          {categoryState.status === "loading" ? (
            <div aria-hidden="true" className="flex flex-col gap-2">
              <div className="skeleton h-10 w-full" />
              <div className="skeleton h-10 w-full" />
              <div className="skeleton h-10 w-full" />
            </div>
          ) : categoryState.status === "error" ? (
            <p role="alert" className="text-sm leading-relaxed text-red-800">
              {categoryState.message}
            </p>
          ) : (
            <PriceBandTable categories={categoryState.data} />
          )}
        </div>
      </section>

      {authStatus === "loading" ? (
        <p role="status" className="text-sm text-muted">
          Đang kiểm tra đăng nhập…
        </p>
      ) : authStatus === "unauthenticated" ? (
        <SignInRequired
          testId="sell-scrap-login-required"
          action="bán phế liệu"
        />
      ) : (
        <>
          <SubmitScrapRequestForm
            categories={
              categoryState.status === "ready" ? categoryState.data : []
            }
            clearSessionAndRedirect={clearSessionAndRedirect}
            onSubmitted={() => setRefreshCounter((n) => n + 1)}
          />
          <MyScrapRequests
            refreshKey={refreshCounter}
            clearSessionAndRedirect={clearSessionAndRedirect}
          />
        </>
      )}
    </div>
  );
}

function SubmitScrapRequestForm({
  categories,
  clearSessionAndRedirect,
  onSubmitted,
}: {
  categories: ScrapCategory[];
  clearSessionAndRedirect: () => void;
  onSubmitted: () => void;
}) {
  const categoryId = useId();
  const weightId = useId();
  const photoId = useId();
  const noteId = useId();
  const statusId = useId();

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<
    "idle" | "submitting" | "success"
  >("idle");

  const [photoState, setPhotoState] = useState<
    | { status: "idle" }
    | { status: "uploading" }
    | { status: "done"; mediaAssetId: string; previewUrl: string }
    | { status: "error"; message: string }
  >({ status: "idle" });

  const activeCategories = categories.filter((c) => c.active);

  async function onPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setPhotoState({ status: "uploading" });
    const result = checkAuthExpiry(
      await uploadMedia(file),
      clearSessionAndRedirect,
    );
    if (!result.ok) {
      URL.revokeObjectURL(previewUrl);
      setPhotoState({
        status: "error",
        message: marketplaceErrorMessage(result.error),
      });
      return;
    }
    setPhotoState({ status: "done", mediaAssetId: result.data.id, previewUrl });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);
    setFieldErrors({});

    // Capture the form now: after the await below, React has nulled
    // event.currentTarget, so touching it later throws and skips onSubmitted().
    const form = event.currentTarget;
    const fd = new FormData(form);
    const noteRaw = String(fd.get("note") ?? "").trim();
    const raw = {
      categoryId: String(fd.get("categoryId") ?? ""),
      estimatedWeightKg: Number(fd.get("estimatedWeightKg")),
      mediaAssetId: photoState.status === "done" ? photoState.mediaAssetId : "",
      ...(noteRaw ? { note: noteRaw } : {}),
    };

    const parsed = CreateScrapRequestSchema.safeParse(raw);
    if (!parsed.success) {
      const flat = firstFieldErrors(parsed.error.flatten().fieldErrors);
      const localized: Record<string, string> = {};
      for (const [key, msg] of Object.entries(flat)) {
        if (key === "categoryId") localized[key] = "Vui lòng chọn loại phế liệu.";
        else if (key === "estimatedWeightKg")
          localized[key] = "Khối lượng phải lớn hơn 0 và tối đa 1000kg.";
        else if (key === "mediaAssetId")
          localized[key] = "Vui lòng tải lên một ảnh.";
        else if (key === "note") localized[key] = "Ghi chú tối đa 500 ký tự.";
        else localized[key] = msg;
      }
      setFieldErrors(localized);
      return;
    }

    setSubmitState("submitting");
    const result = checkAuthExpiry(
      await postScrapRequest(parsed.data),
      clearSessionAndRedirect,
    );
    if (!result.ok) {
      setServerError(marketplaceErrorMessage(result.error));
      setSubmitState("idle");
      return;
    }

    setSubmitState("success");
    setPhotoState((prev) => {
      if (prev.status === "done") URL.revokeObjectURL(prev.previewUrl);
      return { status: "idle" };
    });
    form.reset();
    onSubmitted();
  }

  const categoryError = fieldErrors.categoryId;
  const weightError = fieldErrors.estimatedWeightKg;
  const noteError = fieldErrors.note;

  return (
    <section aria-labelledby="sell-form-heading" className="min-w-0">
      <h2
        id="sell-form-heading"
        className="font-display text-xl font-semibold tracking-tight text-ink"
      >
        Gửi yêu cầu bán phế liệu
      </h2>
      <form
        className="mt-4 flex max-w-md min-w-0 flex-col gap-5"
        onSubmit={onSubmit}
        noValidate
        aria-describedby={statusId}
      >
        <div>
          <label htmlFor={categoryId} className="block text-sm font-medium text-ink">
            Loại phế liệu
          </label>
          <select
            id={categoryId}
            name="categoryId"
            required
            disabled={submitState === "submitting" || activeCategories.length === 0}
            aria-invalid={categoryError ? true : undefined}
            aria-describedby={categoryError ? `${categoryId}-error` : undefined}
            className="mt-1.5 min-h-11 w-full rounded-md border border-edge bg-paper px-3 py-2 text-base text-ink"
            defaultValue=""
          >
            <option value="" disabled>
              Chọn loại phế liệu
            </option>
            {activeCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name} ({formatVnd(category.minPricePerKgVnd)}–
                {formatVnd(category.maxPricePerKgVnd)}/kg)
              </option>
            ))}
          </select>
          {categoryError ? (
            <p id={`${categoryId}-error`} className="mt-1.5 text-sm text-red-800" role="alert">
              {categoryError}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={weightId} className="block text-sm font-medium text-ink">
            Khối lượng ước tính (kg)
          </label>
          <input
            id={weightId}
            name="estimatedWeightKg"
            type="number"
            inputMode="decimal"
            min={0.1}
            max={1000}
            step="any"
            required
            disabled={submitState === "submitting"}
            aria-invalid={weightError ? true : undefined}
            aria-describedby={weightError ? `${weightId}-error` : undefined}
            className="mt-1.5 min-h-11 w-full rounded-md border border-edge bg-paper px-3 py-2 text-base text-ink"
          />
          {weightError ? (
            <p id={`${weightId}-error`} className="mt-1.5 text-sm text-red-800" role="alert">
              {weightError}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={photoId} className="block text-sm font-medium text-ink">
            Ảnh phế liệu (một ảnh)
          </label>
          <input
            id={photoId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            disabled={submitState === "submitting" || photoState.status === "uploading"}
            onChange={(event) => void onPhotoChange(event)}
            className="mt-1.5 block w-full min-w-0 text-sm text-ink file:mr-3 file:min-h-11 file:rounded-md file:border file:border-edge file:bg-paper file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink"
          />
          <div role="status" className="mt-2 text-sm text-muted">
            {photoState.status === "uploading" ? "Đang tải ảnh lên…" : null}
            {photoState.status === "error" ? (
              <span role="alert" className="text-red-800">
                {photoState.message}
              </span>
            ) : null}
            {photoState.status === "done" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoState.previewUrl}
                alt="Ảnh phế liệu đã chọn"
                className="mt-1 h-24 w-24 rounded-md border border-edge object-cover"
              />
            ) : null}
          </div>
          {fieldErrors.mediaAssetId ? (
            <p className="mt-1.5 text-sm text-red-800" role="alert">
              {fieldErrors.mediaAssetId}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={noteId} className="block text-sm font-medium text-ink">
            Ghi chú <span className="font-normal text-muted">(tuỳ chọn)</span>
          </label>
          <textarea
            id={noteId}
            name="note"
            maxLength={500}
            rows={3}
            disabled={submitState === "submitting"}
            aria-invalid={noteError ? true : undefined}
            aria-describedby={noteError ? `${noteId}-error` : undefined}
            className="mt-1.5 w-full min-w-0 rounded-md border border-edge bg-paper px-3 py-2 text-base text-ink"
          />
          {noteError ? (
            <p id={`${noteId}-error`} className="mt-1.5 text-sm text-red-800" role="alert">
              {noteError}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={submitState === "submitting" || photoState.status === "uploading"}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-paper transition-opacity duration-quick ease-out hover:opacity-90 disabled:opacity-60"
        >
          {submitState === "submitting" ? "Đang gửi…" : "Gửi yêu cầu"}
        </button>

        {serverError ? (
          <p role="alert" className="text-sm leading-relaxed text-red-800">
            {serverError}
          </p>
        ) : null}

        <p id={statusId} role="status" className="text-sm leading-relaxed text-muted">
          {submitState === "success" ? "Đã gửi yêu cầu. Xem trong danh sách bên dưới." : null}
        </p>
      </form>
    </section>
  );
}

function MyScrapRequests({
  refreshKey,
  clearSessionAndRedirect,
}: {
  refreshKey: number;
  clearSessionAndRedirect: () => void;
}) {
  const [state, setState] = useState<LoadState<ScrapRequestDto[]>>({
    status: "loading",
  });
  const [rowAction, setRowAction] = useState<
    Record<string, "accepting" | "rejecting" | undefined>
  >({});
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setState({ status: "loading" });
    const result = checkAuthExpiry(
      await fetchMyScrapRequests(),
      clearSessionAndRedirect,
    );
    if (!result.ok) {
      setState({ status: "error", message: marketplaceErrorMessage(result.error) });
      return;
    }
    setState({ status: "ready", data: result.data.requests });
  }, [clearSessionAndRedirect]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  async function onReject(id: string) {
    setRowAction((s) => ({ ...s, [id]: "rejecting" }));
    setRowError((s) => ({ ...s, [id]: "" }));
    const result = checkAuthExpiry(
      await rejectScrapRequestQuote(id),
      clearSessionAndRedirect,
    );
    if (!result.ok) {
      setRowError((s) => ({ ...s, [id]: marketplaceErrorMessage(result.error) }));
      setRowAction((s) => ({ ...s, [id]: undefined }));
      return;
    }
    await load();
  }

  async function onAccept(id: string, pricePerKgVnd: number) {
    const confirmed = window.confirm(
      `Xác nhận chấp nhận báo giá ${formatVnd(pricePerKgVnd)}/kg?`,
    );
    if (!confirmed) return;
    setRowAction((s) => ({ ...s, [id]: "accepting" }));
    setRowError((s) => ({ ...s, [id]: "" }));
    const result = checkAuthExpiry(
      await acceptScrapRequestQuote(id),
      clearSessionAndRedirect,
    );
    if (!result.ok) {
      setRowError((s) => ({ ...s, [id]: marketplaceErrorMessage(result.error) }));
      setRowAction((s) => ({ ...s, [id]: undefined }));
      return;
    }
    await load();
  }

  return (
    <section aria-labelledby="my-requests-heading" className="min-w-0">
      <h2
        id="my-requests-heading"
        className="font-display text-xl font-semibold tracking-tight text-ink"
      >
        Yêu cầu của tôi
      </h2>
      <div className="mt-4" role="status" aria-live="polite">
        {state.status === "loading" ? (
          <div aria-hidden="true" className="flex flex-col gap-3">
            <div className="skeleton h-24 w-full" />
            <div className="skeleton h-24 w-full" />
          </div>
        ) : state.status === "error" ? (
          <p role="alert" className="text-sm leading-relaxed text-red-800">
            {state.message}
          </p>
        ) : state.data.length === 0 ? (
          <EmptyState
            testId="my-scrap-requests-empty"
            title="Chưa có yêu cầu nào"
            description="Gửi yêu cầu bán phế liệu ở trên để bắt đầu."
          />
        ) : (
          <ul className="flex min-w-0 flex-col gap-4">
            {state.data.map((request) => (
              <li
                key={request.id}
                className="min-w-0 rounded-md border border-edge bg-paper p-4"
              >
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={mediaUrl(request.media.downloadPath)}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-md border border-edge object-cover"
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{request.category.name}</p>
                      <p className="text-sm text-muted">
                        {request.estimatedWeightKg}kg
                      </p>
                      {request.note ? (
                        <p className="mt-1 text-sm text-muted">{request.note}</p>
                      ) : null}
                    </div>
                  </div>
                  <StatusBadge status={request.status} />
                </div>

                {request.activeQuote && request.activeQuote.status === "PENDING" ? (
                  <div className="mt-3 min-w-0 border-t border-rule pt-3">
                    <p className="text-sm text-ink">
                      Giá báo:{" "}
                      <span className="font-medium">
                        {formatVnd(request.activeQuote.pricePerKgVnd)}/kg
                      </span>
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={Boolean(rowAction[request.id])}
                        onClick={() =>
                          void onAccept(
                            request.id,
                            request.activeQuote!.pricePerKgVnd,
                          )
                        }
                        className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-paper transition-opacity duration-quick ease-out hover:opacity-90 disabled:opacity-60"
                      >
                        {rowAction[request.id] === "accepting"
                          ? "Đang xử lý…"
                          : "Chấp nhận"}
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(rowAction[request.id])}
                        onClick={() => void onReject(request.id)}
                        className="inline-flex min-h-11 items-center justify-center rounded-md border border-edge bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors duration-quick ease-out hover:border-accent disabled:opacity-60"
                      >
                        {rowAction[request.id] === "rejecting"
                          ? "Đang xử lý…"
                          : "Từ chối"}
                      </button>
                    </div>
                    {rowError[request.id] ? (
                      <p role="alert" className="mt-2 text-sm text-red-800">
                        {rowError[request.id]}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
