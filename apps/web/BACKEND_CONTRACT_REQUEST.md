# Backend contract request — frontend foundation

**Owner:** Frontend (`apps/web`)
**Status:** Needed before any real browser auth or domain data
**Browser rule:** All client traffic must use same-origin `/api/*` (Next rewrite to Nest). Never hard-code `localhost:3001` or `NEXT_PUBLIC_API_URL` in client components.

---

## 1. Auth endpoints

| Method | Path (same-origin) | Purpose |
|--------|--------------------|---------|
| `POST` | `/api/auth/register` | Create account |
| `POST` | `/api/auth/login` | Establish session |
| `POST` | `/api/auth/logout` | End session |
| `GET` | `/api/auth/me` | Current user (or 401) |

Optional later: password reset, email verify.

---

## 2. Request DTOs (draft — finalize in `@greencity/shared`)

### Login

```ts
{
  email: string;      // email format
  password: string;   // min length per policy
}
```

### Register

```ts
{
  email: string;
  password: string;
  displayName?: string;
}
```

Do **not** accept `role` from the client.

---

## 3. Response DTOs

### Current user (`GET /api/auth/me` 200)

```ts
{
  id: string;
  email: string;
  displayName: string | null;
  roles: Array<"user" | "admin" | "cleanup_partner">;
}
```

### Login / register 200

Same shape as current user, or `{ user: CurrentUser }` — pick one and document.

### Logout 204 / 200

Empty body preferred.

---

## 4. Error codes

Standard body (already sketched in shared):

```ts
{
  error: {
    code: string;
    message: string;
    details?: unknown;
  }
}
```

Suggested auth codes:

| Code | HTTP | When |
|------|------|------|
| `AUTH_INVALID_CREDENTIALS` | 401 | Bad email/password |
| `AUTH_UNAUTHORIZED` | 401 | No/invalid session |
| `AUTH_FORBIDDEN` | 403 | Authenticated but not allowed |
| `AUTH_VALIDATION` | 400 | Zod/input failure |
| `AUTH_EMAIL_TAKEN` | 409 | Register conflict |
| `AUTH_RATE_LIMITED` | 429 | Abuse protection |

---

## 5. Cookie / session behavior

| Concern | Expected |
|---------|----------|
| Cookie name | Document exact name (e.g. `greencity_session`) |
| Flags | `HttpOnly`, `Secure` (prod), `SameSite=Lax` (or `Strict` if viable) |
| Path | `/` |
| Store | Server-side session row (Postgres) |
| Lifetime | Document absolute + idle TTL |
| Rotation | On login; optional on privilege change |

Frontend must **not** read session tokens from JS.

---

## 6. Origin / CSRF

| Concern | Expected |
|---------|----------|
| Same-origin | Browser only talks to `/api/*` on the web origin |
| CSRF | Prefer cookie + `SameSite` + custom header or double-submit for state-changing routes; document chosen pattern |
| CORS | Not required for same-origin rewrite; if CORS is ever enabled, whitelist only the web origin |

---

## 7. Media access contract

| Concern | Expected |
|---------|----------|
| Upload | Presign or multipart via `/api/media/*` — document |
| Read | Authorized URLs only; no public bucket listing |
| DTO | Media id, content type, size, createdAt — **no** raw filesystem paths |

---

## 8. Public location DTO

Public/browsing responses must never include exact coordinates.

```ts
{
  district?: string;
  city?: string;
  // grid / jitter only — never lat/lng exact for unauthorized
  publicLabel?: string;
}
```

Exact location only after authorization gates (reservation, partner assignment, admin).

---

## 9. Frontend non-goals until contracts exist

- No invented auth client
- No mock production endpoints in `apps/web`
- No duplicated Zod schemas in `apps/web` that drift from shared
- Login page remains a visual shell only

When contracts land in `@greencity/shared`, wire forms with those schemas and same-origin fetch only.
