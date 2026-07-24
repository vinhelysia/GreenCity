import {
  ApiErrorSchema,
  type ApiError,
  type PublicUser,
  AuthMeResponseSchema,
  AuthSessionResponseSchema,
  ScrapCategorySchema,
  type ScrapCategory,
  type CreateScrapRequest,
  ScrapRequestListSchema,
  type ScrapRequestList,
  MarketplaceListingListSchema,
  type MarketplaceListingList,
  SubscriptionStateSchema,
  type SubscriptionState,
  ReservationSchema,
  type Reservation,
  MediaAssetPublicSchema,
  type MediaAssetPublic,
  type CreateQuoteRequest,
  type CreateCleanupReport,
  CleanupReportListSchema,
  type CleanupReportList,
  HomeStatsSchema,
  type HomeStats,
  PublicCleanupReportListSchema,
  type PublicCleanupReportList,
  PointsBalanceSchema,
  type PointsBalance,
} from "@greencity/shared";

export type ParsedApiError = ApiError["error"];

export type ApiResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: ParsedApiError; status: number };

/** Same-origin fetch with credentials. Never pass absolute hosts. */
export async function apiFetch<T>(
  path: `/${string}`,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  // FormData (media upload) must keep the browser-generated multipart
  // boundary — only string bodies (JSON.stringify output) get the JSON header.
  const hasJsonBody = typeof init?.body === "string";
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(hasJsonBody ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    const parsed = ApiErrorSchema.safeParse(body);
    return {
      ok: false,
      status: res.status,
      error: parsed.success
        ? parsed.data.error
        : {
            code: "UNKNOWN_ERROR",
            message: "Không thể hoàn tất yêu cầu. Vui lòng thử lại.",
          },
    };
  }

  return { ok: true, data: body as T, status: res.status };
}

export async function fetchMe(): Promise<ApiResult<{ user: PublicUser }>> {
  const result = await apiFetch<unknown>("/api/auth/me");
  if (!result.ok) return result;
  const parsed = AuthMeResponseSchema.safeParse(result.data);
  if (!parsed.success) {
    return {
      ok: false,
      status: result.status,
      error: {
        code: "INVALID_RESPONSE",
        message: "Phản hồi máy chủ không hợp lệ.",
      },
    };
  }
  return { ok: true, data: parsed.data, status: result.status };
}

export async function postLogin(body: {
  email: string;
  password: string;
}): Promise<ApiResult<{ user: PublicUser }>> {
  const result = await apiFetch<unknown>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!result.ok) return result;
  const parsed = AuthSessionResponseSchema.safeParse(result.data);
  if (!parsed.success) {
    return {
      ok: false,
      status: result.status,
      error: {
        code: "INVALID_RESPONSE",
        message: "Phản hồi máy chủ không hợp lệ.",
      },
    };
  }
  return { ok: true, data: parsed.data, status: result.status };
}

export async function postRegister(body: {
  email: string;
  password: string;
  displayName?: string;
  phone?: string;
}): Promise<ApiResult<{ user: PublicUser }>> {
  const result = await apiFetch<unknown>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!result.ok) return result;
  const parsed = AuthSessionResponseSchema.safeParse(result.data);
  if (!parsed.success) {
    return {
      ok: false,
      status: result.status,
      error: {
        code: "INVALID_RESPONSE",
        message: "Phản hồi máy chủ không hợp lệ.",
      },
    };
  }
  return { ok: true, data: parsed.data, status: result.status };
}

export async function postLogout(): Promise<ApiResult<{ ok: boolean }>> {
  return apiFetch("/api/auth/logout", { method: "POST" });
}

/** Map shared Zod flatten fieldErrors to first message per field. */
export function firstFieldErrors(
  fieldErrors: Record<string, string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, messages] of Object.entries(fieldErrors)) {
    const msg = messages?.[0];
    if (msg) out[key] = msg;
  }
  return out;
}

// ─── Marketplace ──────────────────────────────────────────────────────────

function invalidResponse(status: number): ApiResult<never> {
  return {
    ok: false,
    status,
    error: {
      code: "INVALID_RESPONSE",
      message: "Phản hồi máy chủ không hợp lệ.",
    },
  };
}

/**
 * Vietnamese copy for MARKETPLACE_ERROR_CODES (@greencity/shared). ONE place —
 * UI code must branch on error.code, never on error.message.
 */
const MARKETPLACE_ERROR_MESSAGES: Record<string, string> = {
  SUBSCRIPTION_REQUIRED:
    "Bạn cần gói người mua để đặt giữ. Đây là gói demo, chưa xử lý thanh toán.",
  LISTING_NOT_AVAILABLE: "Tin này vừa được người khác đặt giữ.",
  CANNOT_RESERVE_OWN_LISTING: "Đây là tin đăng của bạn.",
  QUOTE_OUT_OF_PUBLISHED_RANGE: "Giá phải nằm trong khoảng đã công khai.",
  SCRAP_REQUEST_NOT_QUOTABLE:
    "Yêu cầu này không còn ở trạng thái chờ báo giá.",
  QUOTE_NOT_PENDING: "Báo giá này không còn hiệu lực.",
  MEDIA_NOT_OWNED: "Không tìm thấy dữ liệu.",
  CATEGORY_NOT_FOUND: "Không tìm thấy dữ liệu.",
  SCRAP_REQUEST_NOT_FOUND: "Không tìm thấy dữ liệu.",
  MEDIA_ALREADY_USED: "Ảnh này đã dùng cho một yêu cầu khác. Hãy chọn ảnh khác.",
  CLEANUP_REPORT_NOT_FOUND: "Không tìm thấy dữ liệu báo cáo.",
  CLEANUP_REPORT_NOT_PENDING: "Báo cáo không còn ở trạng thái chờ duyệt.",
};

/** Localize a marketplace ApiError. Falls back to the server message. */
export function marketplaceErrorMessage(error: ParsedApiError): string {
  return (
    MARKETPLACE_ERROR_MESSAGES[error.code] ??
    error.message ??
    "Không thể hoàn tất yêu cầu. Vui lòng thử lại."
  );
}

/** Build a same-origin <img> src from a MediaAssetPublic.downloadPath. */
export function mediaUrl(downloadPath: string): string {
  return `/api${downloadPath}`;
}

/**
 * Call after every authenticated marketplace fetch. A 401 mid-session means
 * the server-side session is gone (expired/revoked) — clear client auth state
 * and send the user back to /dang-nhap instead of leaving a stale UI up.
 */
export function checkAuthExpiry<T>(
  result: ApiResult<T>,
  clearSessionAndRedirect: () => void,
): ApiResult<T> {
  if (!result.ok && result.status === 401) clearSessionAndRedirect();
  return result;
}

const ScrapCategoryArraySchema = ScrapCategorySchema.array();

/** GET /api/scrap-categories — public price bands, no auth required. */
export async function fetchScrapCategories(): Promise<
  ApiResult<{ categories: ScrapCategory[] }>
> {
  const result = await apiFetch<unknown>("/api/scrap-categories");
  if (!result.ok) return result;
  const body = result.data as { categories?: unknown } | null;
  const parsed = ScrapCategoryArraySchema.safeParse(body?.categories);
  if (!parsed.success) return invalidResponse(result.status);
  return { ok: true, data: { categories: parsed.data }, status: result.status };
}

/** POST /api/media/upload — multipart, ONE file field named "file". */
export async function uploadMedia(
  file: File,
): Promise<ApiResult<MediaAssetPublic>> {
  const form = new FormData();
  form.append("file", file);
  const result = await apiFetch<unknown>("/api/media/upload", {
    method: "POST",
    body: form,
  });
  if (!result.ok) return result;
  const parsed = MediaAssetPublicSchema.safeParse(result.data);
  if (!parsed.success) return invalidResponse(result.status);
  return { ok: true, data: parsed.data, status: result.status };
}

/**
 * POST /api/scrap-requests. Response shape beyond ok/error is not part of the
 * frozen contract table, so callers refetch /scrap-requests/mine (strictly
 * validated) to pick up the new row rather than trusting an assumed shape here.
 */
export async function postScrapRequest(
  body: CreateScrapRequest,
): Promise<ApiResult<unknown>> {
  return apiFetch<unknown>("/api/scrap-requests", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** GET /api/scrap-requests/mine — seller's own requests + active quotes. */
export async function fetchMyScrapRequests(): Promise<
  ApiResult<ScrapRequestList>
> {
  const result = await apiFetch<unknown>("/api/scrap-requests/mine");
  if (!result.ok) return result;
  const parsed = ScrapRequestListSchema.safeParse(result.data);
  if (!parsed.success) return invalidResponse(result.status);
  return { ok: true, data: parsed.data, status: result.status };
}

/** POST /api/scrap-requests/:id/accept */
export async function acceptScrapRequestQuote(
  id: string,
): Promise<ApiResult<unknown>> {
  return apiFetch<unknown>(`/api/scrap-requests/${id}/accept`, {
    method: "POST",
  });
}

/** POST /api/scrap-requests/:id/reject */
export async function rejectScrapRequestQuote(
  id: string,
): Promise<ApiResult<unknown>> {
  return apiFetch<unknown>(`/api/scrap-requests/${id}/reject`, {
    method: "POST",
  });
}

/** GET /api/subscriptions/me — buyer reserve eligibility. */
export async function fetchSubscriptionState(): Promise<
  ApiResult<SubscriptionState>
> {
  const result = await apiFetch<unknown>("/api/subscriptions/me");
  if (!result.ok) return result;
  const parsed = SubscriptionStateSchema.safeParse(result.data);
  if (!parsed.success) return invalidResponse(result.status);
  return { ok: true, data: parsed.data, status: result.status };
}

/** GET /api/points/me — reward points balance and ledger entries. */
export async function fetchMyPoints(): Promise<ApiResult<PointsBalance>> {
  const result = await apiFetch<unknown>("/api/points/me");
  if (!result.ok) return result;
  const parsed = PointsBalanceSchema.safeParse(result.data);
  if (!parsed.success) return invalidResponse(result.status);
  return { ok: true, data: parsed.data, status: result.status };
}

/** GET /api/marketplace/listings — public. */
export async function fetchMarketplaceListings(): Promise<
  ApiResult<MarketplaceListingList>
> {
  const result = await apiFetch<unknown>("/api/marketplace/listings");
  if (!result.ok) return result;
  const parsed = MarketplaceListingListSchema.safeParse(result.data);
  if (!parsed.success) return invalidResponse(result.status);
  return { ok: true, data: parsed.data, status: result.status };
}

/** POST /api/marketplace/listings/:id/reserve */
export async function reserveListing(
  id: string,
): Promise<ApiResult<Reservation>> {
  const result = await apiFetch<unknown>(
    `/api/marketplace/listings/${id}/reserve`,
    { method: "POST" },
  );
  if (!result.ok) return result;
  const body = result.data as { reservation?: unknown } | null;
  const parsed = ReservationSchema.safeParse(body?.reservation);
  if (!parsed.success) return invalidResponse(result.status);
  return { ok: true, data: parsed.data, status: result.status };
}

/**
 * GET /api/admin/scrap-requests?status=SUBMITTED — ADMIN only. Reuses
 * ScrapRequestListSchema: the table gives no separate admin-view schema, and
 * every field the admin screen needs (category, weight, media, note) is
 * already on ScrapRequestSchema.
 */
export async function fetchAdminSubmittedScrapRequests(): Promise<
  ApiResult<ScrapRequestList>
> {
  const result = await apiFetch<unknown>(
    "/api/admin/scrap-requests?status=SUBMITTED",
  );
  if (!result.ok) return result;
  const parsed = ScrapRequestListSchema.safeParse(result.data);
  if (!parsed.success) return invalidResponse(result.status);
  return { ok: true, data: parsed.data, status: result.status };
}

/** POST /api/admin/scrap-requests/:id/quote — ADMIN only. */
export async function postAdminQuote(
  id: string,
  body: CreateQuoteRequest,
): Promise<ApiResult<unknown>> {
  return apiFetch<unknown>(`/api/admin/scrap-requests/${id}/quote`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ─── Cleanup reports ─────────────────────────────────────────────────────────

export async function postCleanupReport(
  body: CreateCleanupReport,
): Promise<ApiResult<unknown>> {
  return apiFetch<unknown>("/api/cleanup-reports", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchMyCleanupReports(): Promise<
  ApiResult<CleanupReportList>
> {
  const result = await apiFetch<unknown>("/api/cleanup-reports/mine");
  if (!result.ok) return result;
  const parsed = CleanupReportListSchema.safeParse(result.data);
  if (!parsed.success) return invalidResponse(result.status);
  return { ok: true, data: parsed.data, status: result.status };
}

export async function fetchAdminCleanupReports(): Promise<
  ApiResult<CleanupReportList>
> {
  const result = await apiFetch<unknown>(
    "/api/admin/cleanup-reports?status=SUBMITTED",
  );
  if (!result.ok) return result;
  const parsed = CleanupReportListSchema.safeParse(result.data);
  if (!parsed.success) return invalidResponse(result.status);
  return { ok: true, data: parsed.data, status: result.status };
}

/** Reserved listings only: those are the ones an admin can still complete. */
export async function fetchAdminReservedListings(): Promise<
  ApiResult<MarketplaceListingList>
> {
  const result = await apiFetch<unknown>("/api/admin/listings?status=RESERVED");
  if (!result.ok) return result;
  const parsed = MarketplaceListingListSchema.safeParse(result.data);
  if (!parsed.success) return invalidResponse(result.status);
  return { ok: true, data: parsed.data, status: result.status };
}

export async function completeListing(
  id: string,
): Promise<ApiResult<unknown>> {
  return apiFetch<unknown>(`/api/admin/listings/${id}/complete`, {
    method: "POST",
  });
}

export async function verifyCleanupReport(
  id: string,
): Promise<ApiResult<unknown>> {
  return apiFetch<unknown>(`/api/admin/cleanup-reports/${id}/verify`, {
    method: "POST",
  });
}

export async function rejectCleanupReport(
  id: string,
): Promise<ApiResult<unknown>> {
  return apiFetch<unknown>(`/api/admin/cleanup-reports/${id}/reject`, {
    method: "POST",
  });
}

// ─── Homepage public stats & reports ─────────────────────────────────────────

export async function fetchHomeStats(): Promise<ApiResult<HomeStats>> {
  const result = await apiFetch<unknown>("/api/stats");
  if (!result.ok) return result;
  const parsed = HomeStatsSchema.safeParse(result.data);
  if (!parsed.success) return invalidResponse(result.status);
  return { ok: true, data: parsed.data, status: result.status };
}

export async function fetchPublicCleanupReports(): Promise<
  ApiResult<PublicCleanupReportList>
> {
  const result = await apiFetch<unknown>("/api/cleanup-reports/public");
  if (!result.ok) return result;
  const parsed = PublicCleanupReportListSchema.safeParse(result.data);
  if (!parsed.success) return invalidResponse(result.status);
  return { ok: true, data: parsed.data, status: result.status };
}
