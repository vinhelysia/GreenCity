import {
  ApiErrorSchema,
  type ApiError,
  type PublicUser,
  AuthMeResponseSchema,
  AuthSessionResponseSchema,
} from "@greencity/shared";

export type ParsedApiError = ApiError["error"];

export type ApiResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: ParsedApiError; status: number };

/** Same-origin JSON fetch with credentials. Never pass absolute hosts. */
export async function apiFetch<T>(
  path: `/${string}`,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
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
